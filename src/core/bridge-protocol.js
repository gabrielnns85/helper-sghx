/**
 * Protocolo de mensagens entre o content script (mundo isolado) e a ponte
 * injetada no mundo MAIN da página. Ver docs/adr/0001-mundo-de-execucao.md.
 */
export const SOURCE = 'helper-sghx';
export const PROTOCOL_VERSION = 1;

let counter = 0;
function nextId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createRequest(type, payload = null, id = nextId()) {
  return { source: SOURCE, v: PROTOCOL_VERSION, dir: 'request', id, type, payload };
}

export function createResponse(request, { ok, payload = null, error } = {}) {
  const base = { source: SOURCE, v: PROTOCOL_VERSION, dir: 'response', id: request.id, type: request.type, ok: Boolean(ok) };
  return ok ? { ...base, payload } : { ...base, error: String(error ?? 'Erro desconhecido') };
}

function isEnvelope(data) {
  return (
    data !== null &&
    typeof data === 'object' &&
    data.source === SOURCE &&
    data.v === PROTOCOL_VERSION &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    typeof data.type === 'string' &&
    data.type.length > 0
  );
}

export function isRequest(data) {
  return isEnvelope(data) && data.dir === 'request';
}

export function isResponse(data) {
  return isEnvelope(data) && data.dir === 'response' && typeof data.ok === 'boolean';
}
