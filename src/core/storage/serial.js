/**
 * Fila de operações assíncronas, uma por vez, para ler → alterar → gravar no
 * chrome.storage sem uma operação atropelar a outra.
 * O erro de uma tarefa chega a quem a chamou e não trava as próximas.
 *
 * @returns {<T>(task: () => Promise<T>) => Promise<T>}
 */
export function createSerialQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => undefined); // só mantém a fila andando; quem chamou recebe o erro em `result`
    return result;
  };
}
