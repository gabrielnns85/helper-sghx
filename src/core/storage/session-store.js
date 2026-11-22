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
    /** Abre um atendimento novo na aba (descarta o anterior dela) e o torna o ativo. */
    start(tabId) {
      assertTabId(tabId);
      return serial(async () => {
        const state = await read();
        const entry = { id: newId(), data: {} };
        await write({ activeTabId: tabId, byTab: { ...state.byTab, [tabId]: entry } });
        return summary(entry);
      });
    },

    /** Torna ativo o atendimento da aba; aba sem atendimento não muda nada (null). */
    claim(tabId) {
      assertTabId(tabId);
      return serial(async () => {
        const state = await read();
        const entry = state.byTab[tabId];
        if (!entry) return null;
        if (state.activeTabId !== tabId) await write({ ...state, activeTabId: tabId });
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

    /** @param {Scope} scope @param {string} key valor congelado, ou undefined */
    async get(scope, key) {
      assertKey(key, CONTEXT);
      return serial(async () => deepFreeze(entryOf(await read(), scope)?.data[key]));
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
      return serial(async () => {
        const state = await read();
        const entry = entryOf(state, scope);
        if (!entry) throw new Error(`${CONTEXT}: sem atendimento ativo`);
        if (expectId !== undefined && expectId !== entry.id) {
          throw new Error(`${CONTEXT}: o atendimento mudou; nada foi gravado`);
        }
        const updated = { ...entry, data: { ...entry.data, [key]: value } };
        await write({ ...state, byTab: { ...state.byTab, [tabOf(state, scope)]: updated } });
      });
    },
  };
}
