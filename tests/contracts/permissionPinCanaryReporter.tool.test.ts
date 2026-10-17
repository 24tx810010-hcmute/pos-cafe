import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error The Playwright reporter is a JavaScript runtime module.
import PinCanaryReporter, { projectPinCanaryResults } from '../../scripts/permission-pin-canary-reporter.mjs';

describe('TC-PIN-18 reporter failure controls', () => {
  test('projects only finite counts when an assertion or hook carries secret-bearing diagnostics', () => {
    const secret = 'CANARY_SECRET_HASH_TOKEN_123456789';
    const report = projectPinCanaryResults([
      { status: 'expected', outcome: 'passed', attempts: 1, error: { message: secret, rows: [secret] } },
      { status: 'expected', outcome: 'failed', attempts: 1, error: { message: secret, stack: secret } },
    ], 'failed', 1);
    expect(report).toEqual({ status: 'FAIL', total: 2, passed: 1, failed: 1, retried: 0, missing: 0, fatalCount: 1 });
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  test('rejects retry, skip, expected failure and missing body without raw values', () => {
    for (const rows of [
      [{ status: 'expected', outcome: 'passed', attempts: 2 }],
      [{ status: 'unexpected', outcome: 'passed', attempts: 1 }],
      [{ status: 'expected', outcome: 'skipped', attempts: 1 }],
      [{ status: 'expected', outcome: undefined, attempts: 0 }],
    ]) expect(projectPinCanaryResults(rows, 'passed').status).toBe('FAIL');
  });

  test('the real reporter discards secret-bearing assertion and hook errors on disk', () => {
    const secret = 'CANARY_REPORTER_SECRET_HASH_TOKEN_987654321';
    const path = join(tmpdir(), `pin-canary-reporter-${randomUUID()}.json`);
    try {
      const reporter = new PinCanaryReporter({ outputFile: path });
      const failure = { message: secret, stack: secret, location: { line: 17 }, rows: [secret] };
      reporter.onBegin({}, { allTests: () => [{ expectedStatus: 'passed',
        results: [{ status: 'failed', errors: [failure] }] }] });
      reporter.onError(failure);
      reporter.onEnd({ status: 'failed' });
      const output = readFileSync(path, 'utf8');
      expect(output).not.toContain(secret);
      expect(JSON.parse(output)).toMatchObject({ status: 'FAIL', total: 1, failed: 1,
        fatalCount: 1, failureLines: [17] });
    } finally { try { unlinkSync(path); } catch { /* No file when reporter setup fails. */ } }
  });
});
