import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error This local reporter is an ESM JavaScript module without declarations.
import PermissionPinRaceReporter from "../../scripts/permission-pin-race-reporter.mjs";

const PRIVATE = "SYNTHETIC_PRIVATE_PAYLOAD_927416_DO_NOT_EMIT";
let directory: string;
let file: string;
let priorReportFile: string | undefined;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "pin-race-safe-reporter-"));
  file = join(directory, "result.json");
  priorReportFile = process.env.PIN_RACE_REPORT_FILE;
  process.env.PIN_RACE_REPORT_FILE = file;
});

afterEach(() => {
  unlinkSync(file);
  rmdirSync(directory);
  if (priorReportFile === undefined) delete process.env.PIN_RACE_REPORT_FILE;
  else process.env.PIN_RACE_REPORT_FILE = priorReportFile;
});

function reporter() {
  const instance = new PermissionPinRaceReporter({ outputFile: file });
  instance.onBegin({}, { allTests: () => [0, 1, 2] });
  return instance;
}

function result(errorKind: "assertion" | "setup" | "teardown") {
  const line = errorKind === "assertion" ? "71:9" : errorKind === "setup" ? "557:16" : "562:12";
  return {
    status: "failed", retry: 0,
    errors: [{ message: `${errorKind}: ${PRIVATE}`,
      stack: `Error: ${PRIVATE}\n at ${PRIVATE}/permissionPinCompletionRace.spec.ts:${line}\n body=${PRIVATE}` }],
  };
}

for (const kind of ["assertion", "setup", "teardown"] as const) {
  it(`redacts ${kind} error bodies while keeping finite location and counts`, () => {
    const instance = reporter();
    instance.onTestEnd({ title: `G2b ${kind}`, expectedStatus: "passed",
      annotations: [
        { type: "pin-race-phase", description: "PIN_RACE_PHASE_SAFE" },
        { type: "pin-race-phase", description: `PIN_RACE_PHASE_${PRIVATE}` },
      ] }, result(kind));
    instance.onEnd({ status: "failed" });
    const source = readFileSync(file, "utf8");
    expect(source.includes(PRIVATE)).toBe(false);
    const saved = JSON.parse(source);
    expect(saved).toMatchObject({ schema: "permission-pin-race-safe-v1", status: "failed",
      discovered: 3, completed: 1, counts: { failed: 1 }, hookFailures: 0,
      tests: [{ status: "failed", expectedStatus: "passed", retry: 0,
        errorCode: "TEST_FAILURE_REDACTED", lastPhase: null }] });
    expect(saved.tests[0].sourceLocations).toEqual([
      kind === "assertion" ? "71:9" : kind === "setup" ? "557:16" : "562:12",
    ]);
  });
}

it("redacts an unhandled error without losing the hook failure count", () => {
  const instance = reporter();
  instance.onError({ message: PRIVATE, stack: `Error: ${PRIVATE}` });
  instance.onEnd({ status: "failed" });
  const source = readFileSync(file, "utf8");
  expect(source.includes(PRIVATE)).toBe(false);
  expect(JSON.parse(source)).toMatchObject({ status: "failed", discovered: 3, completed: 0,
    hookFailures: 1, tests: [] });
});
