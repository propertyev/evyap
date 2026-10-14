import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { E2E_ENV } from '../playwright.config';

export default function globalSetup() {
  const dir = resolve(process.cwd(), 'e2e/.tmp');
  mkdirSync(dir, { recursive: true });
  for (const f of ['e2e.db', 'e2e.db-journal']) rmSync(resolve(dir, f), { force: true });
  const env = { ...process.env, ...E2E_ENV };
  execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
}
