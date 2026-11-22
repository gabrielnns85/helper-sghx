// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSettings } from '../../src/core/storage/settings.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { createFakeArea } from '../helpers/fake-chrome.js';

const DEFAULTS = Object.freeze({
  unit: Object.freeze({ name: 'UNIDADE TESTE', codFces: 1 }),
  queueRefresh: Object.freeze({ enabled: false, intervalSec: 30 }),
});

let area;
let settings;

beforeEach(() => {
  area = createFakeArea();
  settings = createSettings({ area, defaults: DEFAULTS });
});

afterEach(() => vi.restoreAllMocks());

describe('settings.get', () => {
  it('sem nada salvo, devolve os padrões', async () => {
    expect(await settings.get()).toEqual(DEFAULTS);
    expect(await settings.get('queueRefresh')).toEqual({ enabled: false, intervalSec: 30 });
  });

  it('o que foi salvo substitui o padrão daquela chave', async () => {
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(await settings.get()).toEqual({ ...DEFAULTS, queueRefresh: { enabled: true, intervalSec: 45 } });
  });

  it('devolve valores congelados', async () => {
    const all = await settings.get();
    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(all.unit)).toBe(true);
  });

  it('chave desconhecida lança', async () => {
    await expect(settings.get('senha')).rejects.toThrow(/desconhecida/i);
  });

  it('valor salvo inválido (versão antiga, edição manual) é ignorado com aviso e vale o padrão', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    area = createFakeArea({ settings: { queueRefresh: { enabled: 'sim' }, obsoleta: 1 } });
    settings = createSettings({ area, defaults: DEFAULTS });
    expect(await settings.get('queueRefresh')).toEqual(DEFAULTS.queueRefresh);
    expect(warn).toHaveBeenCalled();
  });

  it('falha ao ler o chrome.storage: avisa e usa os padrões', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    area.failNext('get');
    expect(await settings.get()).toEqual(DEFAULTS);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[helper-sghx]'), expect.any(String));
  });
});

describe('settings.set', () => {
  it('grava em chrome.storage.local, mantendo as outras chaves salvas', async () => {
    await settings.set({ unit: { name: 'OUTRA', codFces: 2 } });
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 60 } });
    expect(area.dump()).toEqual({
      settings: { unit: { name: 'OUTRA', codFces: 2 }, queueRefresh: { enabled: true, intervalSec: 60 } },
    });
  });

  it('não altera o objeto recebido', async () => {
    const partial = Object.freeze({ unit: Object.freeze({ name: 'OUTRA', codFces: 2 }) });
    await expect(settings.set(partial)).resolves.toBeUndefined();
  });

  it.each([
    ['chave desconhecida (ex.: dado de paciente)', { paciente: { nome: 'X' } }, /desconhecida/i],
    ['tipo diferente do padrão', { queueRefresh: 'sim' }, /tipo/i],
    ['campo a mais no objeto', { unit: { name: 'X', codFces: 2, cpf: '1' } }, /desconhecida/i],
    ['campo faltando no objeto', { unit: { name: 'X' } }, /faltando/i],
    ['campo com tipo errado', { queueRefresh: { enabled: 1, intervalSec: 30 } }, /tipo/i],
    ['número não finito', { queueRefresh: { enabled: true, intervalSec: Infinity } }, /tipo|JSON/i],
    ['não é objeto', 'tudo', /objeto/i],
    ['objeto vazio', {}, /nada/i],
  ])('recusa %s sem gravar nada', async (_caso, partial, message) => {
    await expect(settings.set(partial)).rejects.toThrow(message);
    expect(area.set).not.toHaveBeenCalled();
  });

  it('falha ao gravar vira erro claro', async () => {
    area.failNext('set');
    await expect(settings.set({ unit: { name: 'X', codFces: 2 } })).rejects.toThrow(/não foi possível salvar/i);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('traz os padrões do MVP já decididos nas issues', () => {
    expect(DEFAULT_SETTINGS.unit).toEqual({ name: 'UPA JACANA', codFces: 28 });
    expect(DEFAULT_SETTINGS.queueRefresh).toEqual({ enabled: false, intervalSec: 30 });
    expect(DEFAULT_SETTINGS.autoLogin).toEqual({ enabled: false });
  });

  it('é imutável', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
    expect(Object.values(DEFAULT_SETTINGS).every(Object.isFrozen)).toBe(true);
  });

  it('createSettings usa chrome.storage.local e DEFAULT_SETTINGS por padrão', async () => {
    const local = createFakeArea();
    vi.stubGlobal('chrome', { storage: { local } });
    try {
      expect(await createSettings().get()).toEqual(DEFAULT_SETTINGS);
      expect(local.get).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('configurações não tocam na sessão', () => {
  it('settings.js não usa chrome.storage.session', () => {
    const source = readFileSync(new URL('../../src/core/storage/settings.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/storage\s*\.\s*session\b/);
  });
});
