// Content script dos outros sites (imagens, SIRESP, laboratório), no mundo isolado.
// Funciona com ou sem atendimento aberto no SGHx: sem atendimento, session.current()
// é null e as funcionalidades rodam isoladas (login, copiar dados). Ver docs/storage.md.
import { siteForUrl } from '../core/sites.js';
import { createSessionClient, createSettings } from '../core/storage/index.js';
import { createFeatureRegistry } from '../features/index.js';

async function main(site) {
  const { version } = chrome.runtime.getManifest();
  const session = createSessionClient();
  const settings = createSettings();
  const features = createFeatureRegistry();

  await features.initAll({ site, session, settings });
  console.info(`[helper-sghx] ${version} carregado em ${site}`);
}

const site = siteForUrl(location.href);
if (site) main(site);
