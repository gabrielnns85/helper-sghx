import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addScreenModal } from '../helpers/screen-modals.js';
import { runLoginStep } from '../../src/features/auto-login/login-step.js';
import { runContextStep } from '../../src/features/auto-login/context-step.js';
import { runQueueStep } from '../../src/features/auto-login/queue-step.js';
import { runModuleStep } from '../../src/features/auto-login/module-step.js';
import { FILA_PATH, runNavigateStep } from '../../src/features/auto-login/navigate-step.js';
import { NO_QUEUE } from '../../src/core/catalog.js';

const TIMEOUT = 300;
const HOST = window.location.hostname;
const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });
const CLOUD = Object.freeze({ enabled: true, mode: 'cloud', user: '', password: '' });
const PASSWORD = Object.freeze({ enabled: true, mode: 'password', user: 'medico', password: 'S3nh@-secreta' });

/** Estado falso: libera tudo, a não ser que `blocked` diga o contrário. */
function fakeState({ blocked = [], pending = null, entered = false, loginSubmitted = false } = {}) {
  let queue = pending;
  let submitted = loginSubmitted;
  return {
    hasEntered: vi.fn(() => entered),
    markEntered: vi.fn(),
    hasLoginSubmitted: vi.fn(() => submitted),
    markLoginSubmitted: vi.fn(() => { submitted = true; }),
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

describe('runModuleStep: tela de Módulos', () => {
  let opened;

  beforeEach(() => {
    loadFixture('modulos');
    opened = vi.fn();
    document.querySelectorAll('.card-modulo-sghx').forEach((card) => card.addEventListener('click', () => opened(card.id)));
  });

  it('clica em Módulo Atendimento (e só nele)', async () => {
    expect(await runModuleStep({ state: fakeState() })).toBe('submitted');
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened).toHaveBeenCalledWith('2');
  });

  it('fora da tela de Módulos: não faz nada', async () => {
    loadFixture('login');
    const state = fakeState();
    expect(await runModuleStep({ state })).toBe('not-ready');
    expect(state.tryAttempt).not.toHaveBeenCalled();
  });

  it('sem o card de Atendimento: não clica em outro módulo', async () => {
    document.querySelector('.card-modulo-sghx[id="2"]').remove();
    expect(await runModuleStep({ state: fakeState() })).toBe('not-ready');
    expect(opened).not.toHaveBeenCalled();
  });

  it('já entrou nesta aba (voltou aos Módulos de propósito): não clica', async () => {
    expect(await runModuleStep({ state: fakeState({ entered: true }) })).toBe('not-ready');
    expect(opened).not.toHaveBeenCalled();
  });

  it('com pop-up aberto: não clica', async () => {
    addErrorDialog();
    expect(await runModuleStep({ state: fakeState() })).toBe('not-ready');
    expect(opened).not.toHaveBeenCalled();
  });

  it('já tentou há pouco: não tenta de novo', async () => {
    expect(await runModuleStep({ state: fakeState({ blocked: ['module'] }) })).toBe('cooldown');
    expect(opened).not.toHaveBeenCalled();
  });
});

describe('runLoginStep: Login Nuvem (VIDAAS)', () => {
  let directClick;
  let bridge;

  beforeEach(() => {
    loadFixture('login-certificado-nuvem');
    const modal = $('#modalProvedorCertificado');
    hide(modal);
    $('#loginCertificadoNuvem').addEventListener('click', () => show(modal));
    directClick = vi.fn();
    modal.querySelector('#modalLoginEntra').addEventListener('click', directClick);
    bridge = { request: vi.fn(async () => ({ clicked: true })) };
  });

  const run = (patch = {}) => runLoginStep({ config: CLOUD, state: fakeState(), bridge, timeout: TIMEOUT, ...patch });

  it('abre o Certificado Nuvem, escolhe VIDAAS e pede à ponte o entrar (javascript: só roda no mundo da página)', async () => {
    expect(await run()).toBe('submitted');
    expect($('#comboProvedor').value).toBe('5');
    expect(bridge.request).toHaveBeenCalledWith('submitCloudProvider');
    expect(directClick).not.toHaveBeenCalled();
  });

  it('escolhe VIDAAS antes de pedir o entrar', async () => {
    bridge.request.mockImplementation(async () => {
      expect($('#comboProvedor').selectedOptions[0].text).toBe('VIDAAS');
    });
    await run();
    expect(bridge.request).toHaveBeenCalledTimes(1);
  });

  it('não preenche usuário nem senha no modo nuvem', async () => {
    await run();
    expect($('#inputUsuario').value).toBe('');
    expect($('#inputSenha').value).toBe('');
  });

  it('sem a ponte com a página: erro claro', async () => {
    await expect(run({ bridge: undefined })).rejects.toThrow(/ponte/i);
  });

  it('a ponte falha: erro claro', async () => {
    bridge.request.mockRejectedValue(new Error('Tempo esgotado na ponte'));
    await expect(run()).rejects.toThrow(/entrar do Certificado em Nuvem/i);
  });

  it('modal do provedor não abre: erro claro, sem pedir o entrar', async () => {
    const fresh = $('#loginCertificadoNuvem').cloneNode(true); // sem o handler que abre o modal
    $('#loginCertificadoNuvem').replaceWith(fresh);
    await expect(run()).rejects.toThrow(/Tempo esgotado/);
    expect(bridge.request).not.toHaveBeenCalled();
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
    const result = await runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState(), timeout: TIMEOUT });
    expect(result).toBe('submitted');
    expect($('#inputUsuario').value).toBe('medico');
    expect($('#inputSenha').value).toBe('S3nh@-secreta');
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('se o campo de senha recusar, o erro não repete a senha', async () => {
    $('#inputSenha').readOnly = true;
    const err = await runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState(), timeout: TIMEOUT }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain('S3nh@-secreta');
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('runLoginStep: segurança da senha e tentativas', () => {
  beforeEach(() => loadFixture('login'));
  const run = (patch = {}) => runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState(), timeout: TIMEOUT, ...patch });

  it('endereço diferente do SGHx esperado: não preenche a senha (subdomínio falso)', async () => {
    await expect(run({ allowedHost: 'upajacana.smsprefeiturasp.com.br' })).rejects.toThrow(/endereço/i);
    expect($('#inputSenha').value).toBe('');
    expect($('#inputUsuario').value).toBe('');
  });

  it('sem endereço esperado configurado: não preenche', async () => {
    await expect(run({ allowedHost: undefined })).rejects.toThrow(/endereço/i);
    expect($('#inputSenha').value).toBe('');
  });

  it('formulário que envia para outra origem: não preenche a senha', async () => {
    $('form').setAttribute('action', 'https://exemplo-falso.invalid/coleta');
    await expect(run()).rejects.toThrow(/outro endereço|formulário/i);
    expect($('#inputSenha').value).toBe('');
  });

  it('formulário com action do próprio SGHx é aceito', async () => {
    $('form').setAttribute('action', '/sistema/Login?ReturnUrl=%2fsistema%2fpep');
    expect(await run()).toBe('submitted');
  });

  it('o usuário não aparece na mensagem de erro (pode ser o CPF do profissional)', async () => {
    $('#inputUsuario').readOnly = true;
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain('medico');
  });

  it('sem o campo de senha na tela: erro claro (sem TypeError)', async () => {
    $('#inputSenha').remove();
    const err = await run().catch((e) => e);
    expect(err.message).toMatch(/senha/i);
    expect(err).not.toBeInstanceOf(TypeError);
  });

  it('depois de enviar, marca "login enviado"', async () => {
    const state = fakeState();
    await run({ state });
    expect(state.markLoginSubmitted).toHaveBeenCalledTimes(1);
  });

  it('a tela de login voltou depois de um envio (senha errada, VIDAAS cancelado): não repete sozinho', async () => {
    const state = fakeState({ loginSubmitted: true });
    expect(await run({ state })).toBe('already-submitted');
    expect($('#inputSenha').value).toBe('');
    expect(state.tryAttempt).not.toHaveBeenCalled();
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
    expect(await runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState(), timeout: TIMEOUT })).toBe('not-ready');
    expect($('#inputSenha').value).toBe('');
  });

  it('com outro modal de login aberto (dois fatores, termo de uso…): para', async () => {
    addScreenModal({ id: 'modalAutentDoisFatores', title: 'Autenticação', root: document.body });
    expect(await runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState(), timeout: TIMEOUT })).toBe('not-ready');
  });

  it('já tentou há pouco (sem loop): não tenta de novo', async () => {
    const result = await runLoginStep({ config: PASSWORD, allowedHost: HOST, state: fakeState({ blocked: ['login'] }), timeout: TIMEOUT });
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

  it('ocupação sem escolha: marca a fila para abrir quando o médico entrar à mão', async () => {
    $('#comboOcupacao').innerHTML = '<option value="">Selecione</option><option value="2">OUTRA</option>';
    const state = fakeState();
    expect(await run({ queue: PEDIATRIA, state })).toBe('needs-occupation');
    expect(state.markQueuePending).toHaveBeenCalledWith(PEDIATRIA);
  });

  it('a lista recarregou e zerou um campo antes do clique: confere, para e não entra', async () => {
    $('#comboSubModulo').addEventListener('change', () => { $('#comboEstabelecimento').value = ''; });
    $('#comboSubModulo').innerHTML = '<option value="">Selecione</option><option value="2">PRONTO ATENDIMENTO</option>';
    await expect(run()).rejects.toThrow(/diverg/i);
    expect(entrar).not.toHaveBeenCalled();
  });

  it('opção 59 com texto de SGHX: recusa (cliente errado), sem entrar', async () => {
    $('#comboMunicipio').innerHTML = '<option value="">Selecione</option><option value="59">SBCD - SAO PAULO - SGHX</option>';
    await expect(run()).rejects.toThrow(/diverg|cliente/i);
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

describe('runNavigateStep: depois de entrar, vai para Atendimento > Fila de Atendimento', () => {
  const ORIGIN = 'https://upajacana.smsprefeiturasp.com.br';
  const fakeLocation = (pathname) => ({ origin: ORIGIN, pathname, assign: vi.fn() });

  beforeEach(() => { document.body.innerHTML = '<div class="content"><h1>PEP</h1></div>'; });

  it('com fila pendente, na página inicial do PEP: abre a Fila de Atendimento', async () => {
    const location = fakeLocation('/sistema/pep');
    expect(await runNavigateStep({ state: fakeState({ pending: PEDIATRIA }), location })).toBe('submitted');
    expect(location.assign).toHaveBeenCalledWith(`${ORIGIN}${FILA_PATH}`);
    expect(FILA_PATH).toBe('/sistema/Pep/Fila/FilaInicial');
  });

  it('não consome a marca (a etapa da fila usa depois)', async () => {
    const state = fakeState({ pending: PEDIATRIA });
    await runNavigateStep({ state, location: fakeLocation('/sistema/Pep/') });
    expect(state.hasQueuePending()).toBe(true);
  });

  it('sem fila pendente (o médico só navegou): não faz nada', async () => {
    const location = fakeLocation('/sistema/pep');
    expect(await runNavigateStep({ state: fakeState(), location })).toBe('not-ready');
    expect(location.assign).not.toHaveBeenCalled();
  });

  it.each(['/sistema/Pep/Fila/FilaInicial', '/sistema/', '/sistema/Login'])('em %s: não navega', async (path) => {
    const location = fakeLocation(path);
    expect(await runNavigateStep({ state: fakeState({ pending: PEDIATRIA }), location })).toBe('not-ready');
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('com a fila já na tela: não navega', async () => {
    loadFixture('fila-categorias');
    const location = fakeLocation('/sistema/pep');
    expect(await runNavigateStep({ state: fakeState({ pending: PEDIATRIA }), location })).toBe('not-ready');
  });

  it('com pop-up ou termo de uso aberto: não navega nem descarta o modal', async () => {
    addErrorDialog();
    const location = fakeLocation('/sistema/pep');
    expect(await runNavigateStep({ state: fakeState({ pending: PEDIATRIA }), location })).toBe('not-ready');
    expect(location.assign).not.toHaveBeenCalled();
  });

  it('já tentou há pouco: não tenta de novo', async () => {
    const location = fakeLocation('/sistema/pep');
    expect(await runNavigateStep({ state: fakeState({ pending: PEDIATRIA, blocked: ['navigate'] }), location })).toBe('cooldown');
    expect(location.assign).not.toHaveBeenCalled();
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

  it('com pop-up aberto: não clica e não consome a marca', async () => {
    addErrorDialog();
    const state = fakeState({ pending: PEDIATRIA });
    expect(await runQueueStep({ state, timeout: TIMEOUT })).toBe('not-ready');
    expect(clicked).not.toHaveBeenCalled();
    expect(state.takeQueuePending).not.toHaveBeenCalled();
  });

  it('fora da fila: não consome a marca', async () => {
    loadFixture('login');
    const state = fakeState({ pending: PEDIATRIA });
    expect(await runQueueStep({ state, timeout: TIMEOUT })).toBe('not-ready');
    expect(state.takeQueuePending).not.toHaveBeenCalled();
  });
});
