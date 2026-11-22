// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSessionStore } from '../../src/core/storage/session-store.js';
import { createFakeArea } from '../helpers/fake-chrome.js';

const SGHX_TAB = 10;
const OTHER_SGHX_TAB = 20;

let area;
let store;

beforeEach(() => {
  area = createFakeArea();
  store = createSessionStore({ area });
});

describe('createSessionStore: atendimento por aba do SGHx', () => {
  it('sem atendimento: current() é null e get() devolve undefined', async () => {
    expect(await store.current({ tabId: SGHX_TAB })).toBeNull();
    expect(await store.current({ active: true })).toBeNull();
    expect(await store.get({ tabId: SGHX_TAB }, 'paciente')).toBeUndefined();
  });

  it('start() abre um atendimento com id novo e o torna o ativo', async () => {
    const { id } = await store.start(SGHX_TAB);
    expect(id).toEqual(expect.any(String));
    expect(await store.current({ tabId: SGHX_TAB })).toEqual({ id });
    expect(await store.current({ active: true })).toEqual({ id });
  });

  it('start() de novo na mesma aba troca o atendimento e apaga os dados anteriores', async () => {
    const first = await store.start(SGHX_TAB);
    await store.set({ tabId: SGHX_TAB }, 'paciente', { nome: 'TESTE' });
    const second = await store.start(SGHX_TAB);
    expect(second.id).not.toBe(first.id);
    expect(await store.get({ tabId: SGHX_TAB }, 'paciente')).toBeUndefined();
  });

  it('set()/get() guardam valores por aba e o ativo enxerga a aba ativa', async () => {
    await store.start(SGHX_TAB);
    await store.set({ tabId: SGHX_TAB }, 'paciente', { nome: 'TESTE' });
    expect(await store.get({ tabId: SGHX_TAB }, 'paciente')).toEqual({ nome: 'TESTE' });
    expect(await store.get({ active: true }, 'paciente')).toEqual({ nome: 'TESTE' });
  });

  it('get() devolve cópia congelada: alterar o retorno não muda a sessão', async () => {
    await store.start(SGHX_TAB);
    await store.set({ tabId: SGHX_TAB }, 'paciente', { nome: 'TESTE', alergias: ['X'] });
    const value = await store.get({ tabId: SGHX_TAB }, 'paciente');
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.alergias)).toBe(true);
  });

  it('dois atendimentos em abas diferentes não se misturam', async () => {
    await store.start(SGHX_TAB);
    await store.set({ tabId: SGHX_TAB }, 'paciente', { nome: 'A' });
    await store.start(OTHER_SGHX_TAB);
    await store.set({ tabId: OTHER_SGHX_TAB }, 'paciente', { nome: 'B' });

    expect(await store.get({ tabId: SGHX_TAB }, 'paciente')).toEqual({ nome: 'A' });
    expect(await store.get({ active: true }, 'paciente')).toEqual({ nome: 'B' });
  });

  it('claim() torna ativa a aba que já tem atendimento; aba sem atendimento não vira ativa', async () => {
    const a = await store.start(SGHX_TAB);
    await store.start(OTHER_SGHX_TAB);

    expect(await store.claim(SGHX_TAB)).toEqual({ id: a.id });
    expect(await store.current({ active: true })).toEqual({ id: a.id });

    expect(await store.claim(99)).toBeNull();
    expect(await store.current({ active: true })).toEqual({ id: a.id });
  });

  it('clear() apaga só a aba e, se ela era a ativa, fica sem ativo', async () => {
    await store.start(SGHX_TAB);
    const b = await store.start(OTHER_SGHX_TAB);
    await store.clear(OTHER_SGHX_TAB);

    expect(await store.current({ tabId: OTHER_SGHX_TAB })).toBeNull();
    expect(await store.current({ active: true })).toBeNull();
    expect(await store.current({ tabId: SGHX_TAB })).not.toBeNull();
    expect(b.id).toEqual(expect.any(String));
  });

  it('clear() de aba sem atendimento não falha', async () => {
    await expect(store.clear(SGHX_TAB)).resolves.toBeUndefined();
  });

  it('set() sem atendimento rejeita', async () => {
    await expect(store.set({ active: true }, 'x', 1)).rejects.toThrow(/sem atendimento ativo/i);
    await expect(store.set({ tabId: SGHX_TAB }, 'x', 1)).rejects.toThrow(/sem atendimento ativo/i);
  });

  it('set() com { expectId } de outro atendimento rejeita (evita gravar no paciente errado)', async () => {
    const a = await store.start(SGHX_TAB);
    await store.start(SGHX_TAB);
    await expect(store.set({ active: true }, 'x', 1, { expectId: a.id })).rejects.toThrow(/atendimento mudou/i);
  });

  it.each([
    ['chave vazia', '', 1],
    ['chave não-texto', 42, 1],
    ['valor undefined', 'x', undefined],
    ['valor função', 'x', () => {}],
    ['número não finito', 'x', Number.NaN],
  ])('set() recusa %s', async (_caso, key, value) => {
    await store.start(SGHX_TAB);
    await expect(store.set({ tabId: SGHX_TAB }, key, value)).rejects.toThrow(TypeError);
  });

  it('o estado fica no chrome.storage.session: um store novo (worker reiniciado) continua vendo', async () => {
    const { id } = await store.start(SGHX_TAB);
    await store.set({ tabId: SGHX_TAB }, 'cid', 'J06.9');
    const restarted = createSessionStore({ area });
    expect(await restarted.current({ active: true })).toEqual({ id });
    expect(await restarted.get({ active: true }, 'cid')).toBe('J06.9');
  });

  it('operações simultâneas não se atropelam', async () => {
    await store.start(SGHX_TAB);
    await Promise.all(['a', 'b', 'c', 'd'].map((k, i) => store.set({ tabId: SGHX_TAB }, k, i)));
    for (const [i, k] of ['a', 'b', 'c', 'd'].entries()) {
      expect(await store.get({ tabId: SGHX_TAB }, k)).toBe(i);
    }
  });

  it('falha do chrome.storage vira erro claro e não trava as próximas operações', async () => {
    await store.start(SGHX_TAB);
    area.failNext('get');
    await expect(store.get({ tabId: SGHX_TAB }, 'x')).rejects.toThrow(/sessão/i);
    await expect(store.current({ tabId: SGHX_TAB })).resolves.not.toBeNull();
  });
});

describe('dados do paciente nunca vão para armazenamento persistente', () => {
  it.each(['session-store.js', 'session-router.js', 'session-service.js'])(
    '%s não usa chrome.storage.local nem sync',
    (file) => {
      const source = readFileSync(new URL(`../../src/core/storage/${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/storage\s*\.\s*(local|sync)\b/);
      expect(source).not.toMatch(/localStorage|indexedDB/);
    },
  );
});
