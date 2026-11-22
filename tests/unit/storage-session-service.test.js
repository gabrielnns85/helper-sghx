// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { installSessionService } from '../../src/core/storage/session-service.js';
import { sessionMessage } from '../../src/core/storage/session-router.js';
import { createFakeChrome, sender, SGHX_URL, MOBILEMED_URL } from '../helpers/fake-chrome.js';

const SGHX_TAB = 10;

let chrome;

/** Entrega a mensagem como o Chrome: o ouvinte responde por sendResponse. */
function deliver(message, from) {
  return new Promise((resolve) => {
    const [keepOpen] = chrome.runtime.onMessage.emit(message, from, resolve);
    if (keepOpen !== true) resolve('sem resposta');
  });
}

beforeEach(() => {
  chrome = createFakeChrome();
  installSessionService(chrome);
});

describe('installSessionService (service worker)', () => {
  it('responde às mensagens da sessão de forma assíncrona', async () => {
    const res = await deliver(sessionMessage('start'), sender({ url: SGHX_URL, tabId: SGHX_TAB }));
    expect(res).toEqual({ ok: true, value: { id: expect.any(String) } });
  });

  it('guarda no chrome.storage.session, nunca no local', async () => {
    await deliver(sessionMessage('start'), sender({ url: SGHX_URL, tabId: SGHX_TAB }));
    await deliver(sessionMessage('set', { key: 'cid', value: 'J06.9' }), sender({ url: SGHX_URL, tabId: SGHX_TAB }));
    expect(JSON.stringify(chrome.storage.session.dump())).toContain('J06.9');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('ignora mensagens que não são da sessão (não segura o canal)', async () => {
    expect(await deliver({ type: 'outra-coisa' }, sender({ url: SGHX_URL }))).toBe('sem resposta');
  });

  it('fechar a aba do SGHx apaga o atendimento dela', async () => {
    await deliver(sessionMessage('start'), sender({ url: SGHX_URL, tabId: SGHX_TAB }));
    await Promise.all(chrome.tabs.onRemoved.emit(SGHX_TAB, { isWindowClosing: false }));
    const res = await deliver(sessionMessage('current'), sender({ url: MOBILEMED_URL, tabId: 30 }));
    expect(res).toEqual({ ok: true, value: null });
  });
});
