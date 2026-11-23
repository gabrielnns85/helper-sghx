import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addScreenModal } from '../helpers/screen-modals.js';
import { runLoginStep } from '../../src/features/auto-login/login-step.js';
import { runContextStep } from '../../src/features/auto-login/context-step.js';
import { runQueueStep } from '../../src/features/auto-login/queue-step.js';
import { NO_QUEUE } from '../../src/core/catalog.js';

const TIMEOUT = 300;
const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });
const CLOUD = Object.freeze({ enabled: true, mode: 'cloud', user: '', password: '' });
const PASSWORD = Object.freeze({ enabled: true, mode: 'password', user: 'medico', password: 'S3nh@-secreta' });

/** Estado falso: libera tudo, a não ser que `blocked` diga o contrário. */
function fakeState({ blocked = [], pending = null } = {}) {
  let queue = pending;
  return {
    tryAttempt: vi.fn((step) => !blocked.includes(step)),
    markQueuePending: vi.fn((q) => { queue = q; }),
    takeQueuePending: vi.fn(() => { const q = queue; queue = null; return q; }),
    hasQueuePending: vi.fn(() => queue !== null),
  };
}

const $ = (s) => document.querySelector(s);
const show = (el) => { el.style.display = 'block'; };
const hide = (el) => { el.style.display = 'none'; };

function addErrorDialog() {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.style.display = 'block';
  box.innerHTML = '<div class="modal-header erro"><span class="bootstrap-dialog-title">ERRO</span></div>'
    + '<div class="bootstrap-dialog-message">Usuário ou senha inválidos</div>';
  document.body.appendChild(box);
}

afterEach(clearFixture);

describe('runLoginStep: Login Nuvem (VIDAAS)', () => {
  let entrar;

  beforeEach(() => {
    loadFixture('login-certificado-nuvem');
    const modal = $('#modalProvedorCertificado');
    hide(modal);
    $('#loginCertificadoNuvem').addEventListener('click', () => show(modal));
    entrar = vi.fn();
    modal.querySelector('#modalLoginEntra').addEventListener('click', entrar);
  });

  it('abre o Certificado Nuvem, escolhe VIDAAS e clica em entrar dentro do modal', async () => {
    const result = await runLoginStep({ config: CLOUD, state: fakeState(), timeout: TIMEOUT });
    expect(result).toBe('submitted');
    expect($('#comboProvedor').value).toBe('VIDAAS');
    expect(entrar).toHaveBeenCalledTimes(1);
  });

  it('não preenche usuário nem senha no modo nuvem', async () => {
    await runLoginStep({ config: CLOUD, state: fakeState(), timeout: TIMEOUT });
    expect($('#inputUsuario').value).toBe('');
    expect($('#inputSenha').value).toBe('');
  });

  it('clica no entrar do modal visível, não no #modalLoginEntra repetido de outro modal', async () => {
    const outro = vi.fn();
    const hidden = addScreenModal({ id: 'modalListaCertificado', title: 'Certificado' });
    hide(hidden);
    const a = document.createElement('a');
    a.id = 'modalLoginEntra';
    a.addEventListener('click', outro);
    hidden.prepend(a);
    document.body.prepend(hidden);
    await runLoginStep({ config: CLOUD, state: fakeState(), timeout: TIMEOUT });
    expect(outro).not.toHaveBeenCalled();
    expect(entrar).toHaveBeenCalledTimes(1);
  });

  it('modal do provedor não abre: erro claro, sem clicar em nada', async () => {
    const fresh = $('#loginCertificadoNuvem').cloneNode(true); // sem o handler que abre o modal
    $('#loginCertificadoNuvem').replaceWith(fresh);
    await expect(runLoginStep({ config: CLOUD, state: fakeState(), timeout: TIMEOUT })).rejects.toThrow(/Tempo esgotado/);
    expect(entrar).not.toHaveBeenCalled();
  });
});

describe('runLoginStep: usuário e senha', () => {
  let submitted;

  beforeEach(() => {
    loadFixture('login');
    submitted = vi.fn((e) => e.preventDefault());
    $('form').addEventListener('submit', submitted);
  });

  it('preenche usuário e senha e clica em Entrar', async () => {
    const result = await runLoginStep({ config: PASSWORD, state: fakeState(), timeout: TIMEOUT });
    expect(result).toBe('submitted');
    expect($('#inputUsuario').value).toBe('medico');
    expect($('#inputSenha').value).toBe('S3nh@-secreta');
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('se o campo de senha recusar, o erro não repete a senha', async () => {
    $('#inputSenha').readOnly = true;
    const err = await runLoginStep({ config: PASSWORD, state: fakeState(), timeout: TIMEOUT }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain('S3nh@-secreta');
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('runLoginStep: quando não age', () => {
  beforeEach(() => loadFixture('login'));

  it('fora da tela de login (já logado): não faz nada', async () => {
    loadFixture('fila-pronto-atendimento');
    const state = fakeState();
    expect(await runLoginStep({ config: CLOUD, state, timeout: TIMEOUT })).toBe('not-ready');
    expect(state.tryAttempt).not.toHaveBeenCalled();
  });

  it('com pop-up de erro aberto (ex.: senha errada): para', async () => {
    addErrorDialog();
    expect(await runLoginStep({ config: PASSWORD, state: fakeState(), timeout: TIMEOUT })).toBe('not-ready');
    expect($('#inputSenha').value).toBe('');
  });

  it('com outro modal de login aberto (dois fatores, termo de uso…): para', async () => {
    addScreenModal({ id: 'modalAutentDoisFatores', title: 'Autenticação', root: document.body });
    expect(await runLoginStep({ config: PASSWORD, state: fakeState(), timeout: TIMEOUT })).toBe('not-ready');
  });

  it('já tentou há pouco (sem loop): não tenta de novo', async () => {
    const result = await runLoginStep({ config: PASSWORD, state: fakeState({ blocked: ['login'] }), timeout: TIMEOUT });
    expect(result).toBe('cooldown');
    expect($('#inputSenha').value).toBe('');
  });
});

describe('runContextStep: modal de contexto', () => {
  let entrar;

  beforeEach(() => {
    loadFixture('login-contexto');
    entrar = vi.fn();
    $('#modalLogin #modalLoginEntra').addEventListener('click', entrar);
  });

  const run = (patch = {}) =>
    runContextStep({ codFces: 28, queue: NO_QUEUE, state: fakeState(), timeout: TIMEOUT, ...patch });

  it('escolhe 59 SBCD - SAO PAULO (nunca o - SGHX), a unidade, o submódulo e entra', async () => {
    expect(await run()).toBe('submitted');
    expect($('#comboMunicipio').value).toBe('59');
    expect($('#comboEstabelecimento').value).toBe('28');
    expect($('#comboSubModulo').value).toBe('2');
    expect(entrar).toHaveBeenCalledTimes(1);
  });

  it('mantém a ocupação que já veio escolhida', async () => {
    await run();
    expect($('#comboOcupacao').value).toBe('1');
  });

  it('espera as opções carregadas depois do Cliente (cascata por ajax)', async () => {
    const estab = $('#comboEstabelecimento');
    estab.replaceChildren();
    $('#comboMunicipio').addEventListener('change', () => {
      setTimeout(() => { estab.innerHTML = '<option value="">Selecione</option><option value="28">UPA JACANA</option>'; }, 30);
    });
    expect(await run()).toBe('submitted');
    expect(estab.value).toBe('28');
  });

  it('ocupação sem escolha: para no modal para o médico escolher, sem clicar em entrar', async () => {
    $('#comboOcupacao').innerHTML = '<option value="">Selecione</option><option value="1">MEDICO TESTE</option><option value="2">OUTRA</option>';
    expect(await run()).toBe('needs-occupation');
    expect(entrar).not.toHaveBeenCalled();
  });

  it('unidade que não aparece: erro claro, sem entrar', async () => {
    await expect(run({ codFces: 999 })).rejects.toThrow(/Tempo esgotado/);
    expect(entrar).not.toHaveBeenCalled();
  });

  it('com fila configurada, marca a fila para abrir depois de entrar', async () => {
    const state = fakeState();
    await run({ queue: PEDIATRIA, state });
    expect(state.markQueuePending).toHaveBeenCalledWith(PEDIATRIA);
  });

  it('sem fila configurada, não marca nada', async () => {
    const state = fakeState();
    await run({ state });
    expect(state.markQueuePending).not.toHaveBeenCalled();
  });

  it('com pop-up aberto ou modal de contexto fechado: não age', async () => {
    addErrorDialog();
    expect(await run()).toBe('not-ready');
    clearFixture();
    loadFixture('login');
    expect(await run()).toBe('not-ready');
  });

  it('já tentou há pouco: não tenta de novo', async () => {
    expect(await run({ state: fakeState({ blocked: ['context'] }) })).toBe('cooldown');
    expect(entrar).not.toHaveBeenCalled();
  });
});

describe('runQueueStep: abre a fila configurada depois de entrar', () => {
  let clicked;

  beforeEach(() => {
    loadFixture('fila-categorias');
    clicked = vi.fn();
    $('#Fila_GridAcao').addEventListener('click', (e) => clicked(e.target.closest('tr').textContent));
  });

  it('clica na categoria com os mesmos códigos (aguardando, não "já atendidos")', async () => {
    expect(await runQueueStep({ state: fakeState({ pending: PEDIATRIA }), timeout: TIMEOUT })).toBe('selected');
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(clicked.mock.calls[0][0]).toBe('PRONTO ATENDIMENTO - PEDIATRIA1');
  });

  it('sem marca pendente (o médico só abriu a fila): não clica', async () => {
    expect(await runQueueStep({ state: fakeState(), timeout: TIMEOUT })).toBe('no-pending');
    expect(clicked).not.toHaveBeenCalled();
  });

  it('categoria vazia some da lista: desiste sem erro', async () => {
    const ortopedia = { codAcaoDestino: 5, codEspecialidade: 105, indSituacao: 1 };
    expect(await runQueueStep({ state: fakeState({ pending: ortopedia }), timeout: TIMEOUT })).toBe('queue-not-found');
    expect(clicked).not.toHaveBeenCalled();
  });

  it('data-model malformado é ignorado', async () => {
    $('#Fila_GridAcao tr').setAttribute('data-model', '{quebrado');
    expect(await runQueueStep({ state: fakeState({ pending: PEDIATRIA }), timeout: TIMEOUT })).toBe('selected');
  });

  it('fora da fila: não consome a marca', async () => {
    loadFixture('login');
    const state = fakeState({ pending: PEDIATRIA });
    expect(await runQueueStep({ state, timeout: TIMEOUT })).toBe('not-ready');
    expect(state.takeQueuePending).not.toHaveBeenCalled();
  });
});
