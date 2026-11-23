// Estado do login automático (#10) no sessionStorage da aba: sobrevive ao vaivém
// SGHx → VIDAAS → SGHx e a recarregamentos, e some ao fechar a aba.
// Guarda só horários e códigos de fila: nunca usuário nem senha.

const PREFIX = 'helper-sghx:auto-login:';
const QUEUE_KEY = `${PREFIX}queue`;
const MANUAL_LOGOUT_KEY = `${PREFIX}manual-logout`;
const ENTERED_KEY = `${PREFIX}entered`;
const LOGIN_SUBMITTED_KEY = `${PREFIX}login-submitted`;

/** Uma tentativa por etapa nesse intervalo: VIDAAS cancelado ou senha errada não viram loop. */
export const ATTEMPT_COOLDOWN_MS = 2 * 60_000;
/** A marca "abrir a fila depois de entrar" vale por esse tempo (QR no app, escolher a ocupação…). */
export const QUEUE_PENDING_TTL_MS = 15 * 60_000;

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

  const setFlag = (key, label) => {
    try {
      storage.setItem(key, String(now()));
    } catch (err) {
      console.warn(`[helper-sghx] login automático: não foi possível marcar "${label}"`, err.message);
    }
  };
  const removeKey = (key) => {
    try {
      storage.removeItem(key);
    } catch {
      // Sem storage não há marca para apagar.
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

    /** O médico clicou em Sair: nesta aba, nada de entrar sozinho até ele entrar de novo. */
    markManualLogout() {
      setFlag(MANUAL_LOGOUT_KEY, 'saída manual');
      removeKey(QUEUE_KEY); // sair e entrar à mão não deve levar à fila sozinho
    },

    isManualLogout: () => typeof read(MANUAL_LOGOUT_KEY) === 'string',

    clearManualLogout: () => removeKey(MANUAL_LOGOUT_KEY),

    /** Já houve sessão logada nesta aba: a tela de Módulos não é mais "entrada". */
    markEntered() {
      setFlag(ENTERED_KEY, 'já entrou');
      removeKey(LOGIN_SUBMITTED_KEY);
    },
    hasEntered: () => typeof read(ENTERED_KEY) === 'string',

    /** Login enviado: se a tela de login voltar (senha errada, VIDAAS cancelado), não repete sozinho. */
    markLoginSubmitted: () => setFlag(LOGIN_SUBMITTED_KEY, 'login enviado'),
    hasLoginSubmitted: () => typeof read(LOGIN_SUBMITTED_KEY) === 'string',

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
