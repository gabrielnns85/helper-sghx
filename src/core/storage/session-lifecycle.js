import { SCREEN } from '../screen/screens.js';

/** Telas que sempre encerram o atendimento: fila e login (logout). */
const LEAVING = new Set([SCREEN.FILA, SCREEN.LOGIN]);

/** Na consulta ou num modal aberto a partir dela (prescrição, atestado, EMAD…). */
const inConsulta = (screen) => screen.stack.includes(SCREEN.CONSULTA);

/** Interações do médico que marcam a aba como "em uso" (fase de captura, antes da página). */
const INTERACTIONS = ['pointerdown', 'keydown'];

/**
 * Liga a sessão do atendimento às telas do SGHx (só no content script do SGHx):
 * - entrou na consulta → abre o atendimento (ativo só se a janela tiver foco);
 * - saiu da consulta (fila, login, modal não mapeado sobre a fila…) → apaga;
 * - saiu da página (logout, F5, navegar) → apaga;
 * - médico usou a aba (foco, clique, tecla) → ela passa a definir o atendimento ativo
 *   (o da consulta dela, ou nenhum se estiver fora da consulta).
 * Só ficar visível não conta: uma janela de trás que aparece não muda o ativo.
 * Modal desconhecido sobre a consulta (ex.: sessão expirada) não muda nada.
 *
 * @param {{ session: ReturnType<typeof import('./session-client.js').createSessionClient>,
 *           screen: ReturnType<typeof import('../screen/watch.js').watchScreen>,
 *           win?: Window }} opts
 * @returns {() => void} desliga tudo
 */
export function bindSessionToScreen({ session, screen, win = window }) {
  const doc = win.document;
  let claimedSinceFocus = false;

  const run = (action, args) => {
    session[action](args).catch((err) => {
      console.warn(`[helper-sghx] sessão do atendimento (${action}):`, err.message);
    });
  };

  const start = () => run('start', { activate: doc.hasFocus() });
  const sync = () => (inConsulta(screen.current()) ? start() : run('clear'));

  const onScreenChange = ({ previous, current }) => {
    if (inConsulta(current)) {
      if (!inConsulta(previous)) start();
    } else if (inConsulta(previous) || LEAVING.has(current.id)) {
      run('clear');
    }
  };

  const claim = () => {
    claimedSinceFocus = true;
    run('claim');
  };
  const onFocus = () => {
    if (doc.hasFocus()) claim();
  };
  const onInteraction = () => {
    if (!claimedSinceFocus) claim();
  };
  const onBlur = () => {
    claimedSinceFocus = false;
  };
  const onPageHide = () => run('clear');
  const onPageShow = (event) => {
    if (event.persisted) sync(); // voltou do cache de navegação (bfcache)
  };

  sync();
  const unsubscribe = screen.subscribe(onScreenChange);
  const listeners = [
    [win, 'focus', onFocus],
    [win, 'blur', onBlur],
    [win, 'pagehide', onPageHide],
    [win, 'pageshow', onPageShow],
    ...INTERACTIONS.map((type) => [doc, type, onInteraction, true]),
  ];
  listeners.forEach(([target, type, fn, capture]) => target.addEventListener(type, fn, capture));

  return () => {
    unsubscribe();
    listeners.forEach(([target, type, fn, capture]) => target.removeEventListener(type, fn, capture));
  };
}
