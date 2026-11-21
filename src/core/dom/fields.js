import { DomHelperError, OptionNotFoundError, ValueNotAppliedError } from './errors.js';
import { normalizeText, readText, resolveElement, sameText } from './util.js';

/** Atributo usado para a ponte (mundo MAIN) achar o mesmo elemento. */
export const REF_ATTR = 'data-helper-sghx-ref';

let refCounter = 0;

/**
 * Preenche um campo do SGHx como se fosse o usuário.
 *
 * - input, textarea, campos de data (datepicker), select, checkbox e radio são
 *   preenchidos aqui mesmo (serve no mundo isolado): grava pelo setter nativo e
 *   dispara `input`, `change` e `blur`, que é o que o jQuery e os bindings
 *   `value`/`textInput`/`checked`/`options` do Knockout escutam.
 * - Widgets DevExtreme (`.dx-widget`) e a opção `observable` (gravar direto no
 *   view-model do Knockout) só funcionam no mundo MAIN: vão pela ponte.
 *
 * Depois de gravar, relê o valor e lança ValueNotAppliedError se ele não pegou.
 * Nunca clica em Salvar.
 *
 * @param {string | Element} target seletor CSS ou elemento
 * @param {string | number | boolean} value texto, value/texto da opção, ou booleano (checkbox/radio)
 * @param {object} [opts]
 * @param {{ request(type: string, payload: object): Promise<any> }} [opts.bridge] cliente da ponte
 * @param {string} [opts.observable] nome do observable no view-model do elemento (via ponte)
 * @param {boolean} [opts.blur=true] dispara blur depois do change
 * @param {boolean} [opts.verify=true] relê o valor depois de gravar
 * @param {boolean} [opts.force=false] permite campo readonly/disabled
 * @param {ParentNode} [opts.root=document]
 * @returns {Promise<{ strategy: 'native' | 'knockout' | 'devextreme', value: any }>}
 */
export async function setFieldValue(target, value, opts = {}) {
  const { bridge, observable, root = document } = opts;
  if (value === null || value === undefined) throw new TypeError('setFieldValue: valor ausente');
  const { el, label } = resolveElement(target, { root });

  if (observable !== undefined || el.closest('.dx-widget')) {
    const strategy = observable !== undefined ? 'knockout' : 'devextreme';
    await viaBridge(el, label, value, { bridge, observable, strategy });
    return { strategy, value };
  }

  assertEditable(el, label, opts.force);
  const applied = setNative(el, label, value, opts);
  return { strategy: 'native', value: applied };
}

async function viaBridge(el, label, value, { bridge, observable, strategy }) {
  if (!bridge || typeof bridge.request !== 'function') {
    const why = strategy === 'knockout' ? 'gravar no observable' : 'um widget DevExtreme';
    throw new DomHelperError(`"${label}" precisa da ponte com a página (mundo MAIN) para ${why}`);
  }
  if (!el.hasAttribute(REF_ATTR)) {
    refCounter += 1;
    el.setAttribute(REF_ATTR, `r${Date.now().toString(36)}${refCounter}`);
  }
  const payload = { selector: `[${REF_ATTR}="${el.getAttribute(REF_ATTR)}"]`, value };
  if (observable !== undefined) payload.observable = observable;
  try {
    // A resposta vem da página e não é confiável: só importa se deu certo.
    await bridge.request('setFieldValue', payload);
  } catch (err) {
    throw new DomHelperError(`Falha ao preencher "${label}" pela ponte: ${err?.message ?? err}`);
  }
}

function assertEditable(el, label, force) {
  if (force) return;
  if (el.disabled) throw new DomHelperError(`Campo "${label}" está desabilitado`);
  if (el.readOnly) throw new DomHelperError(`Campo "${label}" é somente leitura`);
}

function setNative(el, label, value, { blur = true, verify = true }) {
  const tag = el.tagName;
  const type = (el.type || '').toLowerCase();

  if (tag === 'SELECT') return setSelect(el, label, value, { blur, verify });
  if (tag === 'INPUT' && type === 'checkbox') return setCheckbox(el, label, value, { blur });
  if (tag === 'INPUT' && type === 'radio') return setRadio(el, label, value, { blur });
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
    throw new DomHelperError(`"${label}" não é um campo preenchível (${tag.toLowerCase()}); use a opção observable`);
  }

  const text = String(value);
  writeValue(el, text);
  fire(el, ['input', 'change'], blur);
  if (verify && el.value !== text) throw new ValueNotAppliedError(label, text, el.value);
  return text;
}

/** Setter nativo do protótipo: passa por cima de setters sobrescritos na instância. */
function writeValue(el, text) {
  let proto = Object.getPrototypeOf(el);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc?.set) { desc.set.call(el, text); return; }
    proto = Object.getPrototypeOf(proto);
  }
  el.value = text;
}

function fire(el, types, blur) {
  const view = el.ownerDocument.defaultView;
  for (const type of types) el.dispatchEvent(new view.Event(type, { bubbles: true }));
  if (blur) {
    el.dispatchEvent(new view.FocusEvent('blur', { bubbles: false }));
    el.dispatchEvent(new view.FocusEvent('focusout', { bubbles: true }));
  }
}

function setSelect(el, label, value, { blur, verify }) {
  const options = [...el.options];
  const wanted = String(value);
  const option = options.find((o) => o.value === wanted) ?? options.find((o) => sameText(o.text, wanted));
  if (!option) throw new OptionNotFoundError(wanted, label, options.map((o) => o.text.trim()));
  el.value = option.value;
  fire(el, ['input', 'change'], blur);
  if (verify && el.value !== option.value) throw new ValueNotAppliedError(label, option.value, el.value);
  return option.value;
}

function setCheckbox(el, label, value, { blur }) {
  if (typeof value !== 'boolean') throw new TypeError(`Checkbox "${label}" aceita só true/false`);
  // Clique de verdade: o binding `checked` do Knockout escuta `click`.
  if (el.checked !== value) el.click();
  if (blur) fire(el, [], true);
  if (el.checked !== value) throw new ValueNotAppliedError(label, value, el.checked);
  return value;
}

function radioLabel(radio) {
  const doc = radio.ownerDocument;
  const byFor = radio.id ? [...doc.querySelectorAll('label[for]')].find((l) => l.htmlFor === radio.id) : null;
  return readText(byFor ?? radio.closest('label')) || radio.value;
}

function setRadio(el, label, value, { blur }) {
  let radio = el;
  if (value === false) throw new DomHelperError(`Não é possível desmarcar o radio "${label}": escolha outra opção do grupo`);
  if (value !== true) {
    const scope = el.form ?? el.ownerDocument;
    const group = el.name
      ? [...scope.querySelectorAll('input[type="radio"]')].filter((r) => r.name === el.name)
      : [el];
    const wanted = String(value);
    radio = group.find((r) => r.value === wanted) ?? group.find((r) => normalizeText(radioLabel(r)) === normalizeText(wanted));
    if (!radio) throw new OptionNotFoundError(wanted, label, group.map(radioLabel));
  }
  if (!radio.checked) radio.click();
  if (blur) fire(radio, [], true);
  if (!radio.checked) throw new ValueNotAppliedError(label, radio.value, 'desmarcado');
  return radio.value;
}
