// Etapa 1 do login automático (#10): tela de login → Login Nuvem (VIDAAS) ou usuário e senha.
// Skill sghx, MAPA.md §1 (passos 2 e 2a). A senha nunca vai para mensagem de erro nem
// para a ponte (mundo MAIN): é gravada aqui, no mundo isolado.
import { setFieldValue, waitForElement } from '../../core/dom/index.js';
import { isVisible, sameText } from '../../core/dom/util.js';
import { clickModalSubmit, visibleLightboxes } from './page.js';

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

async function loginWithCloud({ root, timeout }) {
  root.querySelector(CLOUD_BUTTON)?.click();
  const modal = await waitForElement(PROVIDER_MODAL, { visible: true, root, timeout });
  await setFieldValue(modal.querySelector(PROVIDER_SELECT), PROVIDER, { root });
  clickModalSubmit(modal);
}

/** "Entrar" do formulário de login (sem id no SGHx), fora dos modais. */
function findSubmit(root) {
  const candidates = [...root.querySelectorAll('a, button, input[type="submit"]')]
    .filter((el) => !el.closest('.lightbox') && isVisible(el));
  const submit = candidates.find((el) => sameText(el.textContent || el.value, 'Entrar'));
  if (!submit) throw new Error('Botão "Entrar" da tela de login não encontrado');
  return submit;
}

/** Grava sem a releitura do helper, cuja mensagem de erro repetiria o valor (a senha). */
async function fillSecret(selector, value, root) {
  const field = root.querySelector(selector);
  try {
    await setFieldValue(field ?? selector, value, { root, verify: false });
  } catch (err) {
    throw new Error(`Não foi possível preencher a senha (${err.name})`);
  }
  if (field.value !== value) throw new Error('A senha não ficou no campo da tela de login');
}

async function loginWithPassword({ user, password, root }) {
  await setFieldValue(USER_FIELD, user, { root });
  await fillSecret(PASSWORD_FIELD, password, root);
  findSubmit(root).click();
}

/**
 * @param {{ config: { mode: string, user: string, password: string },
 *   state: { tryAttempt(step: string): boolean }, root?: ParentNode, timeout?: number }} opts
 * @returns {Promise<'not-ready' | 'cooldown' | 'submitted'>}
 */
export async function runLoginStep({ config, state, root = document, timeout }) {
  if (!isLoginFormReady(root)) return 'not-ready';
  if (!state.tryAttempt('login')) return 'cooldown';
  if (config.mode === 'password') {
    await loginWithPassword({ user: config.user, password: config.password, root });
  } else {
    await loginWithCloud({ root, timeout });
  }
  return 'submitted';
}
