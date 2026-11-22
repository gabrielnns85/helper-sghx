// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { SITE, SITES, siteForUrl } from '../../src/core/sites.js';
import { SGHX_URL, MOBILEMED_URL, SIRESP_URL, LISNET_URL } from '../helpers/fake-chrome.js';

describe('siteForUrl', () => {
  it.each([
    [SGHX_URL, SITE.SGHX],
    ['https://outraunidade.smsprefeiturasp.com.br/sistema/Fila', SITE.SGHX],
    [MOBILEMED_URL, SITE.MOBILEMED],
    [SIRESP_URL, SITE.SIRESP],
    [LISNET_URL, SITE.LISNET],
  ])('reconhece %s como %s', (url, id) => {
    expect(siteForUrl(url)).toBe(id);
  });

  it.each([
    ['domínio parecido', 'https://laudos.mobilemed.com.br.evil.com/'],
    ['sufixo sem ponto', 'https://falsosmsprefeiturasp.com.br/'],
    ['sem TLS', 'http://laudos.mobilemed.com.br/'],
    ['outra porta', 'https://www.siresp.saude.sp.gov.br:8443/'],
    ['subdomínio não previsto', 'https://outro.mobilemed.com.br/'],
    ['Lisnet fora de /laudos/', 'https://biomega.lisnet.com.br/admin/'],
    ['site qualquer', 'https://example.com/'],
    ['URL inválida', 'não é url'],
    ['vazio', undefined],
  ])('recusa %s', (_caso, url) => {
    expect(siteForUrl(url)).toBeNull();
  });

  it('só o SGHx é dono da sessão', () => {
    expect(SITES.filter((s) => s.ownsSession).map((s) => s.id)).toEqual([SITE.SGHX]);
  });

  it('cada site declara os padrões de URL do content script', () => {
    for (const site of SITES) {
      expect(site.matches.length).toBeGreaterThan(0);
      for (const pattern of site.matches) expect(pattern).toMatch(/^https:\/\//);
    }
  });

  it('é imutável', () => {
    expect(Object.isFrozen(SITES)).toBe(true);
    expect(SITES.every((s) => Object.isFrozen(s) && Object.isFrozen(s.matches))).toBe(true);
  });
});
