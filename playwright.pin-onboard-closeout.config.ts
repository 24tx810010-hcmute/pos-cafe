import { defineConfig, devices } from "@playwright/test";
import { pinOnboardEnvironment } from "./tests/supabase/permissionPinOnboardEnvironment.ts";

const env = pinOnboardEnvironment();

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /ownerPinOnboardingCloseout\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: "artifacts/owner-pin-onboarding-closeout-e2e.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5189",
    trace: "off", screenshot: "off", video: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5189 --strictPort",
    url: "http://127.0.0.1:5189",
    reuseExistingServer: false,
    env: { VITE_DATA_MODE: "supabase", VITE_SUPABASE_URL: env.api, VITE_SUPABASE_ANON_KEY: env.anonKey },
  },
  projects: [{ name: "pin-onboard-closeout-isolated", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } }],
});
