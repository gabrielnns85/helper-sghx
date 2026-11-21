import { describe, it, expect, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addDialog } from '../helpers/dialogs.js';
import { addScreenModal } from '../helpers/screen-modals.js';
import { detectScreen, SCREEN } from '../../src/core/screen/index.js';

afterEach(clearFixture);

describe('detectScreen: uma fixture por tela', () => {
  it.each([
    ['login', SCREEN.LOGIN, ['login']],
    ['login-contexto', SCREEN.LOGIN, ['login']],
    ['fila-pronto-atendimento', SCREEN.FILA, ['fila']],
    ['consulta-soap', SCREEN.CONSULTA, ['fila', 'consulta']],
    ['prescricao-medicamento', SCREEN.PRESCRICAO, ['fila', 'consulta', 'prescricao']],
    ['solicitacao-procedimentos', SCREEN.SOLICITACAO_PROCEDIMENTO, ['fila', 'consulta', 'solicitacao-procedimento']],
    ['atestado-medico', SCREEN.ATESTADO, ['fila', 'consulta', 'atestado']],
  ])('%s → %s', (fixture, id, stack) => {
    // Arrange
    loadFixture(fixture);

    // Act
    const screen = detectScreen();

    // Assert
    expect(screen).toEqual({ id, stack });
  });
});

describe('detectScreen: regras de empilhamento', () => {
  it('DOM vazio → unknown com pilha vazia', () => {
    expect(detectScreen()).toEqual({ id: SCREEN.UNKNOWN, stack: [] });
  });

  it('devolve objeto congelado (imutável)', () => {
    loadFixture('consulta-soap');
    const screen = detectScreen();
    expect(Object.isFrozen(screen)).toBe(true);
    expect(Object.isFrozen(screen.stack)).toBe(true);
  });

  it('questionário que não é atestado (EMAD) por cima da consulta → unknown', () => {
    loadFixture('questionario-emad');
    expect(detectScreen()).toEqual({ id: SCREEN.UNKNOWN, stack: ['fila', 'consulta', 'unknown'] });
  });

  it('modal não mapeado por cima → unknown, e não a tela de baixo', () => {
    loadFixture('consulta-soap');
    addScreenModal({ id: 'Orientacao_Modal', title: 'Orientações' });
    expect(detectScreen().id).toBe(SCREEN.UNKNOWN);
  });

  it('pop-up por cima não muda a tela', () => {
    loadFixture('consulta-soap');
    addDialog({ message: 'Deseja realmente sair sem salvar?', buttons: ['Sim', 'Não'] });
    expect(detectScreen()).toEqual({ id: SCREEN.CONSULTA, stack: ['fila', 'consulta'] });
  });

  it('modal oculto não conta', () => {
    loadFixture('prescricao-medicamento');
    document.querySelector('#PrescricaoMedicamento_Modal').style.display = 'none';
    expect(detectScreen().id).toBe(SCREEN.CONSULTA);
  });

  it('modal removido do DOM não conta', () => {
    loadFixture('consulta-soap');
    document.querySelector('#Consulta_Modal').remove();
    expect(detectScreen()).toEqual({ id: SCREEN.FILA, stack: ['fila'] });
  });

  it.each(['PosologiaMedicamentoModal', 'PosologiaModal', 'JustificativaFarmaciaExternaModal'])(
    'submodal %s da prescrição continua sendo prescricao',
    (id) => {
      loadFixture('prescricao-medicamento');
      addScreenModal({ id, title: 'Posologia' });
      expect(detectScreen()).toEqual({ id: SCREEN.PRESCRICAO, stack: ['fila', 'consulta', 'prescricao'] });
    },
  );

  it('reconhece o título do atestado sem diferenciar acentos e maiúsculas', () => {
    loadFixture('consulta-soap');
    addScreenModal({ id: 'ModalQuestionario', title: '  ATESTADO MEDICO ' });
    expect(detectScreen().id).toBe(SCREEN.ATESTADO);
  });

  it('não confunde Atestado Síndrome Gripal com o Atestado Médico', () => {
    loadFixture('consulta-soap');
    addScreenModal({ id: 'ModalQuestionario', title: 'Atestado Síndrome Gripal' });
    expect(detectScreen().id).toBe(SCREEN.UNKNOWN);
  });

  it('aceita o id do modal num elemento interno do .lightbox', () => {
    loadFixture('fila-pronto-atendimento');
    const modal = addScreenModal({ title: 'Consulta Médica' });
    modal.querySelector('.light-content-box').id = 'Consulta_Modal';
    expect(detectScreen().id).toBe(SCREEN.CONSULTA);
  });

  it('procura só dentro de root', () => {
    loadFixture('consulta-soap');
    const root = document.querySelector('.fila-atendimento');
    expect(detectScreen({ root })).toEqual({ id: SCREEN.FILA, stack: ['fila'] });
  });
});
