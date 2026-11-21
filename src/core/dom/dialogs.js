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

function findButton(dialog, button) {
  const found = dialog.buttons.find((b) => (button instanceof RegExp ? matchesText(b.text, button) : sameText(b.text, button)));
  if (!found) {
    throw new DomHelperError(
      `Botão ${describePattern(button)} não existe no pop-up "${dialog.message}". Botões: ${dialog.buttons.map((b) => b.text).join('; ')}`,
    );
  }
  return found;
}

function assertNotSave(dialog, caller) {
  if (SAVE_PATTERN.test(normalizeText(`${dialog.title} ${dialog.message}`))) {
    throw new DomHelperError(
      `${caller} recusou: o pop-up "${dialog.message}" parece confirmar uma gravação no prontuário, que só o médico pode confirmar`,
    );
  }
}

const isBlank = (v) => v === undefined || v === null || v === '';

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
  if (isBlank(text)) throw new TypeError('confirmDialog: informe o texto esperado do pop-up (text)');
  if (isBlank(button)) throw new TypeError('confirmDialog: informe o botão a clicar (button)');

  const dialog = await waitForDialog({ text, timeout, root });
  const found = findButton(dialog, button);
  if (!allowSave) assertNotSave(dialog, 'confirmDialog');

  found.el.click();
  await waitForGone(dialog.el, { timeout, root, description: `pop-up "${dialog.message}" fechar` });
  return { title: dialog.title, message: dialog.message, button: found.text };
}

/**
 * Fecha sozinho, enquanto estiver ativo, os pop-ups que casam com alguma regra
 * (ex.: avisos que podem ser sempre ignorados e travariam a automação).
 * Cada regra exige `text` (RegExp ou "contém") e `button`. Cada pop-up recebe no
 * máximo um clique. Pop-ups de gravação nunca são confirmados (vão para onError).
 *
 * As regras devem ser específicas: avisos clínicos (ex.: alergia) não podem
 * ser fechados sem o médico ver.
 *
 * @param {{ text: string | RegExp, button: string | RegExp }[]} rules
 * @param {{ root?: ParentNode, onDismiss?: Function, onError?: Function }} [opts]
 * @returns {{ stop(): void }}
 */
export function autoDismissDialogs(rules, { root = document, onDismiss, onError } = {}) {
  if (!Array.isArray(rules) || !rules.length || rules.some((r) => !r || isBlank(r.text) || isBlank(r.button))) {
    throw new TypeError('autoDismissDialogs: informe ao menos uma regra com text e button');
  }
  const handled = new WeakSet();
  let stopped = false;

  const scan = () => {
    if (stopped) return;
    for (const dialog of getOpenDialogs({ root })) {
      if (handled.has(dialog.el)) continue;
      const rule = rules.find((r) => dialogMatches(dialog, r.text));
      if (!rule) continue;
      handled.add(dialog.el);
      try {
        const found = findButton(dialog, rule.button);
        assertNotSave(dialog, 'autoDismissDialogs');
        found.el.click();
        onDismiss?.({ title: dialog.title, message: dialog.message, button: found.text });
      } catch (err) {
        onError?.(err);
      }
    }
  };

  const doc = root.ownerDocument ?? root;
  const observer = new doc.defaultView.MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true, attributes: true });
  scan();
  return {
    stop() {
      stopped = true;
      observer.disconnect();
    },
  };
}
