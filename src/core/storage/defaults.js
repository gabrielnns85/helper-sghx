import { deepFreeze } from './values.js';

/**
 * Configurações do médico e seus valores padrão. Só chaves listadas aqui podem ser
 * salvas, com a mesma forma e os mesmos tipos (ver settings.js). Opções novas entram
 * aqui junto com a issue que as usa (#8, #11, #14…).
 * Senhas NÃO entram aqui: vão para o cofre (#64).
 */
export const DEFAULT_SETTINGS = deepFreeze({
  /** Unidade de saúde (skill sghx: CodFces 28 = UPA JACANA). */
  unit: { name: 'UPA JACANA', codFces: 28 },
  /** Atualização automática da fila (#13/#14). */
  queueRefresh: { enabled: false, intervalSec: 30 },
  /** Login automático no SGHx (#10/#11). */
  autoLogin: { enabled: false },
});
