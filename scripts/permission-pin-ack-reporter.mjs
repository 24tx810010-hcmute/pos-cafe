import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// A failed browser assertion may include request bodies, PINs, JWTs or page
// content. Persist only the finite verdict surface; never serialize an Error.
export default class PermissionPinAckReporter {
  constructor(options = {}) {
    this.file = resolve(process.env.PIN_ACK_REPORT_FILE ?? options.outputFile ?? "artifacts/permission-pin-ack-loss/browser-safe.json");
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
      schema: "permission-pin-ack-safe-v1",
      status,
      startedAt: this.startedAt,
      finishedAt: status === "running" ? null : new Date().toISOString(),
      discovered: this.discovery,
      completed: this.tests.length,
      counts,
      hookFailures: this.hookFailures,
      tests: this.tests,
    }, null, 2));
  }

  onBegin(_config, suite) {
    this.discovery = suite.allTests().length;
    this.write("running");
  }

  onTestEnd(test, result) {
    const lastPhase = (test.annotations ?? []).filter(item => item.type === "pin-ack-phase").at(-1)?.description;
    const locations = [...new Set(result.errors.flatMap(error =>
      [...String(error.stack ?? "").matchAll(/permissionPinAckLoss\.spec\.ts:(\d+):(\d+)/g)]
        .map(match => `${match[1]}:${match[2]}`)))];
    this.tests.push({
      title: test.title,
      status: result.status,
      expectedStatus: test.expectedStatus,
      retry: result.retry,
      errorCode: result.errors.length ? "TEST_FAILURE_REDACTED" : null,
      lastPhase: /^PIN_ACK_PHASE_[A-Z_]+$/.test(lastPhase ?? "") ? lastPhase : null,
      sourceLocations: locations,
    });
    this.write("running");
  }

  onError() {
    this.hookFailures += 1;
    this.write("running");
  }

  onEnd(result) {
    this.write(result.status);
  }
}
