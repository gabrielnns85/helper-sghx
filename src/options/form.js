// Conversão entre o formulário da página de opções e as configurações (#8).
// Sem DOM e sem chrome.*: a página (page.js) lê os campos e mostra os erros.
// Só códigos vão para as configurações; nomes (unidade, fila) vêm do catálogo.
import { KNOWN_QUEUES, NO_QUEUE, findUnit, queueKey } from '../core/catalog.js';
import { validateSetting } from '../core/storage/settings-rules.js';

/**
 * @typedef {{
 *   autoLoginEnabled: boolean, queueRefreshEnabled: boolean,
 *   intervalSec: string, queue: string, unitName: string, codFces: string,
 * }} FormValues
 */

const PLACEHOLDER = Object.freeze({ value: '', label: 'Escolha a fila' });

/** Opções do select de fila: "Escolha a fila" e as filas do catálogo. */
export function queueOptions() {
  return [PLACEHOLDER, ...KNOWN_QUEUES.map((q) => ({ value: queueKey(q), label: q.label }))];
}

/** @returns {FormValues} */
export function settingsToForm(settings) {
  return {
    autoLoginEnabled: settings.autoLogin.enabled,
    queueRefreshEnabled: settings.queueRefresh.enabled,
    intervalSec: String(settings.queueRefresh.intervalSec),
    queue: queueKey(settings.queueRefresh.queue),
    unitName: findUnit(settings.unit.codFces)?.name ?? '',
    codFces: String(settings.unit.codFces),
  };
}

/** Texto do campo em número; vazio vira NaN para a regra recusar. */
const toNumber = (text) => {
  const trimmed = String(text).trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
};

/** Chave do select → só os códigos da fila (sem o nome). null = não está na lista. */
function queueFromKey(key) {
  if (key === '') return { ...NO_QUEUE };
  const found = KNOWN_QUEUES.find((q) => queueKey(q) === key);
  if (!found) return null;
  const { codAcaoDestino, codEspecialidade, indSituacao } = found;
  return { codAcaoDestino, codEspecialidade, indSituacao };
}

/**
 * Valores do formulário → configurações prontas para settings.set, ou os erros por campo.
 * O nome da unidade na tela é só leitura e não é gravado.
 * @param {FormValues} values
 * @returns {{ settings: Record<string, unknown> | null, errors: { path: string, message: string }[] }}
 */
export function formToSettings(values) {
  const queue = queueFromKey(values.queue);
  const queueErrors = queue ? [] : [{ path: 'queueRefresh.queue', message: 'Fila não reconhecida: escolha uma fila da lista' }];
  const candidate = {
    unit: { codFces: toNumber(values.codFces) },
    autoLogin: { enabled: Boolean(values.autoLoginEnabled) },
    queueRefresh: {
      enabled: Boolean(values.queueRefreshEnabled),
      intervalSec: toNumber(values.intervalSec),
      // Fila fora da lista: o erro acima já barra; NO_QUEUE só mantém a forma para as outras regras.
      queue: queue ?? { ...NO_QUEUE },
    },
  };
  const ruleErrors = Object.entries(candidate).flatMap(([key, value]) => validateSetting(key, value));
  const errors = queue ? ruleErrors : [...queueErrors, ...ruleErrors.filter((e) => e.path !== 'queueRefresh.queue')];
  return errors.length > 0 ? { settings: null, errors } : { settings: candidate, errors: [] };
}

const FIELD_BY_PATH = Object.freeze({
  'unit.codFces': 'codFces',
  'queueRefresh.intervalSec': 'intervalSec',
  'queueRefresh.queue': 'queue',
});

/** Campo do formulário onde mostrar o erro de `path` (null = só no status). */
export function fieldForPath(path) {
  return FIELD_BY_PATH[path] ?? null;
}
