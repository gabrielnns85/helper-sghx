// Login automático no SGHx (#10). Liga/desliga e modo em settings.autoLogin; a fila
// aberta depois de entrar é a de settings.queueRefresh.queue. A cada carregamento e
// mudança de tela, roda a etapa que casa com o que está aberto; cada etapa tenta uma
// vez só por intervalo (state.js), então não entra em loop.
import { runContextStep } from './context-step.js';
import { runLoginStep } from './login-step.js';
import { runModuleStep } from './module-step.js';
import { runNavigateStep } from './navigate-step.js';
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
/** Botão Sair do SGHx: <input type="button" class="btn-sair" onclick="logoutArea()">. */
const LOGOUT_BUTTON = '.btn-sair, [onclick^="logoutArea"]';
const PEP_PREFIX = '/sistema/pep';
const LOGIN_FIELD = '#inputUsuario';

/** Etapas na ordem do fluxo; cada uma devolve 'not-ready' quando a tela não é a dela. */
// `entry`: etapas que entram no sistema; pausadas depois do Sair (saída manual).
const STEPS = Object.freeze([
  { id: 'module', entry: true, run: (rest) => runModuleStep(rest) },
  { id: 'login', entry: true, run: ({ all, ...rest }) => runLoginStep({ config: all.autoLogin, ...rest }) },
  {
    id: 'context',
    entry: true,
    run: ({ all, ...rest }) => runContextStep({ codFces: all.unit.codFces, queue: all.queueRefresh.queue, ...rest }),
  },
  { id: 'navigate', run: (rest) => runNavigateStep(rest) },
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
 * @param {{ state?: ReturnType<typeof createAutoLoginState>, root?: ParentNode, timeout?: number,
 *   location?: Pick<Location, 'origin' | 'pathname' | 'assign'> }} [opts]
 */
export function createAutoLoginFeature({ state, root = document, timeout, location = globalThis.location } = {}) {
  let running = Promise.resolve();
  let bridge;
  let toldDisabled = false;
  let toldPaused = false;
  let loginState = state;
  const getState = () => {
    loginState ??= createAutoLoginState();
    return loginState;
  };

  async function runOnce(settings) {
    const all = await readSettings(settings);
    if (!all) return;
    if (!all.autoLogin.enabled) {
      if (!toldDisabled) console.info(`${LOG}: desligado nas opções da extensão`);
      toldDisabled = true;
      return;
    }
    const current = getState();
    const paused = current.isManualLogout();
    for (const step of STEPS) {
      if (paused && step.entry) {
        if (!toldPaused) console.info(`${LOG}: pausado porque você clicou em Sair; entre manualmente para reativar`);
        toldPaused = true;
        continue;
      }
      try {
        const result = await step.run({ all, state: current, root, timeout, bridge, location });
        if (result === 'not-ready') continue;
        // Só o id da etapa e o resultado: nunca usuário, senha nem dado da página.
        console.info(`${LOG}: etapa "${step.id}" → ${result}`);
        return;
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

  /** Clique em Sair (fase de captura: antes do logoutArea() da página) marca a saída manual. */
  function watchLogout() {
    const doc = root.ownerDocument ?? root;
    doc.addEventListener('click', (event) => {
      if (event.target instanceof doc.defaultView.Element && event.target.closest(LOGOUT_BUTTON)) getState().markManualLogout();
    }, true);
  }

  /** Página do PEP carregada já logado: o médico entrou de novo (ou cancelou o Sair). */
  function clearLogoutIfLoggedIn() {
    const inPep = location.pathname.toLowerCase().startsWith(PEP_PREFIX);
    if (inPep && !root.querySelector(LOGIN_FIELD)) getState().clearManualLogout();
  }

  return {
    id: 'auto-login',
    async init({ settings, screen, bridge: pageBridge }) {
      bridge = pageBridge;
      clearLogoutIfLoggedIn();
      watchLogout();
      screen.subscribe(() => { schedule(settings); });
      schedule(settings);
      watchContextModal(settings);
    },
    /** Para testes: resolve quando não há etapa em andamento. */
    idle: () => running,
  };
}
