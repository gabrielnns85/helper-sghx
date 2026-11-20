// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { findSensitiveData, scanFixtures, FIXTURES_DIR } from '../helpers/privacy-scan.js';

describe('trava de privacidade das fixtures', () => {
  it.each([
    ['CPF formatado', 'CPF: 123.456.789-09'],
    ['CPF sem máscara', '<td>12345678909</td>'],
    ['Cartão SUS', 'CNS 898001234567891'],
    ['Cartão SUS formatado', 'CNS 898 0012 3456 7891'],
    ['GUID de sessão', 'session=3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
    ['e-mail', 'contato: fulano@exemplo.com.br'],
    ['telefone', 'Tel. (11) 98765-4321'],
    ['prontuário de outro paciente', '{"CodUsuario": 123456}'],
  ])('detecta %s', (_tipo, texto) => {
    expect(findSensitiveData(texto)).not.toEqual([]);
  });

  it('aceita o paciente de teste da skill (782657) e textos sintéticos', () => {
    expect(findSensitiveData('{"CodUsuario": 782657, "NomUsuario": "TESTE TESTE"}')).toEqual([]);
    expect(findSensitiveData('<input id="Consulta_Peso" value="70">')).toEqual([]);
  });

  it('a pasta tests/fixtures/ existe e tem README', () => {
    expect(existsSync(FIXTURES_DIR)).toBe(true);
    expect(existsSync(`${FIXTURES_DIR}/README.md`)).toBe(true);
  });

  it('nenhuma fixture versionada contém dado com cara de dado real', () => {
    expect(scanFixtures()).toEqual([]);
  });
});
