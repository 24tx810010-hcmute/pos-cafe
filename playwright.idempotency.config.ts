import { defineConfig, devices } from '@playwright/test';
import { loadTestEnvironmentFile, parseTestEnvironment } from './tests/contracts/preflight.ts';

loadTestEnvironmentFile();
const env = parseTestEnvironment();

export default defineConfig({
  testDir: './tests/supabase',
  testMatch: /idempotency(?:Recovery|Pricing|Bootstrap)?\.spec\.ts/,
  globalSetup: './tests/supabase/idempotencyGlobalSetup.ts',
  timeout: 45_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [['json', { outputFile: 'artifacts/idempotency-e2e.json' }]],
  use: { baseURL: 'http://127.0.0.1:5176', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5176 --strictPort',
    url: 'http://127.0.0.1:5176', reuseExistingServer: false,
    env: { VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: env.apiUrl, VITE_SUPABASE_ANON_KEY: env.anonKey },
  },
  projects: [{ name: 'idempotency-server', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
});
