import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// These are fixed diagnostic labels owned by the harness. Error messages are
// untrusted text and may contain credentials, even when they resemble a code.
const SAFE_ERROR_CODES = new Set([
  "PIN_EXPIRY_CASE_FAILED",
  "PIN_EXPIRY_CLEANUP_FAILED",
  "PIN_EXPIRY_NO_EFFECTS_BASELINE_FAILED",
  "PIN_EXPIRY_CLOCK_ALLOWLIST_REFUSED",
  "PIN_EXPIRY_CLOCK_RESTORE_MISMATCH",
]);
const SAFE_PHASES = new Set([
  "PIN_EXPIRY_PHASE_PREFLIGHT",
  "PIN_EXPIRY_PHASE_RESTRICTED_LOGIN",
  "PIN_EXPIRY_PHASE_DB_WAIT_WHILE_VALID",
  "PIN_EXPIRY_PHASE_EXACT_EXPIRY_STILL_WAITING",
  "PIN_EXPIRY_PHASE_SERVER_DENIAL_ACK_HELD",
  "PIN_EXPIRY_PHASE_UI_SERVER_RESPONSE_CONFIRMED",
  "PIN_EXPIRY_PHASE_OLD_TOKEN_DENIED",
  "PIN_EXPIRY_PHASE_FRESH_RESTRICTED_LOGIN",
]);
function safeErrorCode(message) {
  const raw = String(message ?? "").trim();
  const code = raw.startsWith("Error: ") ? raw.slice("Error: ".length) : raw;
  return SAFE_ERROR_CODES.has(code) ? code : null;
}

// No Playwright error text, snippets, diffs, request bodies, or stacks are
// persisted. Even setup/teardown and uncaught failures get a finite code.
export default class PermissionPinExpiryReporter {
  constructor(options = {}) {
    this.file = resolve(process.env.PIN_EXPIRY_REPORT_FILE ?? options.outputFile
      ?? "artifacts/permission-pin-expiry-wait/browser-safe.json");
    this.tests = [];
    this.hookFailures = 0;
    this.discovered = 0;
    this.startedAt = new Date().toISOString();
  }
  write(status) {
    const counts = this.tests.reduce((value, item) => {
      value[item.status] = (value[item.status] ?? 0) + 1;
      return value;
    }, {});
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ schema: "permission-pin-expiry-safe-v1",
      status, startedAt: this.startedAt,
      finishedAt: status === "running" ? null : new Date().toISOString(),
      discovered: this.discovered, completed: this.tests.length,
      counts, hookFailures: this.hookFailures, tests: this.tests }, null, 2));
  }
  onBegin(_config, suite) { this.discovered = suite.allTests().length; this.write("running"); }
  onTestEnd(test, result) {
    const last = (test.annotations ?? []).filter(item => item.type === "pin-expiry-phase").at(-1)?.description;
    const finiteCode = result.errors.map(error => safeErrorCode(error.message)).find(Boolean);
    this.tests.push({ title: "TC-PIN-08 exact expiry wait", status: result.status,
      expectedStatus: test.expectedStatus, retry: result.retry,
      errorCode: result.errors.length ? finiteCode ?? "TEST_FAILURE_REDACTED" : null,
      lastPhase: SAFE_PHASES.has(last) ? last : null });
    this.write("running");
  }
  onError() { this.hookFailures += 1; this.write("running"); }
  onEnd(result) { this.write(result.status); }
}
