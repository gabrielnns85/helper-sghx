import { sessionMessage } from './session-router.js';
import { deepFreeze } from './values.js';

const CONTEXT = 'Sessão do atendimento';

const isReply = (r) =>
  r !== null && typeof r === 'object' && ((r.ok === true && 'value' in r) || (r.ok === false && typeof r.error === 'string'));

/**
 * Sessão do atendimento vista de um content script (SGHx ou outro site). Os dados
 * ficam no service worker; aqui só passam mensagens. No SGHx, get/set agem no
 * atendimento da própria aba; nos outros sites, no atendimento ativo, e
 * `current()` é null quando não há atendimento (a funcionalidade roda isolada).
 *
 * @param {{ runtime?: { sendMessage(msg: object): Promise<unknown> } }} [opts]
 */
export function createSessionClient({ runtime = globalThis.chrome?.runtime } = {}) {
  async function call(op, args) {
    let reply;
    try {
      reply = await runtime.sendMessage(sessionMessage(op, args));
    } catch (err) {
      throw new Error(`${CONTEXT} indisponível (${err.message})`, { cause: err });
    }
    if (!isReply(reply)) throw new Error(`${CONTEXT}: resposta inválida do service worker`);
    if (!reply.ok) throw new Error(reply.error);
    return deepFreeze(reply.value);
  }

  return {
    /** Só o SGHx: abre um atendimento novo nesta aba. @returns {Promise<{ id: string }>} */
    start: () => call('start'),
    /** Só o SGHx: esta aba passa a ser o atendimento ativo. */
    claim: () => call('claim'),
    /** Só o SGHx: apaga o atendimento desta aba. */
    clear: async () => {
      await call('clear');
    },
    /** @returns {Promise<{ id: string } | null>} */
    current: () => call('current'),
    /** @param {string} key @returns {Promise<unknown>} valor congelado, ou null */
    get: (key) => call('get', { key }),
    /**
     * @param {string} key
     * @param {unknown} value JSON puro
     * @param {{ expectId?: string }} [opts] recusa se o atendimento já não for este
     */
    set: async (key, value, { expectId } = {}) => {
      await call('set', expectId === undefined ? { key, value } : { key, value, expectId });
    },
  };
}
