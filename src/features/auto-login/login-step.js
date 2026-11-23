// Etapa 1 do login automático (#10): tela de login → Login Nuvem (VIDAAS) ou usuário e senha.
// Skill sghx, MAPA.md §1 (passos 2 e 2a). A senha nunca vai para mensagem de erro nem
// para a ponte (mundo MAIN): é gravada aqui, no mundo isolado.
import { setFieldValue, waitForElement } from '../../core/dom/index.js';
import { isVisible, sameText } from '../../core/dom/util.js';
import { visibleLightboxes } from './page.js';

const USER_FIELD = '#inputUsuario';
const PASSWORD_FIELD = '#inputSenha';
const CLOUD_BUTTON = '#loginCertificadoNuvem';
const PROVIDER_MODAL = '#modalProvedorCertificado';
const PROVIDER_SELECT = '#comboProvedor';
const PROVIDER = 'VIDAAS';

/** Tela de login limpa: formulário visível e nenhum modal nem pop-up aberto. */
export function isLoginFormReady(root = document) {
  const user = root.querySelector(USER_FIELD);
  return isVisible(user) && visibleLightboxes(root).length === 0;
}

/**
 * O "entrar" do provedor é um link javascript:, que a CSP da extensão bloqueia quando o
 * clique sai do mundo isolado: quem clica é a ponte, no mundo da página.
 */
async function submitProvider(bridge) {
  if (!bridge || typeof bridge.request !== 'function') {
    throw new Error('Login Nuvem precisa da ponte com a página para clicar em entrar');
  }
  try {
    await bridge.request('submitCloudProvider');
  } catch (err) {
    throw new Error(`Não foi possível clicar no entrar do Certificado em Nuvem (${err?.message ?? err})`);
  }
}

async function loginWithCloud({ root, timeout, bridge }) {
  root.querySelector(CLOUD_BUTTON)?.click();
  const modal = await waitForElement(PROVIDER_MODAL, { visible: true, root, timeout });
  await setFieldValue(modal.querySelector(PROVIDER_SELECT), PROVIDER, { root });
  await submitProvider(bridge);
}

/** "Entrar" do formulário de login (sem id no SGHx), fora dos modais. */
function findSubmit(root) {
  const candidates = [...root.querySelectorAll('a, button, input[type="submit"]')]
    .filter((el) => !el.closest('.lightbox') && isVisible(el));
  const submit = candidates.find((el) => sameText(el.textContent || el.value, 'Entrar'));
  if (!submit) throw new Error('Botão "Entrar" da tela de login não encontrado');
  return submit;
}

/** Grava sem a releitura do helper, cuja mensagem de erro repetiria o valor (usuário ou senha). */
async function fillPrivate(selector, value, root, label) {
  const field = root.querySelector(selector);
  if (!field) throw new Error(`Campo de ${label} não encontrado na tela de login`);
  try {
    await setFieldValue(field, value, { root, verify: false });
  } catch (err) {
    throw new Error(`Não foi possível preencher o campo de ${label} (${err.name})`);
  }
  if (field.value !== value) throw new Error(`O ${label} não ficou no campo da tela de login`);
}

/**
 * A senha só vai para o endereço exato do SGHx da unidade (não para qualquer subdomínio
 * do domínio da prefeitura) e para um formulário que envia para a mesma origem.
 */
function assertTrustedLoginPage({ allowedHost, location, root }) {
  if (!allowedHost || location.hostname !== allowedHost) {
    throw new Error('O endereço desta página não é o do SGHx da unidade; não preenchi usuário nem senha');
  }
  const form = root.querySelector(PASSWORD_FIELD)?.form;
  const action = form?.getAttribute('action');
  if (action && new URL(form.action).origin !== location.origin) {
    throw new Error('O formulário de login envia para outro endereço; não preenchi usuário nem senha');
  }
}

async function loginWithPassword({ user, password, root }) {
  await fillPrivate(USER_FIELD, user, root, 'usuário');
  await fillPrivate(PASSWORD_FIELD, password, root, 'senha');
  findSubmit(root).click();
}

/**
 * @param {{ config: { mode: string, user: string, password: string }, allowedHost?: string,
 *   state: { tryAttempt(step: string): boolean, hasLoginSubmitted(): boolean, markLoginSubmitted(): void },
 *   bridge?: { request(type: string, payload?: object): Promise<any> },
 *   root?: ParentNode, timeout?: number, location?: Pick<Location, 'hostname' | 'origin'> }} opts
 * @returns {Promise<'not-ready' | 'already-submitted' | 'cooldown' | 'submitted'>}
 */
export async function runLoginStep({ config, allowedHost, state, bridge, root = document, timeout, location = globalThis.location }) {
  if (!isLoginFormReady(root)) return 'not-ready';
  // A tela de login voltou depois de um envio (senha errada, VIDAAS cancelado): repetir pode bloquear a conta.
  if (state.hasLoginSubmitted()) return 'already-submitted';
  if (config.mode === 'password') assertTrustedLoginPage({ allowedHost, location, root });
  if (!state.tryAttempt('login')) return 'cooldown';
  if (config.mode === 'password') {
    await loginWithPassword({ user: config.user, password: config.password, root });
  } else {
    await loginWithCloud({ root, timeout, bridge });
  }
  state.markLoginSubmitted();
  return 'submitted';
}
