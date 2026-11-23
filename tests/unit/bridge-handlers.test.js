import { describe, it, expect, afterEach, vi } from 'vitest';
import ko from 'knockout';
import { createRequest } from '../../src/core/bridge-protocol.js';
import { createPageHandlers, handleRequest } from '../../src/core/bridge-handlers.js';

describe('bridge-handlers (mundo MAIN)', () => {
  it('ping informa se Knockout e jQuery existem na página', () => {
    expect(createPageHandlers({ ko: {}, jQuery: () => {} }).ping()).toEqual({ ko: true, jquery: true });
    expect(createPageHandlers({}).ping()).toEqual({ ko: false, jquery: false });
  });

  it('responde com o resultado do handler', async () => {
    const res = await handleRequest(createRequest('ping', null, 'r1'), { ping: () => 'pong' });
    expect(res).toMatchObject({ dir: 'response', id: 'r1', type: 'ping', ok: true, payload: 'pong' });
  });

  it('recusa tipos fora da lista de comandos', async () => {
    const res = await handleRequest(createRequest('eval', 'alert(1)', 'r2'), { ping: () => 'pong' });
    expect(res).toMatchObject({ id: 'r2', ok: false });
    expect(res.error).toMatch(/desconhecido/i);
  });

  it('não expõe propriedades herdadas como comandos', async () => {
    const res = await handleRequest(createRequest('toString', null, 'r3'), { ping: () => 'pong' });
    expect(res.ok).toBe(false);
  });

  it('converte exceção do handler em resposta de erro', async () => {
    const res = await handleRequest(createRequest('ping', null, 'r4'), {
      ping: () => { throw new Error('quebrou'); },
    });
    expect(res).toMatchObject({ ok: false, error: 'quebrou' });
  });

  describe('setFieldValue', () => {
    afterEach(() => {
      document.body.innerHTML = '';
      delete window.ko;
    });

    it('está na lista de comandos e grava no observable pela ponte', async () => {
      window.ko = ko;
      document.body.innerHTML = '<div id="vm"><span id="dias" data-bind="text: NumDias"></span></div>';
      const vm = { NumDias: ko.observable(0) };
      ko.applyBindings(vm, document.querySelector('#vm'));
      const handlers = createPageHandlers(window);
      const res = await handleRequest(
        createRequest('setFieldValue', { selector: '#dias', value: 4, observable: 'NumDias' }, 'r5'),
        handlers,
      );
      expect(res).toMatchObject({ ok: true, payload: { strategy: 'knockout' } });
      expect(vm.NumDias()).toBe(4);
      ko.cleanNode(document.querySelector('#vm'));
    });

    it('devolve erro (sem lançar) quando o payload é inválido', async () => {
      const res = await handleRequest(createRequest('setFieldValue', { selector: 42 }, 'r6'), createPageHandlers(window));
      expect(res).toMatchObject({ ok: false });
      expect(res.error).toMatch(/seletor/i);
    });
  });

  describe('submitCloudProvider (entrar do Certificado em Nuvem)', () => {
    // No SGHx o entrar é <a href="javascript:provedorEscolhido()">: clicado do mundo isolado,
    // a CSP da extensão bloqueia o javascript:. Por isso o clique sai do mundo MAIN.
    const markup = (display) => `
      <div id="modalLogin" class="lightbox" style="display:none"><a id="modalLoginEntra" class="ctx">entrar</a></div>
      <div id="modalProvedorCertificado" class="lightbox" style="display:${display}">
        <select id="comboProvedor"><option value="1">SAFEID</option><option value="5">VIDAAS</option></select>
        <a id="modalLoginEntra" class="prov">entrar</a>
      </div>`;

    afterEach(() => { document.body.innerHTML = ''; });

    it('clica no entrar do modal do provedor, não no #modalLoginEntra de outro modal', async () => {
      document.body.innerHTML = markup('block');
      document.querySelector('#comboProvedor').value = '5'; // VIDAAS
      const clicked = [];
      document.querySelectorAll('[id="modalLoginEntra"]').forEach((a) => a.addEventListener('click', () => clicked.push(a.className)));
      const res = await handleRequest(createRequest('submitCloudProvider', null, 'r7'), createPageHandlers(window));
      expect(res).toMatchObject({ ok: true });
      expect(clicked).toEqual(['prov']);
    });

    it('provedor diferente de VIDAAS escolhido: erro, sem clicar', async () => {
      document.body.innerHTML = markup('block');
      document.querySelector('#comboProvedor').value = '1';
      const clicked = vi.fn();
      document.querySelectorAll('[id="modalLoginEntra"]').forEach((a) => a.addEventListener('click', clicked));
      const res = await handleRequest(createRequest('submitCloudProvider', null, 'r9'), createPageHandlers(window));
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/vidaas/i);
      expect(clicked).not.toHaveBeenCalled();
    });

    it('modal escondido por um ancestral: conta como fechado', async () => {
      document.body.innerHTML = `<div style="display:none">${markup('block')}</div>`;
      const clicked = vi.fn();
      document.querySelectorAll('[id="modalLoginEntra"]').forEach((a) => a.addEventListener('click', clicked));
      const res = await handleRequest(createRequest('submitCloudProvider', null, 'r10'), createPageHandlers(window));
      expect(res.ok).toBe(false);
      expect(clicked).not.toHaveBeenCalled();
    });

    it('modal do provedor fechado: erro, sem clicar', async () => {
      document.body.innerHTML = markup('none');
      const clicked = vi.fn();
      document.querySelectorAll('[id="modalLoginEntra"]').forEach((a) => a.addEventListener('click', clicked));
      const res = await handleRequest(createRequest('submitCloudProvider', null, 'r8'), createPageHandlers(window));
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/certificado em nuvem/i);
      expect(clicked).not.toHaveBeenCalled();
    });
  });
});
