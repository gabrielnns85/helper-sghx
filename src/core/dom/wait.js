import { TimeoutError } from './errors.js';
import { isVisible } from './util.js';

export const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_INTERVAL = 100;

/**
 * Espera `condition()` (síncrona ou assíncrona) devolver um valor verdadeiro e
 * resolve com ele. Reavalia a cada mudança no DOM (MutationObserver) e, para
 * estados fora do DOM, por polling a cada `interval` ms.
 * Exceções da condição contam como "ainda não"; a última vai na mensagem de timeout.
 *
 * @param {() => any} condition
 * @param {{ timeout?: number, interval?: number, description?: string, root?: Node }} [opts]
 * @returns {Promise<any>}
 * @throws {TimeoutError} quando o tempo acaba
 */
export function waitFor(condition, { timeout = DEFAULT_TIMEOUT, interval = DEFAULT_INTERVAL, description, root } = {}) {
  if (typeof condition !== 'function') throw new TypeError('waitFor: a condição deve ser uma função');
  const what = description || condition.name || 'condição';
  const observed = root ?? globalThis.document;

  return new Promise((resolve, reject) => {
    let done = false;
    let running = false;
    let again = false;
    let lastError;
    let observer;
    let poll;
    let timer;

    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      fn(arg);
    };

    const check = async () => {
      if (done) return;
      if (running) { again = true; return; }
      running = true;
      try {
        do {
          again = false;
          try {
            const value = await condition();
            if (value) { finish(resolve, value); return; }
          } catch (err) {
            lastError = err;
          }
        } while (again && !done);
      } finally {
        running = false;
      }
    };

    timer = setTimeout(() => finish(reject, new TimeoutError(what, timeout, lastError)), timeout);
    poll = setInterval(check, interval);
    const MO = observed?.ownerDocument?.defaultView?.MutationObserver ?? observed?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (observed && MO) {
      observer = new MO(check);
      observer.observe(observed, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    check();
  });
}

const query = (selector, root, visible) => {
  if (!visible) return root.querySelector(selector);
  return [...root.querySelectorAll(selector)].find(isVisible) ?? null;
};

/**
 * Espera um elemento que case com `selector` (e, com `visible`, que esteja visível).
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, { visible = false, root = document, ...opts } = {}) {
  return waitFor(() => query(selector, root, visible), {
    description: `elemento ${visible ? 'visível ' : ''}"${selector}" aparecer`,
    root,
    ...opts,
  });
}

/**
 * Espera o elemento (ou todo elemento que case com o seletor) sair do DOM ou ficar oculto.
 * @param {string | Element} target
 * @returns {Promise<void>}
 */
export async function waitForGone(target, { root = document, ...opts } = {}) {
  const isEl = typeof target !== 'string';
  const label = isEl ? (target.id ? `#${target.id}` : target.tagName.toLowerCase()) : target;
  await waitFor(() => (isEl ? !isVisible(target) : !query(target, root, true)), {
    description: `elemento "${label}" sumir`,
    root,
    ...opts,
  });
}
