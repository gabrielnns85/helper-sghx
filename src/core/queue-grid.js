// Coluna Ação da Fila de Atendimento (skill sghx, MAPA.md §7): categorias em
// `#Fila_GridAcao tr[data-model]`. Clicar na categoria só lista pacientes: não grava nada.

export const CATEGORY_ROWS = '#Fila_GridAcao tr[data-model]';

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

/** Linha da categoria com os mesmos códigos da fila, ou null (categoria vazia some da lista). */
export const findQueueRow = (root, queue) =>
  [...root.querySelectorAll(CATEGORY_ROWS)].find((row) => sameQueue(rowCodes(row), queue)) ?? null;
