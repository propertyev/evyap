// Rewrites the datasource provider in prisma/schema.prisma to match DATABASE_URL.
// file:...        -> sqlite
// postgres(ql)://  -> postgresql
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvFile(resolve(process.cwd(), '.env'));

const url = process.env.DATABASE_URL || 'file:./dev.db';
const provider = /^postgres(ql)?:\/\//.test(url) ? 'postgresql' : 'sqlite';
const file = resolve(process.cwd(), 'prisma/schema.prisma');
const src = readFileSync(file, 'utf8');
const next = src.replace(/(datasource db \{\s*provider\s*=\s*)"[a-z]+"/, `$1"${provider}"`);
if (next !== src) {
  writeFileSync(file, next);
  console.log(`[set-provider] datasource provider -> ${provider}`);
}
