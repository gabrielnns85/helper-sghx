// Etapa 2 do login automático (#10): modal de contexto (#modalLogin) depois de autenticar.
// Skill sghx, MAPA.md §1 passo 3. Cliente sempre 59 SBCD - SAO PAULO (nunca o "- SGHX");
// a ocupação que vier escolhida fica; sem nenhuma, o médico escolhe.
import { isNoQueue } from '../../core/catalog.js';
import { setFieldValue, waitFor } from '../../core/dom/index.js';
import { clickModalSubmit, isOnlyOpenModal } from './page.js';

const CONTEXT_MODAL = '#modalLogin';
const CLIENT = Object.freeze({ selector: '#comboMunicipio', value: '59' });
const UNIT_SELECT = '#comboEstabelecimento';
const OCCUPATION_SELECT = '#comboOcupacao';
const SUBMODULE = Object.freeze({ selector: '#comboSubModulo', value: '2' }); // PRONTO ATENDIMENTO

const hasOption = (select, value) => [...(select?.options ?? [])].some((o) => o.value === value);
const hasRealOption = (select) => [...(select?.options ?? [])].some((o) => o.value !== '');

/** Espera a opção aparecer (as listas podem vir por ajax depois do Cliente) e escolhe. */
async function choose(modal, selector, value, timeout) {
  const select = await waitFor(() => {
    const el = modal.querySelector(selector);
    return hasOption(el, value) ? el : null;
  }, { timeout, description: `opção ${value} em "${selector}"`, root: modal });
  if (select.value !== value) await setFieldValue(select, value, { root: modal });
}

/** Ocupação já escolhida? Espera a lista carregar antes de decidir. */
async function occupationChosen(modal, timeout) {
  const select = await waitFor(() => {
    const el = modal.querySelector(OCCUPATION_SELECT);
    return hasRealOption(el) ? el : null;
  }, { timeout, description: `opções em "${OCCUPATION_SELECT}"`, root: modal });
  return select.value !== '';
}

/**
 * @param {{ codFces: number, queue: import('./state.js').QueueCodes,
 *   state: { tryAttempt(step: string): boolean, markQueuePending(q: object): void },
 *   root?: ParentNode, timeout?: number }} opts
 * @returns {Promise<'not-ready' | 'cooldown' | 'needs-occupation' | 'submitted'>}
 */
export async function runContextStep({ codFces, queue, state, root = document, timeout }) {
  if (!isOnlyOpenModal(root, CONTEXT_MODAL)) return 'not-ready';
  if (!state.tryAttempt('context')) return 'cooldown';
  const modal = root.querySelector(CONTEXT_MODAL);
  await choose(modal, CLIENT.selector, CLIENT.value, timeout);
  await choose(modal, UNIT_SELECT, String(codFces), timeout);
  if (!(await occupationChosen(modal, timeout))) return 'needs-occupation';
  await choose(modal, SUBMODULE.selector, SUBMODULE.value, timeout);
  if (!isNoQueue(queue)) state.markQueuePending(queue);
  clickModalSubmit(modal);
  return 'submitted';
}
