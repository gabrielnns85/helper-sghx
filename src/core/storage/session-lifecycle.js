import { SCREEN } from '../screen/screens.js';

/** Telas que encerram o atendimento: voltar à fila ou ao login (logout). */
const LEAVING = new Set([SCREEN.FILA, SCREEN.LOGIN]);

/** Na consulta ou num modal aberto a partir dela (prescrição, atestado, EMAD…). */
const inConsulta = (screen) => screen.stack.includes(SCREEN.CONSULTA);

/**
 * Liga a sessão do atendimento às telas do SGHx (só no content script do SGHx):
 * - entrou na consulta → abre o atendimento;
 * - voltou à fila ou ao login → apaga;
 * - saiu da página (logout, F5, navegar) → apaga;
 * - aba/janela da consulta em uso → vira o atendimento ativo para os outros sites.
 * Telas desconhecidas (ex.: sessão expirada) não mudam nada.
 *
 * @param {{ session: ReturnType<typeof import('./session-client.js').createSessionClient>,
 *           screen: ReturnType<typeof import('../screen/watch.js').watchScreen>,
 *           win?: Window }} opts
 * @returns {() => void} desliga tudo
 */
export function bindSessionToScreen({ session, screen, win = window }) {
  const doc = win.document;

  const run = (action) => {
    session[action]().catch((err) => {
      console.warn(`[helper-sghx] sessão do atendimento (${action}):`, err.message);
    });
  };

  const sync = () => run(inConsulta(screen.current()) ? 'start' : 'clear');

  const onScreenChange = ({ previous, current }) => {
    if (LEAVING.has(current.id)) run('clear');
    else if (inConsulta(current) && !inConsulta(previous)) run('start');
  };

  const claimIfInUse = () => {
    if (doc.visibilityState !== 'hidden' && inConsulta(screen.current())) run('claim');
  };
  const onPageHide = () => run('clear');
  const onPageShow = (event) => {
    if (event.persisted) sync(); // voltou do cache de navegação (bfcache)
  };

  sync();
  const unsubscribe = screen.subscribe(onScreenChange);
  doc.addEventListener('visibilitychange', claimIfInUse);
  win.addEventListener('focus', claimIfInUse);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);

  return () => {
    unsubscribe();
    doc.removeEventListener('visibilitychange', claimIfInUse);
    win.removeEventListener('focus', claimIfInUse);
    win.removeEventListener('pagehide', onPageHide);
    win.removeEventListener('pageshow', onPageShow);
  };
}
