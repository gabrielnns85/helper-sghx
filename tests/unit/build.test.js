// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { build } from '../../scripts/build.mjs';

const SCRIPTS = ['background.js', 'content.js', 'page-bridge.js', 'sites/external.js', 'options/options.js'];
const PAGES = ['options/options.html', 'options/options.css'];

let outDir;
let zipPath;
let files;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'helper-sghx-build-'));
  ({ zipPath } = await build({ outDir }));
  files = unzipSync(readFileSync(zipPath));
}, 30_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('npm run build', () => {
  it('gera helper-sghx-<versão>.zip', () => {
    expect(basename(zipPath)).toBe('helper-sghx-0.1.0.zip');
    expect(existsSync(zipPath)).toBe(true);
  });

  it('o zip tem o manifest na raiz e todos os scripts que ele cita', () => {
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    for (const s of manifest.content_scripts.flatMap((cs) => cs.js)) {
      expect(Object.keys(files)).toContain(s);
    }
    expect(Object.keys(files)).toContain(manifest.background.service_worker);
    expect(Object.keys(files)).toContain(manifest.options_ui.page);
  });

  it('a página de opções leva o próprio CSS e script', () => {
    const html = strFromU8(files['options/options.html']);
    expect(html).toContain('href="options.css"');
    expect(html).toContain('src="options.js"');
  });

  it('os scripts são autocontidos (sem import/export de ES modules)', () => {
    for (const name of SCRIPTS) {
      expect(strFromU8(files[name])).not.toMatch(/^\s*(import|export)\s/m);
    }
  });

  it('não inclui testes, fontes de desenvolvimento nem node_modules', () => {
    expect(Object.keys(files).sort()).toEqual([...SCRIPTS, ...PAGES, 'manifest.json'].sort());
  });
});
