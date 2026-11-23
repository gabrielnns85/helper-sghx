/** Estado de interface do painel (aberto/recolhido), lembrado entre páginas. Não são configurações do médico. */
const STORAGE_KEY = 'uiState';
const DEFAULT_PANEL = Object.freeze({ collapsed: false });

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isValidPanel = (v) => isPlainObject(v) && Object.keys(v).length === 1 && typeof v.collapsed === 'boolean';

/** @param {{ area?: chrome.storage.StorageArea }} [opts] */
export function createPanelState({ area = globalThis.chrome?.storage?.local } = {}) {
  if (!area) throw new Error('Estado do painel: chrome.storage.local indisponível');

  async function readAll() {
    const { [STORAGE_KEY]: saved } = await area.get(STORAGE_KEY);
    return isPlainObject(saved) ? saved : {};
  }

  return {
    /** Estado salvo ou o padrão (aberto); nunca lança. */
    async load() {
      try {
        const { panel } = await readAll();
        if (panel === undefined) return { ...DEFAULT_PANEL };
        if (isValidPanel(panel)) return { collapsed: panel.collapsed };
        console.warn('[helper-sghx] estado do painel salvo é inválido; usando o padrão');
      } catch (err) {
        console.warn('[helper-sghx] não foi possível ler o estado do painel:', err.message);
      }
      return { ...DEFAULT_PANEL };
    },

    /** Grava o estado; falha de storage só avisa (o painel segue funcionando). */
    async save(panel) {
      if (!isValidPanel(panel)) throw new TypeError('Estado do painel: esperado { collapsed: boolean }');
      try {
        await area.set({ [STORAGE_KEY]: { ...(await readAll()), panel: { collapsed: panel.collapsed } } });
      } catch (err) {
        console.warn('[helper-sghx] não foi possível gravar o estado do painel:', err.message);
      }
    },
  };
}
