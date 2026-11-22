// Página de opções da extensão (#8): ponto de entrada empacotado pelo esbuild.
import { createSettings } from '../core/storage/settings.js';
import { initOptionsPage } from './page.js';

initOptionsPage({ settings: createSettings(), root: document }).catch((err) => {
  console.error('[helper-sghx] falha ao abrir a página de opções', err);
  const status = document.querySelector('#status');
  if (status) {
    status.dataset.kind = 'error';
    status.textContent = 'Não foi possível carregar as configurações. Recarregue a página.';
  }
});
