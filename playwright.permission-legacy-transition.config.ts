import { defineConfig, devices } from "@playwright/test";
import { candidateEnvironment } from "./tests/supabase/permissionCandidateEnvironment.ts";

const env = candidateEnvironment();
const shared = { VITE_DATA_MODE: "supabase", VITE_SUPABASE_URL: env.api, VITE_SUPABASE_ANON_KEY: env.anonKey };

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /permissionLegacyTransition\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: "artifacts/permission-legacy-transition-e2e.json" }]],
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort",
      url: "http://127.0.0.1:5178",
      reuseExistingServer: false,
      env: shared,
    },
    {
      command: "node scripts/permission-legacy-head.mjs serve",
      url: "http://127.0.0.1:5179",
      reuseExistingServer: false,
      env: { ...shared, PERMISSION_LEGACY_HOST: "127.0.0.1", PERMISSION_LEGACY_PORT: "5179" },
      timeout: 120_000,
    },
  ],
  projects: [{ name: "permission-legacy-transition-isolated", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } }],
});
