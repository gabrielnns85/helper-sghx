import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { createQueueRefreshFeature } from '../../src/features/queue-refresh/index.js';
import { SCREEN } from '../../src/core/screen/index.js';
import { NO_QUEUE } from '../../src/core/catalog.js';

const INTERVAL = 30_000;
const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });
const ORTOPEDIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 105, indSituacao: 1 });

const config = (patch = {}) => ({ enabled: true, intervalSec: 30, queue: PEDIATRIA, ...patch });

function fakeScreen(id = SCREEN.FILA) {
  let current = { id };
  const listeners = new Set();
  return {
    current: () => current,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    go(next) {
      const previous = current;
      current = { id: next };
      for (const fn of [...listeners]) fn({ previous, current });
    },
  };
}

function fakeUi() {
  const sections = [];
  const messages = [];
  return {
    sections,
    messages,
    registerSection: (s) => sections.push(s),
    notify: vi.fn((m) => { const entry = { ...m, cleared: false }; messages.push(entry); return () => { entry.cleared = true; }; }),
    activeErrors: () => messages.filter((m) => m.level === 'error' && !m.cleared),
  };
}

function addOpenModal() {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.style.display = 'block';
  document.body.appendChild(box);
  return box;
}

async function setup({ cfg = config(), screenId, refresh, typing } = {}) {
  let current = cfg;
  const settings = { get: vi.fn(async () => current) };
  const screen = fakeScreen(screenId);
  const ui = fakeUi();
  const doRefresh = refresh ?? vi.fn(async () => 'refreshed');
  const feature = createQueueRefreshFeature({ root: document, refresh: doRefresh, typing });
  await feature.init({ settings, screen, ui });
  const el = document.createElement('div');
  const controller = new AbortController();
  ui.sections[0].render(el, { screen: screen.current(), signal: controller.signal });
  return {
    feature, screen, ui, el, controller, settings, refresh: doRefresh,
    setConfig: (next) => { current = next; },
    q: (role) => el.querySelector(`[data-role="${role}"]`),
    tick: (ms) => vi.advanceTimersByTimeAsync(ms),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  loadFixture('fila-categorias');
});

afterEach(() => {
  vi.useRealTimers();
  clearFixture();
});

describe('queue-refresh: ciclo de 30 s', () => {
  it('registra a feature com id e uma seção só da tela da fila', async () => {
    const t = await setup();
    expect(t.feature.id).toBe('queue-refresh');
    expect(t.ui.sections).toHaveLength(1);
    expect(t.ui.sections[0].screens).toEqual([SCREEN.FILA]);
  });

  it('atualiza a cada 30 s, com a fila configurada, e não antes', async () => {
    const t = await setup();
    await t.tick(INTERVAL - 1000);
    expect(t.refresh).not.toHaveBeenCalled();
    await t.tick(1000);
    expect(t.refresh).toHaveBeenCalledTimes(1);
    expect(t.refresh).toHaveBeenCalledWith(expect.objectContaining({ queue: PEDIATRIA }));
    await t.tick(INTERVAL);
    expect(t.refresh).toHaveBeenCalledTimes(2);
  });

  it('só funciona na tela da fila: fora dela não há timer nem atualização', async () => {
    const t = await setup({ screenId: SCREEN.CONSULTA });
    expect(vi.getTimerCount()).toBe(0);
    await t.tick(INTERVAL * 2);
    expect(t.refresh).not.toHaveBeenCalled();
  });

  it('ao entrar na fila liga o timer e ao sair para tudo', async () => {
    const t = await setup({ screenId: SCREEN.CONSULTA });
    t.screen.go(SCREEN.FILA);
    await t.tick(INTERVAL);
    expect(t.refresh).toHaveBeenCalledTimes(1);
    t.screen.go(SCREEN.CONSULTA);
    expect(vi.getTimerCount()).toBe(0);
    await t.tick(INTERVAL * 3);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });

  it('voltar à fila reinicia a contagem de 30 s', async () => {
    const t = await setup();
    await t.tick(20_000);
    t.screen.go(SCREEN.CONSULTA);
    t.screen.go(SCREEN.FILA);
    await t.tick(20_000);
    expect(t.refresh).not.toHaveBeenCalled();
    await t.tick(10_000);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });

  it('não roda se a atualização estiver desligada nas opções', async () => {
    const t = await setup({ cfg: config({ enabled: false }) });
    await t.tick(INTERVAL * 2);
    expect(t.refresh).not.toHaveBeenCalled();
    expect(t.q('status').textContent).toMatch(/desligad/i);
  });

  it('não roda sem fila definida e avisa no painel', async () => {
    const t = await setup({ cfg: config({ queue: { ...NO_QUEUE } }) });
    await t.tick(INTERVAL * 2);
    expect(t.refresh).not.toHaveBeenCalled();
    expect(t.q('status').textContent).toMatch(/defina a fila/i);
  });

  it('lê a configuração a cada ciclo: a mudança vale no próximo', async () => {
    const t = await setup();
    await t.tick(INTERVAL);
    t.setConfig(config({ queue: ORTOPEDIA }));
    await t.tick(INTERVAL);
    expect(t.refresh).toHaveBeenLastCalledWith(expect.objectContaining({ queue: ORTOPEDIA }));
  });

  it('não sobrepõe ciclos: com um em andamento não começa outro', async () => {
    let finish;
    const slow = vi.fn(() => new Promise((resolve) => { finish = () => resolve('refreshed'); }));
    const t = await setup({ refresh: slow });
    await t.tick(INTERVAL * 3);
    expect(slow).toHaveBeenCalledTimes(1);
    finish();
    await t.tick(INTERVAL);
    expect(slow).toHaveBeenCalledTimes(2);
  });
});

describe('queue-refresh: quando não atualizar', () => {
  it('com modal aberto não atualiza e tenta de novo assim que fechar, sem esperar outros 30 s', async () => {
    const t = await setup();
    const box = addOpenModal();
    await t.tick(INTERVAL * 2 - 1000);
    expect(t.refresh).not.toHaveBeenCalled();
    expect(t.q('status').textContent).toMatch(/modal/i);
    box.style.display = 'none';
    await t.tick(2000);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });

  it('durante a digitação não atualiza e retoma quando parar', async () => {
    let typing = true;
    const t = await setup({ typing: { isTyping: () => typing, stop() {} } });
    await t.tick(INTERVAL * 2 - 1000);
    expect(t.refresh).not.toHaveBeenCalled();
    expect(t.q('status').textContent).toMatch(/digit/i);
    typing = false;
    await t.tick(2000);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('queue-refresh: pausar e retomar', () => {
  it('mostra o botão com o estado e pausa/retoma a atualização', async () => {
    const t = await setup();
    expect(t.q('toggle').textContent).toBe('Pausar');
    expect(t.q('status').textContent).toMatch(/ativo/i);

    t.q('toggle').click();
    expect(t.q('toggle').textContent).toBe('Retomar');
    expect(t.q('status').textContent).toMatch(/pausad/i);
    await t.tick(INTERVAL * 2);
    expect(t.refresh).not.toHaveBeenCalled();

    t.q('toggle').click();
    expect(t.q('toggle').textContent).toBe('Pausar');
    await t.tick(INTERVAL);
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });

  it('a pausa sobrevive a sair e voltar para a fila', async () => {
    const t = await setup();
    t.q('toggle').click();
    t.screen.go(SCREEN.CONSULTA);
    t.screen.go(SCREEN.FILA);
    const el = document.createElement('div');
    t.ui.sections[0].render(el, { screen: t.screen.current(), signal: new AbortController().signal });
    expect(el.querySelector('[data-role="toggle"]').textContent).toBe('Retomar');
    await t.tick(INTERVAL * 2);
    expect(t.refresh).not.toHaveBeenCalled();
  });
});

describe('queue-refresh: o que o painel mostra', () => {
  it('mostra a fila acompanhada e "atualizado há X s"', async () => {
    const t = await setup();
    expect(t.q('queue').textContent).toContain('PRONTO ATENDIMENTO - PEDIATRIA');
    expect(t.q('since').textContent).toMatch(/ainda não/i);
    await t.tick(INTERVAL);
    await t.tick(5000);
    expect(t.q('since').textContent).toMatch(/há 5 s/);
  });

  it('para de atualizar o texto quando a seção é abortada', async () => {
    const t = await setup();
    await t.tick(INTERVAL);
    t.controller.abort();
    const before = t.q('since').textContent;
    await t.tick(10_000);
    expect(t.q('since').textContent).toBe(before);
  });
});

describe('queue-refresh: falhas', () => {
  it('botão Atualizar ausente vira alerta de erro visível', async () => {
    const t = await setup({ refresh: vi.fn(async () => 'no-button') });
    await t.tick(INTERVAL);
    expect(t.ui.activeErrors()).toHaveLength(1);
    expect(t.q('status').textContent).toMatch(/falh/i);
  });

  it('fila sem categoria na tela (vazia) não é erro: a grade foi atualizada e o painel explica', async () => {
    const t = await setup({ refresh: vi.fn(async () => 'queue-not-found') });
    await t.tick(INTERVAL);
    expect(t.ui.activeErrors()).toHaveLength(0);
    expect(t.q('status').textContent).toMatch(/vazia/i);
    expect(t.q('since').textContent).toMatch(/há 0 s/);
  });

  it('exceção no ciclo vira alerta e não derruba o timer', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue('refreshed');
    const t = await setup({ refresh });
    await t.tick(INTERVAL);
    expect(t.ui.activeErrors()).toHaveLength(1);
    await t.tick(INTERVAL);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('o alerta some quando a atualização volta a funcionar', async () => {
    const refresh = vi.fn().mockResolvedValueOnce('no-button').mockResolvedValue('refreshed');
    const t = await setup({ refresh });
    await t.tick(INTERVAL);
    expect(t.ui.activeErrors()).toHaveLength(1);
    await t.tick(INTERVAL);
    expect(t.ui.activeErrors()).toHaveLength(0);
  });

  it('alerta quando passa de 2× o intervalo sem atualizar (modal aberto o tempo todo)', async () => {
    const t = await setup();
    addOpenModal();
    await t.tick(INTERVAL * 2 - 1000);
    expect(t.ui.activeErrors()).toHaveLength(0);
    await t.tick(3000);
    expect(t.ui.activeErrors()).toHaveLength(1);
  });

  it('sair da fila remove o alerta', async () => {
    const t = await setup({ refresh: vi.fn(async () => 'no-button') });
    await t.tick(INTERVAL);
    t.screen.go(SCREEN.CONSULTA);
    expect(t.ui.activeErrors()).toHaveLength(0);
  });

  it('falha ao ler as configurações não derruba o timer', async () => {
    const t = await setup();
    t.settings.get.mockRejectedValueOnce(new Error('storage'));
    await t.tick(INTERVAL);
    await t.tick(INTERVAL);
    expect(t.refresh).toHaveBeenCalled();
  });
});
