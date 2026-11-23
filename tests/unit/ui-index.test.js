import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { createFakeArea } from '../helpers/fake-chrome.js';
import { initUi } from '../../src/ui/index.js';

const screen = { current: () => ({ id: 'fila', stack: ['fila'] }), subscribe: () => () => {} };
let ui;

beforeEach(() => loadFixture('fila-pronto-atendimento'));
afterEach(() => {
  ui?.destroy();
  ui = undefined;
  vi.restoreAllMocks();
  clearFixture();
});

describe('initUi', () => {
  it('monta o painel e devolve a API para as funcionalidades', async () => {
    ui = await initUi({ screen, area: createFakeArea() });
    expect(document.querySelector('#helper-sghx-panel')).toBeTruthy();
    expect(ui.registerSection).toBeTypeOf('function');
    expect(ui.notify).toBeTypeOf('function');
  });

  it('a API é congelada', async () => {
    ui = await initUi({ screen, area: createFakeArea() });
    expect(Object.isFrozen(ui)).toBe(true);
  });

  it('se o painel falhar ao montar, avisa e devolve uma API inerte (não derruba as funcionalidades)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badScreen = { ...screen, subscribe: () => { throw new Error('x'); } };
    ui = await initUi({ screen: badScreen, area: createFakeArea() });
    expect(error).toHaveBeenCalled();
    expect(() => ui.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: () => {} })).not.toThrow();
    expect(() => ui.notify({ level: 'error', text: 'x' })).not.toThrow();
  });

  it('sem chrome.storage.local o painel não monta e devolve a API inerte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('chrome', {});
    ui = await initUi({ screen });
    expect(ui.notify({ level: 'info', text: 'x' })).toBeTypeOf('function');
    vi.unstubAllGlobals();
  });

  it('a API inerte valida a mensagem como o painel real', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('chrome', {});
    ui = await initUi({ screen });
    expect(() => ui.notify({ level: 'x', text: 'a' })).toThrow(TypeError);
    vi.unstubAllGlobals();
  });
});
