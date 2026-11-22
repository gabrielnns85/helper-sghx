// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fieldForPath, formToSettings, queueKey, queueOptions, settingsToForm } from '../../src/options/form.js';
import { KNOWN_QUEUES } from '../../src/options/queues.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { validateSetting } from '../../src/core/storage/settings-rules.js';

const DEFAULT_QUEUE = DEFAULT_SETTINGS.queueRefresh.queue;
const formFromDefaults = (patch = {}) => ({ ...settingsToForm(DEFAULT_SETTINGS), ...patch });
const options = queueOptions(DEFAULT_QUEUE);

describe('KNOWN_QUEUES (filas da skill sghx, até a #14 listar pelo endpoint)', () => {
  it('inclui a fila padrão e só filas válidas, sem repetição', () => {
    expect(KNOWN_QUEUES.map(queueKey)).toContain(queueKey(DEFAULT_QUEUE));
    expect(new Set(KNOWN_QUEUES.map(queueKey)).size).toBe(KNOWN_QUEUES.length);
    for (const queue of KNOWN_QUEUES) {
      expect(validateSetting('queueRefresh', { ...DEFAULT_SETTINGS.queueRefresh, queue })).toEqual([]);
    }
  });

  it('é imutável', () => {
    expect(Object.isFrozen(KNOWN_QUEUES)).toBe(true);
    expect(KNOWN_QUEUES.every(Object.isFrozen)).toBe(true);
  });
});

describe('queueOptions', () => {
  it('lista as filas conhecidas com valor e nome', () => {
    expect(options).toHaveLength(KNOWN_QUEUES.length);
    expect(options).toContainEqual({ value: '5:15:1', label: DEFAULT_QUEUE.label, queue: DEFAULT_QUEUE });
  });

  it('fila salva fora da lista entra no fim, para não se perder', () => {
    const custom = { codAcaoDestino: 99, codEspecialidade: 0, indSituacao: 0, label: 'FILA NOVA' };
    const list = queueOptions(custom);
    expect(list).toHaveLength(KNOWN_QUEUES.length + 1);
    expect(list.at(-1)).toEqual({ value: '99:0:0', label: 'FILA NOVA', queue: custom });
  });
});

describe('settingsToForm', () => {
  it('converte as configurações em valores de campo', () => {
    expect(settingsToForm(DEFAULT_SETTINGS)).toEqual({
      autoLoginEnabled: false,
      queueRefreshEnabled: false,
      intervalSec: '30',
      queue: '5:15:1',
      unitName: 'UPA JACANA',
      codFces: '28',
    });
  });
});

describe('formToSettings', () => {
  it('o formulário dos padrões volta aos padrões', () => {
    expect(formToSettings(formFromDefaults(), options)).toEqual({ settings: DEFAULT_SETTINGS, errors: [] });
  });

  it('converte texto em número, liga/desliga em booleano e apara o nome', () => {
    const { settings, errors } = formToSettings(
      formFromDefaults({ autoLoginEnabled: true, queueRefreshEnabled: true, intervalSec: ' 45 ', unitName: '  UPA X ' }),
      options,
    );
    expect(errors).toEqual([]);
    expect(settings.autoLogin).toEqual({ enabled: true });
    expect(settings.queueRefresh).toEqual({ enabled: true, intervalSec: 45, queue: DEFAULT_QUEUE });
    expect(settings.unit).toEqual({ name: 'UPA X', codFces: 28 });
  });

  it('usa a fila escolhida na lista', () => {
    const fastTrack = KNOWN_QUEUES.find((q) => q.codEspecialidade === 106);
    const { settings } = formToSettings(formFromDefaults({ queue: queueKey(fastTrack) }), options);
    expect(settings.queueRefresh.queue).toEqual(fastTrack);
  });

  it.each([
    ['intervalo vazio', { intervalSec: '' }, 'queueRefresh.intervalSec'],
    ['intervalo não numérico', { intervalSec: 'abc' }, 'queueRefresh.intervalSec'],
    ['intervalo abaixo do mínimo', { intervalSec: '15' }, 'queueRefresh.intervalSec'],
    ['intervalo acima do máximo', { intervalSec: '400' }, 'queueRefresh.intervalSec'],
    ['fila fora da lista', { queue: '1:2:3' }, 'queueRefresh.queue'],
    ['nome da unidade vazio', { unitName: '   ' }, 'unit.name'],
    ['outra unidade', { codFces: '2' }, 'unit.codFces'],
  ])('%s vira erro no campo', (_caso, patch, path) => {
    const { settings, errors } = formToSettings(formFromDefaults(patch), options);
    expect(settings).toBeNull();
    expect(errors.map((e) => e.path)).toEqual([path]);
    expect(errors[0].message).toEqual(expect.any(String));
  });

  it('não altera os valores recebidos', () => {
    const values = Object.freeze(formFromDefaults({ unitName: ' X ' }));
    expect(() => formToSettings(values, options)).not.toThrow();
  });
});

describe('fieldForPath', () => {
  it.each([
    ['unit.name', 'unitName'],
    ['unit.codFces', 'codFces'],
    ['queueRefresh.intervalSec', 'intervalSec'],
    ['queueRefresh.queue', 'queue'],
    ['queueRefresh.queue.label', 'queue'],
    ['desconhecido', null],
  ])('%s → %s', (path, field) => {
    expect(fieldForPath(path)).toBe(field);
  });
});
