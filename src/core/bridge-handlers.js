import { createResponse } from './bridge-protocol.js';
import { setPageFieldValue } from './dom/page-fields.js';

/**
 * Comandos que a ponte (mundo MAIN) aceita. Nada aqui pode salvar no
 * prontuário: os comandos só leem o estado da página ou preenchem campos,
 * como o usuário faria. Qualquer script da página consegue chamar estes
 * comandos, então nunca exponha algo que a própria página não possa fazer.
 */
export function createPageHandlers(win) {
  return {
    ping() {
      return { ko: Boolean(win.ko), jquery: Boolean(win.jQuery) };
    },
    // Preenche widget DevExtreme ou observable do Knockout (ver src/core/dom/fields.js).
    setFieldValue(payload) {
      return setPageFieldValue(win, payload);
    },
  };
}

export async function handleRequest(request, handlers) {
  if (!Object.hasOwn(handlers, request.type)) {
    return createResponse(request, { ok: false, error: `Comando desconhecido: ${request.type}` });
  }
  try {
    const payload = await handlers[request.type](request.payload);
    return createResponse(request, { ok: true, payload });
  } catch (err) {
    return createResponse(request, { ok: false, error: err?.message ?? err });
  }
}
