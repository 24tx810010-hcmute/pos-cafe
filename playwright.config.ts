import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  // Comprehensive admin flows under a single shared dev server during the first
  // (cold) Vite compile can run long when all viewport projects start at once.
  timeout: 60_000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tablet-landscape",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 600 } },
    },
    {
      name: "phone-landscape",
      use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "small-landscape",
      use: { ...devices["Desktop Chrome"], viewport: { width: 740, height: 360 } },
    },
    {
      name: "portrait",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
