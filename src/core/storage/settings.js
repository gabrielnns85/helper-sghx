import { DEFAULT_SETTINGS } from './defaults.js';
import { createSerialQueue } from './serial.js';
import { validateSetting } from './settings-rules.js';
import { deepFreeze, isStorable, kindOf } from './values.js';

/** Tudo fica numa chave só do chrome.storage.local. */
const STORAGE_KEY = 'settings';

const isObject = (v) => kindOf(v) === 'object';

/**
 * Confere se o valor tem a forma do padrão: mesmo tipo e, em objetos, exatamente
 * as mesmas chaves. Assim nada fora do previsto (ex.: dado de paciente) é salvo.
 */
function assertShape(value, def, path) {
  if (!isStorable(value)) throw new TypeError(`Configuração "${path}": o valor não é JSON`);
  if (kindOf(value) !== kindOf(def)) {
    throw new TypeError(`Configuração "${path}": tipo ${kindOf(value)}, esperado ${kindOf(def)}`);
  }
  if (!isObject(def)) return;
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(def, key)) throw new TypeError(`Configuração "${path}.${key}" desconhecida`);
  }
  for (const key of Object.keys(def)) {
    if (!Object.hasOwn(value, key)) throw new TypeError(`Configuração "${path}.${key}" faltando`);
    assertShape(value[key], def[key], `${path}.${key}`);
  }
}

function assertKnown(defaults, key) {
  if (!Object.hasOwn(defaults, key)) throw new TypeError(`Configuração "${key}" desconhecida`);
}

/** Chave conhecida, forma do padrão e regras de valor (settings-rules.js). */
function assertValid(defaults, validate, key, value) {
  assertKnown(defaults, key);
  assertShape(value, defaults[key], key);
  const errors = validate(key, value);
  if (errors.length > 0) throw new TypeError(errors.map((e) => e.message).join('; '));
}

/**
 * Configurações persistentes do médico, em chrome.storage.local (um perfil do Chrome
 * por médico). Nunca guardar aqui dados de paciente (vão para a sessão) nem senhas de outros sites
 * (vão para o cofre, #64). Exceção temporária: autoLogin.password (#10, ver defaults.js).
 *
 * @param {{
 *   area?: chrome.storage.StorageArea,
 *   defaults?: Readonly<Record<string, unknown>>,
 *   validate?: (key: string, value: unknown) => { path: string, message: string }[],
 *   onChanged?: chrome.storage.StorageChangedEvent | null,
 * }} [opts]
 */
export function createSettings({
  area = globalThis.chrome?.storage?.local,
  defaults = DEFAULT_SETTINGS,
  validate = validateSetting,
  onChanged = globalThis.chrome?.storage?.onChanged,
} = {}) {
  if (!area) throw new Error('Configurações: chrome.storage.local indisponível');
  const serial = createSerialQueue();

  /** Só as entradas salvas válidas; as inválidas são avisadas e ignoradas (vale o padrão). */
  function validSaved(saved) {
    if (!isObject(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter(([key, value]) => {
        try {
          assertValid(defaults, validate, key, value);
          return true;
        } catch (err) {
          console.warn('[helper-sghx] configuração salva ignorada:', err.message);
          return false;
        }
      }),
    );
  }

  async function readSaved() {
    const { [STORAGE_KEY]: saved } = await area.get(STORAGE_KEY);
    return validSaved(saved);
  }

  /** Padrões + salvas válidas, congelado. */
  const merged = (saved) => deepFreeze({ ...defaults, ...saved });

  return {
    /**
     * Todas as configurações (padrões + salvas) ou só uma. Se o chrome.storage
     * falhar, avisa e usa os padrões. Valores congelados.
     * @param {string} [key]
     */
    async get(key) {
      if (key !== undefined) assertKnown(defaults, key);
      let saved;
      try {
        saved = await serial(readSaved);
      } catch (err) {
        console.warn('[helper-sghx] não foi possível ler as configurações; usando os padrões:', err.message);
        saved = {};
      }
      const all = merged(saved);
      return key === undefined ? all : all[key];
    },

    /**
     * Como get(), mas se o chrome.storage falhar lança em vez de usar os padrões.
     * Para quem vai gravar em seguida (página de opções): evita salvar por cima do que existe.
     */
    async load() {
      try {
        return merged(await serial(readSaved));
      } catch (err) {
        throw new Error(`Não foi possível ler as configurações (${err.message})`, { cause: err });
      }
    },

    /**
     * Salva uma ou mais configurações. Cada uma substitui a anterior inteira e precisa
     * ter a forma do padrão. Nada é gravado se alguma for inválida.
     * @param {Record<string, unknown>} partial
     */
    async set(partial) {
      if (!isObject(partial)) throw new TypeError('Configurações: esperado um objeto');
      const keys = Object.keys(partial);
      if (keys.length === 0) throw new TypeError('Configurações: nada para salvar');
      for (const key of keys) assertValid(defaults, validate, key, partial[key]);
      await serial(async () => {
        try {
          const saved = await readSaved();
          await area.set({ [STORAGE_KEY]: { ...saved, ...partial } });
        } catch (err) {
          throw new Error(`Não foi possível salvar as configurações (${err.message})`, { cause: err });
        }
      });
    },

    /** Apaga tudo o que foi salvo: voltam a valer os padrões (inclusive padrões futuros). */
    async reset() {
      await serial(async () => {
        try {
          await area.remove(STORAGE_KEY);
        } catch (err) {
          throw new Error(`Não foi possível restaurar os padrões (${err.message})`, { cause: err });
        }
      });
    },

    /**
     * Avisa `listener(todas)` sempre que as configurações mudarem (página de opções,
     * outra aba), sem recarregar. Recebe padrões + salvas válidas, congelado.
     * @param {(all: Readonly<Record<string, unknown>>) => void} listener
     * @returns {() => void} cancela a inscrição
     */
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Configurações: subscribe espera uma função');
      if (!onChanged) throw new Error('Configurações: chrome.storage.onChanged indisponível');
      const handle = (changes, areaName) => {
        if (areaName !== 'local' || !Object.hasOwn(changes, STORAGE_KEY)) return;
        try {
          listener(merged(validSaved(changes[STORAGE_KEY].newValue)));
        } catch (err) {
          console.error('[helper-sghx] falha ao aplicar a mudança de configuração', err);
        }
      };
      onChanged.addListener(handle);
      return () => onChanged.removeListener(handle);
    },
  };
}
