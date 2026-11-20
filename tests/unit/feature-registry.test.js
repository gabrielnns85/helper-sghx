import { describe, it, expect, vi } from 'vitest';
import { createFeatureRegistry } from '../../src/features/index.js';

describe('registro de funcionalidades', () => {
  it('começa vazio', () => {
    expect(createFeatureRegistry().list()).toEqual([]);
  });

  it('registra funcionalidades e as lista em ordem', () => {
    const reg = createFeatureRegistry();
    reg.register({ id: 'a', init() {} });
    reg.register({ id: 'b', init() {} });
    expect(reg.list().map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('exige id e init', () => {
    const reg = createFeatureRegistry();
    expect(() => reg.register({ init() {} })).toThrow(/id/);
    expect(() => reg.register({ id: 'x' })).toThrow(/init/);
  });

  it('recusa id duplicado', () => {
    const reg = createFeatureRegistry();
    reg.register({ id: 'a', init() {} });
    expect(() => reg.register({ id: 'a', init() {} })).toThrow(/duplicad/);
  });

  it('initAll chama init com o contexto e isola falhas', async () => {
    const reg = createFeatureRegistry();
    const ctx = { bridge: {} };
    const good = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reg.register({ id: 'ruim', init() { throw new Error('x'); } });
    reg.register({ id: 'boa', init: good });
    const result = await reg.initAll(ctx);
    expect(good).toHaveBeenCalledWith(ctx);
    expect(result).toEqual({ ok: ['boa'], failed: ['ruim'] });
  });
});
