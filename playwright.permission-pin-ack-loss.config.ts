import { defineConfig, devices } from "@playwright/test";
import { pinAckEnvironment } from "./tests/supabase/permissionPinAckEnvironment.ts";

const env = pinAckEnvironment();
const port = Number(process.env.PIN_ACK_VITE_PORT);
if (port !== 5179) throw new Error("PIN_ACK_VITE_PORT_REFUSED");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/supabase",
  testMatch: /permissionPinAckLoss\.spec\.ts/,
  timeout: 90_000,
  retries: 0,
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  reporter: [["./scripts/permission-pin-ack-reporter.mjs", {
    outputFile: "artifacts/permission-pin-ack-loss/browser-safe.json",
  }]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
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
    name: "permission-pin-ack-isolated-chromium",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
  }],
});
