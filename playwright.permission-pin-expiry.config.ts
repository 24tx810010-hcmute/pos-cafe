import { defineConfig, devices } from "@playwright/test";
import { pinExpiryEnvironment } from "./tests/supabase/permissionPinExpiryEnvironment.ts";

const env = pinExpiryEnvironment();
const port = Number(process.env.PIN_EXPIRY_VITE_PORT);
if (port !== 5181) throw new Error("PIN_EXPIRY_VITE_PORT_REFUSED");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /permissionPinExpiryWait\.spec\.ts/,
  timeout: 120_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["./scripts/permission-pin-expiry-reporter.mjs", {
    outputFile: "artifacts/permission-pin-expiry-wait/browser-safe.json",
  }]],
  use: { baseURL, trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: { VITE_DATA_MODE: "supabase", VITE_SUPABASE_URL: env.api,
      VITE_SUPABASE_ANON_KEY: env.anonKey },
  },
  projects: [{ name: "permission-pin-expiry-isolated-chromium",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } }],
});
