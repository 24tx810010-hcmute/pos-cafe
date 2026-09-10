import { defineConfig, devices } from "@playwright/test";

const demoRunbookTest = /demo-runbook\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/smoke",
  // Comprehensive admin flows under a single shared dev server during the first
  // (cold) Vite compile can run long when all viewport projects start at once.
  timeout: 60_000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
    env: {
      VITE_DATA_MODE: "mock",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      testIgnore: demoRunbookTest,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tablet-landscape",
      testIgnore: demoRunbookTest,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 600 } },
    },
    {
      name: "phone-landscape",
      testIgnore: demoRunbookTest,
      use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "small-landscape",
      testIgnore: demoRunbookTest,
      use: { ...devices["Desktop Chrome"], viewport: { width: 740, height: 360 } },
    },
    {
      name: "portrait",
      testIgnore: demoRunbookTest,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "demo-runbook",
      testMatch: demoRunbookTest,
      timeout: 120_000,
      use: {
        ...devices["Desktop Chrome"],
        trace: "on",
        viewport: { width: 1024, height: 600 },
      },
    },
  ],
});
