import { describe, it, expect, afterEach } from 'vitest';
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
});
