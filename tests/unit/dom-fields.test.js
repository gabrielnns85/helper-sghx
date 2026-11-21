import { describe, it, expect, vi, afterEach } from 'vitest';
import ko from 'knockout';
import $ from 'jquery';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { setFieldValue } from '../../src/core/dom/fields.js';
import {
  DomHelperError,
  ElementNotFoundError,
  OptionNotFoundError,
  ValueNotAppliedError,
} from '../../src/core/dom/errors.js';

afterEach(clearFixture);

function recordEvents(el, types = ['input', 'change', 'blur', 'click']) {
  const seen = [];
  for (const t of types) el.addEventListener(t, () => seen.push(t));
  return seen;
}

describe('setFieldValue: inputs comuns', () => {
  it('preenche input de texto e dispara input, change e blur', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#txtNome');
    const eventos = recordEvents(el);
    const res = await setFieldValue('#txtNome', 'Texto sintético');
    expect(el.value).toBe('Texto sintético');
    expect(eventos).toEqual(['input', 'change', 'blur']);
    expect(res).toEqual({ strategy: 'native', value: 'Texto sintético' });
  });

  it('os eventos borbulham até o formulário', async () => {
    loadFixture('dom-form-basico');
    const form = document.querySelector('#form-basico');
    const eventos = [];
    form.addEventListener('input', () => eventos.push('input'));
    form.addEventListener('change', () => eventos.push('change'));
    await setFieldValue('#txtNome', 'x');
    expect(eventos).toEqual(['input', 'change']);
  });

  it('com blur: false não dispara blur', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#txtNome');
    const eventos = recordEvents(el);
    await setFieldValue(el, 'x', { blur: false });
    expect(eventos).toEqual(['input', 'change']);
  });

  it('preenche textarea e aceita o elemento em vez do seletor', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#txtDescricao');
    await setFieldValue(el, 'linha 1\nlinha 2');
    expect(el.value).toBe('linha 1\nlinha 2');
  });

  it('converte números para texto', async () => {
    loadFixture('dom-form-basico');
    await setFieldValue('#txtNome', 3);
    expect(document.querySelector('#txtNome').value).toBe('3');
  });

  it('preenche campo de data (datepicker) com o texto dd/mm/aaaa', async () => {
    loadFixture('dom-form-basico');
    await setFieldValue('#txtData', '18/11/2026');
    expect(document.querySelector('#txtData').value).toBe('18/11/2026');
  });

  it('handlers jQuery da página recebem o change', async () => {
    loadFixture('dom-form-basico');
    const spy = vi.fn();
    $('#txtNome').on('change', spy);
    await setFieldValue('#txtNome', 'x');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lança ElementNotFoundError com o seletor quando o campo não existe', async () => {
    loadFixture('dom-form-basico');
    const p = setFieldValue('#naoExiste', 'x');
    await expect(p).rejects.toBeInstanceOf(ElementNotFoundError);
    await expect(setFieldValue('#naoExiste', 'x')).rejects.toThrow('Elemento não encontrado: "#naoExiste"');
  });

  it('recusa campo somente leitura ou desabilitado, salvo com force', async () => {
    loadFixture('dom-form-basico');
    await expect(setFieldValue('#txtSomenteLeitura', 'x')).rejects.toThrow(/"#txtSomenteLeitura".*somente leitura/);
    await expect(setFieldValue('#txtDesabilitado', 'x')).rejects.toThrow(/"#txtDesabilitado".*desabilitado/);
    await expect(setFieldValue('#txtSomenteLeitura', 'x')).rejects.toBeInstanceOf(DomHelperError);
    await setFieldValue('#txtSomenteLeitura', 'x', { force: true });
    expect(document.querySelector('#txtSomenteLeitura').value).toBe('x');
  });

  it('recusa valor nulo ou indefinido', async () => {
    loadFixture('dom-form-basico');
    await expect(setFieldValue('#txtNome', null)).rejects.toThrow(TypeError);
    await expect(setFieldValue('#txtNome', undefined)).rejects.toThrow(TypeError);
  });

  it('lança ValueNotAppliedError quando a página altera o valor', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#txtNome');
    el.addEventListener('change', () => { el.value = el.value.slice(0, 3); });
    const p = setFieldValue(el, 'abcdef');
    await expect(p).rejects.toBeInstanceOf(ValueNotAppliedError);
    await expect(setFieldValue(el, 'abcdef')).rejects.toThrow('Valor não aplicado em "#txtNome": esperado "abcdef", ficou "abc"');
  });

  it('com verify: false aceita o valor reformatado pela página', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#txtNome');
    el.addEventListener('change', () => { el.value = el.value.toUpperCase(); });
    await expect(setFieldValue(el, 'abc', { verify: false })).resolves.toMatchObject({ strategy: 'native' });
    expect(el.value).toBe('ABC');
  });
});

describe('setFieldValue: select', () => {
  it('seleciona pelo value', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#bpaPrincipal');
    const eventos = recordEvents(el, ['change']);
    const res = await setFieldValue(el, '0301060100');
    expect(el.value).toBe('0301060100');
    expect(eventos).toEqual(['change']);
    expect(res.value).toBe('0301060100');
  });

  it('seleciona pelo texto, sem diferenciar maiúsculas e acentos', async () => {
    loadFixture('dom-form-basico');
    await setFieldValue('#bpaPrincipal', 'atendimento ortopedico com imobilizacao provisoria');
    expect(document.querySelector('#bpaPrincipal').value).toBe('0301060100');
  });

  it('lança OptionNotFoundError listando as opções existentes', async () => {
    loadFixture('dom-form-basico');
    const p = setFieldValue('#bpaPrincipal', 'inexistente');
    await expect(p).rejects.toBeInstanceOf(OptionNotFoundError);
    await expect(setFieldValue('#bpaPrincipal', 'inexistente')).rejects.toThrow(
      'Opção "inexistente" não existe em "#bpaPrincipal". Opções: Selecione; ATENDIMENTO MEDICO EM UNIDADE DE PRONTO ATENDIMENTO; ATENDIMENTO ORTOPÉDICO COM IMOBILIZAÇÃO PROVISÓRIA',
    );
  });
});

describe('setFieldValue: checkbox e radio', () => {
  it('marca e desmarca checkbox com clique (o binding checked do Knockout escuta click)', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#chkCabecalho');
    const eventos = recordEvents(el, ['click', 'change']);
    await setFieldValue(el, true);
    expect(el.checked).toBe(true);
    expect(eventos).toEqual(['click', 'change']);
    await setFieldValue(el, false);
    expect(el.checked).toBe(false);
  });

  it('não clica quando o checkbox já está no estado pedido', async () => {
    loadFixture('dom-form-basico');
    const el = document.querySelector('#chkCabecalho');
    el.checked = true;
    const eventos = recordEvents(el, ['click']);
    await setFieldValue(el, true);
    expect(eventos).toEqual([]);
  });

  it('exige booleano para checkbox', async () => {
    loadFixture('dom-form-basico');
    await expect(setFieldValue('#chkCabecalho', 'sim')).rejects.toThrow(TypeError);
  });

  it('marca um radio com true', async () => {
    loadFixture('dom-form-basico');
    await setFieldValue('#rdDefinitivo', true);
    expect(document.querySelector('#rdDefinitivo').checked).toBe(true);
  });

  it('escolhe o radio do grupo pelo value ou pelo texto do label', async () => {
    loadFixture('dom-form-basico');
    await setFieldValue('#rdProvisorio', '2');
    expect(document.querySelector('#rdDefinitivo').checked).toBe(true);
    const res = await setFieldValue('#rdDefinitivo', 'provisorio');
    expect(document.querySelector('#rdProvisorio').checked).toBe(true);
    expect(res.value).toBe('1');
  });

  it('não desmarca radio e lista as opções quando não acha', async () => {
    loadFixture('dom-form-basico');
    await expect(setFieldValue('#rdProvisorio', false)).rejects.toThrow(/radio/);
    await expect(setFieldValue('#rdProvisorio', 'outro')).rejects.toThrow(/Opções: Provisório; Definitivo/);
  });
});

describe('setFieldValue: Knockout via eventos nativos', () => {
  function bindVm() {
    loadFixture('dom-form-knockout');
    const vm = {
      DscMotivo: ko.observable(''),
      DscHistorico: ko.observable(''),
      Tipos: [{ Cod: 1, Dsc: 'Provisório' }, { Cod: 2, Dsc: 'Definitivo' }],
      IndTipoDiagnostico: ko.observable(1),
      IndCabecalho: ko.observable(false),
      NumDias: ko.observable(0),
    };
    vm.Total = ko.pureComputed(() => vm.NumDias() * 2);
    ko.applyBindings(vm, document.querySelector('#vmConsulta'));
    return vm;
  }

  afterEach(() => {
    const root = document.querySelector('#vmConsulta');
    if (root) ko.cleanNode(root);
  });

  it('atualiza observables ligados por value, textInput, options e checked', async () => {
    const vm = bindVm();
    await setFieldValue('#DscMotivo', 'Dor abdominal (sintético)');
    await setFieldValue('#DscHistorico', 'Sem comorbidades (sintético)');
    await setFieldValue('#IndTipoDiagnostico', 'Definitivo');
    await setFieldValue('#IndCabecalho', true);
    expect(vm.DscMotivo()).toBe('Dor abdominal (sintético)');
    expect(vm.DscHistorico()).toBe('Sem comorbidades (sintético)');
    expect(vm.IndTipoDiagnostico()).toBe(2);
    expect(vm.IndCabecalho()).toBe(true);
  });
});

describe('setFieldValue: roteamento para a ponte (mundo MAIN)', () => {
  const fakeBridge = (impl = async () => ({ ok: true })) => ({ request: vi.fn(impl) });

  it('com a opção observable pede à ponte, identificando o elemento por um atributo', async () => {
    loadFixture('dom-form-knockout');
    const bridge = fakeBridge();
    const res = await setFieldValue('#spanNumDias', 5, { observable: 'NumDias', bridge });
    expect(bridge.request).toHaveBeenCalledTimes(1);
    const [type, payload] = bridge.request.mock.calls[0];
    expect(type).toBe('setFieldValue');
    expect(payload).toMatchObject({ value: 5, observable: 'NumDias' });
    expect(document.querySelector(payload.selector)).toBe(document.querySelector('#spanNumDias'));
    expect(res).toEqual({ strategy: 'knockout', value: 5 });
  });

  it('widgets DevExtreme (.dx-widget) vão para a ponte, mesmo apontando para o input interno', async () => {
    loadFixture('dom-devextreme-selectbox');
    const bridge = fakeBridge();
    const res = await setFieldValue('#comboMedicamentoInput', 'DIPIRONA', { bridge });
    const [type, payload] = bridge.request.mock.calls[0];
    expect(type).toBe('setFieldValue');
    expect(payload.observable).toBeUndefined();
    expect(document.querySelector(payload.selector)).toBe(document.querySelector('#comboMedicamentoInput'));
    expect(res.strategy).toBe('devextreme');
  });

  it('reaproveita o mesmo identificador em chamadas seguidas', async () => {
    loadFixture('dom-devextreme-selectbox');
    const bridge = fakeBridge();
    await setFieldValue('#comboMedicamento', 'a', { bridge });
    await setFieldValue('#comboMedicamento', 'b', { bridge });
    expect(bridge.request.mock.calls[0][1].selector).toBe(bridge.request.mock.calls[1][1].selector);
  });

  it('sem ponte, explica que o campo precisa do mundo MAIN', async () => {
    loadFixture('dom-devextreme-selectbox');
    await expect(setFieldValue('#comboMedicamento', 'x')).rejects.toThrow(/precisa da ponte/);
    loadFixture('dom-form-knockout');
    await expect(setFieldValue('#spanNumDias', 1, { observable: 'NumDias' })).rejects.toThrow(/precisa da ponte/);
  });

  it('erro da ponte vira DomHelperError citando o campo', async () => {
    loadFixture('dom-devextreme-selectbox');
    const bridge = fakeBridge(async () => { throw new Error('Opção "x" não existe'); });
    const p = setFieldValue('#comboMedicamento', 'x', { bridge });
    await expect(p).rejects.toBeInstanceOf(DomHelperError);
    await expect(setFieldValue('#comboMedicamento', 'x', { bridge })).rejects.toThrow(
      'Falha ao preencher "#comboMedicamento" pela ponte: Opção "x" não existe',
    );
  });

  it('não confia no conteúdo da resposta da ponte', async () => {
    loadFixture('dom-devextreme-selectbox');
    const bridge = fakeBridge(async () => ({ strategy: '<img src=x onerror=alert(1)>', value: 'forjado' }));
    await expect(setFieldValue('#comboMedicamento', 'x', { bridge })).resolves.toEqual({ strategy: 'devextreme', value: 'x' });
  });
});
