import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFakeArea } from '../helpers/fake-chrome.js';
import { createPanelState } from '../../src/ui/panel-state.js';

afterEach(() => vi.restoreAllMocks());

describe('createPanelState', () => {
  it('começa aberto (collapsed=false) quando nada foi salvo', async () => {
    const state = createPanelState({ area: createFakeArea() });
    expect(await state.load()).toEqual({ collapsed: false });
  });

  it('grava e relê o estado recolhido, em chave própria (fora de "settings")', async () => {
    const area = createFakeArea();
    await createPanelState({ area }).save({ collapsed: true });
    expect(area.dump()).toEqual({ uiState: { panel: { collapsed: true } } });
    expect(await createPanelState({ area }).load()).toEqual({ collapsed: true });
  });

  it('ignora valor salvo inválido e usa o padrão', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createFakeArea({ uiState: { panel: { collapsed: 'sim' } } });
    expect(await createPanelState({ area }).load()).toEqual({ collapsed: false });
  });

  it('se a leitura falhar, avisa e usa o padrão', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createFakeArea();
    area.failNext('get');
    expect(await createPanelState({ area }).load()).toEqual({ collapsed: false });
    expect(warn).toHaveBeenCalled();
  });

  it('se a gravação falhar, não lança (o painel segue funcionando)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const area = createFakeArea();
    area.failNext('set');
    await expect(createPanelState({ area }).save({ collapsed: true })).resolves.toBeUndefined();
  });

  it('recusa estado com forma errada', async () => {
    const state = createPanelState({ area: createFakeArea() });
    await expect(state.save({ collapsed: 1 })).rejects.toThrow(TypeError);
  });

  it('preserva outras chaves de uiState ao gravar', async () => {
    const area = createFakeArea({ uiState: { outra: 1 } });
    await createPanelState({ area }).save({ collapsed: true });
    expect(area.dump().uiState).toEqual({ outra: 1, panel: { collapsed: true } });
  });
});
