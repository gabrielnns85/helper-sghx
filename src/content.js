// Content script no mundo isolado: UI, funcionalidades e chrome.*.
import { createBridgeClient } from './core/bridge-client.js';
import { createFeatureRegistry } from './features/index.js';
import { createAutoLoginFeature } from './features/auto-login/index.js';
import { createQueueRefreshFeature } from './features/queue-refresh/index.js';
import { watchScreen } from './core/screen/index.js';
import { SITE } from './core/sites.js';
import { bindSessionToScreen, createSessionClient, createSettings } from './core/storage/index.js';
import { initUi } from './ui/index.js';

const PING_ATTEMPTS = 3;

async function pingBridge(bridge) {
  // A ponte pode ser injetada depois deste script: tenta algumas vezes.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await bridge.request('ping');
    } catch (err) {
      if (attempt >= PING_ATTEMPTS) throw err;
    }
  }
}

async function main() {
  const { version } = chrome.runtime.getManifest();
  const bridge = createBridgeClient(window, { timeoutMs: 1000 });
  const features = createFeatureRegistry();
  features.register(createAutoLoginFeature());
  features.register(createQueueRefreshFeature());

  // Tela ativa do SGHx: as funcionalidades usam screen.current() e screen.subscribe().
  const screen = watchScreen();

  // Sessão do atendimento (apagada ao voltar à fila/login) e configurações do médico.
  const session = createSessionClient();
  const settings = createSettings();
  bindSessionToScreen({ session, screen });

  // Painel flutuante: as funcionalidades registram seções e mensagens por ctx.ui.
  const ui = await initUi({ screen });
  await features.initAll({ site: SITE.SGHX, bridge, screen, session, settings, ui });

  try {
    const page = await pingBridge(bridge);
    console.info(`[helper-sghx] ${version} carregado · ko: ${page.ko} · jQuery: ${page.jquery}`);
  } catch (err) {
    console.warn(`[helper-sghx] ${version} carregado, mas a ponte com a página falhou:`, err.message);
  }
}

main();
