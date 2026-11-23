// Atualização automática da fila (#13, F1): na tela da fila, a cada 30 s clica em Atualizar
// e reseleciona a fila definida (settings.queueRefresh). Não atualiza com modal aberto nem
// durante a digitação; o painel mostra a fila acompanhada, "atualizado há X s", o estado e
// o botão Pausar/Retomar (docs/funcionalidades.md §3). O intervalo é fixo nesta fase.
import { findQueue, isNoQueue } from '../../core/catalog.js';
import { SCREEN } from '../../core/screen/index.js';
import { blockedReason, createTypingTracker } from './guards.js';
import { RELOAD_TIMEOUT_MS, refreshQueue } from './refresh.js';

const LOG = '[helper-sghx] atualizar fila';
export const REFRESH_INTERVAL_MS = 30_000;
/** Cadência de verificação: tenta de novo logo que o bloqueio some e mantém o "há X s" vivo. */
const TICK_MS = 1000;
/** Passou disto sem atualizar (× intervalo): alerta visível. */
const STALE_FACTOR = 2;

const STATUS = Object.freeze({
  active: 'Ativo',
  paused: 'Pausado',
  disabled: 'Desligado nas opções',
  'no-queue': 'Defina a fila nas opções',
  modal: 'Aguardando: modal aberto',
  typing: 'Aguardando: você está digitando',
  empty: 'Fila vazia ou fora da lista (grade atualizada)',
  failed: 'Falha ao atualizar',
  'settings-error': 'Não foi possível ler as configurações',
});

const describeError = (err) => `${err?.name ?? 'Erro'}: ${err?.message ?? String(err)}`;

const sinceText = (lastOkAt) =>
  lastOkAt === null ? 'Ainda não atualizou' : `Atualizado há ${Math.max(0, Math.floor((Date.now() - lastOkAt) / 1000))} s`;

/**
 * @param {{ root?: Document, refresh?: typeof refreshQueue, typing?: { isTyping(): boolean, stop(): void },
 *   intervalMs?: number, tickMs?: number, reloadTimeout?: number }} [opts]
 */
export function createQueueRefreshFeature({
  root = document, refresh = refreshQueue, typing, intervalMs = REFRESH_INTERVAL_MS, tickMs = TICK_MS, reloadTimeout = RELOAD_TIMEOUT_MS,
} = {}) {
  let ctx;
  let timer = null;
  let tracker = null;
  let busy = false;
  let paused = false;
  let generation = 0;
  let startedAt = 0;
  let lastAttemptAt = 0;
  let alert = null;
  let view = Object.freeze({ status: 'active', queueLabel: '—', lastOkAt: null });
  const listeners = new Set();

  const setView = (patch) => {
    view = Object.freeze({ ...view, ...patch });
    for (const listener of [...listeners]) listener();
  };

  /** Um alerta por vez, que fica até a atualização voltar (ui.notify 'error' não some sozinho). */
  function setAlert(text) {
    if (alert?.text === text) return;
    alert?.clear();
    alert = { text, clear: ctx.ui.notify({ level: 'error', text }) };
  }
  function clearAlert() {
    alert?.clear();
    alert = null;
  }

  function checkStale(now) {
    const limit = STALE_FACTOR * intervalMs;
    if (now - (view.lastOkAt ?? startedAt) <= limit) return;
    setAlert(`A fila não é atualizada há mais de ${Math.round(limit / 1000)} s`);
  }

  async function readConfig() {
    try {
      return await ctx.settings.get('queueRefresh');
    } catch (err) {
      console.warn(`${LOG}: não foi possível ler as configurações`, describeError(err));
      return null;
    }
  }

  async function runRefresh(queue, run) {
    lastAttemptAt = Date.now();
    let result;
    try {
      result = await refresh({ queue, root, reloadTimeout });
    } catch (err) {
      console.warn(`${LOG}: falha no ciclo`, describeError(err));
      result = 'error';
    }
    if (run !== generation) return; // saiu da fila no meio do ciclo
    if (result === 'refreshed' || result === 'queue-not-found') {
      clearAlert();
      setView({ status: result === 'refreshed' ? 'active' : 'empty', lastOkAt: Date.now() });
      return;
    }
    setView({ status: 'failed' });
    setAlert('Não foi possível atualizar a fila: botão Atualizar não encontrado ou erro na página');
  }

  async function tick() {
    if (busy) return;
    busy = true;
    const run = generation;
    try {
      const config = await readConfig();
      if (run !== generation) return;
      if (!config) return setView({ status: 'settings-error' });
      const queueLabel = isNoQueue(config.queue) ? '—' : (findQueue(config.queue)?.label ?? 'fila definida');
      const inactive = !config.enabled ? 'disabled' : isNoQueue(config.queue) ? 'no-queue' : paused ? 'paused' : null;
      if (inactive) {
        clearAlert();
        return setView({ status: inactive, queueLabel });
      }
      const now = Date.now();
      if (now - lastAttemptAt < intervalMs) return setView({ queueLabel });
      const reason = blockedReason({ root, typing: tracker });
      if (reason) {
        setView({ status: reason, queueLabel });
        return checkStale(now);
      }
      setView({ queueLabel });
      await runRefresh(config.queue, run);
    } finally {
      busy = false;
      if (run === generation) setView({});
    }
  }

  function start() {
    if (timer !== null) return Promise.resolve();
    generation += 1;
    startedAt = Date.now();
    lastAttemptAt = startedAt;
    tracker = typing ?? createTypingTracker({ root });
    timer = setInterval(tick, tickMs);
    return tick();
  }

  function stop() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    generation += 1;
    busy = false;
    tracker?.stop();
    tracker = null;
    clearAlert();
  }

  const onScreen = () => (ctx.screen.current().id === SCREEN.FILA ? start() : stop());

  function renderSection(el, { signal }) {
    const doc = el.ownerDocument;
    const make = (tag, role, text) => {
      const node = doc.createElement(tag);
      node.setAttribute('data-role', role);
      if (text) node.textContent = text;
      return node;
    };
    const queue = make('div', 'queue');
    const status = make('div', 'status');
    const since = make('div', 'since');
    const toggle = make('button', 'toggle');
    toggle.type = 'button';
    toggle.addEventListener('click', () => {
      paused = !paused;
      setView({ status: paused ? 'paused' : 'active' });
    });
    el.append(queue, status, since, toggle);

    const paint = () => {
      queue.textContent = `Acompanhando: ${view.queueLabel}`;
      status.textContent = STATUS[view.status];
      since.textContent = sinceText(view.lastOkAt);
      toggle.textContent = paused ? 'Retomar' : 'Pausar';
    };
    listeners.add(paint);
    signal.addEventListener('abort', () => listeners.delete(paint));
    paint();
  }

  return {
    id: 'queue-refresh',
    async init(context) {
      ctx = context;
      ctx.ui.registerSection({ id: 'queue-refresh', title: 'Atualizar fila', screens: [SCREEN.FILA], render: renderSection });
      ctx.screen.subscribe(onScreen);
      await onScreen();
    },
  };
}
