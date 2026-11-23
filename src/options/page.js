// Controlador da página de opções (#8): preenche o formulário, salva, restaura os
// padrões e mostra os erros. Recebe `settings`, `root` e `confirm` para poder ser
// testado no jsdom.
import { fieldForPath, formToSettings, queueOptions, settingsToForm } from './form.js';

const CHECKBOXES = Object.freeze(['autoLoginEnabled', 'queueRefreshEnabled']);
// autoLoginMode é um grupo de rádios: o RadioNodeList também tem .value.
const TEXT_FIELDS = Object.freeze([
  'autoLoginMode', 'autoLoginUser', 'autoLoginPassword', 'intervalSec', 'queue', 'unitName', 'codFces',
]);

const MESSAGES = Object.freeze({
  saved: 'Configurações salvas. Já valem nas abas abertas do SGHx.',
  restored: 'Padrões restaurados.',
  invalid: 'Corrija os campos destacados. Nada foi salvo.',
  confirmRestore: 'Restaurar os padrões? Todas as suas configurações serão apagadas e as automações desligadas.',
  loadFailed: 'Recarregue a página antes de mudar algo, para não apagar o que já está salvo.',
});

const fieldOf = (form, name) => form.elements.namedItem(name);

function showStatus(statusEl, kind, text) {
  statusEl.dataset.kind = kind;
  statusEl.textContent = text;
}

function renderQueueOptions(form) {
  const options = queueOptions().map(({ value, label }) => {
    const option = form.ownerDocument.createElement('option');
    option.value = value;
    option.textContent = label; // texto, nunca HTML
    return option;
  });
  fieldOf(form, 'queue').replaceChildren(...options);
}

/** Usuário e senha só aparecem no modo usuário e senha. */
function syncCredentials(form) {
  form.querySelector('#autoLogin-credentials').hidden = fieldOf(form, 'autoLoginMode').value !== 'password';
}

function fillForm(form, all) {
  const values = settingsToForm(all);
  CHECKBOXES.forEach((name) => { fieldOf(form, name).checked = values[name]; });
  TEXT_FIELDS.forEach((name) => { fieldOf(form, name).value = values[name]; });
  syncCredentials(form);
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

/** Sem ler o que está salvo, salvar ou restaurar apagaria tudo: trava os botões. */
function lockForm(form) {
  form.querySelectorAll('button').forEach((button) => { button.disabled = true; });
}

/**
 * @param {{
 *   settings: ReturnType<import('../core/storage/settings.js').createSettings>,
 *   root?: Document,
 *   confirm?: (message: string) => boolean,
 * }} opts
 * @returns {Promise<{ save: () => Promise<void>, restoreDefaults: () => Promise<void> }>}
 */
export async function initOptionsPage({ settings, root = document, confirm = (m) => root.defaultView.confirm(m) }) {
  const form = root.querySelector('#settings-form');
  const statusEl = root.querySelector('#status');
  renderQueueOptions(form);

  async function save() {
    clearErrors(form);
    const { settings: next, errors } = formToSettings(readValues(form));
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
    if (!confirm(MESSAGES.confirmRestore)) return;
    clearErrors(form);
    try {
      await settings.reset();
      fillForm(form, await settings.load());
      showStatus(statusEl, 'ok', MESSAGES.restored);
    } catch (err) {
      showStatus(statusEl, 'error', err.message);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'autoLoginMode') syncCredentials(form);
  });
  root.querySelector('#restore-defaults').addEventListener('click', () => restoreDefaults());

  try {
    fillForm(form, await settings.load());
  } catch (err) {
    lockForm(form);
    showStatus(statusEl, 'error', `${err.message}. ${MESSAGES.loadFailed}`);
    return { save, restoreDefaults };
  }
  // Mudança feita em outra aba: atualiza a tela para não salvar por cima com valores velhos.
  settings.subscribe((all) => fillForm(form, all));
  return { save, restoreDefaults };
}
