import { describe, it, expect, vi, afterEach } from 'vitest';
import { createResponse, isRequest } from '../../src/core/bridge-protocol.js';
import { createBridgeClient } from '../../src/core/bridge-client.js';

const ORIGIN = 'https://upajacana.example.test';

/** Janela falsa: postMessage entrega a todos os listeners de forma assíncrona. */
function fakeWindow() {
  const target = new EventTarget();
  const win = {
    location: { origin: ORIGIN },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    posted: [],
    postMessage(data, targetOrigin) {
      win.posted.push({ data, targetOrigin });
      queueMicrotask(() => win.deliver(data));
    },
    deliver(data, { source = win, origin = ORIGIN } = {}) {
      const ev = new Event('message');
      Object.assign(ev, { data, source, origin });
      target.dispatchEvent(ev);
    },
  };
  return win;
}

/** Simula a ponte: responde às requisições postadas. */
function attachFakeBridge(win, reply) {
  win.addEventListener('message', (ev) => {
    if (isRequest(ev.data)) win.deliver(createResponse(ev.data, reply(ev.data)));
  });
}

afterEach(() => vi.useRealTimers());

describe('bridge-client (mundo isolado)', () => {
  it('posta a requisição restrita à própria origem', async () => {
    const win = fakeWindow();
    attachFakeBridge(win, () => ({ ok: true, payload: 'pong' }));
    await createBridgeClient(win).request('ping');
    expect(win.posted[0].targetOrigin).toBe(ORIGIN);
    expect(win.posted[0].data).toMatchObject({ dir: 'request', type: 'ping' });
  });

  it('resolve com o payload da resposta correspondente', async () => {
    const win = fakeWindow();
    attachFakeBridge(win, (req) => ({ ok: true, payload: { eco: req.payload } }));
    await expect(createBridgeClient(win).request('ping', 7)).resolves.toEqual({ eco: 7 });
  });

  it('rejeita quando a ponte responde com erro', async () => {
    const win = fakeWindow();
    attachFakeBridge(win, () => ({ ok: false, error: 'Comando desconhecido' }));
    await expect(createBridgeClient(win).request('x')).rejects.toThrow('Comando desconhecido');
  });

  it('ignora respostas de outra janela ou de outra origem', async () => {
    vi.useFakeTimers();
    const win = fakeWindow();
    win.addEventListener('message', (ev) => {
      if (!isRequest(ev.data)) return;
      const res = createResponse(ev.data, { ok: true, payload: 'falso' });
      win.deliver(res, { source: {} });
      win.deliver(res, { origin: 'https://malicioso.test' });
    });
    const p = createBridgeClient(win, { timeoutMs: 500 }).request('ping');
    const assertion = expect(p).rejects.toThrow(/tempo/i);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it('expira quando a ponte não responde', async () => {
    vi.useFakeTimers();
    const p = createBridgeClient(fakeWindow(), { timeoutMs: 300 }).request('ping');
    const assertion = expect(p).rejects.toThrow(/tempo/i);
    await vi.advanceTimersByTimeAsync(300);
    await assertion;
  });
});
