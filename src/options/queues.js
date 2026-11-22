// Filas do pronto atendimento conhecidas pela skill sghx (referencia/MAPA.md §7,
// mapa.json › fila_categorias_acao). A página de opções não roda no SGHx e não
// consegue chamar Fila/BuscaPainelPorFilaAcaoDestino: a #14 troca esta lista pela
// lista real lida na fila. CodAcaoDestino 5 = Pronto Atendimento, situação 1 = aguardando.
import { deepFreeze } from '../core/storage/values.js';

const prontoAtendimento = (codEspecialidade, nome) => ({
  codAcaoDestino: 5,
  codEspecialidade,
  indSituacao: 1,
  label: `PRONTO ATENDIMENTO - ${nome}`,
});

export const KNOWN_QUEUES = deepFreeze([
  prontoAtendimento(11, 'CIRURGIA GERAL'),
  prontoAtendimento(106, 'FAST TRACK'),
  prontoAtendimento(15, 'MEDICINA INTERNA / CLINICA GERAL'),
  prontoAtendimento(105, 'ORTOPEDIA / TRAUMATOLOGIA'),
  prontoAtendimento(36, 'PEDIATRIA'),
  prontoAtendimento(39, 'PSIQUIATRIA'),
]);
