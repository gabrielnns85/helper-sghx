import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { createPanel } from '../../src/ui/panel.js';

const HOST = '#helper-sghx-panel';

/** Tela ativa falsa: current() e subscribe() como o watchScreen. */
function fakeScreen(id = 'fila') {
  let current = { id, stack: [id] };
  const listeners = new Set();
  return {
    current: () => current,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    go(next) {
      const previous = current;
      current = { id: next, stack: [next] };
      for (const fn of listeners) fn({ previous, current });
    },
  };
}

const memoryState = (initial = { collapsed: false }) => {
  let value = initial;
  return { load: vi.fn(async () => value), save: vi.fn(async (v) => { value = v; }) };
};

const shadow = () => document.querySelector(HOST).shadowRoot;
const q = (sel) => shadow().querySelector(sel);
const flush = () => new Promise((r) => setTimeout(r, 0));

let panel;
const make = async (opts = {}) => {
  panel = createPanel({ screen: fakeScreen(), state: memoryState(), ...opts });
  await panel.mount();
  return panel;
};

beforeEach(() => loadFixture('fila-pronto-atendimento'));
afterEach(() => {
  panel?.destroy();
  panel = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  clearFixture();
});

describe('painel: montagem', () => {
  it('monta um host único com shadow DOM, à direita e acima dos modais', async () => {
    await make();
    await panel.mount();
    expect(document.querySelectorAll(HOST)).toHaveLength(1);
    expect(shadow()).toBeTruthy();
    const css = shadow().querySelector('style').textContent;
    expect(css).toMatch(/right:\s*0/);
    expect(css).not.toMatch(/left:\s*0/);
    expect(Number(/z-index:\s*(\d+)/.exec(css)[1])).toBeGreaterThanOrEqual(2147483000);
  });

  it('destroy remove o painel da página', async () => {
    await make();
    panel.destroy();
    expect(document.querySelector(HOST)).toBeNull();
  });
});

describe('painel: recolher e lembrar', () => {
  it('abre por padrão e recolhe pelo botão, gravando o estado', async () => {
    const state = memoryState();
    await make({ state });
    expect(q('[data-part="body"]').hidden).toBe(false);
    q('[data-part="toggle"]').click();
    await flush();
    expect(q('[data-part="body"]').hidden).toBe(true);
    expect(q('[data-part="toggle"]').getAttribute('aria-expanded')).toBe('false');
    expect(state.save).toHaveBeenCalledWith({ collapsed: true });
  });

  it('abre já recolhido quando o estado salvo é recolhido', async () => {
    await make({ state: memoryState({ collapsed: true }) });
    expect(q('[data-part="body"]').hidden).toBe(true);
  });

  it('se gravar falhar, o painel continua recolhendo', async () => {
    const state = memoryState();
    state.save.mockRejectedValue(new Error('x'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await make({ state });
    q('[data-part="toggle"]').click();
    await flush();
    expect(q('[data-part="body"]').hidden).toBe(true);
  });
});

describe('painel: tela ativa', () => {
  it('mostra o nome da tela detectada e atualiza quando muda', async () => {
    const screen = fakeScreen('fila');
    await make({ screen });
    expect(q('[data-part="screen"]').textContent).toMatch(/Fila/);
    screen.go('consulta');
    expect(q('[data-part="screen"]').textContent).toMatch(/Consulta/);
  });

  it('mostra "Tela não reconhecida" em unknown', async () => {
    await make({ screen: fakeScreen('unknown') });
    expect(q('[data-part="screen"]').textContent).toMatch(/não reconhecida/i);
  });

  it('recolhido, a aba informa a tela ativa (title e aria-label) e acompanha as mudanças', async () => {
    const screen = fakeScreen('fila');
    await make({ screen, state: memoryState({ collapsed: true }) });
    expect(q('[data-part="toggle"]').title).toMatch(/Fila/);
    expect(q('[data-part="toggle"]').getAttribute('aria-label')).toMatch(/Fila/);
    screen.go('atestado');
    expect(q('[data-part="toggle"]').title).toMatch(/Atestado/);
  });
});

describe('painel: seções', () => {
  it('mostra só as seções da tela ativa e troca ao mudar de tela', async () => {
    const screen = fakeScreen('fila');
    await make({ screen });
    panel.registerSection({ id: 'a', title: 'Fila A', screens: ['fila'], render: (el) => (el.textContent = 'conteúdo A') });
    panel.registerSection({ id: 'b', title: 'Consulta B', screens: ['consulta'], render: (el) => (el.textContent = 'conteúdo B') });
    expect(q('[data-section="a"]').textContent).toMatch(/conteúdo A/);
    expect(q('[data-section="b"]')).toBeNull();
    screen.go('consulta');
    expect(q('[data-section="a"]')).toBeNull();
    expect(q('[data-section="b"]').textContent).toMatch(/conteúdo B/);
  });

  it('passa a tela ao render e o título aparece na seção', async () => {
    const render = vi.fn();
    await make();
    panel.registerSection({ id: 'a', title: 'Minha seção', screens: ['fila'], render });
    expect(q('[data-section="a"]').textContent).toMatch(/Minha seção/);
    expect(render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ screen: expect.objectContaining({ id: 'fila' }) }));
  });

  it('seção registrada antes de mount() aparece depois dele', async () => {
    panel = createPanel({ screen: fakeScreen(), state: memoryState() });
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: () => {} });
    await panel.mount();
    expect(q('[data-section="a"]')).toBeTruthy();
  });

  it('uma seção que lança erro não derruba as outras e avisa o médico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await make();
    panel.registerSection({ id: 'ruim', title: 'Ruim', screens: ['fila'], render: () => { throw new Error('boom'); } });
    panel.registerSection({ id: 'boa', title: 'Boa', screens: ['fila'], render: (el) => (el.textContent = 'ok') });
    expect(q('[data-section="boa"]').textContent).toMatch(/ok/);
    expect(q('[data-part="messages"]').textContent).toMatch(/Ruim/);
  });

  it('recusa seção duplicada', async () => {
    await make();
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: () => {} });
    expect(() => panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: () => {} })).toThrow(/duplicada/);
  });
});

describe('painel: mensagens', () => {
  it('mostra erro fixo até o médico dispensar', async () => {
    vi.useFakeTimers();
    await make();
    panel.notify({ level: 'error', text: 'Sessão expirada' });
    vi.advanceTimersByTime(10 * 60_000);
    expect(q('[data-part="messages"]').textContent).toMatch(/Sessão expirada/);
    q('[data-part="messages"] [data-action="dismiss"]').click();
    expect(q('[data-part="messages"]').textContent).not.toMatch(/Sessão expirada/);
    vi.useRealTimers();
  });

  it('mensagem de info some sozinha', async () => {
    vi.useFakeTimers();
    await make();
    panel.notify({ level: 'info', text: 'Fila atualizada' });
    expect(q('[data-part="messages"]').textContent).toMatch(/Fila atualizada/);
    vi.advanceTimersByTime(10_000);
    expect(q('[data-part="messages"]').textContent).not.toMatch(/Fila atualizada/);
    vi.useRealTimers();
  });

  it('notify devolve uma função que limpa a mensagem', async () => {
    await make();
    const clear = panel.notify({ level: 'error', text: 'Falhou' });
    clear();
    expect(q('[data-part="messages"]').textContent).not.toMatch(/Falhou/);
  });

  it('mostra o texto como texto, nunca como HTML', async () => {
    await make();
    panel.notify({ level: 'error', text: '<img src=x onerror=alert(1)>' });
    expect(q('[data-part="messages"] img')).toBeNull();
    expect(q('[data-part="messages"]').textContent).toContain('<img');
  });

  it('erro aparece mesmo com o painel recolhido (indicador na aba)', async () => {
    await make({ state: memoryState({ collapsed: true }) });
    panel.notify({ level: 'error', text: 'Falhou' });
    expect(q('[data-part="toggle"]').dataset.alert).toBe('error');
  });

  it('recusa nível desconhecido e texto vazio', async () => {
    await make();
    expect(() => panel.notify({ level: 'x', text: 'a' })).toThrow(TypeError);
    expect(() => panel.notify({ level: 'info', text: '' })).toThrow(TypeError);
  });
});

describe('painel: não interfere no SGHx', () => {
  it('o host fica direto no body, fora do conteúdo do SGHx', async () => {
    await make();
    expect(document.querySelector(HOST).parentElement).toBe(document.body);
  });

  it('não é detectado como modal pelo detectScreen', async () => {
    const { detectScreen } = await import('../../src/core/screen/index.js');
    const before = detectScreen({ root: document });
    await make();
    panel.notify({ level: 'error', text: 'x' });
    expect(detectScreen({ root: document })).toEqual(before);
  });
});

describe('painel: ciclo de vida', () => {
  it('destroy durante o mount não deixa painel nem ouvinte para trás', async () => {
    const screen = fakeScreen();
    const unsub = vi.fn();
    screen.subscribe = vi.fn(() => unsub);
    let release;
    const state = { load: vi.fn(() => new Promise((r) => { release = r; })), save: vi.fn() };
    panel = createPanel({ screen, state });
    const mounting = panel.mount();
    panel.destroy();
    release({ collapsed: false });
    await mounting;
    expect(document.querySelector(HOST)).toBeNull();
    expect(screen.subscribe).not.toHaveBeenCalled();
  });

  it('dois mount() concorrentes montam um painel só', async () => {
    panel = createPanel({ screen: fakeScreen(), state: memoryState() });
    await Promise.all([panel.mount(), panel.mount()]);
    expect(document.querySelectorAll(HOST)).toHaveLength(1);
  });

  it('destroy cancela a inscrição na tela e os timers das mensagens', async () => {
    vi.useFakeTimers();
    const screen = fakeScreen();
    const unsub = vi.fn();
    const subscribe = screen.subscribe;
    screen.subscribe = (fn) => { const off = subscribe(fn); return () => { unsub(); off(); }; };
    await make({ screen });
    const baseline = vi.getTimerCount();
    panel.notify({ level: 'info', text: 'a' });
    expect(vi.getTimerCount()).toBe(baseline + 1);
    panel.destroy();
    expect(unsub).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(baseline);
    vi.useRealTimers();
  });

  it('mount depois de destroy monta de novo', async () => {
    await make();
    panel.destroy();
    await panel.mount();
    expect(document.querySelectorAll(HOST)).toHaveLength(1);
  });

  it('notify depois de destroy não guarda nem agenda nada', async () => {
    vi.useFakeTimers();
    await make();
    panel.destroy();
    const baseline = vi.getTimerCount();
    const clear = panel.notify({ level: 'info', text: 'a' });
    expect(clear).toBeTypeOf('function');
    expect(vi.getTimerCount()).toBe(baseline);
    vi.useRealTimers();
  });
});

describe('painel: seções (ciclo de vida e erros)', () => {
  it('registrar uma seção nova não refaz as outras', async () => {
    await make();
    const renderA = vi.fn();
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: renderA });
    panel.registerSection({ id: 'b', title: 'B', screens: ['fila'], render: () => {} });
    expect(renderA).toHaveBeenCalledTimes(1);
  });

  it('mantém a ordem de registro das seções', async () => {
    await make();
    for (const id of ['a', 'b', 'c']) panel.registerSection({ id, title: id, screens: ['fila'], render: () => {} });
    expect([...shadow().querySelectorAll('[data-section]')].map((n) => n.dataset.section)).toEqual(['a', 'b', 'c']);
  });

  it('o signal do render é abortado ao trocar de tela e no destroy', async () => {
    const screen = fakeScreen('fila');
    await make({ screen });
    let signal;
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: (_el, ctx) => { signal = ctx.signal; } });
    expect(signal.aborted).toBe(false);
    screen.go('consulta');
    expect(signal.aborted).toBe(true);
    screen.go('fila');
    const second = signal;
    panel.destroy();
    expect(second.aborted).toBe(true);
  });

  it('render assíncrono que rejeita vira erro no painel, sem rejeição não tratada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await make();
    panel.registerSection({ id: 'a', title: 'Assíncrona', screens: ['fila'], render: async () => { throw new Error('x'); } });
    await flush();
    expect(q('[data-part="messages"]').textContent).toMatch(/Assíncrona/);
  });

  it('o erro de uma seção quebrada não se repete a cada troca de tela', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const screen = fakeScreen('fila');
    await make({ screen });
    panel.registerSection({ id: 'ruim', title: 'Ruim', screens: ['fila', 'consulta'], render: () => { throw new Error('x'); } });
    screen.go('consulta');
    screen.go('fila');
    expect(shadow().querySelectorAll('[data-part="messages"] .message')).toHaveLength(1);
  });

  it('o erro da seção some quando ela volta a renderizar sem falhar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const screen = fakeScreen('fila');
    await make({ screen });
    let fail = true;
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila', 'consulta'], render: () => { if (fail) throw new Error('x'); } });
    fail = false;
    screen.go('consulta');
    expect(shadow().querySelectorAll('[data-part="messages"] .message')).toHaveLength(0);
  });

  it('seção de outra tela não aparece em unknown', async () => {
    await make({ screen: fakeScreen('unknown') });
    panel.registerSection({ id: 'a', title: 'A', screens: ['fila'], render: () => {} });
    expect(q('[data-section="a"]')).toBeNull();
  });
});

describe('painel: erro com o painel recolhido', () => {
  it('abre o corpo para mostrar o erro, sem gravar isso como preferência', async () => {
    const state = memoryState({ collapsed: true });
    await make({ state });
    panel.notify({ level: 'error', text: 'Sessão expirada' });
    expect(q('[data-part="body"]').hidden).toBe(false);
    expect(state.save).not.toHaveBeenCalled();
  });

  it('o médico consegue recolher de novo e a preferência gravada é recolhido', async () => {
    const state = memoryState({ collapsed: true });
    await make({ state });
    panel.notify({ level: 'error', text: 'x' });
    q('[data-part="toggle"]').click();
    await flush();
    expect(q('[data-part="body"]').hidden).toBe(true);
    expect(state.save).toHaveBeenLastCalledWith({ collapsed: true });
  });

  it('info não abre o painel recolhido', async () => {
    await make({ state: memoryState({ collapsed: true }) });
    panel.notify({ level: 'info', text: 'x' });
    expect(q('[data-part="body"]').hidden).toBe(true);
  });
});
