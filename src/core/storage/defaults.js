import { NO_QUEUE } from '../catalog.js';
import { deepFreeze } from './values.js';

/**
 * Configurações do médico e seus valores padrão. Só chaves listadas aqui podem ser
 * salvas, com a mesma forma e os mesmos tipos (ver settings.js). Opções novas entram
 * aqui junto com a issue que as usa (#8, #11, #14…).
 * Senhas NÃO entram aqui: vão para o cofre (#64).
 */
export const DEFAULT_SETTINGS = deepFreeze({
  /** Unidade de saúde: só o código; o nome vem de src/core/catalog.js (CodFces 28 = UPA JACANA). */
  unit: { codFces: 28 },
  /**
   * Atualização automática da fila (#13/#14). `queue` guarda só os códigos da categoria
   * (skill sghx › Fila). Começa sem fila: o médico escolhe antes de ligar, para não
   * acompanhar a fila errada sem perceber.
   */
  queueRefresh: { enabled: false, intervalSec: 30, queue: { ...NO_QUEUE } },
  /** Login automático no SGHx (#10/#11). */
  autoLogin: { enabled: false },
});
