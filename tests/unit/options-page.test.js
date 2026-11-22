import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initOptionsPage } from '../../src/options/page.js';
import { createSettings } from '../../src/core/storage/settings.js';
import { DEFAULT_SETTINGS } from '../../src/core/storage/defaults.js';
import { createFakeArea } from '../helpers/fake-chrome.js';

// import.meta.dirname: no jsdom o URL global não aceita file://.
const HTML = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'options', 'options.html'), 'utf8');
const page = new DOMParser().parseFromString(HTML, 'text/html');

let area;
let settings;
let options;

const $ = (selector) => document.querySelector(selector);
const field = (name) => $(`[name="${name}"]`);
const errorFor = (name) => $(`[data-error-for="${name}"]`);
const status = () => $('#status');

beforeEach(async () => {
  document.body.innerHTML = page.body.innerHTML;
  area = createFakeArea();
  settings = createSettings({ area, onChanged: null });
  options = await initOptionsPage({ settings, root: document });
});

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
});

describe('ao abrir', () => {
  it('preenche os campos com os padrões', () => {
    expect(field('autoLoginEnabled').checked).toBe(false);
    expect(field('queueRefreshEnabled').checked).toBe(false);
    expect(field('intervalSec').value).toBe('30');
    expect(field('queue').value).toBe('5:15:1');
    expect(field('unitName').value).toBe('UPA JACANA');
    expect(field('codFces').value).toBe('28');
  });

  it('CodFces aparece desabilitado (só a UPA Jaçanã por enquanto)', () => {
    expect(field('codFces').disabled).toBe(true);
  });

  it('o intervalo indica os limites de 30 a 360 s', () => {
    expect(field('intervalSec').min).toBe('30');
    expect(field('intervalSec').max).toBe('360');
  });

  it('preenche com o que já estava salvo', async () => {
    area = createFakeArea({ settings: { autoLogin: { enabled: true } } });
    settings = createSettings({ area, onChanged: null });
    await initOptionsPage({ settings, root: document });
    expect(field('autoLoginEnabled').checked).toBe(true);
  });

  it('nomes de fila entram como texto, nunca como HTML', async () => {
    const queue = { codAcaoDestino: 99, codEspecialidade: 0, indSituacao: 0, label: '<img src=x onerror=alert(1)>' };
    area = createFakeArea({ settings: { queueRefresh: { ...DEFAULT_SETTINGS.queueRefresh, queue } } });
    settings = createSettings({ area, onChanged: null });
    await initOptionsPage({ settings, root: document });
    expect(field('queue').value).toBe('99:0:0');
    expect(field('queue').querySelector('img')).toBeNull();
    expect(field('queue').selectedOptions[0].textContent).toBe(queue.label);
  });
});

describe('salvar', () => {
  it('grava as configurações e avisa', async () => {
    field('queueRefreshEnabled').checked = true;
    field('intervalSec').value = '60';
    await options.save();
    expect(await settings.get('queueRefresh')).toEqual({ ...DEFAULT_SETTINGS.queueRefresh, enabled: true, intervalSec: 60 });
    expect(status().textContent).toMatch(/salvas/i);
    expect(status().dataset.kind).toBe('ok');
  });

  it('o botão Salvar envia o formulário', async () => {
    field('autoLoginEnabled').checked = true;
    $('#settings-form').requestSubmit();
    await vi.waitFor(async () => expect(await settings.get('autoLogin')).toEqual({ enabled: true }));
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

describe('restaurar padrões', () => {
  it('apaga o que foi salvo e recarrega os campos', async () => {
    field('intervalSec').value = '90';
    await options.save();
    await options.restoreDefaults();
    expect(area.dump()).toEqual({});
    expect(field('intervalSec').value).toBe('30');
    expect(status().textContent).toMatch(/padrões restaurados/i);
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
