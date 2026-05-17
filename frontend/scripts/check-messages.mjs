// Fails if messages/th.json and messages/en.json have different key sets.
// Run via `npm run check:i18n`; wired into CI.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

function load(locale) {
  const filePath = join(messagesDir, `${locale}.json`);
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read ${filePath}: ${e.message}`);
  }
  try {
    return new Set(flattenKeys(JSON.parse(raw)));
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

const th = load('th');
const en = load('en');

const missingFromEn = [...th].filter((k) => !en.has(k)).sort();
const missingFromTh = [...en].filter((k) => !th.has(k)).sort();

if (missingFromEn.length || missingFromTh.length) {
  if (missingFromTh.length) console.error('Keys missing from th.json:', missingFromTh);
  if (missingFromEn.length) console.error('Keys missing from en.json:', missingFromEn);
  process.exit(1);
}

console.log(`i18n OK — ${th.size} keys match between th.json and en.json`);
