/**
 * Registro das funcionalidades. Cada funcionalidade é { id, init(ctx) }.
 * Funcionalidades são adicionadas nas próprias issues (login, fila, atestado…).
 * ctx = { site, session, settings } em todos os sites (src/core/sites.js), mais
 * { bridge, screen } no SGHx: `screen` é o watchScreen (src/core/screen), para agir
 * só na tela certa (`screen.current().id`) e reagir a mudanças (`screen.subscribe`).
 * `session` guarda dados do atendimento (nunca persistidos) e `settings` as
 * configurações do médico (`settings.subscribe` aplica mudanças sem recarregar);
 * ver docs/storage.md. Opções e painel seguem docs/funcionalidades.md.
 */
export function createFeatureRegistry() {
  const features = [];

  return {
    register(feature) {
      if (!feature || typeof feature.id !== 'string' || !feature.id) {
        throw new Error('Funcionalidade sem id');
      }
      if (typeof feature.init !== 'function') {
        throw new Error(`Funcionalidade "${feature.id}" sem init()`);
      }
      if (features.some((f) => f.id === feature.id)) {
        throw new Error(`Funcionalidade duplicada: ${feature.id}`);
      }
      features.push(feature);
    },

    list() {
      return [...features];
    },

    async initAll(ctx) {
      const result = { ok: [], failed: [] };
      for (const feature of features) {
        try {
          await feature.init(ctx);
          result.ok.push(feature.id);
        } catch (err) {
          console.error(`[helper-sghx] falha ao iniciar "${feature.id}"`, err);
          result.failed.push(feature.id);
        }
      }
      return result;
    },
  };
}
