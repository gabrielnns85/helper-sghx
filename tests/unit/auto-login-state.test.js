// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { ATTEMPT_COOLDOWN_MS, QUEUE_PENDING_TTL_MS, createAutoLoginState } from '../../src/features/auto-login/state.js';

/** sessionStorage em memória (mesma API síncrona). */
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    dump: () => Object.fromEntries(data),
  };
}

const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });

let storage;
let clock;
let state;

beforeEach(() => {
  storage = memoryStorage();
  clock = 1_000_000;
  state = createAutoLoginState({ storage, now: () => clock });
});

describe('tentativas (sem loop)', () => {
  it('a primeira tentativa de uma etapa é liberada e a segunda, logo depois, não', () => {
    expect(state.tryAttempt('login')).toBe(true);
    expect(state.tryAttempt('login')).toBe(false);
  });

  it('etapas diferentes não se bloqueiam', () => {
    expect(state.tryAttempt('login')).toBe(true);
    expect(state.tryAttempt('context')).toBe(true);
  });

  it('vale entre carregamentos da mesma aba (VIDAAS cancelado volta ao login sem repetir)', () => {
    state.tryAttempt('login');
    const reloaded = createAutoLoginState({ storage, now: () => clock });
    expect(reloaded.tryAttempt('login')).toBe(false);
  });

  it('depois do intervalo de espera, libera de novo', () => {
    state.tryAttempt('login');
    clock += ATTEMPT_COOLDOWN_MS;
    expect(state.tryAttempt('login')).toBe(true);
  });

  it('valor estranho no armazenamento conta como nenhuma tentativa', () => {
    storage.setItem('helper-sghx:auto-login:attempt:login', 'lixo');
    expect(state.tryAttempt('login')).toBe(true);
  });

  it('sem sessionStorage (bloqueado), não tenta nada: melhor não entrar do que entrar em loop', () => {
    const broken = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => {},
    };
    expect(createAutoLoginState({ storage: broken, now: () => clock }).tryAttempt('login')).toBe(false);
  });
});

describe('fila pendente depois de entrar', () => {
  it('guarda só os códigos da fila e entrega uma vez', () => {
    state.markQueuePending({ ...PEDIATRIA, label: 'não vai' });
    expect(JSON.stringify(storage.dump())).not.toContain('não vai');
    expect(state.takeQueuePending()).toEqual(PEDIATRIA);
    expect(state.takeQueuePending()).toBeNull();
  });

  it('marca velha expira', () => {
    state.markQueuePending(PEDIATRIA);
    clock += QUEUE_PENDING_TTL_MS + 1;
    expect(state.takeQueuePending()).toBeNull();
  });

  it('marca corrompida é descartada', () => {
    storage.setItem('helper-sghx:auto-login:queue', '{"queue":{"codAcaoDestino":"x"}}');
    expect(state.takeQueuePending()).toBeNull();
  });

  it('hasQueuePending não consome a marca', () => {
    state.markQueuePending(PEDIATRIA);
    expect(state.hasQueuePending()).toBe(true);
    expect(state.takeQueuePending()).toEqual(PEDIATRIA);
    expect(state.hasQueuePending()).toBe(false);
  });
});

describe('o que fica no sessionStorage', () => {
  it('nunca guarda usuário nem senha: só horários e códigos', () => {
    state.tryAttempt('login');
    state.markQueuePending(PEDIATRIA);
    for (const value of Object.values(storage.dump())) {
      expect(value).toMatch(/^[\d{}":,a-zA-Z]+$/);
      expect(value).not.toMatch(/senha|password|user/i);
    }
  });
});
