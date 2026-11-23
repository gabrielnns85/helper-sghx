// Etapa 4 do login automático (#10): já na Fila de Atendimento, abre a fila configurada
// (queueRefresh.queue) clicando na categoria da coluna Ação. Skill sghx, MAPA.md §7:
// `#Fila_GridAcao tr[data-model]`. Clicar na categoria só lista pacientes: não grava nada.
import { isVisible } from '../../core/dom/util.js';
import { visibleLightboxes } from './page.js';
import { waitFor } from '../../core/dom/index.js';
import { TimeoutError } from '../../core/dom/errors.js';

const FILA_MARKER = '#Fila_CodAgrupamento';
const CATEGORY_ROWS = '#Fila_GridAcao tr[data-model]';

/** data-model vem da página: parse defensivo, só os três códigos. */
function rowCodes(row) {
  try {
    const model = JSON.parse(row.getAttribute('data-model'));
    return { codAcaoDestino: model.CodAcaoDestino, codEspecialidade: model.CodEspecialidade, indSituacao: model.IndSituacao };
  } catch {
    return null;
  }
}

const sameQueue = (a, b) =>
  a !== null && a.codAcaoDestino === b.codAcaoDestino && a.codEspecialidade === b.codEspecialidade && a.indSituacao === b.indSituacao;

const findRow = (root, queue) => [...root.querySelectorAll(CATEGORY_ROWS)].find((row) => sameQueue(rowCodes(row), queue)) ?? null;

/**
 * @param {{ state: { takeQueuePending(): import('./state.js').QueueCodes | null },
 *   root?: ParentNode, timeout?: number }} opts
 * @returns {Promise<'not-ready' | 'no-pending' | 'queue-not-found' | 'selected'>}
 */
export async function runQueueStep({ state, root = document, timeout }) {
  if (!isVisible(root.querySelector(FILA_MARKER)) || visibleLightboxes(root).length > 0) return 'not-ready';
  const queue = state.takeQueuePending();
  if (!queue) return 'no-pending';
  try {
    const row = await waitFor(() => findRow(root, queue), { timeout, description: 'categoria da fila configurada', root });
    row.click();
    return 'selected';
  } catch (err) {
    if (err instanceof TimeoutError) return 'queue-not-found'; // categoria vazia some da lista
    throw err;
  }
}
