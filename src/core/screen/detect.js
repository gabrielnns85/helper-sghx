import { isVisible, matchesText, readText } from '../dom/util.js';
import { MODAL_RULES, PAGE_RULES, SCREEN } from './screens.js';

/** Modais de tela e pop-ups são .lightbox; só os pop-ups têm mensagem (ver dom/dialogs.js). */
const LIGHTBOX = '.lightbox';
const DIALOG_MESSAGE = '.bootstrap-dialog-message';
const MODAL_TITLE = '.title3';

/**
 * @typedef {'login' | 'fila' | 'consulta' | 'prescricao' | 'solicitacao-procedimento' | 'atestado' | 'unknown'} ScreenId
 * @typedef {Readonly<{ id: ScreenId, stack: ReadonlyArray<ScreenId> }>} Screen
 */

/** O modal casa com o seletor nele mesmo ou num filho que não está em outro .lightbox aninhado. */
function ownsSelector(modal, selector) {
  if (modal.matches(selector)) return true;
  return [...modal.querySelectorAll(selector)].some((el) => el.closest(LIGHTBOX) === modal);
}

function ownTitle(modal) {
  const title = [...modal.querySelectorAll(MODAL_TITLE)].find((el) => el.closest(LIGHTBOX) === modal);
  return readText(title);
}

function modalScreenId(modal) {
  const rule = MODAL_RULES.find(
    (r) => ownsSelector(modal, r.selector) && (r.title === undefined || matchesText(ownTitle(modal), r.title)),
  );
  return rule?.id ?? SCREEN.UNKNOWN;
}

function pageScreenId(root) {
  const rule = PAGE_RULES.find((r) => [...root.querySelectorAll(r.selector)].some(isVisible));
  return rule?.id;
}

const isScreenModal = (el) => isVisible(el) && !el.querySelector(DIALOG_MESSAGE);

/** Tira repetições seguidas: posologia sobre prescrição continua sendo uma prescrição. */
const collapseRepeats = (ids) => ids.filter((id, i) => id !== ids[i - 1]);

/**
 * Identifica a tela ativa: a do modal de tela visível de cima (ordem do DOM) ou,
 * sem modal, a tela de fundo. Pop-ups não contam. Modal não mapeado no topo
 * dá `unknown`, para nenhuma automação agir na tela que ficou por baixo.
 *
 * @param {{ root?: ParentNode }} [opts]
 * @returns {Screen} objeto congelado; `stack` vai do fundo para o topo
 */
export function detectScreen({ root = document } = {}) {
  const page = pageScreenId(root);
  const modals = [...root.querySelectorAll(LIGHTBOX)].filter(isScreenModal).map(modalScreenId);
  const stack = Object.freeze(collapseRepeats(page ? [page, ...modals] : modals));
  return Object.freeze({ id: stack.at(-1) ?? SCREEN.UNKNOWN, stack });
}

/** Mesma tela = mesma pilha. */
export function sameScreen(a, b) {
  return a.stack.length === b.stack.length && a.stack.every((id, i) => id === b.stack[i]);
}
