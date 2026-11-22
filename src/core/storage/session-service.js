import { createSessionStore } from './session-store.js';
import { createSessionRouter } from './session-router.js';

/**
 * Liga a sessão do atendimento ao service worker: responde às mensagens dos content
 * scripts e apaga o atendimento da aba que foi fechada. O chrome.storage.session só
 * é acessível aqui (nível de acesso padrão: contextos confiáveis), então os content
 * scripts dependem do worker e passam pela validação do roteador.
 *
 * @param {typeof chrome} chromeApi
 */
export function installSessionService(chromeApi) {
  const store = createSessionStore({ area: chromeApi.storage.session });
  const router = createSessionRouter({ store, extensionId: chromeApi.runtime.id });

  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!router.accepts(message)) return false;
    router.handle(message, sender).then(sendResponse);
    return true; // resposta assíncrona
  });

  chromeApi.tabs.onRemoved.addListener((tabId) =>
    store.clear(tabId).catch((err) => {
      console.warn('[helper-sghx] não foi possível apagar a sessão da aba fechada:', err.message);
    }),
  );

  return { store, router };
}
