import { createSerialQueue } from './serial.js';
import { assertKey, assertStorable, deepFreeze } from './values.js';

/**
 * Sessão do atendimento, mantida pelo service worker em chrome.storage.session
 * (memória do navegador: nunca vai para o disco e some ao fechar o navegador).
 *
 * Cada aba do SGHx em consulta tem o próprio atendimento; o "ativo" é o da aba do
 * SGHx usada por último, e é ele que os outros sites (imagens, laboratório, SIRESP)
 * enxergam. Guardar por aba evita que um site externo use o paciente de outra aba.
 *
 * Estado gravado: { activeTabId: number | null, byTab: { [tabId]: { id, data } } }
 */
const STATE_KEY = 'atendimentos';
const EMPTY_STATE = Object.freeze({ activeTabId: null, byTab: Object.freeze({}) });
const CONTEXT = 'Sessão do atendimento';
/** Limite por valor (em caracteres de JSON): a cota do storage.session é da extensão inteira. */
const MAX_VALUE_CHARS = 1_000_000;

/**
 * @typedef {{ tabId: number } | { active: true }} Scope
 *   aba do SGHx (lê o próprio atendimento) ou o atendimento ativo (outros sites)
 * @typedef {Readonly<{ id: string }>} Atendimento
 */

const isState = (s) => s !== null && typeof s === 'object' && s.byTab !== null && typeof s.byTab === 'object';

function assertTabId(tabId) {
  if (!Number.isInteger(tabId)) throw new TypeError(`${CONTEXT}: aba inválida`);
}

const tabOf = (state, scope) => (scope.active ? state.activeTabId : scope.tabId);
const entryOf = (state, scope) => {
  const tabId = tabOf(state, scope);
  return tabId == null ? null : (state.byTab[tabId] ?? null);
};
const summary = (entry) => (entry ? Object.freeze({ id: entry.id }) : null);

/** Recusa quando não há atendimento ou quando ele não é mais o esperado (`expectId`). */
function assertExpected(entry, expectId) {
  if (!entry) throw new Error(`${CONTEXT}: sem atendimento ativo`);
  if (expectId !== undefined && expectId !== entry.id) {
    throw new Error(`${CONTEXT}: o atendimento mudou; nada foi lido nem gravado`);
  }
}

function assertSize(value) {
  if (JSON.stringify(value).length > MAX_VALUE_CHARS) {
    throw new RangeError(`${CONTEXT}: valor grande demais (máx. ${MAX_VALUE_CHARS} caracteres)`);
  }
}

function withoutTab(state, tabId) {
  const byTab = Object.fromEntries(Object.entries(state.byTab).filter(([tab]) => tab !== String(tabId)));
  return { activeTabId: state.activeTabId === tabId ? null : state.activeTabId, byTab };
}

/**
 * @param {{ area: chrome.storage.StorageArea, newId?: () => string }} opts
 *   `area` deve ser o chrome.storage.session.
 */
export function createSessionStore({ area, newId = () => crypto.randomUUID() }) {
  const serial = createSerialQueue();

  async function read() {
    try {
      const { [STATE_KEY]: state } = await area.get(STATE_KEY);
      return isState(state) ? state : EMPTY_STATE;
    } catch (err) {
      throw new Error(`${CONTEXT}: não foi possível ler (${err.message})`, { cause: err });
    }
  }

  async function write(state) {
    try {
      await area.set({ [STATE_KEY]: state });
    } catch (err) {
      throw new Error(`${CONTEXT}: não foi possível gravar (${err.message})`, { cause: err });
    }
  }

  return {
    /**
     * Abre um atendimento novo na aba (descarta o anterior dela). Com `activate`
     * (padrão), ele vira o ativo; aba sem foco passa `false` para não roubar o ativo.
     */
    start(tabId, { activate = true } = {}) {
      assertTabId(tabId);
      return serial(async () => {
        const state = await read();
        const entry = { id: newId(), data: {} };
        const activeTabId = activate ? tabId : state.activeTabId;
        await write({ activeTabId, byTab: { ...state.byTab, [tabId]: entry } });
        return summary(entry);
      });
    },

    /**
     * A aba do SGHx entrou em uso: o atendimento dela vira o ativo. Aba sem
     * atendimento (ex.: na fila) deixa o navegador sem ativo e devolve null.
     */
    claim(tabId) {
      assertTabId(tabId);
      return serial(async () => {
        const state = await read();
        const entry = state.byTab[tabId] ?? null;
        const activeTabId = entry ? tabId : null;
        if (state.activeTabId !== activeTabId) await write({ ...state, activeTabId });
        return summary(entry);
      });
    },

    /** Apaga o atendimento da aba (voltou à fila, logout, aba fechada). */
    clear(tabId) {
      assertTabId(tabId);
      return serial(async () => {
        const state = await read();
        if (!(tabId in state.byTab) && state.activeTabId !== tabId) return;
        await write(withoutTab(state, tabId));
      });
    },

    /** @param {Scope} scope @returns {Promise<Atendimento | null>} */
    current(scope) {
      return serial(async () => summary(entryOf(await read(), scope)));
    },

    /**
     * @param {Scope} scope
     * @param {string} key
     * @param {{ expectId?: string }} [opts] recusa se o atendimento não for mais este
     * @returns {Promise<unknown>} valor congelado, ou undefined
     */
    async get(scope, key, { expectId } = {}) {
      assertKey(key, CONTEXT);
      return serial(async () => {
        const entry = entryOf(await read(), scope);
        if (expectId !== undefined) assertExpected(entry, expectId);
        return deepFreeze(entry && Object.hasOwn(entry.data, key) ? entry.data[key] : undefined);
      });
    },

    /**
     * @param {Scope} scope
     * @param {string} key
     * @param {unknown} value JSON puro
     * @param {{ expectId?: string }} [opts] recusa se o atendimento não for mais este
     */
    async set(scope, key, value, { expectId } = {}) {
      assertKey(key, CONTEXT);
      assertStorable(value, CONTEXT);
      assertSize(value);
      return serial(async () => {
        const state = await read();
        const entry = entryOf(state, scope);
        assertExpected(entry, expectId);
        const updated = { ...entry, data: { ...entry.data, [key]: value } };
        await write({ ...state, byTab: { ...state.byTab, [tabOf(state, scope)]: updated } });
      });
    },
  };
}
