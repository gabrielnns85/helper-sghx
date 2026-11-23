/** CSS do painel, dentro do shadow DOM (o CSS do SGHx não vaza para cá nem o contrário). */
export const PANEL_CSS = `
:host { all: initial; position: fixed; top: 50%; right: 0; transform: translateY(-50%);
  z-index: 2147483600; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color-scheme: light dark; }
.panel { display: flex; align-items: flex-start; }
.body { width: 280px; max-height: 80vh; overflow: auto; box-sizing: border-box; padding: 10px 12px;
  background: Canvas; color: CanvasText; border: 1px solid #8886; border-right: 0; border-radius: 8px 0 0 8px;
  box-shadow: -2px 2px 10px #0003; }
.body[hidden] { display: none; }
.toggle { all: unset; cursor: pointer; box-sizing: border-box; width: 24px; padding: 10px 0; text-align: center;
  background: #1f6feb; color: #fff; border-radius: 6px 0 0 6px; font-weight: 700; user-select: none; }
.toggle:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
.toggle[data-alert='error'] { background: #c62828; }
.screen { margin: 0 0 8px; font-weight: 600; }
.screen small { display: block; font-weight: 400; opacity: .7; }
.messages { margin-bottom: 8px; }
.message { display: flex; gap: 6px; align-items: flex-start; padding: 6px 8px; margin-bottom: 4px;
  border-radius: 4px; background: #1f6feb22; }
.message[data-level='error'] { background: #c6282826; border-left: 3px solid #c62828; }
.message span { flex: 1; overflow-wrap: anywhere; }
.message button { all: unset; cursor: pointer; padding: 0 4px; }
.section { border-top: 1px solid #8884; padding-top: 6px; margin-top: 6px; }
.section h2 { font-size: 12px; margin: 0 0 4px; text-transform: uppercase; opacity: .7; }
`;
