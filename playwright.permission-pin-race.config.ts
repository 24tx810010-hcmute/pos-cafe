import { defineConfig, devices } from "@playwright/test";
import { pinRaceEnvironment } from "./tests/supabase/permissionPinRaceEnvironment.ts";

const env = pinRaceEnvironment();
const port = Number(process.env.PIN_RACE_VITE_PORT);
if (port !== 5180) throw new Error("PIN_RACE_VITE_PORT_REFUSED");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /permissionPinCompletionRace\.spec\.ts/,
  timeout: 120_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["./scripts/permission-pin-race-reporter.mjs", {
    outputFile: "artifacts/permission-pin-completion-race/browser-safe.json",
  }]],
  use: { baseURL, trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_DATA_MODE: "supabase",
      VITE_SUPABASE_URL: env.api,
      VITE_SUPABASE_ANON_KEY: env.anonKey,
    },
  },
  projects: [{
    name: "permission-pin-race-isolated-chromium",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
  }],
});
