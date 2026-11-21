import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addDialog, wireDialogButtons } from '../helpers/dialogs.js';
import { getOpenDialogs, waitForDialog, confirmDialog, autoDismissDialogs } from '../../src/core/dom/dialogs.js';
import { DomHelperError, TimeoutError } from '../../src/core/dom/errors.js';

function settle(promise) {
  return promise.then(() => { throw new Error('a promessa deveria ter sido rejeitada'); }, (e) => e);
}

beforeEach(() => {
  vi.useFakeTimers();
  loadFixture('dom-bootstrap-dialog');
  wireDialogButtons();
});

afterEach(() => {
  vi.useRealTimers();
  clearFixture();
});

describe('getOpenDialogs', () => {
  it('lista só os pop-ups visíveis, em ordem (o último é o de cima)', () => {
    const dialogs = getOpenDialogs();
    expect(dialogs.map((d) => d.el.id)).toEqual(['dlg-erro', 'dlg-sair']);
  });

  it('ignora lightboxes que são modais de tela (sem bootstrap-dialog-message)', () => {
    expect(getOpenDialogs().some((d) => d.el.id === 'Consulta_Modal')).toBe(false);
  });

  it('extrai título, mensagem (com quebras de linha), tipo e botões', () => {
    const [erro, sair] = getOpenDialogs();
    expect(erro).toMatchObject({
      title: 'Avisos!',
      message: '* É obrigatório o preenchimento de Queixa/Exame Físico\n* Aba Avaliação - Obrigatório preenchimento do CIAP2 Avaliação',
      isError: true,
    });
    expect(erro.buttons.map((b) => b.text)).toEqual(['OK']);
    expect(sair).toMatchObject({ title: 'Atenção!', message: 'Deseja realmente sair sem salvar?', isError: false });
    expect(sair.buttons.map((b) => b.text)).toEqual(['Sim', 'Não']);
    expect(sair.buttons[0].el).toBe(document.querySelector('#dlg-sair-sim'));
  });

  it('devolve lista vazia sem pop-ups', () => {
    clearFixture();
    expect(getOpenDialogs()).toEqual([]);
  });
});

describe('waitForDialog', () => {
  it('acha pop-up aberto por regex ou por texto (sem diferenciar acentos)', async () => {
    await expect(waitForDialog({ text: /sair sem salvar/ })).resolves.toMatchObject({ title: 'Atenção!' });
    await expect(waitForDialog({ text: 'obrigatorio o preenchimento de queixa' })).resolves.toMatchObject({ isError: true });
  });

  it('procura também no título', async () => {
    await expect(waitForDialog({ text: 'Avisos' })).resolves.toMatchObject({ isError: true });
  });

  it('espera o pop-up aparecer', async () => {
    const p = waitForDialog({ text: /CID/ });
    setTimeout(() => addDialog({ message: 'Informe o CID principal' }), 200);
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toMatchObject({ message: 'Informe o CID principal' });
  });

  it('sem texto, devolve o pop-up de cima', async () => {
    await expect(waitForDialog()).resolves.toMatchObject({ message: 'Deseja realmente sair sem salvar?' });
  });

  it('timeout com mensagem descritiva', async () => {
    const err = settle(waitForDialog({ text: 'xyz', timeout: 1000 }));
    await vi.advanceTimersByTimeAsync(1000);
    const e = await err;
    expect(e).toBeInstanceOf(TimeoutError);
    expect(e.message).toBe('Tempo esgotado (1000 ms) aguardando: pop-up com o texto "xyz"');
  });
});

describe('confirmDialog', () => {
  it('exige o texto esperado e o botão (não há botão padrão)', async () => {
    await expect(confirmDialog({ button: 'Sim' })).rejects.toThrow(TypeError);
    await expect(confirmDialog({ text: /sair/ })).rejects.toThrow(TypeError);
    await expect(confirmDialog()).rejects.toThrow(TypeError);
  });

  it('clica no botão pedido e espera o pop-up fechar', async () => {
    const clique = vi.fn();
    document.querySelector('#dlg-sair-sim').addEventListener('click', clique);
    const res = await confirmDialog({ text: /sair sem salvar/, button: 'Sim' });
    expect(clique).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#dlg-sair')).toBeNull();
    expect(res).toEqual({ title: 'Atenção!', message: 'Deseja realmente sair sem salvar?', button: 'Sim' });
  });

  it('compara o botão sem diferenciar maiúsculas e acentos', async () => {
    const res = await confirmDialog({ text: /sair/, button: 'nao' });
    expect(res.button).toBe('Não');
  });

  it('lista os botões quando o pedido não existe e não clica em nada', async () => {
    const err = await settle(confirmDialog({ text: /sair/, button: 'Confirmar' }));
    expect(err).toBeInstanceOf(DomHelperError);
    expect(err.message).toBe('Botão "Confirmar" não existe no pop-up "Deseja realmente sair sem salvar?". Botões: Sim; Não');
    expect(document.querySelector('#dlg-sair')).not.toBeNull();
  });

  it('recusa confirmar pop-up que parece gravar no prontuário', async () => {
    const dlg = addDialog({ message: 'Deseja salvar a consulta?', buttons: ['Sim', 'Não'] });
    const clique = vi.fn();
    dlg.querySelector('a').addEventListener('click', clique);
    const err = await settle(confirmDialog({ text: /salvar a consulta/, button: 'Sim' }));
    expect(err).toBeInstanceOf(DomHelperError);
    expect(err.message).toMatch(/gravação/);
    expect(clique).not.toHaveBeenCalled();
  });

  it.each([
    'Confirma a alta do paciente?',
    'Deseja gravar as alterações?',
    'Deseja assinar o documento?',
    'Paciente será liberado. Confirma?',
  ])('recusa também: %s', async (message) => {
    addDialog({ message, buttons: ['Sim', 'Não'] });
    await expect(confirmDialog({ text: message, button: 'Sim' })).rejects.toThrow(/gravação/);
  });

  it('com allowSave: true confirma (decisão já tomada pelo médico)', async () => {
    addDialog({ message: 'Deseja salvar a consulta?', buttons: ['Sim', 'Não'] });
    await expect(confirmDialog({ text: /salvar a consulta/, button: 'Sim', allowSave: true })).resolves.toMatchObject({ button: 'Sim' });
  });

  it('timeout quando o pop-up não fecha depois do clique', async () => {
    const dlg = addDialog({ message: 'Pop-up teimoso', buttons: ['OK'] });
    const ok = dlg.querySelector('a');
    const fixo = ok.cloneNode(true);
    ok.replaceWith(fixo);
    const err = settle(confirmDialog({ text: 'teimoso', button: 'OK', timeout: 500 }));
    await vi.advanceTimersByTimeAsync(1000);
    expect((await err).message).toBe('Tempo esgotado (500 ms) aguardando: pop-up "Pop-up teimoso" fechar');
  });
});

describe('autoDismissDialogs', () => {
  const IGNORAVEL = { text: /já foi prescrito/i, button: 'OK' };
  let watcher;

  afterEach(() => watcher?.stop());

  it('fecha pop-up ignorável que aparece depois e avisa quem chamou', async () => {
    const onDismiss = vi.fn();
    watcher = autoDismissDialogs([IGNORAVEL], { onDismiss });
    const dlg = addDialog({ title: 'Aviso!', message: 'Medicamento já foi prescrito para o paciente.', buttons: ['OK'] });
    const clique = vi.fn();
    dlg.querySelector('a').addEventListener('click', clique);
    await vi.advanceTimersByTimeAsync(0);
    expect(clique).toHaveBeenCalledTimes(1);
    expect(dlg.isConnected).toBe(false);
    expect(onDismiss).toHaveBeenCalledWith({ title: 'Aviso!', message: 'Medicamento já foi prescrito para o paciente.', button: 'OK' });
  });

  it('fecha também o que já estava aberto ao começar', async () => {
    const dlg = addDialog({ message: 'Medicamento já foi prescrito', buttons: ['OK'] });
    watcher = autoDismissDialogs([IGNORAVEL]);
    await vi.advanceTimersByTimeAsync(0);
    expect(dlg.isConnected).toBe(false);
  });

  it('não mexe em pop-ups fora das regras (ex.: alergia)', async () => {
    watcher = autoDismissDialogs([IGNORAVEL]);
    const alergia = addDialog({ message: 'Paciente alérgico a DIPIRONA', buttons: ['OK'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(alergia.isConnected).toBe(true);
    expect(document.querySelector('#dlg-sair')).not.toBeNull();
  });

  it('clica uma vez só por pop-up, mesmo com várias mudanças no DOM', async () => {
    watcher = autoDismissDialogs([IGNORAVEL]);
    const dlg = addDialog({ message: 'já foi prescrito', buttons: ['OK'] });
    const ok = dlg.querySelector('a');
    const fixo = ok.cloneNode(true); // botão que não fecha o pop-up
    ok.replaceWith(fixo);
    const clique = vi.fn();
    fixo.addEventListener('click', clique);
    await vi.advanceTimersByTimeAsync(0);
    document.body.appendChild(document.createElement('p'));
    dlg.setAttribute('data-x', '1');
    await vi.advanceTimersByTimeAsync(0);
    expect(clique).toHaveBeenCalledTimes(1);
  });

  it('recusa regra que casaria com pop-up de gravação e avisa por onError', async () => {
    const onError = vi.fn();
    watcher = autoDismissDialogs([{ text: /consulta/, button: 'Sim' }], { onError });
    const dlg = addDialog({ message: 'Deseja salvar a consulta?', buttons: ['Sim', 'Não'] });
    const clique = vi.fn();
    dlg.querySelector('a').addEventListener('click', clique);
    await vi.advanceTimersByTimeAsync(0);
    expect(clique).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toMatch(/gravação/);
  });

  it('avisa por onError quando o botão da regra não existe', async () => {
    const onError = vi.fn();
    watcher = autoDismissDialogs([{ text: /prescrito/, button: 'Fechar' }], { onError });
    addDialog({ message: 'já foi prescrito', buttons: ['OK'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(onError.mock.calls[0][0].message).toMatch(/Botão "Fechar" não existe/);
  });

  it('stop() para de observar', async () => {
    watcher = autoDismissDialogs([IGNORAVEL]);
    watcher.stop();
    const dlg = addDialog({ message: 'já foi prescrito', buttons: ['OK'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(dlg.isConnected).toBe(true);
  });

  it('exige regras com texto e botão', () => {
    expect(() => autoDismissDialogs([])).toThrow(TypeError);
    expect(() => autoDismissDialogs([{ text: /x/ }])).toThrow(TypeError);
    expect(() => autoDismissDialogs([{ button: 'OK' }])).toThrow(TypeError);
  });
});
