import { defineConfig, devices } from "@playwright/test";
import { candidateEnvironment } from "./tests/supabase/permissionCandidateEnvironment.ts";

const env = candidateEnvironment();

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /ownerPinOnboarding\.spec\.ts/,
  globalSetup: "./tests/supabase/permissionCandidateGlobalSetup.ts",
  timeout: 60_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: "artifacts/owner-pin-onboarding-e2e.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5178",
    // This suite renders one-time Store Keys and temporary/new PIN input. Keep
    // automatic failure artifacts disabled so credentials never enter reports.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    env: {
      VITE_DATA_MODE: "supabase",
      VITE_SUPABASE_URL: env.api,
      VITE_SUPABASE_ANON_KEY: env.anonKey,
    },
  },
  projects: [{
    name: "owner-pin-onboarding-isolated",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
  }],
});
