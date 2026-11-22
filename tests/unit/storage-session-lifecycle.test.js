import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bindSessionToScreen } from '../../src/core/storage/session-lifecycle.js';
import { SCREEN } from '../../src/core/screen/index.js';

const screenOf = (...stack) => Object.freeze({ id: stack.at(-1) ?? SCREEN.UNKNOWN, stack: Object.freeze(stack) });
const FILA = screenOf('fila');
const CONSULTA = screenOf('fila', 'consulta');
const PRESCRICAO = screenOf('fila', 'consulta', 'prescricao');
const EMAD = screenOf('fila', 'consulta', 'unknown');
const LOGIN = screenOf('login');
const UNKNOWN = screenOf('unknown');

/** Dublê do watchScreen: o teste troca a tela com `go(screen)`. */
function fakeScreen(initial) {
  let current = initial;
  const listeners = new Set();
  return {
    current: () => current,
    subscribe: vi.fn((fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }),
    go(next) {
      const event = { previous: current, current: next };
      current = next;
      listeners.forEach((fn) => fn(event));
    },
    listenerCount: () => listeners.size,
  };
}

const fakeSession = () => ({
  start: vi.fn().mockResolvedValue({ id: 'a1' }),
  claim: vi.fn().mockResolvedValue({ id: 'a1' }),
  clear: vi.fn().mockResolvedValue(null),
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const setVisibility = (state) => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

let stop;
let session;
let hasFocus;

beforeEach(() => {
  session = fakeSession();
  setVisibility('visible');
  hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
});

describe('bindSessionToScreen: começo', () => {
  it('abrindo a extensão fora da consulta: apaga o que tiver sobrado da aba', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(FILA) });
    expect(session.clear).toHaveBeenCalledTimes(1);
    expect(session.start).not.toHaveBeenCalled();
  });

  it('abrindo a extensão já na consulta: abre o atendimento', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    expect(session.start).toHaveBeenCalledTimes(1);
    expect(session.clear).not.toHaveBeenCalled();
  });
});

describe('bindSessionToScreen: mudanças de tela', () => {
  it('fila → consulta abre o atendimento; consulta → fila apaga', () => {
    const screen = fakeScreen(FILA);
    stop = bindSessionToScreen({ session, screen });
    session.clear.mockClear();

    screen.go(CONSULTA);
    expect(session.start).toHaveBeenCalledTimes(1);

    screen.go(FILA);
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('logout (tela de login) apaga', () => {
    const screen = fakeScreen(CONSULTA);
    stop = bindSessionToScreen({ session, screen });
    screen.go(LOGIN);
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('modais dentro da consulta (prescrição, EMAD) não abrem atendimento novo nem apagam', () => {
    const screen = fakeScreen(CONSULTA);
    stop = bindSessionToScreen({ session, screen });
    session.start.mockClear();

    screen.go(PRESCRICAO);
    screen.go(EMAD);
    screen.go(CONSULTA);
    expect(session.start).not.toHaveBeenCalled();
    expect(session.clear).not.toHaveBeenCalled();
  });

  it('modal desconhecido sobre a consulta (ex.: sessão expirada) não apaga', () => {
    const screen = fakeScreen(CONSULTA);
    stop = bindSessionToScreen({ session, screen });
    screen.go(screenOf('fila', 'consulta', 'unknown'));
    expect(session.clear).not.toHaveBeenCalled();
  });

  it('saiu da consulta para qualquer outra tela (ex.: modal não mapeado sobre a fila) apaga', () => {
    const screen = fakeScreen(CONSULTA);
    stop = bindSessionToScreen({ session, screen });
    screen.go(screenOf('fila', 'unknown'));
    expect(session.clear).toHaveBeenCalledTimes(1);
    screen.go(UNKNOWN);
    expect(session.start).toHaveBeenCalledTimes(1);
  });

  it('entrar na consulta numa aba sem foco abre o atendimento sem torná-lo ativo', () => {
    hasFocus.mockReturnValue(false);
    const screen = fakeScreen(FILA);
    stop = bindSessionToScreen({ session, screen });
    screen.go(CONSULTA);
    expect(session.start).toHaveBeenLastCalledWith({ activate: false });
    hasFocus.mockReturnValue(true);
    screen.go(FILA);
    screen.go(CONSULTA);
    expect(session.start).toHaveBeenLastCalledWith({ activate: true });
  });
});

describe('bindSessionToScreen: aba em uso e saída da página', () => {
  it('foco na janela do SGHx assume o atendimento ativo', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    window.dispatchEvent(new Event('focus'));
    expect(session.claim).toHaveBeenCalledTimes(1);
  });

  it('aba do SGHx na fila em uso também assume (o worker tira o ativo de outra aba)', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(FILA) });
    window.dispatchEvent(new Event('focus'));
    expect(session.claim).toHaveBeenCalledTimes(1);
  });

  it('só ficar visível, sem interação (janela da frente fechou), não assume', () => {
    hasFocus.mockReturnValue(false);
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    expect(session.claim).not.toHaveBeenCalled();
  });

  it.each(['pointerdown', 'keydown'])('%s na página assume uma vez até a janela perder o foco', (type) => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    document.body.dispatchEvent(new Event(type, { bubbles: true }));
    document.body.dispatchEvent(new Event(type, { bubbles: true }));
    expect(session.claim).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('blur'));
    document.body.dispatchEvent(new Event(type, { bubbles: true }));
    expect(session.claim).toHaveBeenCalledTimes(2);
  });

  it('saindo da página (logout, F5, navegar) apaga', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    window.dispatchEvent(new Event('pagehide'));
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('voltando do cache de navegação (bfcache) na consulta reabre o atendimento', () => {
    stop = bindSessionToScreen({ session, screen: fakeScreen(CONSULTA) });
    session.start.mockClear();
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(session.start).not.toHaveBeenCalled();
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(session.start).toHaveBeenCalledTimes(1);
  });

  it('stop() desliga tudo', () => {
    const screen = fakeScreen(CONSULTA);
    stop = bindSessionToScreen({ session, screen });
    stop();
    stop = undefined;
    session.start.mockClear();

    screen.go(FILA);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('focus'));
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(screen.listenerCount()).toBe(0);
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.claim).not.toHaveBeenCalled();
  });
});

describe('bindSessionToScreen: erros', () => {
  it('falha do worker é avisada no console (sem dados do paciente) e não quebra', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    session.clear.mockRejectedValue(new Error('Sessão do atendimento indisponível'));
    stop = bindSessionToScreen({ session, screen: fakeScreen(FILA) });
    await flush();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[helper-sghx]'), 'Sessão do atendimento indisponível');
  });
});
