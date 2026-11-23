// Regras de valor das configurações (#8). A forma (chaves e tipos) já foi conferida
// por settings.js; aqui ficam os limites de cada campo. Usado por settings.set, pela
// leitura do que está salvo e pela página de opções (erros por campo).
// Unidade e fila só aceitam códigos do catálogo (src/core/catalog.js): sem texto livre.
import { findQueue, findUnit, isNoQueue } from '../catalog.js';

/** Intervalo de atualização da fila, em segundos. */
export const MIN_INTERVAL_SEC = 30;
export const MAX_INTERVAL_SEC = 360;

/** Modos do login automático (#10). */
export const AUTO_LOGIN_MODES = Object.freeze(['cloud', 'password']);
export const MAX_USER_LENGTH = 80;
export const MAX_PASSWORD_LENGTH = 128;

/** @typedef {{ path: string, message: string }} SettingError */

/** Erro em `path` quando `ok` é falso. */
const check = (ok, path, message) => (ok ? [] : [{ path, message }]);

function unitRules(unit) {
  return check(findUnit(unit.codFces) !== null, 'unit.codFces', 'Unidade não suportada');
}

function queueErrors({ enabled, queue }) {
  if (isNoQueue(queue)) {
    return check(!enabled, 'queueRefresh.queue', 'Escolha a fila antes de ligar a atualização automática');
  }
  return check(findQueue(queue) !== null, 'queueRefresh.queue', 'Fila não reconhecida: escolha uma fila da lista');
}

function queueRefreshRules(value) {
  const { intervalSec } = value;
  return [
    ...check(
      Number.isInteger(intervalSec) && intervalSec >= MIN_INTERVAL_SEC && intervalSec <= MAX_INTERVAL_SEC,
      'queueRefresh.intervalSec',
      `Intervalo: um número inteiro de ${MIN_INTERVAL_SEC} a ${MAX_INTERVAL_SEC} segundos`,
    ),
    ...queueErrors(value),
  ];
}

const isBlank = (text) => text.trim() === '';

// Mensagens nunca citam o valor digitado: a senha não pode aparecer em erro nem log.
function passwordModeErrors({ enabled, user, password }) {
  if (!enabled) return [];
  return [
    ...check(!isBlank(user), 'autoLogin.user', 'Informe o usuário do SGHx para entrar com usuário e senha'),
    ...check(password !== '', 'autoLogin.password', 'Informe a senha do SGHx para entrar com usuário e senha'),
  ];
}

function autoLoginRules(value) {
  const { mode, user, password } = value;
  if (!AUTO_LOGIN_MODES.includes(mode)) return [{ path: 'autoLogin.mode', message: 'Modo de login não reconhecido' }];
  return [
    ...check(user.length <= MAX_USER_LENGTH, 'autoLogin.user', `Usuário: no máximo ${MAX_USER_LENGTH} caracteres`),
    ...check(password.length <= MAX_PASSWORD_LENGTH, 'autoLogin.password', `Senha: no máximo ${MAX_PASSWORD_LENGTH} caracteres`),
    ...check(mode === 'password' || password === '', 'autoLogin.password', 'A senha só fica salva no modo usuário e senha'),
    ...(mode === 'password' ? passwordModeErrors(value) : []),
  ];
}

/** Regras por chave de DEFAULT_SETTINGS. Chave sem regra: só a forma vale. */
const RULES = Object.freeze({
  unit: unitRules,
  queueRefresh: queueRefreshRules,
  autoLogin: autoLoginRules,
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
