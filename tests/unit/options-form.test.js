// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fieldForPath, formToSettings, queueOptions, settingsToForm } from '../../src/options/form.js';
import { KNOWN_QUEUES, NO_QUEUE } from '../../src/core/catalog.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';

const PEDIATRIA = { codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 };
const formFromDefaults = (patch = {}) => ({ ...settingsToForm(DEFAULT_SETTINGS), ...patch });

describe('queueOptions', () => {
  it('começa com "Escolha a fila" e depois as filas conhecidas, só com o nome do catálogo', () => {
    const options = queueOptions();
    expect(options[0]).toEqual({ value: '', label: 'Escolha a fila' });
    expect(options.slice(1)).toEqual(KNOWN_QUEUES.map((q) => ({
      value: `${q.codAcaoDestino}:${q.codEspecialidade}:${q.indSituacao}`,
      label: q.label,
    })));
  });
});

describe('settingsToForm', () => {
  it('padrões: nenhuma fila escolhida, nome da unidade vindo do catálogo', () => {
    expect(settingsToForm(DEFAULT_SETTINGS)).toEqual({
      autoLoginEnabled: false,
      autoLoginMode: 'cloud',
      autoLoginUser: '',
      autoLoginPassword: '',
      queueRefreshEnabled: false,
      intervalSec: '30',
      queue: '',
      unitName: 'UPA JACANA',
      codFces: '28',
    });
  });

  it('fila escolhida vira a chave do select', () => {
    const all = { ...DEFAULT_SETTINGS, queueRefresh: { ...DEFAULT_SETTINGS.queueRefresh, queue: PEDIATRIA } };
    expect(settingsToForm(all).queue).toBe('5:36:1');
  });
});

describe('formToSettings', () => {
  it('o formulário dos padrões volta aos padrões', () => {
    expect(formToSettings(formFromDefaults())).toEqual({ settings: DEFAULT_SETTINGS, errors: [] });
  });

  it('converte texto em número e liga/desliga em booleano; a fila guarda só os códigos', () => {
    const { settings, errors } = formToSettings(
      formFromDefaults({ autoLoginEnabled: true, queueRefreshEnabled: true, intervalSec: ' 45 ', queue: '5:36:1' }),
    );
    expect(errors).toEqual([]);
    expect(settings.autoLogin).toEqual({ enabled: true, mode: 'cloud', user: '', password: '' });
    expect(settings.queueRefresh).toEqual({ enabled: true, intervalSec: 45, queue: PEDIATRIA });
    expect(settings.unit).toEqual({ codFces: 28 });
  });

  it('o nome da unidade na tela não é gravado (vem sempre do catálogo)', () => {
    const { settings } = formToSettings(formFromDefaults({ unitName: 'Fulano de Tal' }));
    expect(JSON.stringify(settings)).not.toContain('Fulano');
  });

  it('"Escolha a fila" grava nenhuma fila', () => {
    expect(formToSettings(formFromDefaults({ queue: '' })).settings.queueRefresh.queue).toEqual(NO_QUEUE);
  });

  it.each([
    ['intervalo vazio', { intervalSec: '' }, 'queueRefresh.intervalSec'],
    ['intervalo não numérico', { intervalSec: 'abc' }, 'queueRefresh.intervalSec'],
    ['intervalo abaixo do mínimo', { intervalSec: '15' }, 'queueRefresh.intervalSec'],
    ['intervalo acima do máximo', { intervalSec: '400' }, 'queueRefresh.intervalSec'],
    ['fila fora da lista', { queue: '1:2:3' }, 'queueRefresh.queue'],
    ['fila malformada', { queue: 'abc' }, 'queueRefresh.queue'],
    ['ligar sem escolher a fila', { queueRefreshEnabled: true, queue: '' }, 'queueRefresh.queue'],
    ['outra unidade', { codFces: '2' }, 'unit.codFces'],
  ])('%s vira erro no campo', (_caso, patch, path) => {
    const { settings, errors } = formToSettings(formFromDefaults(patch));
    expect(settings).toBeNull();
    expect(errors.map((e) => e.path)).toEqual([path]);
    expect(errors[0].message).toEqual(expect.any(String));
  });

  it('modo usuário e senha grava o usuário sem espaços nas pontas e a senha como digitada', () => {
    const { settings, errors } = formToSettings(formFromDefaults({
      autoLoginEnabled: true, autoLoginMode: 'password', autoLoginUser: ' medico ', autoLoginPassword: ' s3nha ',
    }));
    expect(errors).toEqual([]);
    expect(settings.autoLogin).toEqual({ enabled: true, mode: 'password', user: 'medico', password: ' s3nha ' });
  });

  it('modo nuvem descarta a senha digitada (não fica salva à toa)', () => {
    const { settings } = formToSettings(formFromDefaults({ autoLoginMode: 'cloud', autoLoginUser: 'medico', autoLoginPassword: 'x' }));
    expect(settings.autoLogin).toEqual({ enabled: false, mode: 'cloud', user: 'medico', password: '' });
  });

  it('modo usuário e senha ligado sem senha vira erro no campo da senha', () => {
    const { settings, errors } = formToSettings(formFromDefaults({
      autoLoginEnabled: true, autoLoginMode: 'password', autoLoginUser: 'medico', autoLoginPassword: '',
    }));
    expect(settings).toBeNull();
    expect(errors.map((e) => e.path)).toEqual(['autoLogin.password']);
  });

  it('não altera os valores recebidos', () => {
    const values = Object.freeze(formFromDefaults({ intervalSec: ' 45 ' }));
    expect(() => formToSettings(values)).not.toThrow();
  });
});

describe('fieldForPath', () => {
  it.each([
    ['unit.codFces', 'codFces'],
    ['queueRefresh.intervalSec', 'intervalSec'],
    ['queueRefresh.queue', 'queue'],
    ['autoLogin.user', 'autoLoginUser'],
    ['autoLogin.password', 'autoLoginPassword'],
    ['desconhecido', null],
  ])('%s → %s', (path, field) => {
    expect(fieldForPath(path)).toBe(field);
  });
});
