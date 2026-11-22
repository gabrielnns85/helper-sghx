import { getSite, siteForUrl } from '../sites.js';

/**
 * Protocolo entre os content scripts e o service worker para a sessão do atendimento:
 * { source: 'helper-sghx', kind: 'session', op, key?, value?, expectId? }
 * Resposta: { ok: true, value } | { ok: false, error }.
 */
const SOURCE = 'helper-sghx';
const KIND = 'session';

/** Só o site dono da sessão (SGHx) abre, assume e apaga atendimentos. */
const OWNER_OPS = new Set(['start', 'claim', 'clear']);

/**
 * @param {'start' | 'claim' | 'clear' | 'current' | 'get' | 'set'} op
 * @param {{ key?: string, value?: unknown, expectId?: string }} [args]
 */
export const sessionMessage = (op, args = {}) => ({ source: SOURCE, kind: KIND, op, ...args });

const isSessionMessage = (m) =>
  m !== null && typeof m === 'object' && m.source === SOURCE && m.kind === KIND && typeof m.op === 'string';

const fail = (error) => ({ ok: false, error });

/**
 * Valida o remetente e encaminha ao store. Aceita só content scripts desta extensão,
 * numa aba, em um site da lista (src/core/sites.js). Nunca lança: erros viram ok:false.
 *
 * @param {{ store: ReturnType<typeof import('./session-store.js').createSessionStore>, extensionId: string }} opts
 */
export function createSessionRouter({ store, extensionId }) {
  const OPS = {
    start: ({ tabId }) => store.start(tabId),
    claim: ({ tabId }) => store.claim(tabId),
    clear: ({ tabId }) => store.clear(tabId),
    current: ({ scope }) => store.current(scope),
    get: ({ scope }, msg) => store.get(scope, msg.key),
    set: ({ scope }, msg) => store.set(scope, msg.key, msg.value, { expectId: msg.expectId }),
  };

  function authorize(sender) {
    if (!sender || sender.id !== extensionId) return null;
    const tabId = sender.tab?.id;
    const siteId = siteForUrl(sender.url);
    if (!Number.isInteger(tabId) || !siteId) return null;
    return { site: getSite(siteId), tabId };
  }

  return {
    accepts: isSessionMessage,

    /** @returns {Promise<{ ok: true, value: unknown } | { ok: false, error: string }>} */
    async handle(message, sender) {
      const caller = authorize(sender);
      if (!caller) return fail('Remetente não autorizado');
      if (!isSessionMessage(message) || !Object.hasOwn(OPS, message.op)) {
        return fail('Operação desconhecida na sessão do atendimento');
      }
      if (OWNER_OPS.has(message.op) && !caller.site.ownsSession) {
        return fail(`Não permitido: o site "${caller.site.id}" não controla a sessão do atendimento`);
      }
      // O SGHx lê a própria aba; os outros sites, o atendimento ativo.
      const scope = caller.site.ownsSession ? { tabId: caller.tabId } : { active: true };
      try {
        const value = await OPS[message.op]({ tabId: caller.tabId, scope }, message);
        return { ok: true, value: value ?? null };
      } catch (err) {
        return fail(err instanceof Error ? err.message : 'Erro desconhecido na sessão do atendimento');
      }
    },
  };
}
