// Catálogo fixo de unidades e filas do SGHx (skill sghx: SKILL.md › Mapa rápido,
// referencia/MAPA.md §7). Nas configurações só se gravam códigos; nomes saem daqui,
// para que nenhum texto livre (nem dado de paciente) vá para o chrome.storage.
// A #14 troca KNOWN_QUEUES pela lista real lida em Fila/BuscaPainelPorFilaAcaoDestino.
import { deepFreeze } from './storage/values.js';

/** Unidades suportadas. Outra unidade = nova entrada aqui. */
export const KNOWN_UNITS = deepFreeze([{ codFces: 28, name: 'UPA JACANA' }]);

const prontoAtendimento = (codEspecialidade, nome) => ({
  codAcaoDestino: 5, // Pronto Atendimento
  codEspecialidade,
  indSituacao: 1, // aguardando (3 = já atendidos, fora de propósito)
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

/** Nenhuma fila escolhida: o médico precisa escolher antes de ligar a atualização. */
export const NO_QUEUE = deepFreeze({ codAcaoDestino: 0, codEspecialidade: 0, indSituacao: 0 });

export const isNoQueue = (queue) =>
  queue.codAcaoDestino === 0 && queue.codEspecialidade === 0 && queue.indSituacao === 0;

/** CodAcaoDestino:CodEspecialidade:IndSituacao, ou '' para nenhuma fila. */
export const queueKey = (queue) =>
  isNoQueue(queue) ? '' : `${queue.codAcaoDestino}:${queue.codEspecialidade}:${queue.indSituacao}`;

/** Fila do catálogo com os mesmos códigos, ou null. */
export const findQueue = (queue) => KNOWN_QUEUES.find((q) => queueKey(q) === queueKey(queue)) ?? null;

/** Unidade do catálogo com o CodFces, ou null. */
export const findUnit = (codFces) => KNOWN_UNITS.find((u) => u.codFces === codFces) ?? null;
