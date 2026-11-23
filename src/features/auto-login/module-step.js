// Etapa 0 do login automático (#10): tela de Módulos (/sistema/) → "Módulo Atendimento".
// Conferido no SGHx em 22/11/2026: cada módulo é um div.card-modulo-sghx com clique por
// Knockout (AbrirLink), que leva a /sistema/Login?ReturnUrl=/sistema/pep.
import { isVisible, readText, sameText } from '../../core/dom/util.js';
import { visibleLightboxes } from './page.js';

const MODULE_CARD = '.card-modulo-sghx';
const MODULE_NAME = '.nome-modulo';
const ATENDIMENTO = 'Módulo Atendimento';

/** Pelo nome, não pelo id: outro módulo nunca é clicado. */
const findAtendimento = (root) =>
  [...root.querySelectorAll(MODULE_CARD)].find((card) => isVisible(card) && sameText(readText(card.querySelector(MODULE_NAME)), ATENDIMENTO)) ?? null;

/**
 * Só no fluxo de entrada: depois de logado na aba, voltar aos Módulos é escolha do médico.
 * @param {{ state: { tryAttempt(step: string): boolean, hasEntered(): boolean }, root?: ParentNode }} opts
 * @returns {Promise<'not-ready' | 'cooldown' | 'submitted'>}
 */
export async function runModuleStep({ state, root = document }) {
  if (state.hasEntered() || visibleLightboxes(root).length > 0) return 'not-ready';
  const card = findAtendimento(root);
  if (!card) return 'not-ready';
  if (!state.tryAttempt('module')) return 'cooldown';
  card.click();
  return 'submitted';
}
