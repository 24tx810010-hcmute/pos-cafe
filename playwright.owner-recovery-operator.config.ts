import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/operator', testMatch: /ownerRecoveryOperator\.spec\.ts/,
  timeout: 45_000, retries: 0, forbidOnly: true, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5192', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: { command: 'node tests/operator/ownerRecoveryFakeServer.mjs',
    url: 'http://127.0.0.1:5192', reuseExistingServer: false, timeout: 30_000 },
  projects: [{ name: 'operator-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'operator-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
});
