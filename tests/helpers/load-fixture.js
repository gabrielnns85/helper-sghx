import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// import.meta.dirname: no ambiente jsdom o URL global não aceita file://.
const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

/**
 * Coloca tests/fixtures/<nome>.html no document.body do jsdom.
 * Scripts da fixture não são executados.
 */
export function loadFixture(name) {
  const path = join(FIXTURES, `${name}.html`);
  if (!existsSync(path)) throw new Error(`Fixture não encontrada: tests/fixtures/${name}.html`);
  document.body.innerHTML = readFileSync(path, 'utf8');
  return document.body;
}

export function clearFixture() {
  document.body.innerHTML = '';
}
