import { describe, it, expect, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';

afterEach(clearFixture);

describe('fixtures no jsdom (exemplo)', () => {
  it('roda no ambiente jsdom', () => {
    expect(typeof window).toBe('object');
    expect(document.body).toBeTruthy();
  });

  it('carrega a fixture sintética do modal de consulta no document', () => {
    loadFixture('exemplo-consulta');
    expect(document.querySelector('#Consulta_Modal')).not.toBeNull();
    expect(document.querySelector('#ConsultaToolbar_Salvar')).not.toBeNull();
  });

  it('permite preencher um campo e observar o evento', () => {
    loadFixture('exemplo-consulta');
    const campo = document.querySelector('#Consulta_Modal textarea[name="MotivoAtendimento"]');
    const eventos = [];
    campo.addEventListener('input', () => eventos.push(campo.value));
    campo.value = 'Texto sintético';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    expect(eventos).toEqual(['Texto sintético']);
  });

  it('cada teste começa com o document limpo', () => {
    expect(document.querySelector('#Consulta_Modal')).toBeNull();
  });

  it('falha com mensagem clara quando a fixture não existe', () => {
    expect(() => loadFixture('nao-existe')).toThrow(/nao-existe/);
  });
});
