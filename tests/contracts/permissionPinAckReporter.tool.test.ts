import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error This task-owned JavaScript reporter has no declaration file.
import PermissionPinAckReporter from "../../scripts/permission-pin-ack-reporter.mjs";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("PIN ACK browser reporter redaction", () => {
  it("keeps body and hook failures finite without serializing private error text", async () => {
    const directory = mkdtempSync(join(tmpdir(), "pin-ack-reporter-"));
    temporary.push(directory);
    const file = join(directory, "safe.json");
    const reporter = new PermissionPinAckReporter({ outputFile: file });
    const secret = "fixture-SECRET-123456-raw-request";
    reporter.onBegin({}, { allTests: () => [{}, {}] });
    reporter.onTestEnd({ title: "TC-PIN-09 A", expectedStatus: "passed" }, {
      status: "failed", retry: 0, errors: [{ message: secret, stack: secret }],
    });
    reporter.onError(new Error(secret));
    reporter.onEnd({ status: "failed" });
    const raw = readFileSync(file, "utf8");
    expect(raw.includes(secret)).toBe(false);
    expect(JSON.parse(raw)).toMatchObject({
      schema: "permission-pin-ack-safe-v1",
      status: "failed", discovered: 2, completed: 1, hookFailures: 1,
      counts: { failed: 1 },
      tests: [{ title: "TC-PIN-09 A", status: "failed", expectedStatus: "passed", retry: 0,
        errorCode: "TEST_FAILURE_REDACTED" }],
    });
  });
});
