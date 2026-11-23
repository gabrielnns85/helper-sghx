// Etapa 3 do login automático (#10): depois de entrar, o SGHx abre a página inicial do PEP;
// a fila fica em Atendimento > Fila de Atendimento (skill sghx, MAPA.md §1 passo 4).
// Só navega quando o próprio login automático marcou a fila para abrir.
import { isVisible } from '../../core/dom/util.js';

export const FILA_PATH = '/sistema/Pep/Fila/FilaInicial';
const PEP_PREFIX = '/sistema/pep';
const FILA_SEGMENT = '/fila/';
const FILA_MARKER = '#Fila_CodAgrupamento';
const LOGIN_FIELD = '#inputUsuario';

/** Dentro do PEP (já logado), fora da fila. */
function isPepOutsideFila(root, pathname) {
  const path = pathname.toLowerCase();
  if (!path.startsWith(PEP_PREFIX) || path.includes(FILA_SEGMENT)) return false;
  return !isVisible(root.querySelector(FILA_MARKER)) && !isVisible(root.querySelector(LOGIN_FIELD));
}

/**
 * @param {{ state: { tryAttempt(step: string): boolean, hasQueuePending(): boolean },
 *   root?: ParentNode, location?: Pick<Location, 'origin' | 'pathname' | 'assign'> }} opts
 * @returns {Promise<'not-ready' | 'cooldown' | 'submitted'>}
 */
export async function runNavigateStep({ state, root = document, location = globalThis.location }) {
  if (!state.hasQueuePending() || !isPepOutsideFila(root, location.pathname)) return 'not-ready';
  if (!state.tryAttempt('navigate')) return 'cooldown';
  location.assign(`${location.origin}${FILA_PATH}`);
  return 'submitted';
}
