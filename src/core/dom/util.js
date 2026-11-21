import { ElementNotFoundError } from './errors.js';

/** Minúsculas, sem acentos e com espaços colapsados, para comparar textos da tela. */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** RegExp testa o texto; string compara por "contém", sem acentos nem maiúsculas. */
export function matchesText(text, pattern) {
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }
  return normalizeText(text).includes(normalizeText(pattern));
}

/** Igualdade de textos sem acentos nem maiúsculas. */
export function sameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

/** Rótulo curto para mensagens de erro: `#id`, `tag[name="x"]` ou `tag.classe`. */
export function describeElement(el) {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${name}"]`;
  const cls = [...el.classList].slice(0, 2).join('.');
  return cls ? `${tag}.${cls}` : tag;
}

/** Aceita seletor ou elemento. Devolve `{ el, label }` ou lança ElementNotFoundError. */
export function resolveElement(target, { root = document } = {}) {
  if (typeof target === 'string') {
    const el = root.querySelector(target);
    if (!el) throw new ElementNotFoundError(target);
    return { el, label: target };
  }
  if (target && target.nodeType === 1) return { el: target, label: describeElement(target) };
  throw new TypeError('Alvo deve ser um seletor CSS ou um elemento');
}

/**
 * Visível = conectado ao documento e sem ancestral com display:none, nem
 * visibility:hidden. Não depende de layout, então funciona igual no jsdom.
 */
export function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const view = el.ownerDocument.defaultView;
  if (view.getComputedStyle(el).visibility === 'hidden') return false;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hidden || view.getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

/** Texto do nó com `<br>` virando quebra de linha e espaços colapsados por linha. */
export function readText(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  for (const br of clone.querySelectorAll('br')) br.replaceWith('\n');
  return clone.textContent
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
