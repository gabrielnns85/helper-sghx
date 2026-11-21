import { detectScreen, sameScreen } from './detect.js';

/** Mudanças que podem abrir, fechar ou trocar um modal (inclusive o título via Knockout). */
const OBSERVE = Object.freeze({
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['style', 'class', 'hidden'],
});

const assertFunction = (fn, name) => {
  if (typeof fn !== 'function') throw new TypeError(`watchScreen: ${name} deve ser uma função`);
};

/**
 * Observa a tela ativa e avisa quando ela muda (`{ previous, current }`).
 * Só emite quando a pilha de telas muda; mudanças no DOM dentro da mesma tela não emitem.
 * A falha de um ouvinte é registrada e não impede os outros.
 *
 * @param {{ root?: ParentNode, onChange?: (event: { previous: import('./detect.js').Screen,
 *           current: import('./detect.js').Screen }) => void }} [opts]
 * @returns {{ current(): import('./detect.js').Screen, subscribe(fn: Function): () => void, stop(): void }}
 */
export function watchScreen({ root = document, onChange } = {}) {
  if (onChange !== undefined) assertFunction(onChange, 'onChange');
  const listeners = new Set(onChange ? [onChange] : []);
  let current = detectScreen({ root });

  const notify = (event) => {
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (err) {
        console.error('[helper-sghx] falha em um ouvinte da mudança de tela', err);
      }
    }
  };

  const check = () => {
    const next = detectScreen({ root });
    if (sameScreen(next, current)) return;
    const event = Object.freeze({ previous: current, current: next });
    current = next;
    notify(event);
  };

  const doc = root.ownerDocument ?? root;
  const observer = new doc.defaultView.MutationObserver(check);
  observer.observe(root, OBSERVE);

  return {
    current: () => current,
    subscribe(fn) {
      assertFunction(fn, 'o ouvinte');
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    stop() {
      observer.disconnect();
      listeners.clear();
    },
  };
}
