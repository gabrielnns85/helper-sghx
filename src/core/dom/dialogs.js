import { DomHelperError } from './errors.js';
import { isVisible, matchesText, normalizeText, readText, sameText } from './util.js';
import { waitFor, waitForGone } from './wait.js';

/**
 * Pop-ups do SGHx. O framework da Fastmedic monta a marcação do BootstrapDialog
 * à mão (não usa BootstrapDialog.show):
 *
 *   div.lightbox > .modal-content.light-content
 *     .modal-header[.erro] .bootstrap-dialog-title
 *     .modal-body .bootstrap-dialog-message
 *     .modal-footer .bootstrap-dialog-footer-buttons .btn-box > a
 *
 * Os modais de tela também são .lightbox, mas sem .bootstrap-dialog-message.
 */
const MESSAGE = '.bootstrap-dialog-message';

/**
 * Mensagens que parecem confirmar uma gravação no prontuário. "sair sem salvar"
 * não conta: é a confirmação de sair, que não grava.
 */
const SAVE_PATTERN = /(?<!sem )\b(salvar|gravar|assinar)\b|\balta\b|\bliberad[oa]\b/;

/**
 * @typedef {{ el: Element, title: string, message: string, isError: boolean,
 *             buttons: { el: HTMLElement, text: string }[] }} Dialog
 */

/** Pop-ups visíveis, em ordem do DOM: o último é o de cima. */
export function getOpenDialogs({ root = document } = {}) {
  const dialogs = [];
  for (const msg of root.querySelectorAll(MESSAGE)) {
    const el = msg.closest('.lightbox') ?? msg.closest('.modal-content') ?? msg.parentElement;
    if (!isVisible(el) || dialogs.some((d) => d.el === el)) continue;
    dialogs.push({
      el,
      title: readText(el.querySelector('.bootstrap-dialog-title')),
      message: readText(msg),
      isError: Boolean(el.querySelector('.modal-header.erro')),
      buttons: [...el.querySelectorAll('.bootstrap-dialog-footer-buttons a, .bootstrap-dialog-footer-buttons button')]
        .filter(isVisible)
        .map((b) => ({ el: b, text: readText(b) })),
    });
  }
  return dialogs;
}

const dialogMatches = (d, text) => text === undefined || matchesText(d.message, text) || matchesText(d.title, text);
const describePattern = (text) => (text instanceof RegExp ? String(text) : `"${text}"`);

/**
 * Espera um pop-up cujo título ou mensagem case com `text` (RegExp, ou string
 * por "contém" sem acentos). Sem `text`, devolve o pop-up de cima.
 * Com `exclude`, ignora os pop-ups desses elementos (usado pelo clickAndWait).
 * @returns {Promise<Dialog>}
 */
export function waitForDialog({ text, timeout, root = document, exclude } = {}) {
  const skip = new Set(exclude ?? []);
  return waitFor(
    () => getOpenDialogs({ root }).filter((d) => !skip.has(d.el) && dialogMatches(d, text)).at(-1),
    {
      timeout,
      root,
      description: text === undefined ? 'pop-up' : `pop-up com o texto ${describePattern(text)}`,
    },
  );
}

/**
 * Confirma um pop-up esperado: acha o pop-up pelo texto, clica no botão pedido e
 * espera o pop-up fechar. `text` e `button` são obrigatórios: não existe botão
 * padrão, para nunca confirmar um pop-up que a automação não previu.
 *
 * Recusa pop-ups que parecem gravar no prontuário (salvar, gravar, assinar,
 * alta, liberado). Use `allowSave: true` só quando o médico já confirmou.
 *
 * @param {{ text: string | RegExp, button: string | RegExp, allowSave?: boolean,
 *           timeout?: number, root?: ParentNode }} opts
 * @returns {Promise<{ title: string, message: string, button: string }>}
 */
export async function confirmDialog({ text, button, allowSave = false, timeout = 5000, root = document } = {}) {
  if (text === undefined || text === null || text === '') {
    throw new TypeError('confirmDialog: informe o texto esperado do pop-up (text)');
  }
  if (button === undefined || button === null || button === '') {
    throw new TypeError('confirmDialog: informe o botão a clicar (button)');
  }

  const dialog = await waitForDialog({ text, timeout, root });
  const found = dialog.buttons.find((b) => (button instanceof RegExp ? matchesText(b.text, button) : sameText(b.text, button)));
  if (!found) {
    throw new DomHelperError(
      `Botão ${describePattern(button)} não existe no pop-up "${dialog.message}". Botões: ${dialog.buttons.map((b) => b.text).join('; ')}`,
    );
  }
  if (!allowSave && SAVE_PATTERN.test(normalizeText(`${dialog.title} ${dialog.message}`))) {
    throw new DomHelperError(
      `confirmDialog recusou: o pop-up "${dialog.message}" parece confirmar uma gravação no prontuário, que só o médico pode confirmar`,
    );
  }

  found.el.click();
  await waitForGone(dialog.el, { timeout, root, description: `pop-up "${dialog.message}" fechar` });
  return { title: dialog.title, message: dialog.message, button: found.text };
}
