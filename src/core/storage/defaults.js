import { NO_QUEUE } from '../catalog.js';
import { deepFreeze } from './values.js';

/**
 * Configurações do médico e seus valores padrão. Só chaves listadas aqui podem ser
 * salvas, com a mesma forma e os mesmos tipos (ver settings.js). Opções novas entram
 * aqui junto com a issue que as usa (#8, #11, #14…).
 * Senhas vão para o cofre (#64). Exceção temporária, decidida na #10 para a fase de
 * teste: a senha do SGHx do login automático (modo 'password') fica em `autoLogin`.
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
  /**
   * Login automático no SGHx (#10/#11). `mode`: 'cloud' (Certificado Nuvem → VIDAAS,
   * a extensão não vê senha nenhuma) ou 'password' (usuário e senha do SGHx guardados
   * aqui, em texto puro, até o cofre da #64). Texto livre justificado na #10.
   */
  autoLogin: { enabled: false, mode: 'cloud', user: '', password: '' },
});
