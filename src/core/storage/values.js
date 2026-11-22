// Valores que podem ir para o chrome.storage (que guarda JSON) e congelamento profundo.

const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Descreve o tipo do jeito que a validação compara: 'array', 'object', 'null', 'number'… */
export const kindOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
};

/** Só JSON puro: null, boolean, string, número finito, array e objeto simples. */
export function isStorable(value) {
  switch (kindOf(value)) {
    case 'null':
    case 'boolean':
    case 'string':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'array':
      return value.every(isStorable);
    case 'object':
      return isPlainObject(value) && Object.values(value).every(isStorable);
    default:
      return false;
  }
}

/** @param {string} context prefixo da mensagem de erro */
export function assertKey(key, context) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new TypeError(`${context}: a chave deve ser um texto não vazio`);
  }
}

/** @param {string} context prefixo da mensagem de erro */
export function assertStorable(value, context) {
  if (!isStorable(value)) {
    throw new TypeError(`${context}: o valor deve ser JSON (texto, número finito, booleano, null, lista ou objeto simples)`);
  }
}

/**
 * Congela o valor e tudo dentro dele. Usar só em valores recém-copiados
 * (o chrome.storage devolve uma cópia nova a cada leitura).
 * @template T @param {T} value @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
