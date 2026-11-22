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

const fieldOf = (form, name) => form.elements.namedItem(name);

function showStatus(statusEl, kind, text) {
  statusEl.dataset.kind = kind;
  statusEl.textContent = text;
}

/** Preenche o formulário e devolve as filas mostradas no select. */
function fillForm(form, all) {
  const queues = queueOptions(all.queueRefresh.queue);
  const options = queues.map(({ value, label }) => {
    const option = form.ownerDocument.createElement('option');
    option.value = value;
    option.textContent = label; // texto, nunca HTML
    return option;
  });
  fieldOf(form, 'queue').replaceChildren(...options);
  const values = settingsToForm(all);
  CHECKBOXES.forEach((name) => { fieldOf(form, name).checked = values[name]; });
  TEXT_FIELDS.forEach((name) => { fieldOf(form, name).value = values[name]; });
  return queues;
}

const readValues = (form) => ({
  ...Object.fromEntries(CHECKBOXES.map((name) => [name, fieldOf(form, name).checked])),
  ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, fieldOf(form, name).value])),
});

function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function showErrors(form, errors) {
  for (const { path, message } of errors) {
    const name = fieldForPath(path);
    const errorEl = name && form.querySelector(`[data-error-for="${name}"]`);
    if (!errorEl) continue;
    errorEl.textContent = errorEl.textContent ? `${errorEl.textContent} ${message}` : message;
    fieldOf(form, name).setAttribute('aria-invalid', 'true');
  }
}

/**
 * @param {{ settings: ReturnType<import('../core/storage/settings.js').createSettings>, root?: Document }} opts
 * @returns {Promise<{ save: () => Promise<void>, restoreDefaults: () => Promise<void> }>}
 */
export async function initOptionsPage({ settings, root = document }) {
  const form = root.querySelector('#settings-form');
  const statusEl = root.querySelector('#status');
  let shownQueues = fillForm(form, await settings.get());

  async function save() {
    clearErrors(form);
    const { settings: next, errors } = formToSettings(readValues(form), shownQueues);
    if (errors.length > 0) {
      showErrors(form, errors);
      showStatus(statusEl, 'error', MESSAGES.invalid);
      return;
    }
    try {
      await settings.set(next);
      showStatus(statusEl, 'ok', MESSAGES.saved);
    } catch (err) {
      showStatus(statusEl, 'error', err.message);
    }
  }

  async function restoreDefaults() {
    clearErrors(form);
    try {
      await settings.reset();
      shownQueues = fillForm(form, await settings.get());
      showStatus(statusEl, 'ok', MESSAGES.restored);
    } catch (err) {
      showStatus(statusEl, 'error', err.message);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
  root.querySelector('#restore-defaults').addEventListener('click', () => restoreDefaults());
  return { save, restoreDefaults };
}
