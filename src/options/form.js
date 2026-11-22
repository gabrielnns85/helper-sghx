// Conversão entre o formulário da página de opções e as configurações (#8).
// Sem DOM e sem chrome.*: a página (page.js) lê os campos e mostra os erros.
import { validateSetting } from '../core/storage/settings-rules.js';
import { KNOWN_QUEUES } from './queues.js';

/**
 * @typedef {{ codAcaoDestino: number, codEspecialidade: number, indSituacao: number, label: string }} Queue
 * @typedef {{ value: string, label: string, queue: Queue }} QueueOption
 * @typedef {{
 *   autoLoginEnabled: boolean, queueRefreshEnabled: boolean,
 *   intervalSec: string, queue: string, unitName: string, codFces: string,
 * }} FormValues
 */

/** Identifica a categoria da fila como o SGHx: CodAcaoDestino:CodEspecialidade:IndSituacao. */
export const queueKey = (queue) => `${queue.codAcaoDestino}:${queue.codEspecialidade}:${queue.indSituacao}`;

const toOption = (queue) => ({ value: queueKey(queue), label: queue.label, queue });

/**
 * Filas para o select: as conhecidas e, se a salva não estiver entre elas, ela no fim.
 * @param {Queue} current
 * @returns {QueueOption[]}
 */
export function queueOptions(current) {
  const known = KNOWN_QUEUES.map(toOption);
  return known.some((o) => o.value === queueKey(current)) ? known : [...known, toOption(current)];
}

/** @returns {FormValues} */
export function settingsToForm(settings) {
  return {
    autoLoginEnabled: settings.autoLogin.enabled,
    queueRefreshEnabled: settings.queueRefresh.enabled,
    intervalSec: String(settings.queueRefresh.intervalSec),
    queue: queueKey(settings.queueRefresh.queue),
    unitName: settings.unit.name,
    codFces: String(settings.unit.codFces),
  };
}

/** Texto do campo em número; vazio vira NaN para a regra recusar. */
const toNumber = (text) => {
  const trimmed = String(text).trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
};

/**
 * Valores do formulário → configurações prontas para settings.set, ou os erros por campo.
 * @param {FormValues} values
 * @param {QueueOption[]} options as filas mostradas no select
 * @returns {{ settings: Record<string, unknown> | null, errors: { path: string, message: string }[] }}
 */
export function formToSettings(values, options) {
  const option = options.find((o) => o.value === values.queue);
  const queueErrors = option ? [] : [{ path: 'queueRefresh.queue', message: 'Fila: escolha uma fila da lista' }];
  const candidate = {
    unit: { name: values.unitName.trim(), codFces: toNumber(values.codFces) },
    autoLogin: { enabled: Boolean(values.autoLoginEnabled) },
    queueRefresh: {
      enabled: Boolean(values.queueRefreshEnabled),
      intervalSec: toNumber(values.intervalSec),
      // Sem fila válida, o erro acima já barra; o placeholder só mantém a forma para as outras regras.
      queue: option ? option.queue : options[0].queue,
    },
  };
  const errors = [...queueErrors, ...Object.entries(candidate).flatMap(([key, value]) => validateSetting(key, value))];
  return errors.length > 0 ? { settings: null, errors } : { settings: candidate, errors: [] };
}

const FIELD_BY_PATH = Object.freeze({
  'unit.name': 'unitName',
  'unit.codFces': 'codFces',
  'queueRefresh.intervalSec': 'intervalSec',
  'queueRefresh.queue': 'queue',
});

/** Campo do formulário onde mostrar o erro de `path` (null = só no status). */
export function fieldForPath(path) {
  if (path.startsWith('queueRefresh.queue')) return 'queue';
  return FIELD_BY_PATH[path] ?? null;
}
