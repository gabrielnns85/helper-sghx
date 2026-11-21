import { DomHelperError, TimeoutError } from './errors.js';
import { getOpenDialogs, waitForDialog } from './dialogs.js';
import { resolveElement } from './util.js';
import { waitFor, waitForElement, waitForGone } from './wait.js';

/**
 * Clica (um clique nativo, que os handlers jQuery/Knockout da página recebem) e
 * espera o resultado. `until` pode ser:
 * - seletor CSS: espera o elemento aparecer visível e resolve com ele;
 * - função: espera ela devolver algo verdadeiro (ver waitFor);
 * - `{ dialog: texto | RegExp }`: espera um pop-up NOVO (aberto depois do clique);
 * - `{ gone: seletor }`: espera o elemento sumir.
 *
 * Não use para Salvar: a confirmação de gravação é do médico.
 *
 * @returns {Promise<any>} o resultado da espera
 */
export async function clickAndWait(target, until, { timeout, root = document } = {}) {
  const wait = buildWait(until, { timeout, root });
  const { el, label } = resolveElement(target, { root });
  if (isDisabled(el)) {
    throw new DomHelperError(`"${label}" está desabilitado; o clique não foi feito`);
  }

  const before = getOpenDialogs({ root }).map((d) => d.el);
  el.click();
  try {
    return await wait(before);
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new TimeoutError(`${err.description}, após clicar em "${label}"`, err.timeout, err.lastError);
    }
    throw err;
  }
}

/**
 * `disabled`/`aria-disabled`, e o jeito do SGHx: `$.fn.desabilita` marca
 * `data-disabled="true"` e, em links/spans, a classe `-disabled` (e tira os handlers).
 */
function isDisabled(el) {
  return Boolean(el.disabled)
    || el.getAttribute('aria-disabled') === 'true'
    || el.getAttribute('data-disabled') === 'true'
    || el.classList.contains('-disabled');
}

function buildWait(until, opts) {
  if (typeof until === 'string') return () => waitForElement(until, { visible: true, ...opts });
  if (typeof until === 'function') return () => waitFor(until, opts);
  if (until && typeof until === 'object') {
    if ('dialog' in until) return (before) => waitForDialog({ text: until.dialog, exclude: before, ...opts });
    if (typeof until.gone === 'string') return () => waitForGone(until.gone, opts);
  }
  throw new TypeError('clickAndWait: "until" deve ser seletor, função, { dialog } ou { gone }');
}
