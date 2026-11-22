// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  MAX_INTERVAL_SEC,
  MIN_INTERVAL_SEC,
  SUPPORTED_COD_FCES,
  validateSetting,
} from '../../src/core/storage/settings-rules.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';

const queueRefresh = (patch = {}) => ({ ...DEFAULT_SETTINGS.queueRefresh, ...patch });
const queue = (patch = {}) => queueRefresh({ queue: { ...DEFAULT_SETTINGS.queueRefresh.queue, ...patch } });
const paths = (errors) => errors.map((e) => e.path);

describe('limites', () => {
  it('intervalo de 30 s a 360 s; só a UPA Jaçanã (CodFces 28) por enquanto', () => {
    expect(MIN_INTERVAL_SEC).toBe(30);
    expect(MAX_INTERVAL_SEC).toBe(360);
    expect(SUPPORTED_COD_FCES).toEqual([28]);
  });
});

describe('validateSetting', () => {
  it('os padrões são válidos', () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      expect(validateSetting(key, value)).toEqual([]);
    }
  });

  it('chave sem regra não tem erros', () => {
    expect(validateSetting('autoLogin', { enabled: true })).toEqual([]);
  });

  it.each([30, 45, 360])('aceita intervalo de %i s', (intervalSec) => {
    expect(validateSetting('queueRefresh', queueRefresh({ intervalSec }))).toEqual([]);
  });

  it.each([29, 361, 0, -30, 30.5])('recusa intervalo de %s s', (intervalSec) => {
    const errors = validateSetting('queueRefresh', queueRefresh({ intervalSec }));
    expect(paths(errors)).toEqual(['queueRefresh.intervalSec']);
    expect(errors[0].message).toMatch(/30.*360/);
  });

  it.each([
    ['codAcaoDestino zero', { codAcaoDestino: 0 }, 'queueRefresh.queue.codAcaoDestino'],
    ['codAcaoDestino fracionado', { codAcaoDestino: 5.5 }, 'queueRefresh.queue.codAcaoDestino'],
    ['codEspecialidade negativa', { codEspecialidade: -1 }, 'queueRefresh.queue.codEspecialidade'],
    ['indSituacao negativa', { indSituacao: -1 }, 'queueRefresh.queue.indSituacao'],
    ['nome da fila vazio', { label: '   ' }, 'queueRefresh.queue.label'],
    ['nome da fila longo demais', { label: 'X'.repeat(121) }, 'queueRefresh.queue.label'],
  ])('recusa fila com %s', (_caso, patch, path) => {
    expect(paths(validateSetting('queueRefresh', queue(patch)))).toEqual([path]);
  });

  it('aceita fila sem especialidade (codEspecialidade 0, ex.: acolhimento)', () => {
    expect(validateSetting('queueRefresh', queue({ codEspecialidade: 0, indSituacao: 0 }))).toEqual([]);
  });

  it.each([
    ['nome vazio', { name: '  ', codFces: 28 }, 'unit.name'],
    ['nome longo demais', { name: 'X'.repeat(101), codFces: 28 }, 'unit.name'],
    ['unidade não suportada', { name: 'OUTRA', codFces: 2 }, 'unit.codFces'],
  ])('recusa unidade com %s', (_caso, unit, path) => {
    expect(paths(validateSetting('unit', unit))).toEqual([path]);
  });

  it('junta todos os erros da mesma configuração', () => {
    const errors = validateSetting('unit', { name: '', codFces: 1 });
    expect(paths(errors)).toEqual(['unit.name', 'unit.codFces']);
  });
});
