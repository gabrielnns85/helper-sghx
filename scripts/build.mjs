// Gera dist/extension/ (pasta para carregar sem compactação) e
// dist/helper-sghx-<versão>.zip. Uso: npm run build | npm run dev (watch).
import * as esbuild from 'esbuild';
import { zipSync } from 'fflate';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(ROOT, 'src');
const ENTRIES = ['background.js', 'content.js', 'page-bridge.js', 'sites/external.js'];

function esbuildOptions(extDir) {
  return {
    entryPoints: ENTRIES.map((e) => join(SRC, e)),
    outdir: extDir,
    bundle: true,
    format: 'iife',
    target: 'chrome111',
    logLevel: 'warning',
  };
}

function readManifest() {
  return JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
}

export function zipExtension(extDir, zipPath) {
  const entries = {};
  for (const name of readdirSync(extDir, { recursive: true, withFileTypes: true })) {
    if (!name.isFile()) continue;
    const full = join(name.parentPath, name.name);
    entries[full.slice(extDir.length + 1).split('\\').join('/')] = readFileSync(full);
  }
  writeFileSync(zipPath, zipSync(entries, { level: 9 }));
}

export async function build({ outDir = join(ROOT, 'dist') } = {}) {
  const { version } = readManifest();
  const extDir = join(outDir, 'extension');
  rmSync(extDir, { recursive: true, force: true });
  mkdirSync(extDir, { recursive: true });

  await esbuild.build(esbuildOptions(extDir));
  copyFileSync(join(SRC, 'manifest.json'), join(extDir, 'manifest.json'));

  const zipPath = join(outDir, `helper-sghx-${version}.zip`);
  zipExtension(extDir, zipPath);
  return { extDir, zipPath };
}

async function watch() {
  const extDir = join(ROOT, 'dist', 'extension');
  mkdirSync(extDir, { recursive: true });
  copyFileSync(join(SRC, 'manifest.json'), join(extDir, 'manifest.json'));
  const ctx = await esbuild.context(esbuildOptions(extDir));
  await ctx.watch();
  console.log(`Observando src/ → ${extDir} (recarregue a extensão no navegador após mudar o manifest)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--watch')) {
    await watch();
  } else {
    const { zipPath, extDir } = await build();
    console.log(`Extensão: ${extDir}\nPacote:   ${zipPath}`);
  }
}
