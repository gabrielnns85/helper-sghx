import { DomHelperError, ElementNotFoundError, OptionNotFoundError, ValueNotAppliedError } from './errors.js';
import { sameText } from './util.js';

/**
 * Lado MAIN do setFieldValue: roda na ponte (src/page-bridge.js), com acesso a
 * `ko`, `jQuery` e `DevExpress` da página. O payload vem de postMessage e é
 * validado aqui; só aceita seletor CSS e nome simples de observable (sem eval).
 */

/** Widgets DevExtreme procurados, na ordem. */
const DX_WIDGETS = [
  'dxSelectBox', 'dxLookup', 'dxTagBox', 'dxAutocomplete',
  'dxDateBox', 'dxNumberBox', 'dxTextBox', 'dxTextArea', 'dxCheckBox',
];
const LIST_WIDGETS = new Set(['dxSelectBox', 'dxLookup', 'dxTagBox', 'dxAutocomplete']);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MAX_SELECTOR = 500;

/**
 * @param {Window} win janela da página
 * @param {{ selector: string, value: any, observable?: string }} payload
 * @returns {{ strategy: 'knockout' } | { strategy: 'devextreme', widget: string }}
 */
export function setPageFieldValue(win, payload) {
  const { selector, value, observable } = validate(payload);
  const el = find(win, selector);
  if (observable !== undefined) return setObservable(win, el, selector, observable, value);
  return setDevExtreme(win, el, selector, value);
}

function validate(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('setFieldValue: payload ausente');
  const { selector, value, observable } = payload;
  if (typeof selector !== 'string' || !selector || selector.length > MAX_SELECTOR) {
    throw new TypeError('setFieldValue: seletor deve ser um texto entre 1 e 500 caracteres');
  }
  if (observable !== undefined && (typeof observable !== 'string' || !IDENTIFIER.test(observable))) {
    throw new TypeError('setFieldValue: observable deve ser um nome simples (ex.: "DscMotivo")');
  }
  return { selector, value, observable };
}

function find(win, selector) {
  let el;
  try {
    el = win.document.querySelector(selector);
  } catch {
    throw new DomHelperError(`Seletor inválido: "${selector}"`);
  }
  if (!el) throw new ElementNotFoundError(selector);
  return el;
}

function setObservable(win, el, label, name, value) {
  const { ko } = win;
  if (!ko) throw new DomHelperError('Knockout não está disponível na página');
  const data = ko.dataFor(el);
  const target = data && Object.hasOwn(data, name) ? data[name] : undefined;
  if (!ko.isWriteableObservable(target)) {
    throw new DomHelperError(`"${name}" não é um observable gravável no view-model de "${label}"`);
  }
  target(value);
  const now = ko.unwrap(target);
  if (now !== value && (typeof value !== 'object' || value === null)) {
    throw new ValueNotAppliedError(label, value, now);
  }
  return { strategy: 'knockout' };
}

function findInstance(win, el) {
  for (let node = el.closest('.dx-widget'); node; node = node.parentElement?.closest('.dx-widget')) {
    for (const widget of DX_WIDGETS) {
      const inst = win.DevExpress?.ui?.[widget]?.getInstance?.(node);
      if (inst) return { inst, widget };
    }
    const $ = win.jQuery;
    const names = $ ? $(node).data('dxComponents') : null;
    for (const widget of Array.isArray(names) ? names : []) {
      const inst = typeof $.fn[widget] === 'function' ? $(node)[widget]('instance') : null;
      if (inst) return { inst, widget };
    }
  }
  return null;
}

function expr(item, e) {
  if (typeof e === 'function') return e(item);
  if (typeof e === 'string' && e !== 'this' && item !== null && typeof item === 'object') return item[e];
  return item;
}

function listItems(inst) {
  const items = inst.option('items');
  if (Array.isArray(items) && items.length) return items;
  const ds = inst.option('dataSource');
  if (Array.isArray(ds) && ds.length) return ds;
  const loaded = typeof inst.getDataSource === 'function' ? inst.getDataSource()?.items?.() : null;
  return Array.isArray(loaded) ? loaded : [];
}

/**
 * Valor do item que casa por valor (=== ou mesmo texto) ou pelo texto exibido.
 * Sem item e com `acceptCustomValue` (ex.: medicamento externo), cria o item como
 * quando o médico digita: pelo `onCustomItemCreating` da própria página.
 * @returns {{ value: any, customItem?: true }}
 */
function pickListValue(inst, label, value) {
  const items = listItems(inst);
  if (!items.length) return { value }; // fonte remota ainda não carregada: grava direto
  const valueExpr = inst.option('valueExpr');
  const displayExpr = inst.option('displayExpr');
  const valueOf = (i) => expr(i, valueExpr);
  const displayOf = (i) => String(expr(i, displayExpr) ?? '');
  const byValue = items.find((i) => valueOf(i) === value)
    ?? items.find((i) => String(valueOf(i)) === String(value));
  if (byValue !== undefined) return { value: valueOf(byValue) };
  const byText = items.find((i) => sameText(displayOf(i), value));
  if (byText !== undefined) return { value: valueOf(byText) };
  if (inst.option('acceptCustomValue')) return { value: createCustomValue(inst, value, valueOf), customItem: true };
  throw new OptionNotFoundError(value, label, items.slice(0, 30).map(displayOf));
}

function createCustomValue(inst, value, valueOf) {
  const handler = inst.option('onCustomItemCreating');
  if (typeof handler === 'function') {
    const element = typeof inst.element === 'function' ? inst.element() : inst.element;
    const e = { component: inst, element, text: String(value), customItem: undefined };
    handler(e);
    const item = e.customItem;
    // customItem assíncrono (Promise) não é usado pelo SGHx: cai no texto.
    if (item !== null && item !== undefined && typeof item.then !== 'function') return valueOf(item);
  }
  return value;
}

function setDevExtreme(win, el, label, value) {
  if (!el.closest('.dx-widget')) {
    throw new DomHelperError(`"${label}" não é widget DevExtreme; sem a opção observable, preencha pelo lado isolado`);
  }
  const found = findInstance(win, el);
  if (!found) throw new DomHelperError(`Não achei a instância do DevExtreme de "${label}"`);
  const { inst, widget } = found;
  const picked = LIST_WIDGETS.has(widget) ? pickListValue(inst, label, value) : { value };
  inst.option('value', picked.value);
  const now = inst.option('value');
  if (now !== picked.value) throw new ValueNotAppliedError(label, picked.value, now);
  return picked.customItem ? { strategy: 'devextreme', widget, customItem: true } : { strategy: 'devextreme', widget };
}
