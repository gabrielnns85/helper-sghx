import { describe, it, expect } from 'vitest';
import { createRequest } from '../../src/core/bridge-protocol.js';
import { createPageHandlers, handleRequest } from '../../src/core/bridge-handlers.js';

describe('bridge-handlers (mundo MAIN)', () => {
  it('ping informa se Knockout e jQuery existem na página', () => {
    expect(createPageHandlers({ ko: {}, jQuery: () => {} }).ping()).toEqual({ ko: true, jquery: true });
    expect(createPageHandlers({}).ping()).toEqual({ ko: false, jquery: false });
  });

  it('responde com o resultado do handler', async () => {
    const res = await handleRequest(createRequest('ping', null, 'r1'), { ping: () => 'pong' });
    expect(res).toMatchObject({ dir: 'response', id: 'r1', type: 'ping', ok: true, payload: 'pong' });
  });

  it('recusa tipos fora da lista de comandos', async () => {
    const res = await handleRequest(createRequest('eval', 'alert(1)', 'r2'), { ping: () => 'pong' });
    expect(res).toMatchObject({ id: 'r2', ok: false });
    expect(res.error).toMatch(/desconhecido/i);
  });

  it('não expõe propriedades herdadas como comandos', async () => {
    const res = await handleRequest(createRequest('toString', null, 'r3'), { ping: () => 'pong' });
    expect(res.ok).toBe(false);
  });

  it('converte exceção do handler em resposta de erro', async () => {
    const res = await handleRequest(createRequest('ping', null, 'r4'), {
      ping: () => { throw new Error('quebrou'); },
    });
    expect(res).toMatchObject({ ok: false, error: 'quebrou' });
  });
});
