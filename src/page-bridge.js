// Roda no mundo MAIN da página (acesso a ko, jQuery e globais do SGHx).
// Não tem acesso a chrome.*. Ver docs/adr/0001-mundo-de-execucao.md.
import { isRequest } from './core/bridge-protocol.js';
import { createPageHandlers, handleRequest } from './core/bridge-handlers.js';

const handlers = createPageHandlers(window);

window.addEventListener('message', async (ev) => {
  if (ev.source !== window || ev.origin !== window.location.origin) return;
  if (!isRequest(ev.data)) return;
  const response = await handleRequest(ev.data, handlers);
  window.postMessage(response, window.location.origin);
});
