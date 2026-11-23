import { describe, it, expect } from 'vitest';
import { createSectionRegistry } from '../../src/ui/sections.js';

const section = (over = {}) => ({ id: 'fila', title: 'Fila', screens: ['fila'], render: () => {}, ...over });

describe('createSectionRegistry', () => {
  it('registra e lista as seções na ordem de registro', () => {
    const registry = createSectionRegistry();
    registry.register(section({ id: 'a' }));
    registry.register(section({ id: 'b' }));
    expect(registry.list().map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('recusa id vazio, duplicado, sem título, sem render ou sem telas', () => {
    const registry = createSectionRegistry();
    registry.register(section());
    expect(() => registry.register(section())).toThrow(/duplicada/);
    expect(() => registry.register(section({ id: '' }))).toThrow(/id/);
    expect(() => registry.register(section({ id: 'x', title: '' }))).toThrow(/título/);
    expect(() => registry.register(section({ id: 'x', render: null }))).toThrow(/render/);
    expect(() => registry.register(section({ id: 'x', screens: [] }))).toThrow(/telas/);
  });

  it('forActiveScreen devolve só as seções da tela ativa', () => {
    const registry = createSectionRegistry();
    registry.register(section({ id: 'a', screens: ['fila'] }));
    registry.register(section({ id: 'b', screens: ['consulta', 'fila'] }));
    registry.register(section({ id: 'c', screens: ['consulta'] }));
    expect(registry.forScreen('fila').map((s) => s.id)).toEqual(['a', 'b']);
    expect(registry.forScreen('unknown')).toEqual([]);
  });

  it('o registro devolvido por list() não altera o interno', () => {
    const registry = createSectionRegistry();
    registry.register(section());
    registry.list().pop();
    expect(registry.list()).toHaveLength(1);
  });
});
