// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { KNOWN_QUEUES, KNOWN_UNITS, NO_QUEUE, findQueue, findUnit, isNoQueue, queueKey } from '../../src/core/catalog.js';

describe('KNOWN_UNITS', () => {
  it('só a UPA Jaçanã (CodFces 28) por enquanto', () => {
    expect(KNOWN_UNITS).toEqual([{ codFces: 28, name: 'UPA JACANA' }]);
  });

  it('findUnit acha pelo CodFces; desconhecido = null', () => {
    expect(findUnit(28)).toEqual({ codFces: 28, name: 'UPA JACANA' });
    expect(findUnit(2)).toBeNull();
  });
});

describe('KNOWN_QUEUES (skill sghx, até a #14 listar pelo endpoint)', () => {
  it('só filas do pronto atendimento aguardando (CodAcaoDestino 5, situação 1), sem repetição', () => {
    expect(KNOWN_QUEUES.length).toBeGreaterThan(0);
    for (const q of KNOWN_QUEUES) {
      expect(q).toMatchObject({ codAcaoDestino: 5, indSituacao: 1 });
      expect(q.label).toMatch(/^PRONTO ATENDIMENTO - /);
    }
    expect(new Set(KNOWN_QUEUES.map(queueKey)).size).toBe(KNOWN_QUEUES.length);
  });

  it('inclui pediatria e clínica geral', () => {
    expect(findQueue({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 })?.label).toMatch(/PEDIATRIA/);
    expect(findQueue({ codAcaoDestino: 5, codEspecialidade: 15, indSituacao: 1 })?.label).toMatch(/CLINICA GERAL/);
  });

  it('findQueue: fila desconhecida ou "já atendidos" = null', () => {
    expect(findQueue({ codAcaoDestino: 99, codEspecialidade: 0, indSituacao: 0 })).toBeNull();
    expect(findQueue({ codAcaoDestino: 5, codEspecialidade: 15, indSituacao: 3 })).toBeNull();
  });

  it('é imutável', () => {
    expect(Object.isFrozen(KNOWN_QUEUES)).toBe(true);
    expect(KNOWN_QUEUES.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(KNOWN_UNITS)).toBe(true);
  });
});

describe('NO_QUEUE (nenhuma fila escolhida)', () => {
  it('tem a forma de uma fila, com códigos zerados, e chave vazia', () => {
    expect(NO_QUEUE).toEqual({ codAcaoDestino: 0, codEspecialidade: 0, indSituacao: 0 });
    expect(isNoQueue(NO_QUEUE)).toBe(true);
    expect(isNoQueue(KNOWN_QUEUES[0])).toBe(false);
    expect(queueKey(NO_QUEUE)).toBe('');
  });

  it('queueKey de uma fila = CodAcaoDestino:CodEspecialidade:IndSituacao', () => {
    expect(queueKey({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 })).toBe('5:36:1');
  });
});
