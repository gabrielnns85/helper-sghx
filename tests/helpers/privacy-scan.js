import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url));

/** Prontuário do paciente de teste da skill sghx (TESTE TESTE). */
const TEST_PATIENT = '782657';

const PATTERNS = [
  ['CPF', /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g],
  ['CPF ou telefone sem máscara (11 dígitos)', /(?<!\d)\d{11}(?!\d)/g],
  ['Cartão SUS', /(?<!\d)[1-9]\d{14}(?!\d)/g],
  ['Cartão SUS formatado', /\b\d{3} \d{4} \d{4} \d{4}\b/g],
  ['GUID (sessão/token)', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['e-mail', /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ['telefone', /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g],
];

const PRONTUARIO = /CodUsuario["']?\s*[:=]\s*["']?(\d+)/gi;

/** Lista trechos com cara de dado pessoal real. Vazio = ok. */
export function findSensitiveData(text) {
  const found = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(re)) found.push({ kind, match: m[0] });
  }
  for (const m of text.matchAll(PRONTUARIO)) {
    if (m[1] !== TEST_PATIENT) found.push({ kind: 'prontuário diferente do paciente de teste', match: m[0] });
  }
  return found;
}

/** Varre as fixtures versionadas (tudo menos .md). */
export function scanFixtures(dir = FIXTURES_DIR) {
  const problems = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.md')) continue;
    const full = join(entry.parentPath, entry.name);
    for (const hit of findSensitiveData(readFileSync(full, 'utf8'))) {
      problems.push({ file: relative(dir, full), ...hit });
    }
  }
  return problems;
}
