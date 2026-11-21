import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, waitForElement, waitForGone } from '../../src/core/dom/wait.js';
import { TimeoutError } from '../../src/core/dom/errors.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

/** Garante que a rejeição é observada antes de avançar o relógio. */
function expectRejection(promise) {
  const settled = promise.then(
    () => { throw new Error('a promessa deveria ter sido rejeitada'); },
    (err) => err,
  );
  return settled;
}

describe('waitFor', () => {
  it('resolve na hora com o valor da condição quando ela já é verdadeira', async () => {
    await expect(waitFor(() => 42)).resolves.toBe(42);
  });

  it('resolve quando uma mudança no DOM torna a condição verdadeira', async () => {
    const p = waitFor(() => document.querySelector('#novo'), { interval: 60_000 });
    const el = document.createElement('div');
    el.id = 'novo';
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBe(el);
  });

  it('verifica por polling estados que não mexem no DOM', async () => {
    let pronto = false;
    const p = waitFor(() => pronto && 'ok', { interval: 100 });
    pronto = true;
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBe('ok');
  });

  it('aceita condição assíncrona', async () => {
    await expect(waitFor(async () => 'assíncrono')).resolves.toBe('assíncrono');
  });

  it('rejeita com TimeoutError e mensagem descritiva ao estourar o tempo', async () => {
    const err = expectRejection(waitFor(() => false, { timeout: 500, description: 'modal de consulta' }));
    await vi.advanceTimersByTimeAsync(500);
    const e = await err;
    expect(e).toBeInstanceOf(TimeoutError);
    expect(e.message).toBe('Tempo esgotado (500 ms) aguardando: modal de consulta');
    expect(e.timeout).toBe(500);
    expect(e.description).toBe('modal de consulta');
  });

  it('usa 10 s como timeout padrão', async () => {
    const err = expectRejection(waitFor(() => false));
    await vi.advanceTimersByTimeAsync(9_999);
    let settled = false;
    err.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await err).timeout).toBe(10_000);
  });

  it('inclui no erro de timeout a última exceção lançada pela condição', async () => {
    const err = expectRejection(
      waitFor(() => { throw new Error('vm is undefined'); }, { timeout: 200, description: 'view-model' }),
    );
    await vi.advanceTimersByTimeAsync(200);
    expect((await err).message).toBe('Tempo esgotado (200 ms) aguardando: view-model (último erro: vm is undefined)');
  });

  it('usa o nome da função como descrição padrão', async () => {
    function consultaAberta() { return false; }
    const err = expectRejection(waitFor(consultaAberta, { timeout: 100 }));
    await vi.advanceTimersByTimeAsync(100);
    expect((await err).message).toMatch(/aguardando: consultaAberta$/);
  });

  it('para de observar e de fazer polling depois de resolver', async () => {
    let n = 0;
    await waitFor(() => { n += 1; return n >= 1; }, { interval: 50 });
    const depois = n;
    document.body.appendChild(document.createElement('p'));
    await vi.advanceTimersByTimeAsync(500);
    expect(n).toBe(depois);
  });

  it('para de observar e de fazer polling depois do timeout', async () => {
    let n = 0;
    const err = expectRejection(waitFor(() => { n += 1; return false; }, { timeout: 100, interval: 50 }));
    await vi.advanceTimersByTimeAsync(100);
    await err;
    const depois = n;
    await vi.advanceTimersByTimeAsync(500);
    expect(n).toBe(depois);
  });

  it('exige uma função como condição', () => {
    expect(() => waitFor('#seletor')).toThrow(TypeError);
  });
});

describe('waitForElement', () => {
  it('devolve o elemento que já existe', async () => {
    document.body.innerHTML = '<div id="a"></div>';
    await expect(waitForElement('#a')).resolves.toBe(document.querySelector('#a'));
  });

  it('espera o elemento ser inserido', async () => {
    const p = waitForElement('#tarde');
    setTimeout(() => { document.body.innerHTML = '<span id="tarde"></span>'; }, 300);
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toBe(document.querySelector('#tarde'));
  });

  it('com visible: true ignora elementos ocultos até aparecerem', async () => {
    document.body.innerHTML = '<div id="pai" hidden><div id="filho"></div></div><div id="b" style="display:none"></div>';
    const filho = waitForElement('#filho', { visible: true });
    const b = waitForElement('#b', { visible: true });
    let resolvido = false;
    filho.then(() => { resolvido = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(resolvido).toBe(false);

    document.querySelector('#pai').hidden = false;
    document.querySelector('#b').style.display = 'block';
    await vi.advanceTimersByTimeAsync(0);
    await expect(filho).resolves.toBe(document.querySelector('#filho'));
    await expect(b).resolves.toBe(document.querySelector('#b'));
  });

  it('procura dentro de root quando informado', async () => {
    document.body.innerHTML = '<div id="r1"><i class="x"></i></div><div id="r2"></div>';
    const p = waitForElement('.x', { root: document.querySelector('#r2'), timeout: 100 });
    const err = expectRejection(p);
    await vi.advanceTimersByTimeAsync(100);
    expect(await err).toBeInstanceOf(TimeoutError);
  });

  it('erro de timeout cita o seletor', async () => {
    const err = expectRejection(waitForElement('#nunca', { timeout: 300, visible: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect((await err).message).toBe('Tempo esgotado (300 ms) aguardando: elemento visível "#nunca" aparecer');
  });
});

describe('waitForGone', () => {
  it('resolve quando o elemento é removido', async () => {
    document.body.innerHTML = '<div id="carregando"></div>';
    const p = waitForGone('#carregando');
    document.querySelector('#carregando').remove();
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it('considera sumido o elemento que ficou oculto', async () => {
    document.body.innerHTML = '<div id="m" style="display:block"></div>';
    const p = waitForGone('#m');
    document.querySelector('#m').style.display = 'none';
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it('aceita um elemento em vez de seletor', async () => {
    document.body.innerHTML = '<div id="m"></div>';
    const el = document.querySelector('#m');
    const p = waitForGone(el);
    el.remove();
    await vi.advanceTimersByTimeAsync(0);
    await expect(p).resolves.toBeUndefined();
  });

  it('erro de timeout cita o seletor', async () => {
    document.body.innerHTML = '<div id="fica"></div>';
    const err = expectRejection(waitForGone('#fica', { timeout: 300 }));
    await vi.advanceTimersByTimeAsync(300);
    expect((await err).message).toBe('Tempo esgotado (300 ms) aguardando: elemento "#fica" sumir');
  });
});
