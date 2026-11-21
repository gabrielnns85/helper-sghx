/**
 * Stub mínimo do DevExtreme para o jsdom. Imita só o que os helpers usam:
 * `DevExpress.ui.<widget>.getInstance(el)` e `instance.option(nome[, valor])`.
 */
export function installFakeDevExtreme(win, { widgets = ['dxSelectBox', 'dxDateBox', 'dxTextBox'] } = {}) {
  const registry = new Map();
  const ui = {};

  for (const name of widgets) {
    ui[name] = {
      getInstance(el) {
        const inst = registry.get(el);
        return inst && inst.name === name ? inst : undefined;
      },
    };
  }
  win.DevExpress = { ui };

  return {
    /**
     * Cria uma instância ligada ao elemento. `accept(valor)` simula um widget
     * que recusa valores (retorna false → o valor não muda).
     */
    create(name, el, options = {}, { accept = () => true } = {}) {
      const inst = {
        name,
        element: el,
        options: { value: null, ...options },
        option(key, value) {
          if (arguments.length === 1) return this.options[key];
          if (key === 'value' && !accept(value)) return undefined;
          this.options[key] = value;
          return undefined;
        },
      };
      registry.set(el, inst);
      return inst;
    },
    uninstall() {
      delete win.DevExpress;
    },
  };
}
