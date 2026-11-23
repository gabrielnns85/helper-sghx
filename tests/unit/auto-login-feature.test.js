import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { createAutoLoginFeature } from '../../src/features/auto-login/index.js';
import { createFeatureRegistry } from '../../src/features/index.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';

const TIMEOUT = 300;
const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });

function fakeState() {
  let queue = null;
  const attempts = new Set();
  return {
    tryAttempt: vi.fn((step) => (attempts.has(step) ? false : (attempts.add(step), true))),
    markQueuePending: vi.fn((q) => { queue = q; }),
    takeQueuePending: vi.fn(() => { const q = queue; queue = null; return q; }),
    hasQueuePending: vi.fn(() => queue !== null),
  };
}

function fakeCtx(all) {
  const listeners = new Set();
  return {
    settings: { get: vi.fn(async () => all) },
    screen: {
      subscribe: vi.fn((fn) => { listeners.add(fn); return () => listeners.delete(fn); }),
      emit: () => listeners.forEach((fn) => fn({})),
    },
  };
}

const withAutoLogin = (autoLogin, extra = {}) => ({ ...DEFAULT_SETTINGS, autoLogin: { ...DEFAULT_SETTINGS.autoLogin, ...autoLogin }, ...extra });
const $ = (s) => document.querySelector(s);

let submitted;

beforeEach(() => {
  loadFixture('login');
  submitted = vi.fn((e) => e.preventDefault());
  $('form').addEventListener('submit', submitted);
});

afterEach(() => {
  clearFixture();
  vi.restoreAllMocks();
});

describe('createAutoLoginFeature', () => {
  it('registra no registro de funcionalidades com o id auto-login', () => {
    const registry = createFeatureRegistry();
    registry.register(createAutoLoginFeature());
    expect(registry.list().map((f) => f.id)).toEqual(['auto-login']);
  });

  it('desligado (padrão): não toca na tela de login', async () => {
    const feature = createAutoLoginFeature({ state: fakeState(), timeout: TIMEOUT });
    await feature.init(fakeCtx(DEFAULT_SETTINGS));
    await feature.idle();
    expect($('#inputUsuario').value).toBe('');
    expect(submitted).not.toHaveBeenCalled();
  });

  it('ligado no modo senha: entra ao carregar a tela de login, uma vez só', async () => {
    const ctx = fakeCtx(withAutoLogin({ enabled: true, mode: 'password', user: 'medico', password: 'x1' }));
    const feature = createAutoLoginFeature({ state: fakeState(), timeout: TIMEOUT });
    await feature.init(ctx);
    await feature.idle();
    ctx.screen.emit();
    await feature.idle();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('modal de contexto aberto depois de autenticar (sem recarregar): segue para o contexto', async () => {
    const ctx = fakeCtx(withAutoLogin({ enabled: true }, { queueRefresh: { ...DEFAULT_SETTINGS.queueRefresh, queue: PEDIATRIA } }));
    const state = fakeState();
    const feature = createAutoLoginFeature({ state, timeout: TIMEOUT });
    loadFixture('login-contexto');
    const entrar = vi.fn();
    $('#modalLogin #modalLoginEntra').addEventListener('click', entrar);
    await feature.init(ctx);
    await feature.idle();
    expect(entrar).toHaveBeenCalledTimes(1);
    expect(state.markQueuePending).toHaveBeenCalledWith(PEDIATRIA);
  });

  it('na fila com marca pendente: abre a fila configurada', async () => {
    const state = fakeState();
    state.markQueuePending(PEDIATRIA);
    loadFixture('fila-categorias');
    const clicked = vi.fn();
    $('#Fila_GridAcao').addEventListener('click', clicked);
    const feature = createAutoLoginFeature({ state, timeout: TIMEOUT });
    await feature.init(fakeCtx(withAutoLogin({ enabled: true })));
    await feature.idle();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('falha numa etapa: avisa no console sem a senha e não quebra a extensão', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    $('#inputSenha').readOnly = true;
    const feature = createAutoLoginFeature({ state: fakeState(), timeout: TIMEOUT });
    await feature.init(fakeCtx(withAutoLogin({ enabled: true, mode: 'password', user: 'medico', password: 'S3gr3d0' })));
    await feature.idle();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('S3gr3d0');
  });

  it('erro ao ler as configurações: não tenta entrar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = fakeCtx(DEFAULT_SETTINGS);
    ctx.settings.get.mockRejectedValue(new Error('sem storage'));
    const feature = createAutoLoginFeature({ state: fakeState(), timeout: TIMEOUT });
    await feature.init(ctx);
    await feature.idle();
    expect(submitted).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
