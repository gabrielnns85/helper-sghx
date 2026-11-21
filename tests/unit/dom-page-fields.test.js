import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import $ from 'jquery';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { installFakeDevExtreme } from '../helpers/fake-devextreme.js';
import { setPageFieldValue } from '../../src/core/dom/page-fields.js';
import {
  DomHelperError,
  ElementNotFoundError,
  OptionNotFoundError,
  ValueNotAppliedError,
} from '../../src/core/dom/errors.js';

const MEDICAMENTOS = [
  { CodMedicamento: 101, DscMedicamento: 'DIPIRONA 500 MG COMPRIMIDO' },
  { CodMedicamento: 202, DscMedicamento: 'PARACETAMOL 750 MG COMPRIMIDO' },
  { CodMedicamento: 303, DscMedicamento: 'ÁCIDO ACETILSALICÍLICO 100 MG' },
];

describe('setPageFieldValue: DevExtreme', () => {
  let dx;
  let win;

  beforeEach(() => {
    loadFixture('dom-devextreme-selectbox');
    win = window;
    dx = installFakeDevExtreme(win);
  });

  afterEach(() => {
    dx.uninstall();
    clearFixture();
  });

  const selectBox = (opts = {}, behavior) =>
    dx.create('dxSelectBox', document.querySelector('#comboMedicamento'), {
      items: MEDICAMENTOS,
      valueExpr: 'CodMedicamento',
      displayExpr: 'DscMedicamento',
      ...opts,
    }, behavior);

  it('dxSelectBox: escolhe pelo valor (valueExpr)', () => {
    const inst = selectBox();
    const res = setPageFieldValue(win, { selector: '#comboMedicamento', value: 202 });
    expect(inst.option('value')).toBe(202);
    expect(res).toEqual({ strategy: 'devextreme', widget: 'dxSelectBox' });
  });

  it('dxSelectBox: aceita o valor como texto ("202")', () => {
    const inst = selectBox();
    setPageFieldValue(win, { selector: '#comboMedicamento', value: '202' });
    expect(inst.option('value')).toBe(202);
  });

  it('dxSelectBox: escolhe pelo texto exibido, sem diferenciar maiúsculas e acentos', () => {
    const inst = selectBox();
    setPageFieldValue(win, { selector: '#comboMedicamento', value: 'acido acetilsalicilico 100 mg' });
    expect(inst.option('value')).toBe(303);
  });

  it('dxSelectBox: com displayExpr/valueExpr função e itens no dataSource', () => {
    const inst = selectBox({
      items: undefined,
      dataSource: MEDICAMENTOS,
      valueExpr: (i) => i && i.CodMedicamento,
      displayExpr: (i) => i && i.DscMedicamento,
    });
    setPageFieldValue(win, { selector: '#comboMedicamento', value: 'Paracetamol 750 mg comprimido' });
    expect(inst.option('value')).toBe(202);
  });

  it('dxSelectBox sem valueExpr usa o próprio item como valor', () => {
    const inst = selectBox({ items: ['VO', 'IM', 'EV'], valueExpr: undefined, displayExpr: undefined });
    setPageFieldValue(win, { selector: '#comboMedicamento', value: 'im' });
    expect(inst.option('value')).toBe('IM');
  });

  it('dxSelectBox: lança OptionNotFoundError listando os itens', () => {
    selectBox();
    expect(() => setPageFieldValue(win, { selector: '#comboMedicamento', value: 'AMOXICILINA' })).toThrow(OptionNotFoundError);
    expect(() => setPageFieldValue(win, { selector: '#comboMedicamento', value: 'AMOXICILINA' })).toThrow(
      'Opção "AMOXICILINA" não existe em "#comboMedicamento". Opções: DIPIRONA 500 MG COMPRIMIDO; PARACETAMOL 750 MG COMPRIMIDO; ÁCIDO ACETILSALICÍLICO 100 MG',
    );
  });

  it('dxSelectBox sem itens carregados (fonte remota) grava o valor direto', () => {
    const inst = selectBox({ items: undefined, dataSource: undefined });
    setPageFieldValue(win, { selector: '#comboMedicamento', value: 101 });
    expect(inst.option('value')).toBe(101);
  });

  it('acha a instância a partir do input interno, pulando widgets internos sem instância', () => {
    const inst = selectBox();
    setPageFieldValue(win, { selector: '#comboMedicamentoInput', value: 101 });
    expect(inst.option('value')).toBe(101);
    setPageFieldValue(win, { selector: '#comboMedicamentoBotao', value: 202 });
    expect(inst.option('value')).toBe(202);
  });

  it('dxDateBox e dxTextBox: grava com option("value")', () => {
    const data = dx.create('dxDateBox', document.querySelector('#dataInicio'));
    const texto = dx.create('dxTextBox', document.querySelector('#textoLivre'));
    expect(setPageFieldValue(win, { selector: '#dataInicio', value: '2026-11-18' })).toEqual({ strategy: 'devextreme', widget: 'dxDateBox' });
    setPageFieldValue(win, { selector: '#textoLivre', value: 'texto sintético' });
    expect(data.option('value')).toBe('2026-11-18');
    expect(texto.option('value')).toBe('texto sintético');
  });

  it('lança ValueNotAppliedError quando o widget recusa o valor', () => {
    dx.create('dxTextBox', document.querySelector('#textoLivre'), {}, { accept: () => false });
    expect(() => setPageFieldValue(win, { selector: '#textoLivre', value: 'x' })).toThrow(ValueNotAppliedError);
  });

  it('cai no jQuery (data dxComponents) quando não há DevExpress.ui.*.getInstance', () => {
    dx.uninstall();
    win.jQuery = $;
    const el = document.querySelector('#comboMedicamento');
    let valor = null;
    const inst = { option(k, v) { if (arguments.length === 1) return k === 'value' ? valor : undefined; if (k === 'value') valor = v; } };
    $(el).data('dxComponents', ['dxSelectBox']);
    $.fn.dxSelectBox = function dxSelectBox(cmd) { return cmd === 'instance' && this[0] === el ? inst : undefined; };
    try {
      expect(setPageFieldValue(win, { selector: '#comboMedicamento', value: 'x' })).toEqual({ strategy: 'devextreme', widget: 'dxSelectBox' });
      expect(valor).toBe('x');
    } finally {
      delete $.fn.dxSelectBox;
      delete win.jQuery;
    }
  });

  it('.dx-widget sem instância gera erro claro', () => {
    expect(() => setPageFieldValue(win, { selector: '#semInstancia', value: 'x' })).toThrow(/instância do DevExtreme/);
  });

  it('elemento fora de widget DevExtreme e sem observable não é tratado na ponte', () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="comum">');
    expect(() => setPageFieldValue(win, { selector: '#comum', value: 'x' })).toThrow(DomHelperError);
  });
});

describe('setPageFieldValue: observable do Knockout', () => {
  let vm;
  const win = window;

  beforeEach(() => {
    win.ko = ko;
    loadFixture('dom-form-knockout');
    vm = {
      DscMotivo: ko.observable(''),
      DscHistorico: ko.observable(''),
      Tipos: [],
      IndTipoDiagnostico: ko.observable(),
      IndCabecalho: ko.observable(false),
      NumDias: ko.observable(0),
    };
    vm.Total = ko.pureComputed(() => vm.NumDias() * 2);
    ko.applyBindings(vm, document.querySelector('#vmConsulta'));
  });

  afterEach(() => {
    ko.cleanNode(document.querySelector('#vmConsulta'));
    delete win.ko;
    clearFixture();
  });

  it('grava direto no observable do view-model do elemento', () => {
    const res = setPageFieldValue(win, { selector: '#spanNumDias', value: 3, observable: 'NumDias' });
    expect(vm.NumDias()).toBe(3);
    expect(document.querySelector('#spanTotal').textContent).toBe('6');
    expect(res).toEqual({ strategy: 'knockout' });
  });

  it('recusa computed (não gravável) e propriedade inexistente', () => {
    expect(() => setPageFieldValue(win, { selector: '#spanTotal', value: 1, observable: 'Total' })).toThrow(/observable gravável/);
    expect(() => setPageFieldValue(win, { selector: '#spanTotal', value: 1, observable: 'NaoExiste' })).toThrow(/observable gravável/);
    expect(() => setPageFieldValue(win, { selector: '#spanTotal', value: 1, observable: '__proto__' })).toThrow(DomHelperError);
  });

  it('sem Knockout na página gera erro claro', () => {
    delete win.ko;
    expect(() => setPageFieldValue(win, { selector: '#spanNumDias', value: 1, observable: 'NumDias' })).toThrow(/Knockout/);
  });
});

describe('setPageFieldValue: validação do payload (vem de postMessage)', () => {
  afterEach(clearFixture);

  it('exige payload com seletor em texto', () => {
    expect(() => setPageFieldValue(window, null)).toThrow(TypeError);
    expect(() => setPageFieldValue(window, { selector: '', value: 1 })).toThrow(TypeError);
    expect(() => setPageFieldValue(window, { selector: { x: 1 }, value: 1 })).toThrow(TypeError);
    expect(() => setPageFieldValue(window, { selector: 'a'.repeat(501), value: 1 })).toThrow(TypeError);
  });

  it('exige nome de observable simples (sem caminho nem expressão)', () => {
    expect(() => setPageFieldValue(window, { selector: '#x', value: 1, observable: 'a.b' })).toThrow(TypeError);
    expect(() => setPageFieldValue(window, { selector: '#x', value: 1, observable: 'alert(1)' })).toThrow(TypeError);
  });

  it('seletor inválido gera erro claro', () => {
    expect(() => setPageFieldValue(window, { selector: '#[', value: 1 })).toThrow(/Seletor inválido/);
  });

  it('elemento inexistente gera ElementNotFoundError', () => {
    expect(() => setPageFieldValue(window, { selector: '#nada', value: 1 })).toThrow(ElementNotFoundError);
  });
});
