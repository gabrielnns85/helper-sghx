// Estado do login automático (#10) no sessionStorage da aba: sobrevive ao vaivém
// SGHx → VIDAAS → SGHx e a recarregamentos, e some ao fechar a aba.
// Guarda só horários e códigos de fila: nunca usuário nem senha.

const PREFIX = 'helper-sghx:auto-login:';
const QUEUE_KEY = `${PREFIX}queue`;

/** Uma tentativa por etapa nesse intervalo: VIDAAS cancelado ou senha errada não viram loop. */
export const ATTEMPT_COOLDOWN_MS = 2 * 60_000;
/** A marca "abrir a fila depois de entrar" vale por esse tempo (inclui ler o QR no app). */
export const QUEUE_PENDING_TTL_MS = 5 * 60_000;

const QUEUE_FIELDS = Object.freeze(['codAcaoDestino', 'codEspecialidade', 'indSituacao']);

/** @typedef {{ codAcaoDestino: number, codEspecialidade: number, indSituacao: number }} QueueCodes */

/** Só os códigos, e só se forem inteiros. */
function queueCodes(value) {
  if (!value || typeof value !== 'object') return null;
  const codes = Object.fromEntries(QUEUE_FIELDS.map((k) => [k, value[k]]));
  return QUEUE_FIELDS.every((k) => Number.isInteger(codes[k])) ? codes : null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {{ storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, now?: () => number }} [opts]
 */
export function createAutoLoginState({ storage = globalThis.sessionStorage, now = Date.now } = {}) {
  /** Ler do storage falhando conta como "não sei": quem chama decide o lado seguro. */
  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return undefined;
    }
  };

  /** Marca válida e dentro do prazo, sem consumir. @returns {QueueCodes | null} */
  const peekQueuePending = () => {
    const saved = parseJson(read(QUEUE_KEY) ?? 'null');
    const codes = queueCodes(saved?.queue);
    if (!codes || !Number.isFinite(saved.at) || now() - saved.at > QUEUE_PENDING_TTL_MS) return null;
    return codes;
  };

  return {
    /**
     * Libera a etapa se ela não foi tentada nos últimos ATTEMPT_COOLDOWN_MS e registra
     * a tentativa. Sem sessionStorage, nunca libera (melhor não entrar do que entrar em loop).
     * @param {string} step
     */
    tryAttempt(step) {
      const key = `${PREFIX}attempt:${step}`;
      const last = read(key);
      if (last === undefined) return false;
      const lastAt = Number(last);
      if (last !== null && Number.isFinite(lastAt) && now() - lastAt < ATTEMPT_COOLDOWN_MS) return false;
      try {
        storage.setItem(key, String(now()));
        return true;
      } catch {
        return false;
      }
    },

    /** @param {QueueCodes} queue */
    markQueuePending(queue) {
      const codes = queueCodes(queue);
      if (!codes) return;
      try {
        storage.setItem(QUEUE_KEY, JSON.stringify({ at: now(), queue: codes }));
      } catch (err) {
        console.warn('[helper-sghx] login automático: não foi possível marcar a fila para abrir', err.message);
      }
    },

    hasQueuePending: () => peekQueuePending() !== null,

    /** Entrega a marca uma vez e apaga. @returns {QueueCodes | null} */
    takeQueuePending() {
      const codes = peekQueuePending();
      try {
        storage.removeItem(QUEUE_KEY);
      } catch {
        // Sem storage não há marca para apagar.
      }
      return codes;
    },
  };
}
