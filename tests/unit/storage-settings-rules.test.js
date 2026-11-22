// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { MAX_INTERVAL_SEC, MIN_INTERVAL_SEC, validateSetting } from '../../src/core/storage/settings-rules.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { NO_QUEUE } from '../../src/core/catalog.js';

const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });
const queueRefresh = (patch = {}) => ({ ...DEFAULT_SETTINGS.queueRefresh, queue: PEDIATRIA, ...patch });
const paths = (errors) => errors.map((e) => e.path);

describe('limites', () => {
  it('intervalo de 30 s a 360 s', () => {
    expect(MIN_INTERVAL_SEC).toBe(30);
    expect(MAX_INTERVAL_SEC).toBe(360);
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

  it('fila conhecida é aceita, ligada ou desligada', () => {
    expect(validateSetting('queueRefresh', queueRefresh({ enabled: true }))).toEqual([]);
    expect(validateSetting('queueRefresh', queueRefresh({ enabled: false }))).toEqual([]);
  });

  it('sem fila escolhida, a atualização pode ficar desligada', () => {
    expect(validateSetting('queueRefresh', queueRefresh({ enabled: false, queue: NO_QUEUE }))).toEqual([]);
  });

  it('sem fila escolhida, não deixa ligar a atualização (evita olhar a fila errada)', () => {
    const errors = validateSetting('queueRefresh', queueRefresh({ enabled: true, queue: NO_QUEUE }));
    expect(paths(errors)).toEqual(['queueRefresh.queue']);
    expect(errors[0].message).toMatch(/escolha a fila/i);
  });

  it.each([
    ['desconhecida', { codAcaoDestino: 99, codEspecialidade: 0, indSituacao: 0 }],
    ['de já atendidos', { codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 3 }],
    ['com código gigante', { codAcaoDestino: 1e300, codEspecialidade: 36, indSituacao: 1 }],
  ])('recusa fila %s', (_caso, queue) => {
    const errors = validateSetting('queueRefresh', queueRefresh({ queue }));
    expect(paths(errors)).toEqual(['queueRefresh.queue']);
    expect(errors[0].message).toMatch(/não reconhecida/i);
  });

  it('aceita a unidade conhecida e recusa as outras', () => {
    expect(validateSetting('unit', { codFces: 28 })).toEqual([]);
    expect(paths(validateSetting('unit', { codFces: 2 }))).toEqual(['unit.codFces']);
  });
});

describe('nenhuma configuração dispensa a confirmação do médico', () => {
  it('não existe opção de salvar, assinar ou enviar automaticamente no prontuário', () => {
    const allKeys = (obj, prefix = '') =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' ? [`${prefix}${k}`, ...allKeys(v, `${prefix}${k}.`)] : [`${prefix}${k}`]);
    expect(allKeys(DEFAULT_SETTINGS).filter((k) => /auto(save|submit|sign|confirm)|skipConfirm/i.test(k))).toEqual([]);
  });
});
