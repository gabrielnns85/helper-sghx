import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { refreshQueue } from '../../src/features/queue-refresh/refresh.js';

const PEDIATRIA = Object.freeze({ codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 });
const TIMEOUT = 300;
const $ = (s) => document.querySelector(s);
const rowFor = (cod, esp, sit) => [...document.querySelectorAll('#Fila_GridAcao tr[data-model]')]
  .find((r) => { const m = JSON.parse(r.getAttribute('data-model')); return m.CodAcaoDestino === cod && m.CodEspecialidade === esp && m.IndSituacao === sit; });

/** Simula o SGHx: Atualizar recarrega a grade (linhas novas no DOM) depois de `delay` ms. */
function reloadOnRefresh({ delay = 0 } = {}) {
  $('#FilaToolbar_Atualizar').addEventListener('click', () => {
    setTimeout(() => {
      const body = $('#Fila_GridAcao tbody');
      body.innerHTML = body.innerHTML; // mesmos dados, elementos novos
    }, delay);
  });
}

afterEach(clearFixture);

describe('refreshQueue', () => {
  it('clica em Atualizar e depois reseleciona a fila definida', async () => {
    loadFixture('fila-categorias');
    reloadOnRefresh();
    const refreshClicked = vi.fn();
    $('#FilaToolbar_Atualizar').addEventListener('click', refreshClicked);
    const oldRow = rowFor(5, 36, 1);

    const result = await refreshQueue({ queue: PEDIATRIA, reloadTimeout: TIMEOUT });

    const newRow = rowFor(5, 36, 1);
    expect(result).toBe('refreshed');
    expect(refreshClicked).toHaveBeenCalledTimes(1);
    expect(newRow).not.toBe(oldRow);
  });

  it('o clique de reseleção vai na linha nova, não na antiga', async () => {
    loadFixture('fila-categorias');
    reloadOnRefresh({ delay: 20 });
    const oldClick = vi.fn();
    rowFor(5, 36, 1).addEventListener('click', oldClick);
    const seen = [];
    document.addEventListener('click', (e) => seen.push(e.target.closest('tr')?.getAttribute('data-model') ?? e.target.id));

    await refreshQueue({ queue: PEDIATRIA, reloadTimeout: TIMEOUT });

    expect(oldClick).not.toHaveBeenCalled();
    expect(seen[0]).toBe('FilaToolbar_Atualizar');
    expect(JSON.parse(seen[1]).DscAcao).toBe('PRONTO ATENDIMENTO - PEDIATRIA');
  });

  it('clica só na categoria da fila, nunca em outra linha', async () => {
    loadFixture('fila-categorias');
    reloadOnRefresh();
    const clicked = [];
    document.addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) clicked.push(JSON.parse(tr.getAttribute('data-model')).CodAcaoDestino); });
    await refreshQueue({ queue: PEDIATRIA, reloadTimeout: TIMEOUT });
    expect(clicked).toEqual([5]);
  });

  it('se a grade for atualizada no lugar (sem trocar as linhas), reseleciona a linha atual', async () => {
    loadFixture('fila-categorias');
    const row = rowFor(5, 36, 1);
    const click = vi.fn();
    row.addEventListener('click', click);
    expect(await refreshQueue({ queue: PEDIATRIA, reloadTimeout: TIMEOUT, reloadTimeout: 50 })).toBe('refreshed');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('devolve queue-not-found quando a categoria sumiu (fila vazia) e não clica em nada', async () => {
    loadFixture('fila-categorias');
    reloadOnRefresh();
    const clicked = vi.fn();
    document.querySelector('#Fila_GridAcao').addEventListener('click', clicked);
    const ortopedia = { codAcaoDestino: 5, codEspecialidade: 105, indSituacao: 1 };
    expect(await refreshQueue({ queue: ortopedia, reloadTimeout: TIMEOUT, reloadTimeout: 50 })).toBe('queue-not-found');
    expect(clicked).not.toHaveBeenCalled();
  });

  it('devolve no-button sem o botão Atualizar e não clica em categoria', async () => {
    loadFixture('fila-categorias');
    $('#FilaToolbar_Atualizar').remove();
    const clicked = vi.fn();
    document.querySelector('#Fila_GridAcao').addEventListener('click', clicked);
    expect(await refreshQueue({ queue: PEDIATRIA, reloadTimeout: TIMEOUT })).toBe('no-button');
    expect(clicked).not.toHaveBeenCalled();
  });
});
