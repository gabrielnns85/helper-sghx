// Dublês das APIs chrome.* usadas pela camada de armazenamento (#6).
import { vi } from 'vitest';

/** chrome.storage guarda JSON: a cópia imita isso (perde undefined, funções…). */
const jsonCopy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/**
 * Área do chrome.storage em memória (local ou session), com API de Promise.
 * `failNext('get' | 'set' | 'remove', error)` faz a próxima chamada rejeitar.
 */
export function createFakeArea(initial = {}) {
  let data = jsonCopy(initial);
  const failures = new Map();

  const maybeFail = (method) => {
    if (!failures.has(method)) return;
    const err = failures.get(method);
    failures.delete(method);
    throw err;
  };

  const keysOf = (keys) => {
    if (keys == null) return Object.keys(data);
    return Array.isArray(keys) ? keys : [keys];
  };

  return {
    get: vi.fn(async (keys) => {
      maybeFail('get');
      return Object.fromEntries(keysOf(keys).filter((k) => k in data).map((k) => [k, jsonCopy(data[k])]));
    }),
    set: vi.fn(async (items) => {
      maybeFail('set');
      data = { ...data, ...jsonCopy(items) };
    }),
    remove: vi.fn(async (keys) => {
      maybeFail('remove');
      const drop = new Set(keysOf(keys));
      data = Object.fromEntries(Object.entries(data).filter(([k]) => !drop.has(k)));
    }),
    failNext(method, error = new Error(`falha simulada em ${method}`)) {
      failures.set(method, error);
    },
    /** Conteúdo bruto, para o teste conferir o que foi gravado. */
    dump: () => jsonCopy(data),
  };
}

/** Evento chrome.* (addListener/removeListener) com `emit` para o teste disparar. */
export function createFakeEvent() {
  const listeners = new Set();
  return {
    addListener: vi.fn((fn) => listeners.add(fn)),
    removeListener: vi.fn((fn) => listeners.delete(fn)),
    hasListeners: () => listeners.size > 0,
    emit: (...args) => [...listeners].map((fn) => fn(...args)),
  };
}

export const EXTENSION_ID = 'helper-sghx-test-id';

/** chrome mínimo do service worker: runtime.onMessage, tabs.onRemoved e storage. */
export function createFakeChrome() {
  return {
    runtime: { id: EXTENSION_ID, onMessage: createFakeEvent() },
    tabs: { onRemoved: createFakeEvent() },
    storage: { session: createFakeArea(), local: createFakeArea() },
  };
}

/** Remetente de mensagem como o Chrome entrega ao service worker. `tabId: undefined` = sem aba. */
export function sender(opts = {}) {
  const { url, id = EXTENSION_ID, frameId = 0 } = opts;
  const tabId = 'tabId' in opts ? opts.tabId : 1;
  return { id, url, frameId, tab: tabId === undefined ? undefined : { id: tabId } };
}

export const SGHX_URL = 'https://upajacana.smsprefeiturasp.com.br/sistema/';
export const MOBILEMED_URL = 'https://laudos.mobilemed.com.br/exames';
export const SIRESP_URL = 'https://www.siresp.saude.sp.gov.br/inicio';
export const LISNET_URL = 'https://biomega.lisnet.com.br/laudos/';
