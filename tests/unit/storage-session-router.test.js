// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createSessionStore } from '../../src/core/storage/session-store.js';
import { createSessionRouter, sessionMessage } from '../../src/core/storage/session-router.js';
import {
  createFakeArea,
  sender,
  EXTENSION_ID,
  SGHX_URL,
  MOBILEMED_URL,
  SIRESP_URL,
} from '../helpers/fake-chrome.js';

const SGHX_TAB = 10;
const OTHER_SGHX_TAB = 20;
const MOBILEMED_TAB = 30;

const fromSghx = (tabId = SGHX_TAB) => sender({ url: SGHX_URL, tabId });
const fromMobilemed = () => sender({ url: MOBILEMED_URL, tabId: MOBILEMED_TAB });

let router;

beforeEach(() => {
  const store = createSessionStore({ area: createFakeArea() });
  router = createSessionRouter({ store, extensionId: EXTENSION_ID });
});

const send = (op, args, from) => router.handle(sessionMessage(op, args), from);

describe('createSessionRouter: quem pode o quê', () => {
  it('o SGHx inicia o atendimento e lê/grava na própria aba', async () => {
    const started = await send('start', {}, fromSghx());
    expect(started).toEqual({ ok: true, value: { id: expect.any(String) } });

    expect(await send('set', { key: 'cid', value: 'J06.9' }, fromSghx())).toEqual({ ok: true, value: null });
    expect(await send('get', { key: 'cid' }, fromSghx())).toEqual({ ok: true, value: 'J06.9' });
  });

  it('outro site lê e grava no atendimento ativo', async () => {
    const { value } = await send('start', {}, fromSghx());
    expect(await send('current', {}, fromMobilemed())).toEqual({ ok: true, value });

    await send('set', { key: 'rx', value: 'laudo pronto' }, fromMobilemed());
    expect(await send('get', { key: 'rx' }, fromSghx())).toEqual({ ok: true, value: 'laudo pronto' });
  });

  it('outro site sem atendimento ativo: current() null e set() recusado (modo isolado)', async () => {
    expect(await send('current', {}, fromMobilemed())).toEqual({ ok: true, value: null });
    const res = await send('set', { key: 'x', value: 1 }, fromMobilemed());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sem atendimento ativo/i);
  });

  it.each(['start', 'claim', 'clear'])('só o SGHx pode %s', async (op) => {
    await send('start', {}, fromSghx());
    const res = await send(op, {}, sender({ url: SIRESP_URL, tabId: 40 }));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/não permitido/i) });
    expect((await send('current', {}, fromMobilemed())).value).not.toBeNull();
  });

  it('a aba do SGHx em outro paciente lê o próprio atendimento, não o ativo', async () => {
    await send('start', {}, fromSghx(SGHX_TAB));
    await send('set', { key: 'nome', value: 'A' }, fromSghx(SGHX_TAB));
    await send('start', {}, fromSghx(OTHER_SGHX_TAB));
    await send('set', { key: 'nome', value: 'B' }, fromSghx(OTHER_SGHX_TAB));

    expect((await send('get', { key: 'nome' }, fromSghx(SGHX_TAB))).value).toBe('A');
    expect((await send('get', { key: 'nome' }, fromMobilemed())).value).toBe('B');

    await send('claim', {}, fromSghx(SGHX_TAB));
    expect((await send('get', { key: 'nome' }, fromMobilemed())).value).toBe('A');
  });

  it('clear do SGHx apaga a sessão que os outros sites viam', async () => {
    await send('start', {}, fromSghx());
    await send('clear', {}, fromSghx());
    expect(await send('current', {}, fromMobilemed())).toEqual({ ok: true, value: null });
  });

  it('set com expectId de atendimento antigo é recusado', async () => {
    const old = (await send('start', {}, fromSghx())).value;
    await send('start', {}, fromSghx());
    const res = await send('set', { key: 'x', value: 1, expectId: old.id }, fromMobilemed());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/atendimento mudou/i);
  });
});

describe('createSessionRouter: remetentes recusados', () => {
  it.each([
    ['outra extensão', sender({ url: SGHX_URL, id: 'outra-extensao' })],
    ['site fora da lista', sender({ url: 'https://example.com/' })],
    ['domínio parecido', sender({ url: 'https://laudos.mobilemed.com.br.evil.com/' })],
    ['sem aba (popup/página da extensão)', sender({ url: SGHX_URL, tabId: undefined })],
    ['sem URL', sender({ url: undefined })],
  ])('%s', async (_caso, from) => {
    const res = await send('current', {}, from);
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/remetente não autorizado/i) });
  });

  it('operação desconhecida', async () => {
    const res = await send('dump', {}, fromSghx());
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/operação desconhecida/i) });
  });

  it('erro de validação vira resposta ok:false, sem lançar', async () => {
    await send('start', {}, fromSghx());
    const res = await send('set', { key: '', value: 1 }, fromSghx());
    expect(res.ok).toBe(false);
    expect(res.error).toEqual(expect.any(String));
  });
});

describe('sessionMessage', () => {
  it('monta a mensagem do protocolo e é reconhecida pelo roteador', () => {
    const msg = sessionMessage('get', { key: 'cid' });
    expect(msg).toEqual({ source: 'helper-sghx', kind: 'session', op: 'get', key: 'cid' });
    expect(router.accepts(msg)).toBe(true);
    expect(router.accepts({ source: 'outro', kind: 'session', op: 'get' })).toBe(false);
    expect(router.accepts(null)).toBe(false);
  });
});
