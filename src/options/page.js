// Controlador da página de opções (#8): preenche o formulário, salva, restaura os
// padrões e mostra os erros. Recebe `settings` e `root` para poder ser testado no jsdom.
import { fieldForPath, formToSettings, queueOptions, settingsToForm } from './form.js';

const CHECKBOXES = Object.freeze(['autoLoginEnabled', 'queueRefreshEnabled']);
const TEXT_FIELDS = Object.freeze(['intervalSec', 'queue', 'unitName', 'codFces']);

const MESSAGES = Object.freeze({
  saved: 'Configurações salvas. Já valem nas abas abertas do SGHx.',
  restored: 'Padrões restaurados.',
  invalid: 'Corrija os campos destacados. Nada foi salvo.',
});

/**
 * @param {{ settings: ReturnType<import('../core/storage/settings.js').createSettings>, root?: Document }} opts
 * @returns {Promise<{ save: () => Promise<void>, restoreDefaults: () => Promise<void> }>}
 */
export async function initOptionsPage({ settings, root = document }) {
  const form = root.querySelector('#settings-form');
  const statusEl = root.querySelector('#status');
  const field = (name) => form.elements.namedItem(name);
  let shownQueues = [];

  const showStatus = (kind, text) => {
    statusEl.dataset.kind = kind;
    statusEl.textContent = text;
  };

  function renderQueues(current) {
    shownQueues = queueOptions(current);
    const options = shownQueues.map(({ value, label }) => {
      const option = root.createElement('option');
      option.value = value;
      option.textContent = label; // texto, nunca HTML
      return option;
    });
    field('queue').replaceChildren(...options);
  }

  function fill(all) {
    renderQueues(all.queueRefresh.queue);
    const values = settingsToForm(all);
    CHECKBOXES.forEach((name) => { field(name).checked = values[name]; });
    TEXT_FIELDS.forEach((name) => { field(name).value = values[name]; });
  }

  const readValues = () => ({
    ...Object.fromEntries(CHECKBOXES.map((name) => [name, field(name).checked])),
    ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, field(name).value])),
  });

  function clearErrors() {
    form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function showErrors(errors) {
    for (const { path, message } of errors) {
      const name = fieldForPath(path);
      const errorEl = name && form.querySelector(`[data-error-for="${name}"]`);
      if (!errorEl) continue;
      errorEl.textContent = errorEl.textContent ? `${errorEl.textContent} ${message}` : message;
      field(name).setAttribute('aria-invalid', 'true');
    }
  }

  async function save() {
    clearErrors();
    const { settings: next, errors } = formToSettings(readValues(), shownQueues);
    if (errors.length > 0) {
      showErrors(errors);
      showStatus('error', MESSAGES.invalid);
      return;
    }
    try {
      await settings.set(next);
      showStatus('ok', MESSAGES.saved);
    } catch (err) {
      showStatus('error', err.message);
    }
  }

  async function restoreDefaults() {
    clearErrors();
    try {
      await settings.reset();
      fill(await settings.get());
      showStatus('ok', MESSAGES.restored);
    } catch (err) {
      showStatus('error', err.message);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
  root.querySelector('#restore-defaults').addEventListener('click', () => restoreDefaults());

  fill(await settings.get());
  return { save, restoreDefaults };
}
