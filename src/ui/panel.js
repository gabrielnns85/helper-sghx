import { PANEL_CSS } from './panel-styles.js';
import { createSectionRegistry } from './sections.js';

const HOST_ID = 'helper-sghx-panel';
const INFO_TTL_MS = 8000;
const LEVELS = Object.freeze(['info', 'error']);

const SCREEN_LABEL = Object.freeze({
  login: 'Login',
  fila: 'Fila',
  consulta: 'Consulta (SOAP)',
  prescricao: 'Prescrição',
  'solicitacao-procedimento': 'Solicitação de procedimento',
  atestado: 'Atestado',
  unknown: 'Tela não reconhecida',
});

/** Valida uma mensagem do painel (também usada pela API inerte, para o mesmo comportamento). */
export function assertMessage({ level, text } = {}) {
  if (!LEVELS.includes(level)) throw new TypeError(`Mensagem do painel: nível inválido "${level}"`);
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Mensagem do painel: texto vazio');
}

const el = (doc, tag, attrs = {}, text) => {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Painel lateral flutuante (direita, acima dos modais do SGHx), recolhível. Mostra a tela
 * ativa, mensagens de status/erro e as seções registradas pelas funcionalidades.
 * Todo texto entra por textContent. Ver docs/ui-panel.md.
 *
 * @param {{ screen: { current(): {id: string}, subscribe(fn: Function): () => void },
 *           state: { load(): Promise<{collapsed: boolean}>, save(s: {collapsed: boolean}): Promise<void> },
 *           doc?: Document }} deps
 */
export function createPanel({ screen, state, doc = document }) {
  const registry = createSectionRegistry();
  const messages = new Map();
  /** id da seção → { box, controller, clearError } das seções hoje na tela. */
  const rendered = new Map();
  let nextMessageId = 0;
  let host;
  let ui;
  let collapsed = false;
  let forcedOpen = false;
  let unsubscribe;
  let mounting;
  let generation = 0;

  const hasError = () => [...messages.values()].some((m) => m.level === 'error');
  const isVisible = () => !collapsed || forcedOpen;
  const screenLabel = () => SCREEN_LABEL[screen.current().id] ?? SCREEN_LABEL.unknown;

  /** Aba (sempre visível): abre/recolhe e, com o painel fechado, diz a tela ativa. */
  function renderToggle() {
    const action = isVisible() ? 'Recolher painel' : 'Abrir painel';
    const text = `${action} helper-sghx · ${screenLabel()}`;
    ui.toggle.setAttribute('aria-expanded', String(isVisible()));
    ui.toggle.textContent = isVisible() ? '›' : '‹';
    ui.toggle.title = text;
    ui.toggle.setAttribute('aria-label', text);
    ui.toggle.dataset.alert = hasError() ? 'error' : '';
  }

  function applyVisibility() {
    ui.body.hidden = !isVisible();
    renderToggle();
  }

  function renderMessages() {
    ui.messages.replaceChildren(
      ...[...messages.entries()].map(([id, m]) => {
        const row = el(doc, 'div', { class: 'message', 'data-level': m.level, role: m.level === 'error' ? 'alert' : 'status' });
        row.append(el(doc, 'span', {}, m.text));
        const close = el(doc, 'button', { type: 'button', 'data-action': 'dismiss', 'aria-label': 'Dispensar' }, '×');
        close.addEventListener('click', () => removeMessage(id));
        row.append(close);
        return row;
      }),
    );
    if (!hasError()) forcedOpen = false;
    applyVisibility();
  }

  function removeMessage(id) {
    const message = messages.get(id);
    if (!message) return;
    clearTimeout(message.timer);
    messages.delete(id);
    if (ui) renderMessages();
  }

  function notify(message) {
    assertMessage(message);
    if (!ui) return () => {};
    const { level, text } = message;
    const id = (nextMessageId += 1);
    const timer = level === 'info' ? setTimeout(() => removeMessage(id), INFO_TTL_MS) : undefined;
    messages.set(id, { level, text, timer });
    // Erro precisa ser visto: abre o painel recolhido, sem mudar a preferência gravada.
    if (level === 'error' && collapsed) forcedOpen = true;
    renderMessages();
    return () => removeMessage(id);
  }

  function failSection(section, entry, err) {
    console.error(`[helper-sghx] falha na seção "${section.id}" do painel`, err);
    if (entry.clearError || !ui || rendered.get(section.id) !== entry) return;
    entry.clearError = notify({ level: 'error', text: `A seção "${section.title}" falhou ao abrir.` });
  }

  function disposeSection(id) {
    const entry = rendered.get(id);
    if (!entry) return;
    entry.controller.abort();
    entry.clearError?.();
    entry.box.remove();
    rendered.delete(id);
  }

  function renderSection(section) {
    disposeSection(section.id);
    const box = el(doc, 'section', { class: 'section', 'data-section': section.id });
    box.append(el(doc, 'h2', {}, section.title));
    const content = el(doc, 'div');
    box.append(content);
    const entry = { box, controller: new AbortController(), clearError: undefined };
    rendered.set(section.id, entry);
    ui.sections.append(box);
    try {
      const result = section.render(content, { screen: screen.current(), signal: entry.controller.signal });
      Promise.resolve(result).catch((err) => failSection(section, entry, err));
    } catch (err) {
      failSection(section, entry, err);
    }
  }

  /** Troca de tela: refaz só as seções dessa tela, na ordem de registro. */
  function renderAllSections() {
    for (const id of [...rendered.keys()]) disposeSection(id);
    for (const section of registry.forScreen(screen.current().id)) renderSection(section);
  }

  function build() {
    host = el(doc, 'div', { id: HOST_ID });
    const root = host.attachShadow({ mode: 'open' });
    const wrap = el(doc, 'div', { class: 'panel' });
    const toggle = el(doc, 'button', { type: 'button', class: 'toggle', 'data-part': 'toggle' });
    const body = el(doc, 'div', { class: 'body', 'data-part': 'body' });
    const screenEl = el(doc, 'div', { class: 'screen', 'data-part': 'screen' });
    const messagesBox = el(doc, 'div', { class: 'messages', 'data-part': 'messages' });
    const sections = el(doc, 'div', { 'data-part': 'sections' });
    body.append(screenEl, messagesBox, sections);
    wrap.append(toggle, body);
    root.append(el(doc, 'style', {}, PANEL_CSS), wrap);
    ui = { toggle, body, screen: screenEl, messages: messagesBox, sections };
    toggle.addEventListener('click', () => {
      collapsed = isVisible();
      forcedOpen = false;
      applyVisibility();
      state.save({ collapsed }).catch((err) => console.warn('[helper-sghx] estado do painel não gravado:', err.message));
    });
  }

  async function doMount(myGeneration) {
    const saved = await state.load();
    if (myGeneration !== generation) return; // destroy() chegou durante a leitura
    ({ collapsed } = saved);
    build();
    ui.screen.textContent = screenLabel();
    renderAllSections();
    renderMessages();
    unsubscribe = screen.subscribe(() => {
      ui.screen.textContent = screenLabel();
      renderAllSections();
      renderToggle();
    });
    doc.body.append(host);
  }

  return {
    registerSection(section) {
      registry.register(section);
      const stored = registry.list().find((s) => s.id === section.id);
      if (ui && stored.screens.includes(screen.current().id)) renderSection(stored);
    },
    notify,

    /** Seguro chamar mais de uma vez; depois de destroy() monta de novo. */
    mount() {
      if (host?.isConnected) return Promise.resolve();
      mounting ??= doMount(generation).finally(() => {
        mounting = undefined;
      });
      return mounting;
    },

    destroy() {
      generation += 1;
      unsubscribe?.();
      unsubscribe = undefined;
      for (const id of [...rendered.keys()]) disposeSection(id);
      for (const id of [...messages.keys()]) removeMessage(id);
      forcedOpen = false;
      host?.remove();
      host = undefined;
      ui = undefined;
    },
  };
}
