// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSettings } from '../../src/core/storage/settings.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { createFakeArea, createFakeEvent } from '../helpers/fake-chrome.js';

const DEFAULTS = Object.freeze({
  unit: Object.freeze({ name: 'UNIDADE TESTE', codFces: 1 }),
  queueRefresh: Object.freeze({ enabled: false, intervalSec: 30 }),
});

let area;
let settings;

// Estes testes conferem a forma; as regras de valor reais têm o próprio describe abaixo.
const noRules = () => [];

beforeEach(() => {
  area = createFakeArea();
  settings = createSettings({ area, defaults: DEFAULTS, validate: noRules });
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

describe('regras de valor (settings-rules.js)', () => {
  beforeEach(() => {
    area = createFakeArea();
    settings = createSettings({ area }); // DEFAULT_SETTINGS + validateSetting
  });

  const queueRefresh = (patch) => ({ ...DEFAULT_SETTINGS.queueRefresh, ...patch });

  it('set recusa valor fora das regras, com a mensagem da regra, e não grava nada', async () => {
    await expect(settings.set({ queueRefresh: queueRefresh({ intervalSec: 10 }) })).rejects.toThrow(/30.*360/);
    expect(area.set).not.toHaveBeenCalled();
  });

  it('set aceita valor dentro das regras', async () => {
    await settings.set({ queueRefresh: queueRefresh({ enabled: true, intervalSec: 60 }) });
    expect((await settings.get('queueRefresh')).intervalSec).toBe(60);
  });

  it('valor salvo fora das regras é ignorado com aviso e vale o padrão', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    area = createFakeArea({ settings: { unit: { codFces: 2 } } });
    settings = createSettings({ area });
    expect(await settings.get('unit')).toEqual(DEFAULT_SETTINGS.unit);
    expect(warn).toHaveBeenCalled();
  });
});

describe('settings.load (leitura que não esconde falha)', () => {
  it('devolve o mesmo que get()', async () => {
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(await settings.load()).toEqual(await settings.get());
  });

  it('falha ao ler o chrome.storage vira erro claro, em vez de padrões', async () => {
    area.failNext('get');
    await expect(settings.load()).rejects.toThrow(/não foi possível ler as configurações/i);
  });
});

describe('settings.reset', () => {
  it('apaga o que foi salvo: volta a valer o padrão', async () => {
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    await settings.reset();
    expect(await settings.get()).toEqual(DEFAULTS);
    expect(area.dump()).toEqual({});
  });

  it('falha ao apagar vira erro claro', async () => {
    area.failNext('remove');
    await expect(settings.reset()).rejects.toThrow(/não foi possível restaurar/i);
  });
});

describe('settings.subscribe (mudança aplicada sem recarregar)', () => {
  let onChanged;

  beforeEach(() => {
    onChanged = createFakeEvent();
    area = createFakeArea({}, { onChanged, areaName: 'local' });
    settings = createSettings({ area, defaults: DEFAULTS, validate: noRules, onChanged });
  });

  it('avisa com as configurações completas e congeladas quando outra página salva', async () => {
    const listener = vi.fn();
    settings.subscribe(listener);
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(listener).toHaveBeenCalledTimes(1);
    const [all] = listener.mock.calls[0];
    expect(all).toEqual({ ...DEFAULTS, queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(Object.isFrozen(all.queueRefresh)).toBe(true);
  });

  it('reset também avisa, com os padrões', async () => {
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    const listener = vi.fn();
    settings.subscribe(listener);
    await settings.reset();
    expect(listener).toHaveBeenCalledWith(DEFAULTS);
  });

  it('ignora outras áreas e outras chaves', () => {
    const listener = vi.fn();
    settings.subscribe(listener);
    onChanged.emit({ settings: { newValue: { queueRefresh: { enabled: true, intervalSec: 45 } } } }, 'session');
    onChanged.emit({ outra: { newValue: 1 } }, 'local');
    expect(listener).not.toHaveBeenCalled();
  });

  it('valor novo inválido é ignorado com aviso e vale o padrão', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const listener = vi.fn();
    settings.subscribe(listener);
    onChanged.emit({ settings: { newValue: { queueRefresh: 'sim' } } }, 'local');
    expect(listener).toHaveBeenCalledWith(DEFAULTS);
  });

  it('a função devolvida cancela a inscrição', async () => {
    const listener = vi.fn();
    const unsubscribe = settings.subscribe(listener);
    unsubscribe();
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(listener).not.toHaveBeenCalled();
    expect(onChanged.hasListeners()).toBe(false);
  });

  it('erro num listener não impede os outros', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = vi.fn();
    settings.subscribe(() => {
      throw new Error('quebrou');
    });
    settings.subscribe(second);
    await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
    expect(second).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[helper-sghx]'), expect.any(Error));
  });

  it('listener que não é função lança', () => {
    expect(() => settings.subscribe('x')).toThrow(TypeError);
  });

  it('sem chrome.storage.onChanged, subscribe lança erro claro', () => {
    const semEvento = createSettings({ area, defaults: DEFAULTS, onChanged: null });
    expect(() => semEvento.subscribe(() => {})).toThrow(/onChanged indisponível/i);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('traz os padrões do MVP já decididos nas issues', () => {
    expect(DEFAULT_SETTINGS.unit).toEqual({ codFces: 28 }); // nome vem do catálogo (src/core/catalog.js)
    expect(DEFAULT_SETTINGS.queueRefresh).toEqual({
      enabled: false,
      intervalSec: 30,
      queue: { codAcaoDestino: 0, codEspecialidade: 0, indSituacao: 0 }, // nenhuma fila: o médico escolhe
    });
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
