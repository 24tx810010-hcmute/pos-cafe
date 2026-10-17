import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: "permission-ui-closeout.spec.ts",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["json", { outputFile: "artifacts/permission-ui-closeout-20261009/current-browser.json" }]],
  outputDir: "artifacts/permission-ui-closeout-20261009/playwright-output",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5191", trace: "off", video: "off", screenshot: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5191 --strictPort",
    env: { VITE_DATA_MODE: "mock", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    url: "http://127.0.0.1:5191",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 1024, height: 768 } } },
    { name: "mobile", use: { viewport: { width: 844, height: 390 } } },
  ],
});
