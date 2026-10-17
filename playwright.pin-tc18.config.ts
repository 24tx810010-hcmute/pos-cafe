import { defineConfig } from "@playwright/test";
import onboardCloseout from "./playwright.pin-onboard-closeout.config";

if (!process.env.PIN_CANARY_CONTROL_FILE || !process.env.PIN_CANARY_ARTIFACT_DIR
  || !process.env.PIN_CANARY_OUTPUT_DIR || !process.env.PIN_CANARY_SAFE_FILE)
  throw new Error("PIN_CANARY_WRAPPER_REQUIRED");

// TC18 failure diagnostics may contain canary secrets. Never use the raw JSON reporter here.
export default defineConfig({
  ...onboardCloseout,
  outputDir: process.env.PIN_CANARY_OUTPUT_DIR,
  grep: /TC-PIN-18/,
  reporter: [["./scripts/permission-pin-canary-reporter.mjs",
    { outputFile: process.env.PIN_CANARY_SAFE_FILE }]],
});
