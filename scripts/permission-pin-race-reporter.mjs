import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Playwright errors and assertion diffs may carry credentials or HTTP bodies.
// This reporter only persists finite status, phase, source positions and counts.
export default class PermissionPinRaceReporter {
  constructor(options = {}) {
    this.file = resolve(process.env.PIN_RACE_REPORT_FILE ?? options.outputFile ?? "artifacts/permission-pin-completion-race/browser-safe.json");
    this.tests = [];
    this.hookFailures = 0;
    this.startedAt = new Date().toISOString();
    this.discovery = 0;
  }

  write(status) {
    const counts = this.tests.reduce((value, item) => {
      value[item.status] = (value[item.status] ?? 0) + 1;
      return value;
    }, {});
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({
      schema: "permission-pin-race-safe-v1", status,
      startedAt: this.startedAt,
      finishedAt: status === "running" ? null : new Date().toISOString(),
      discovered: this.discovery, completed: this.tests.length,
      counts, hookFailures: this.hookFailures, tests: this.tests,
    }, null, 2));
  }

  onBegin(_config, suite) {
    this.discovery = suite.allTests().length;
    this.write("running");
  }

  onTestEnd(test, result) {
    const lastPhase = (test.annotations ?? []).filter(item => item.type === "pin-race-phase").at(-1)?.description;
    const locations = [...new Set(result.errors.flatMap(error =>
      [...String(error.stack ?? "").matchAll(/permissionPinCompletionRace\.spec\.ts:(\d+):(\d+)/g)]
        .map(match => `${match[1]}:${match[2]}`)))];
    this.tests.push({
      title: test.title, status: result.status, expectedStatus: test.expectedStatus,
      retry: result.retry, errorCode: result.errors.length ? "TEST_FAILURE_REDACTED" : null,
      lastPhase: /^PIN_RACE_PHASE_[A-Z_]+$/.test(lastPhase ?? "") ? lastPhase : null,
      sourceLocations: locations,
    });
    this.write("running");
  }

  onError() { this.hookFailures += 1; this.write("running"); }
  onEnd(result) { this.write(result.status); }
}
