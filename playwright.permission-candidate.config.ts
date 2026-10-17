import { defineConfig, devices } from "@playwright/test";
import { candidateEnvironment } from "./tests/supabase/permissionCandidateEnvironment.ts";

const env = candidateEnvironment();
export default defineConfig({
  testDir: "./tests/supabase", testMatch: /permissionCandidate\.spec\.ts/, globalSetup: "./tests/supabase/permissionCandidateGlobalSetup.ts",
  timeout: 45_000, retries: 0, forbidOnly: true, fullyParallel: false, workers: 1,
  reporter: [["json", { outputFile: "artifacts/permission-candidate-e2e.json" }]],
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort", url: "http://127.0.0.1:5178", reuseExistingServer: false,
    env: { VITE_DATA_MODE: "supabase", VITE_SUPABASE_URL: env.api, VITE_SUPABASE_ANON_KEY: env.anonKey } },
  projects: [{ name: "permission-candidate-isolated", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } }],
});
