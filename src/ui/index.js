import { assertMessage, createPanel } from './panel.js';
import { createPanelState } from './panel-state.js';

const LOG = '[helper-sghx] painel';

/** API inerte para quando o painel não monta: as funcionalidades seguem sem interface. */
const NOOP_UI = Object.freeze({
  registerSection() {},
  notify(message) {
    assertMessage(message); // mesmo comportamento do painel real
    return () => {};
  },
  destroy() {},
});

/**
 * Monta o painel flutuante e devolve a API que as funcionalidades recebem em `ctx.ui`:
 * `registerSection({ id, title, screens, render })` e `notify({ level, text })`
 * (ver docs/ui-panel.md). Falha ao montar não derruba a extensão.
 *
 * @param {{ screen: object, area?: chrome.storage.StorageArea }} deps
 */
export async function initUi({ screen, area }) {
  let panel;
  try {
    panel = createPanel({ screen, state: createPanelState({ area }) });
    await panel.mount();
  } catch (err) {
    console.error(`${LOG}: não foi possível montar`, err);
    panel?.destroy();
    return NOOP_UI;
  }
  return Object.freeze({
    registerSection: (section) => panel.registerSection(section),
    notify: (message) => panel.notify(message),
    destroy: () => panel.destroy(),
  });
}
