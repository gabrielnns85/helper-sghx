// Um ciclo de atualização da fila: clica em Atualizar (skill sghx, MAPA.md §1: toolbar
// `#FilaToolbar_Atualizar`) e reseleciona a categoria da fila definida. Só lê: nada grava.
import { CATEGORY_ROWS, findQueueRow } from '../../core/queue-grid.js';
import { waitFor } from '../../core/dom/index.js';
import { TimeoutError } from '../../core/dom/errors.js';

export const REFRESH_BUTTON = '#FilaToolbar_Atualizar';
/** Quanto esperar a grade recarregar (ajax) antes de aceitar a que já está na tela (o SGHx costuma atualizar no lugar: a área principal fica vazia até reselecionar). */
export const RELOAD_TIMEOUT_MS = 2000;

/**
 * @param {{ queue: { codAcaoDestino: number, codEspecialidade: number, indSituacao: number },
 *   root?: ParentNode, reloadTimeout?: number }} opts
 * @returns {Promise<'refreshed' | 'queue-not-found' | 'no-button'>}
 */
export async function refreshQueue({ queue, root = document, reloadTimeout = RELOAD_TIMEOUT_MS }) {
  const button = root.querySelector(REFRESH_BUTTON);
  if (!button) return 'no-button';
  const before = new Set(root.querySelectorAll(CATEGORY_ROWS));
  button.click();
  // A grade é recarregada por ajax: a linha certa é a nova, não a que já estava na tela.
  // Se o SGHx atualizar no lugar (mesmas linhas), vale a que está lá depois da espera.
  let row;
  try {
    row = await waitFor(
      () => { const found = findQueueRow(root, queue); return found && !before.has(found) ? found : null; },
      { timeout: reloadTimeout, description: 'grade da fila recarregada', root },
    );
  } catch (err) {
    if (!(err instanceof TimeoutError)) throw err;
    row = findQueueRow(root, queue);
  }
  if (!row) return 'queue-not-found';
  row.click();
  return 'refreshed';
}
