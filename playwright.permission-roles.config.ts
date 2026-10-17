import { defineConfig } from "@playwright/test";
import candidate from "./playwright.permission-candidate.config";

export default defineConfig(candidate, {
  globalSetup: "./tests/supabase/permissionCandidateActivatedSetup.ts",
  testMatch: /permissionRoles\.spec\.ts/,
  timeout: 120_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["json", { outputFile: "artifacts/permission-roles-e2e.json" }]],
});
