import { createRequest, isResponse } from './bridge-protocol.js';

/**
 * Cliente da ponte, usado no mundo isolado. As respostas vêm da página e
 * devem ser tratadas como dados não confiáveis.
 */
export function createBridgeClient(win, { timeoutMs = 2000 } = {}) {
  const pending = new Map();

  win.addEventListener('message', (ev) => {
    if (ev.source !== win || ev.origin !== win.location.origin) return;
    const msg = ev.data;
    if (!isResponse(msg) || !pending.has(msg.id)) return;
    const { resolve, reject, timer } = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(timer);
    if (msg.ok) resolve(msg.payload);
    else reject(new Error(msg.error));
  });

  return {
    request(type, payload = null) {
      const req = createRequest(type, payload);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(req.id);
          reject(new Error(`Ponte não respondeu a "${type}" dentro do tempo (${timeoutMs} ms)`));
        }, timeoutMs);
        pending.set(req.id, { resolve, reject, timer });
        win.postMessage(req, win.location.origin);
      });
    },
  };
}
