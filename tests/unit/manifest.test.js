// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SITES, SITE } from '../../src/core/sites.js';

const manifest = JSON.parse(readFileSync(new URL('../../src/manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

const SGHX_MATCH = 'https://*.smsprefeiturasp.com.br/*';
const EXTERNAL_MATCHES = SITES.filter((s) => s.id !== SITE.SGHX).flatMap((s) => s.matches);
const scriptsFor = (file) => manifest.content_scripts.filter((cs) => cs.js.includes(file));

describe('manifest.json', () => {
  it('é Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('começa na versão 0.1.0, igual ao package.json', () => {
    expect(manifest.version).toBe('0.1.0');
    expect(pkg.version).toBe(manifest.version);
  });

  it('exige Chrome/Edge 111+ (content script em world MAIN)', () => {
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(111);
  });

  it('roda apenas nos sites conhecidos (src/core/sites.js)', () => {
    const known = new Set(SITES.flatMap((s) => s.matches));
    for (const cs of manifest.content_scripts) {
      for (const match of cs.matches) expect(known.has(match)).toBe(true);
    }
  });

  it('a ponte e o content script do SGHx rodam só no SGHx', () => {
    for (const file of ['content.js', 'page-bridge.js']) {
      const [cs] = scriptsFor(file);
      expect(cs.matches).toEqual([SGHX_MATCH]);
    }
  });

  it('os outros sites (imagens, SIRESP, laboratório) têm o próprio content script, sem ponte', () => {
    const external = scriptsFor('sites/external.js');
    expect(external).toHaveLength(1);
    expect(external[0].matches).toEqual(EXTERNAL_MATCHES);
    expect(external[0].world ?? 'ISOLATED').toBe('ISOLATED');
  });

  it('pede só a permissão storage, sem host_permissions', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions ?? []).toEqual([]);
  });

  it('tem o service worker da sessão do atendimento', () => {
    expect(manifest.background).toEqual({ service_worker: 'background.js' });
  });

  it('no SGHx: um content script no mundo isolado e uma ponte no mundo MAIN', () => {
    const sghx = manifest.content_scripts.filter((cs) => cs.matches.includes(SGHX_MATCH));
    const isolated = sghx.filter((cs) => (cs.world ?? 'ISOLATED') === 'ISOLATED');
    const main = sghx.filter((cs) => cs.world === 'MAIN');
    expect(isolated).toHaveLength(1);
    expect(isolated[0].js).toEqual(['content.js']);
    expect(main).toHaveLength(1);
    expect(main[0].js).toEqual(['page-bridge.js']);
  });
});
