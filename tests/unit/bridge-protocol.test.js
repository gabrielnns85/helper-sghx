import { describe, it, expect } from 'vitest';
import {
  SOURCE,
  PROTOCOL_VERSION,
  createRequest,
  createResponse,
  isRequest,
  isResponse,
} from '../../src/core/bridge-protocol.js';

describe('bridge-protocol', () => {
  it('cria requisição com origem, versão, direção, id e tipo', () => {
    expect(createRequest('ping', { a: 1 }, 'id-1')).toEqual({
      source: SOURCE, v: PROTOCOL_VERSION, dir: 'request', id: 'id-1', type: 'ping', payload: { a: 1 },
    });
  });

  it('gera id único quando não informado', () => {
    expect(createRequest('ping').id).not.toBe(createRequest('ping').id);
  });

  it('cria resposta de sucesso e de erro ligada à requisição', () => {
    const req = createRequest('ping', null, 'id-2');
    expect(createResponse(req, { ok: true, payload: 42 })).toEqual({
      source: SOURCE, v: PROTOCOL_VERSION, dir: 'response', id: 'id-2', type: 'ping', ok: true, payload: 42,
    });
    expect(createResponse(req, { ok: false, error: 'falhou' })).toMatchObject({ ok: false, error: 'falhou' });
  });

  it('reconhece requisições válidas', () => {
    expect(isRequest(createRequest('ping'))).toBe(true);
  });

  it('rejeita mensagens de outra origem, versão ou formato', () => {
    const ok = createRequest('ping');
    expect(isRequest({ ...ok, source: 'outra-extensao' })).toBe(false);
    expect(isRequest({ ...ok, v: PROTOCOL_VERSION + 1 })).toBe(false);
    expect(isRequest({ ...ok, type: 42 })).toBe(false);
    expect(isRequest({ ...ok, id: '' })).toBe(false);
    expect(isRequest(null)).toBe(false);
    expect(isRequest('texto')).toBe(false);
  });

  it('não confunde requisição com resposta', () => {
    const req = createRequest('ping');
    const res = createResponse(req, { ok: true });
    expect(isRequest(res)).toBe(false);
    expect(isResponse(req)).toBe(false);
    expect(isResponse(res)).toBe(true);
  });
});
