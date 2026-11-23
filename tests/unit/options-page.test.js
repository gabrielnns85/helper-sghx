import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initOptionsPage } from '../../src/options/page.js';
import { createSettings } from '../../src/core/storage/settings.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { createFakeArea, createFakeEvent } from '../helpers/fake-chrome.js';

// import.meta.dirname: no jsdom o URL global não aceita file://.
const HTML = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'options', 'options.html'), 'utf8');
const page = new DOMParser().parseFromString(HTML, 'text/html');

const PEDIATRIA = { codAcaoDestino: 5, codEspecialidade: 36, indSituacao: 1 };
const CLOUD_ON = { enabled: true, mode: 'cloud', user: '', password: '' };

let area;
let onChanged;
let settings;
let confirm;
let options;

const $ = (selector) => document.querySelector(selector);
const field = (name) => $(`[name="${name}"]`);
const errorFor = (name) => $(`[data-error-for="${name}"]`);
const status = () => $('#status');
const saveButton = () => $('#settings-form button[type="submit"]');

async function open(initial = {}) {
  document.body.innerHTML = page.body.innerHTML;
  onChanged = createFakeEvent();
  area = createFakeArea(initial, { onChanged, areaName: 'local' });
  settings = createSettings({ area, onChanged });
  confirm = vi.fn(() => true);
  options = await initOptionsPage({ settings, root: document, confirm });
}

beforeEach(() => open());

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('options.html', () => {
  it('título e idioma em português', () => {
    expect(page.documentElement.lang).toBe('pt-BR');
    expect(page.title).toMatch(/helper-sghx/i);
  });

  it('sem script inline (CSP do MV3): só options.js externo', () => {
    const scripts = [...page.querySelectorAll('script')];
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toBe('options.js');
    expect(scripts[0].textContent.trim()).toBe('');
    expect(page.querySelector('[onclick], [onsubmit], [onchange]')).toBeNull();
  });

  it('contrato de funcionalidade: cada configuração de DEFAULT_SETTINGS tem a sua seção', () => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      expect(page.querySelector(`[data-setting="${key}"]`), `seção data-setting="${key}"`).not.toBeNull();
    }
  });

  it('status com aria-live, para leitor de tela', () => {
    expect(page.querySelector('#status').getAttribute('aria-live')).toBe('polite');
  });

  it('login automático avisa para não usar em computador compartilhado', () => {
    expect(page.querySelector('[data-setting="autoLogin"]').textContent).toMatch(/compartilhado/i);
  });
});

describe('ao abrir', () => {
  it('preenche os campos com os padrões: automações desligadas e nenhuma fila escolhida', () => {
    expect(field('autoLoginEnabled').checked).toBe(false);
    expect(field('queueRefreshEnabled').checked).toBe(false);
    expect(field('intervalSec').value).toBe('30');
    expect(field('queue').value).toBe('');
    expect(field('queue').selectedOptions[0].textContent).toBe('Escolha a fila');
  });

  it('unidade só para leitura: nome do catálogo e CodFces 28', () => {
    expect(field('unitName').value).toBe('UPA JACANA');
    expect(field('unitName').readOnly).toBe(true);
    expect(field('codFces').value).toBe('28');
    expect(field('codFces').disabled).toBe(true);
  });

  it('o intervalo indica os limites de 30 a 360 s', () => {
    expect(field('intervalSec').min).toBe('30');
    expect(field('intervalSec').max).toBe('360');
  });

  it('preenche com o que já estava salvo', async () => {
    await open({ settings: { autoLogin: CLOUD_ON, queueRefresh: { enabled: true, intervalSec: 60, queue: PEDIATRIA } } });
    expect(field('autoLoginEnabled').checked).toBe(true);
    expect(field('queue').value).toBe('5:36:1');
    expect(field('queue').selectedOptions[0].textContent).toMatch(/PEDIATRIA/);
  });

  it('falha ao ler o armazenamento: avisa e não deixa salvar nem restaurar por cima', async () => {
    document.body.innerHTML = page.body.innerHTML;
    area = createFakeArea();
    area.failNext('get');
    await initOptionsPage({ settings: createSettings({ area, onChanged: null }), root: document, confirm: vi.fn() });
    expect(status().textContent).toMatch(/não foi possível ler/i);
    expect(status().dataset.kind).toBe('error');
    expect(saveButton().disabled).toBe(true);
    expect($('#restore-defaults').disabled).toBe(true);
  });
});

describe('salvar', () => {
  it('grava as configurações e avisa', async () => {
    field('queueRefreshEnabled').checked = true;
    field('queue').value = '5:36:1';
    field('intervalSec').value = '60';
    await options.save();
    expect(await settings.get('queueRefresh')).toEqual({ enabled: true, intervalSec: 60, queue: PEDIATRIA });
    expect(status().textContent).toMatch(/salvas/i);
    expect(status().dataset.kind).toBe('ok');
  });

  it('o botão Salvar envia o formulário', async () => {
    field('autoLoginEnabled').checked = true;
    $('#settings-form').requestSubmit();
    await vi.waitFor(async () => expect(await settings.get('autoLogin')).toEqual(CLOUD_ON));
  });

  it('ligar a atualização sem escolher a fila: erro no campo da fila e nada gravado', async () => {
    field('queueRefreshEnabled').checked = true;
    await options.save();
    expect(area.set).not.toHaveBeenCalled();
    expect(errorFor('queue').textContent).toMatch(/escolha a fila/i);
    expect(field('queue').getAttribute('aria-invalid')).toBe('true');
  });

  it('campo inválido: mostra o erro no campo e não grava nada', async () => {
    field('intervalSec').value = '10';
    await options.save();
    expect(area.set).not.toHaveBeenCalled();
    expect(errorFor('intervalSec').textContent).toMatch(/30.*360/);
    expect(field('intervalSec').getAttribute('aria-invalid')).toBe('true');
    expect(status().dataset.kind).toBe('error');
  });

  it('depois de corrigir, o erro some', async () => {
    field('intervalSec').value = '10';
    await options.save();
    field('intervalSec').value = '45';
    await options.save();
    expect(errorFor('intervalSec').textContent).toBe('');
    expect(field('intervalSec').hasAttribute('aria-invalid')).toBe(false);
  });

  it('falha ao gravar: mensagem amigável', async () => {
    area.failNext('set');
    await options.save();
    expect(status().textContent).toMatch(/não foi possível salvar/i);
    expect(status().dataset.kind).toBe('error');
  });
});

describe('login automático: modo', () => {
  const credentials = () => $('#autoLogin-credentials');
  const mode = (value) => $(`[name="autoLoginMode"][value="${value}"]`);
  const pick = (value) => {
    mode(value).checked = true;
    mode(value).dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('começa no Login Nuvem (VIDAAS), sem campos de usuário e senha à vista', () => {
    expect(mode('cloud').checked).toBe(true);
    expect(credentials().hidden).toBe(true);
  });

  it('a senha é um campo de senha, sem preenchimento automático do navegador', () => {
    expect(field('autoLoginPassword').type).toBe('password');
    expect(field('autoLoginPassword').getAttribute('autocomplete')).toBe('new-password');
  });

  it('escolher usuário e senha mostra os campos; voltar à nuvem esconde', () => {
    pick('password');
    expect(credentials().hidden).toBe(false);
    pick('cloud');
    expect(credentials().hidden).toBe(true);
  });

  it('grava o modo usuário e senha', async () => {
    field('autoLoginEnabled').checked = true;
    pick('password');
    field('autoLoginUser').value = 'medico';
    field('autoLoginPassword').value = 's3nha';
    await options.save();
    expect(await settings.get('autoLogin')).toEqual({ enabled: true, mode: 'password', user: 'medico', password: 's3nha' });
  });

  it('preenche o modo salvo e mostra os campos', async () => {
    await open({ settings: { autoLogin: { enabled: true, mode: 'password', user: 'medico', password: 's3nha' } } });
    expect(mode('password').checked).toBe(true);
    expect(credentials().hidden).toBe(false);
    expect(field('autoLoginUser').value).toBe('medico');
  });

  it('ligado sem senha: erro no campo e nada gravado', async () => {
    field('autoLoginEnabled').checked = true;
    pick('password');
    field('autoLoginUser').value = 'medico';
    await options.save();
    expect(area.set).not.toHaveBeenCalled();
    expect(errorFor('autoLoginPassword').textContent).toMatch(/senha/i);
    expect(field('autoLoginPassword').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('mudança feita em outra aba', () => {
  it('atualiza os campos sozinha, para não salvar por cima com a tela velha', async () => {
    await settings.set({ autoLogin: CLOUD_ON }); // como se fosse outra aba
    await vi.waitFor(() => expect(field('autoLoginEnabled').checked).toBe(true));
  });
});

describe('restaurar padrões', () => {
  it('pede confirmação, apaga o que foi salvo e recarrega os campos', async () => {
    field('intervalSec').value = '90';
    await options.save();
    await options.restoreDefaults();
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/restaurar/i));
    expect(area.dump()).toEqual({});
    expect(field('intervalSec').value).toBe('30');
    expect(status().textContent).toMatch(/padrões restaurados/i);
  });

  it('se o médico cancelar, nada muda', async () => {
    field('intervalSec').value = '90';
    await options.save();
    confirm.mockReturnValue(false);
    await options.restoreDefaults();
    expect(await settings.get('queueRefresh')).toMatchObject({ intervalSec: 90 });
    expect(field('intervalSec').value).toBe('90');
  });

  it('o botão Restaurar padrões funciona', async () => {
    field('intervalSec').value = '90';
    await options.save();
    $('#restore-defaults').click();
    await vi.waitFor(() => expect(field('intervalSec').value).toBe('30'));
  });

  it('falha ao restaurar: mensagem amigável', async () => {
    area.failNext('remove');
    await options.restoreDefaults();
    expect(status().textContent).toMatch(/não foi possível restaurar/i);
    expect(status().dataset.kind).toBe('error');
  });
});
