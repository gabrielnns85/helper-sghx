// O que está aberto na página de login do SGHx (skill sghx, MAPA.md §1).
// Modais de tela e pop-ups são todos .lightbox: qualquer um visível além do esperado
// (dois fatores, termo de uso, troca de senha, pop-up de erro…) faz a automação parar.
import { visibleLightboxes } from '../../core/dom/util.js';

export { visibleLightboxes };

/** Botão "entrar" dos modais da página de login: o id se repete em vários modais. */
export const MODAL_SUBMIT = '#modalLoginEntra';

/** Só este modal está aberto (nenhum outro modal nem pop-up por cima ou por baixo). */
export function isOnlyOpenModal(root, selector) {
  const open = visibleLightboxes(root);
  return open.length === 1 && open[0].matches(selector);
}

/** Clica no "entrar" do próprio modal, nunca no de outro modal com o mesmo id. */
export function clickModalSubmit(modal) {
  const button = modal.querySelector(MODAL_SUBMIT);
  if (!button) throw new Error('Botão "entrar" não encontrado no modal');
  button.click();
}
