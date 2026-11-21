import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addDialog } from '../helpers/dialogs.js';
import { clickAndWait } from '../../src/core/dom/actions.js';
import { DomHelperError, ElementNotFoundError, TimeoutError } from '../../src/core/dom/errors.js';

function settle(promise) {
  return promise.then(() => { throw new Error('a promessa deveria ter sido rejeitada'); }, (e) => e);
}

let btn;

beforeEach(() => {
  vi.useFakeTimers();
  loadFixture('dom-form-basico');
  btn = document.querySelector('#btnPesquisar');
});

afterEach(() => {
  vi.useRealTimers();
  clearFixture();
});

describe('clickAndWait', () => {
  it('clica uma vez e espera o seletor aparecer (visível)', async () => {
    const clique = vi.fn(() => {
      setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<div id="resultado"></div>'), 300);
    });
    btn.addEventListener('click', clique);
    const p = clickAndWait('#btnPesquisar', '#resultado');
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toBe(document.querySelector('#resultado'));
    expect(clique).toHaveBeenCalledTimes(1);
  });

  it('aceita uma função como condição', async () => {
    let carregado = false;
    btn.addEventListener('click', () => setTimeout(() => { carregado = true; }, 200));
    const p = clickAndWait(btn, () => carregado && 'pronto');
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toBe('pronto');
  });

  it('com { dialog } espera um pop-up NOVO, ignorando os que já estavam abertos', async () => {
    const antigo = addDialog({ message: 'Nenhum registro encontrado' });
    btn.addEventListener('click', () => setTimeout(() => addDialog({ message: 'Nenhum registro encontrado' }), 100));
    const p = clickAndWait(btn, { dialog: /nenhum registro/i });
    await vi.advanceTimersByTimeAsync(100);
    const novo = await p;
    expect(novo.message).toBe('Nenhum registro encontrado');
    expect(novo.el).not.toBe(antigo);
  });

  it('com { gone } espera o seletor sumir', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="carregando"></div>');
    btn.addEventListener('click', () => setTimeout(() => document.querySelector('#carregando').remove(), 100));
    const p = clickAndWait(btn, { gone: '#carregando' });
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBeUndefined();
  });

  it('timeout cita o que foi clicado e o que se esperava', async () => {
    const err = settle(clickAndWait('#btnPesquisar', '#resultado', { timeout: 500 }));
    await vi.advanceTimersByTimeAsync(500);
    const e = await err;
    expect(e).toBeInstanceOf(TimeoutError);
    expect(e.message).toBe('Tempo esgotado (500 ms) aguardando: elemento visível "#resultado" aparecer, após clicar em "#btnPesquisar"');
  });

  it('não clica em botão desabilitado', async () => {
    const btnOff = document.querySelector('#btnDesabilitado');
    const clique = vi.fn();
    btnOff.addEventListener('click', clique);
    await expect(clickAndWait(btnOff, '#x')).rejects.toBeInstanceOf(DomHelperError);
    await expect(clickAndWait(btnOff, '#x')).rejects.toThrow(/desabilitado/);
    expect(clique).not.toHaveBeenCalled();
  });

  it('alvo inexistente gera ElementNotFoundError', async () => {
    await expect(clickAndWait('#naoExiste', '#x')).rejects.toBeInstanceOf(ElementNotFoundError);
  });

  it('condição inválida gera TypeError antes de clicar', async () => {
    const clique = vi.fn();
    btn.addEventListener('click', clique);
    await expect(clickAndWait(btn, 42)).rejects.toThrow(TypeError);
    expect(clique).not.toHaveBeenCalled();
  });
});
