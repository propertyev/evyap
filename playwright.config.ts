import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 3100;
const dbFile = resolve(process.cwd(), 'e2e/.tmp/e2e.db');
export const E2E_ENV = {
  DATABASE_URL: `file:${dbFile}`,
  NEXTAUTH_URL: `http://localhost:${PORT}`,
  NEXTAUTH_SECRET: 'e2e-secret-not-for-production-0123456789',
  SEED_OWNER_EMAIL: 'owner@evyap.local',
  SEED_OWNER_PASSWORD: 'E2e-Owner-Password-1',
  SEED_DEMO: 'false',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // uses the locally installed Google Chrome — no browser download needed
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: E2E_ENV as unknown as Record<string, string>,
  },
});
