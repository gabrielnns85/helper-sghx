// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionClient } from '../../src/core/storage/session-client.js';
import { createSessionStore } from '../../src/core/storage/session-store.js';
import { createSessionRouter } from '../../src/core/storage/session-router.js';
import { createFakeArea, sender, EXTENSION_ID, SGHX_URL, LISNET_URL } from '../helpers/fake-chrome.js';

/** Cliente ligado a um worker de verdade (roteador + store), como se estivesse no site `url`. */
function clientAt(router, url, tabId) {
  const runtime = { sendMessage: vi.fn((msg) => router.handle(msg, sender({ url, tabId }))) };
  return createSessionClient({ runtime });
}

describe('createSessionClient: integração com o service worker', () => {
  let sghx;
  let lisnet;

  beforeEach(() => {
    const router = createSessionRouter({ store: createSessionStore({ area: createFakeArea() }), extensionId: EXTENSION_ID });
    sghx = clientAt(router, SGHX_URL, 10);
    lisnet = clientAt(router, LISNET_URL, 30);
  });

  it('session.get/set/clear de ponta a ponta entre SGHx e outro site', async () => {
    const { id } = await sghx.start();
    await sghx.set('cid', 'J06.9');

    expect(await lisnet.current()).toEqual({ id });
    expect(await lisnet.get('cid', { expectId: id })).toBe('J06.9');

    await lisnet.set('lisnet.exames', ['hemograma'], { expectId: id });
    expect(await sghx.get('lisnet.exames')).toEqual(['hemograma']);

    await sghx.clear();
    expect(await lisnet.current()).toBeNull();
    await expect(lisnet.get('cid', { expectId: id })).rejects.toThrow(/sem atendimento ativo/i);
  });

  it('outro site sem atendimento: current() null; set() rejeita com a mensagem do worker', async () => {
    expect(await lisnet.current()).toBeNull();
    await expect(lisnet.set('lisnet.x', 1, { expectId: 'qualquer' })).rejects.toThrow(/sem atendimento ativo/i);
  });

  it('outro site não consegue apagar nem abrir atendimento', async () => {
    await expect(lisnet.clear()).rejects.toThrow(/não permitido/i);
    await expect(lisnet.start()).rejects.toThrow(/não permitido/i);
  });
});

describe('createSessionClient: falhas de comunicação', () => {
  it('worker inacessível (extensão recarregada) vira erro claro', async () => {
    const runtime = { sendMessage: vi.fn().mockRejectedValue(new Error('Extension context invalidated.')) };
    await expect(createSessionClient({ runtime }).current()).rejects.toThrow(/sessão do atendimento indisponível/i);
  });

  it('resposta vazia ou fora do protocolo vira erro', async () => {
    for (const reply of [undefined, null, { qualquer: 1 }]) {
      const runtime = { sendMessage: vi.fn().mockResolvedValue(reply) };
      await expect(createSessionClient({ runtime }).get('x')).rejects.toThrow(/resposta inválida/i);
    }
  });

  it('envia mensagens no protocolo da sessão', async () => {
    const runtime = { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: null }) };
    await createSessionClient({ runtime }).set('cid', 'J06.9', { expectId: 'abc' });
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      source: 'helper-sghx',
      kind: 'session',
      op: 'set',
      key: 'cid',
      value: 'J06.9',
      expectId: 'abc',
    });
  });

  it('get e start enviam expectId e activate', async () => {
    const runtime = { sendMessage: vi.fn().mockResolvedValue({ ok: true, value: null }) };
    const client = createSessionClient({ runtime });
    await client.get('paciente', { expectId: 'abc' });
    await client.start({ activate: false });
    expect(runtime.sendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ op: 'get', key: 'paciente', expectId: 'abc' }));
    expect(runtime.sendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ op: 'start', activate: false }));
  });
});
