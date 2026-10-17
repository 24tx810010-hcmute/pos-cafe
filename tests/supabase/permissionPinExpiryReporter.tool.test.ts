import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error This local reporter is an ESM JavaScript module without declarations.
import PermissionPinExpiryReporter from "../../scripts/permission-pin-expiry-reporter.mjs";

const PRIVATE = "SYNTHETIC_PRIVATE_PAYLOAD_927416_DO_NOT_EMIT";
const SHAPED_PRIVATE = "PIN_EXPIRY_SYNTHETIC_SECRET_DO_NOT_EMIT";
const PHASE_SHAPED_PRIVATE = "PIN_EXPIRY_PHASE_SYNTHETIC_SECRET_DO_NOT_EMIT";
const PIN_SHAPED_PRIVATE = "384729";
let directory: string;
let file: string;
let priorReportFile: string | undefined;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "pin-expiry-safe-reporter-"));
  file = join(directory, "result.json");
  priorReportFile = process.env.PIN_EXPIRY_REPORT_FILE;
  process.env.PIN_EXPIRY_REPORT_FILE = file;
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  if (priorReportFile === undefined) delete process.env.PIN_EXPIRY_REPORT_FILE;
  else process.env.PIN_EXPIRY_REPORT_FILE = priorReportFile;
});

function reporter() {
  const instance = new PermissionPinExpiryReporter({ outputFile: file });
  instance.onBegin({}, { allTests: () => [0] });
  return instance;
}

for (const kind of ["assertion", "setup", "teardown"] as const) {
  it(`redacts ${kind} and preserves only fixed codes`, () => {
    const instance = reporter();
    instance.onTestEnd({ title: `unsafe ${PRIVATE}`, expectedStatus: "passed",
      annotations: [
        { type: "pin-expiry-phase", description: "PIN_EXPIRY_PHASE_SAFE" },
        { type: "pin-expiry-phase", description: `PIN_EXPIRY_PHASE_${PRIVATE}` },
      ] }, { status: "failed", retry: 0, errors: [{
        message: `${kind} ${PRIVATE} PIN_EXPIRY_TEST_FAILURE`,
        stack: `Error: ${PRIVATE}\n at ${PRIVATE}/permissionPinExpiryWait.spec.ts:71:9\n body=${PRIVATE}`,
      }] });
    instance.onEnd({ status: "failed" });
    const source = readFileSync(file, "utf8");
    expect(source.includes(PRIVATE)).toBe(false);
    expect(JSON.parse(source)).toMatchObject({ schema: "permission-pin-expiry-safe-v1",
      status: "failed", discovered: 1, completed: 1, counts: { failed: 1 }, hookFailures: 0,
      tests: [{ title: "TC-PIN-08 exact expiry wait", status: "failed",
        expectedStatus: "passed", retry: 0, errorCode: "TEST_FAILURE_REDACTED",
        lastPhase: null }] });
    expect(JSON.parse(source).tests[0]).not.toHaveProperty("sourceLocations");
  });
}

it("keeps an exact known diagnostic code", () => {
  const instance = reporter();
  instance.onTestEnd({ title: PRIVATE, expectedStatus: "passed", annotations: [] },
    { status: "failed", retry: 0, errors: [{ message: "PIN_EXPIRY_CASE_FAILED", stack: PRIVATE }] });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(PRIVATE)).toBe(false);
  expect(JSON.parse(source).tests[0].errorCode).toBe("PIN_EXPIRY_CASE_FAILED");
});

it("redacts a secret shaped like a diagnostic code", () => {
  const instance = reporter();
  instance.onTestEnd({ title: PRIVATE, expectedStatus: "passed", annotations: [] },
    { status: "failed", retry: 0, errors: [{ message: `Error: ${SHAPED_PRIVATE}`, stack: SHAPED_PRIVATE }] });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(SHAPED_PRIVATE)).toBe(false);
  expect(JSON.parse(source).tests[0].errorCode).toBe("TEST_FAILURE_REDACTED");
});

it("redacts PIN-shaped stack locations and unknown phase annotations", () => {
  const instance = reporter();
  instance.onTestEnd({ title: PRIVATE, expectedStatus: "passed", annotations: [
    { type: "pin-expiry-phase", description: PHASE_SHAPED_PRIVATE },
  ] }, { status: "failed", retry: 0, errors: [{ message: PRIVATE,
    stack: `at permissionPinExpiryWait.spec.ts:${PIN_SHAPED_PRIVATE}:7`,
  }] });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(PIN_SHAPED_PRIVATE)).toBe(false);
  expect(source.includes(PHASE_SHAPED_PRIVATE)).toBe(false);
  expect(JSON.parse(source).tests[0]).toMatchObject({
    errorCode: "TEST_FAILURE_REDACTED", lastPhase: null,
  });
  expect(JSON.parse(source).tests[0]).not.toHaveProperty("sourceLocations");
});

it("keeps a fixed harness phase", () => {
  const instance = reporter();
  instance.onTestEnd({ title: PRIVATE, expectedStatus: "passed", annotations: [
    { type: "pin-expiry-phase", description: "PIN_EXPIRY_PHASE_FRESH_RESTRICTED_LOGIN" },
  ] }, { status: "passed", retry: 0, errors: [] });
  instance.onEnd({ status: "passed" });
  expect(JSON.parse(readFileSync(file, "utf8")).tests[0].lastPhase)
    .toBe("PIN_EXPIRY_PHASE_FRESH_RESTRICTED_LOGIN");
});

it("redacts an unhandled error and keeps the failure count", () => {
  const instance = reporter();
  instance.onError({ message: PRIVATE, stack: `Error: ${PRIVATE}` });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(PRIVATE)).toBe(false);
  expect(JSON.parse(source)).toMatchObject({ status: "failed", discovered: 1,
    completed: 0, hookFailures: 1, tests: [] });
});

it("redacts unknown failures with a fixed code", () => {
  const instance = reporter();
  instance.onTestEnd({ title: PRIVATE, expectedStatus: "passed", annotations: [] },
    { status: "failed", retry: 0, errors: [{ message: PRIVATE, stack: PRIVATE }] });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(PRIVATE)).toBe(false);
  expect(JSON.parse(source).tests[0].errorCode).toBe("TEST_FAILURE_REDACTED");
});
