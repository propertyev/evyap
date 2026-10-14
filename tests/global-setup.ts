import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default function setup() {
  const dir = resolve(process.cwd(), 'tests/.tmp');
  mkdirSync(dir, { recursive: true });
  rmSync(resolve(dir, 'test.db'), { force: true });
  rmSync(resolve(dir, 'test.db-journal'), { force: true });
  const url = `file:${resolve(dir, 'test.db')}`;
  execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  process.env.TEST_DATABASE_URL = url;
}
