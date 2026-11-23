// Quando a atualização da fila NÃO deve rodar: modal aberto ou médico digitando.
import { visibleLightboxes } from '../../core/dom/util.js';

/** Quanto tempo depois da última tecla o médico ainda conta como digitando. */
export const TYPING_GRACE_MS = 5000;

/** input que não recebe texto: foco neles não é digitação. */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file', 'range', 'color']);

/** Foco em campo de texto, textarea ou contenteditable. Select não: fica focado depois de escolhido. */
function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((el.getAttribute('type') ?? 'text').toLowerCase());
  const editable = el.getAttribute?.('contenteditable');
  return editable !== null && editable !== undefined && editable.toLowerCase() !== 'false';
}

/**
 * Observa o teclado (fase de captura) e o foco para dizer se o médico está digitando.
 * @param {{ root?: Document, graceMs?: number }} [opts]
 */
export function createTypingTracker({ root = document, graceMs = TYPING_GRACE_MS } = {}) {
  let lastKeyAt = null;
  const onKey = () => { lastKeyAt = Date.now(); };
  root.addEventListener('keydown', onKey, true);
  return {
    isTyping: () => isEditable(root.activeElement) || (lastKeyAt !== null && Date.now() - lastKeyAt < graceMs),
    stop: () => root.removeEventListener('keydown', onKey, true),
  };
}

/** @returns {'modal' | 'typing' | null} */
export function blockedReason({ root = document, typing }) {
  if (visibleLightboxes(root).length > 0) return 'modal';
  if (typing.isTyping()) return 'typing';
  return null;
}
