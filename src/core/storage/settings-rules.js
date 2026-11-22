// Regras de valor das configurações (#8). A forma (chaves e tipos) já foi conferida
// por settings.js; aqui ficam os limites de cada campo. Usado por settings.set, pela
// leitura do que está salvo e pela página de opções (erros por campo).

/** Intervalo de atualização da fila, em segundos. */
export const MIN_INTERVAL_SEC = 30;
export const MAX_INTERVAL_SEC = 360;

/** Unidades suportadas (skill sghx: CodFces 28 = UPA JACANA). Outra unidade = novo código aqui. */
export const SUPPORTED_COD_FCES = Object.freeze([28]);

export const UNIT_NAME_MAX = 100;
export const QUEUE_LABEL_MAX = 120;

/** @typedef {{ path: string, message: string }} SettingError */

const isInteger = (v) => Number.isInteger(v);

/** Erro em `path` quando `ok` é falso. */
const check = (ok, path, message) => (ok ? [] : [{ path, message }]);

const checkText = (value, max, path, label) =>
  check(value.trim() !== '' && value.length <= max, path, `${label}: preencha com até ${max} caracteres`);

function unitRules(unit) {
  return [
    ...checkText(unit.name, UNIT_NAME_MAX, 'unit.name', 'Nome da unidade'),
    ...check(
      SUPPORTED_COD_FCES.includes(unit.codFces),
      'unit.codFces',
      `Unidade não suportada (CodFces aceitos: ${SUPPORTED_COD_FCES.join(', ')})`,
    ),
  ];
}

function queueRules(queue) {
  const base = 'queueRefresh.queue';
  return [
    ...check(isInteger(queue.codAcaoDestino) && queue.codAcaoDestino > 0, `${base}.codAcaoDestino`,
      'Fila: código da ação (CodAcaoDestino) deve ser um inteiro positivo'),
    ...check(isInteger(queue.codEspecialidade) && queue.codEspecialidade >= 0, `${base}.codEspecialidade`,
      'Fila: código da especialidade deve ser um inteiro (0 = sem especialidade)'),
    ...check(isInteger(queue.indSituacao) && queue.indSituacao >= 0, `${base}.indSituacao`,
      'Fila: situação deve ser um inteiro (1 = aguardando, 3 = já atendidos)'),
    ...checkText(queue.label, QUEUE_LABEL_MAX, `${base}.label`, 'Nome da fila'),
  ];
}

function queueRefreshRules(value) {
  return [
    ...check(
      isInteger(value.intervalSec) && value.intervalSec >= MIN_INTERVAL_SEC && value.intervalSec <= MAX_INTERVAL_SEC,
      'queueRefresh.intervalSec',
      `Intervalo: um número inteiro de ${MIN_INTERVAL_SEC} a ${MAX_INTERVAL_SEC} segundos`,
    ),
    ...queueRules(value.queue),
  ];
}

/** Regras por chave de DEFAULT_SETTINGS. Chave sem regra: só a forma vale. */
const RULES = Object.freeze({
  unit: unitRules,
  queueRefresh: queueRefreshRules,
});

/**
 * Erros de valor de uma configuração (lista vazia = válida). Supõe a forma já conferida.
 * @param {string} key
 * @param {any} value
 * @returns {SettingError[]}
 */
export function validateSetting(key, value) {
  const rule = Object.hasOwn(RULES, key) ? RULES[key] : null;
  return rule ? rule(value) : [];
}
