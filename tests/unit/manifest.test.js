// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../src/manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

const SGHX_MATCH = 'https://*.smsprefeiturasp.com.br/*';

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

  it('roda apenas em *.smsprefeiturasp.com.br', () => {
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
    for (const cs of manifest.content_scripts) {
      expect(cs.matches).toEqual([SGHX_MATCH]);
    }
  });

  it('não pede permissões nem host_permissions', () => {
    expect(manifest.permissions ?? []).toEqual([]);
    expect(manifest.host_permissions ?? []).toEqual([]);
  });

  it('declara um content script no mundo isolado e uma ponte no mundo MAIN', () => {
    const isolated = manifest.content_scripts.filter((cs) => (cs.world ?? 'ISOLATED') === 'ISOLATED');
    const main = manifest.content_scripts.filter((cs) => cs.world === 'MAIN');
    expect(isolated).toHaveLength(1);
    expect(isolated[0].js).toEqual(['content.js']);
    expect(main).toHaveLength(1);
    expect(main[0].js).toEqual(['page-bridge.js']);
  });
});
