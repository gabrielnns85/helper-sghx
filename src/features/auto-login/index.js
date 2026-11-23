// Login automático no SGHx (#10). Liga/desliga e modo em settings.autoLogin; a fila
// aberta depois de entrar é a de settings.queueRefresh.queue. A cada carregamento e
// mudança de tela, roda a etapa que casa com o que está aberto; cada etapa tenta uma
// vez só por intervalo (state.js), então não entra em loop.
import { runContextStep } from './context-step.js';
import { runLoginStep } from './login-step.js';
import { runQueueStep } from './queue-step.js';
import { createAutoLoginState } from './state.js';
import { waitForElement } from '../../core/dom/index.js';

const LOG = '[helper-sghx] login automático';
const CONTEXT_MODAL = '#modalLogin';
/**
 * O modal de contexto abre por ajax na própria página de login, e o watchScreen não avisa
 * (continua sendo a tela "login"): a feature mesma espera ele aparecer, por até 10 min
 * (tempo de ler o QR do VIDAAS ou digitar o código de dois fatores), conferindo a cada 1 s.
 */
const CONTEXT_MODAL_WAIT_MS = 10 * 60_000;
const CONTEXT_MODAL_POLL_MS = 1000;

/** Etapas na ordem do fluxo; cada uma devolve 'not-ready' quando a tela não é a dela. */
const STEPS = Object.freeze([
  { id: 'login', run: ({ all, ...rest }) => runLoginStep({ config: all.autoLogin, ...rest }) },
  {
    id: 'context',
    run: ({ all, ...rest }) => runContextStep({ codFces: all.unit.codFces, queue: all.queueRefresh.queue, ...rest }),
  },
  { id: 'queue', run: (rest) => runQueueStep(rest) },
]);

/** Só o nome do erro e a mensagem (que nunca carrega a senha): nada de objetos da página. */
const describeError = (err) => `${err?.name ?? 'Erro'}: ${err?.message ?? String(err)}`;

async function readSettings(settings) {
  try {
    return await settings.get();
  } catch (err) {
    console.warn(`${LOG}: não foi possível ler as configurações`, describeError(err));
    return null;
  }
}

/**
 * @param {{ state?: ReturnType<typeof createAutoLoginState>, root?: ParentNode, timeout?: number }} [opts]
 */
export function createAutoLoginFeature({ state, root = document, timeout } = {}) {
  let running = Promise.resolve();

  async function runOnce(settings) {
    const all = await readSettings(settings);
    if (!all?.autoLogin.enabled) return;
    const loginState = state ?? createAutoLoginState();
    for (const step of STEPS) {
      try {
        const result = await step.run({ all, state: loginState, root, timeout });
        if (result !== 'not-ready') return;
      } catch (err) {
        console.warn(`${LOG}: a etapa "${step.id}" falhou; termine o login manualmente`, describeError(err));
        return;
      }
    }
  }

  /** Uma execução por vez: mudanças de tela no meio de uma etapa esperam a anterior. */
  const schedule = (settings) => {
    running = running.then(() => runOnce(settings));
    return running;
  };

  /** Página de login (tem o modal de contexto, mesmo oculto): roda de novo quando ele abrir. */
  function watchContextModal(settings) {
    if (!root.querySelector(CONTEXT_MODAL)) return;
    waitForElement(CONTEXT_MODAL, { visible: true, root, timeout: CONTEXT_MODAL_WAIT_MS, interval: CONTEXT_MODAL_POLL_MS })
      .then(() => running) // deixa terminar a etapa em andamento antes de reavaliar
      .then(() => schedule(settings))
      .catch(() => {}); // o modal não abriu: nada a fazer
  }

  return {
    id: 'auto-login',
    async init({ settings, screen }) {
      screen.subscribe(() => { schedule(settings); });
      schedule(settings);
      watchContextModal(settings);
    },
    /** Para testes: resolve quando não há etapa em andamento. */
    idle: () => running,
  };
}
