import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { readCanaryArtifactFiles, scanCanaryArtifactDirectory } from './permissionCanaryOracle.ts';
// @ts-expect-error Test runner is JavaScript without a declaration file.
import { inspectTc18Outputs } from '../../scripts/permission-pin-canary-run.mjs';
import { CANARY_SCENARIOS } from './permissionCanaryScenarioMatrix.ts';

const roots: string[] = [];
const fresh = () => { const root = mkdtempSync(join(tmpdir(), 'pos-cafe-canary-artifact-')); roots.push(root); return root; };
const code = (action: () => unknown) => { try { action(); return 'NO_ERROR'; } catch (error) { return (error as Error).message; } };
const submittedPin = '123456';
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('TC-PIN-18 persisted artifact oracle', () => {
  test.each(['output.png', 'metadata.json', 'runner.log', 'browser-safe.json'])(
    'detects the submitted PIN written into %s, without echoing file content', name => {
      const root = fresh();
      const path = join(root, name);
      writeFileSync(path, name.endsWith('.json') ? JSON.stringify({ nested: submittedPin }) : Buffer.from(`before:${submittedPin}:after`));
      const failure = code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }));
      expect(failure).toBe('CANARY_LEAK_artifact');
      expect(failure.includes(submittedPin)).toBe(false);
    });

  test('reads changed disk content, rather than the safe string used for the initial write', () => {
    const root = fresh(), path = join(root, 'output.json');
    const safeProjection = JSON.stringify({ status: 'safe' });
    writeFileSync(path, safeProjection);
    expect(scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }).fileCount).toBe(1);
    writeFileSync(path, JSON.stringify({ status: submittedPin }));
    expect(code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }))).toBe('CANARY_LEAK_artifact');
    expect(safeProjection.includes(submittedPin)).toBe(false);
  });

  test('detects JSON escapes and base64 output', () => {
    const root = fresh(), path = join(root, 'output.json');
    writeFileSync(path, '{"value":"\\u0031\\u0032\\u0033\\u0034\\u0035\\u0036"}');
    expect(code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }))).toBe('CANARY_LEAK_artifact');
    writeFileSync(path, JSON.stringify({ value: Buffer.from(submittedPin).toString('base64') }));
    expect(code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }))).toBe('CANARY_LEAK_artifact');
  });

  test('refuses missing, empty, malformed and non-file artifacts', () => {
    const root = fresh();
    expect(code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }))).toBe('CANARY_ARTIFACT_EMPTY');
    expect(code(() => readCanaryArtifactFiles([join(root, 'missing.json')]))).toBe('CANARY_ARTIFACT_UNREADABLE');
    expect(code(() => readCanaryArtifactFiles([root]))).toBe('CANARY_ARTIFACT_UNREADABLE');
    writeFileSync(join(root, 'broken.json'), '{');
    expect(code(() => scanCanaryArtifactDirectory({ root, canaries: [submittedPin] }))).toBe('CANARY_ARTIFACT_UNREADABLE');
  });

  test('post-run gate scans late reporter/log output, and rejects absent coverage or failed execution', () => {
    const root = fresh(), output = join(root, 'output'), runtime = join(output, 'runtime');
    mkdirSync(runtime, { recursive: true });
    const control = join(root, 'control.jsonl');
    const scenarios = [...CANARY_SCENARIOS, 'operator'];
    const records = scenarios.map(scenario => ({ scenario, canaries: [submittedPin] }));
    writeFileSync(control, records.map(row => JSON.stringify(row)).join('\n'));
    for (const scenario of CANARY_SCENARIOS) {
      writeFileSync(join(runtime, `${scenario.replace(':', '-')}.png`), Buffer.from('safe pixels'));
      writeFileSync(join(runtime, `${scenario.replace(':', '-')}.json`), '{}');
    }
    writeFileSync(join(runtime, 'masked-completion.png'), 'safe pixels');
    writeFileSync(join(runtime, 'complete-realtime-readiness.json'), '{}');
    writeFileSync(join(runtime, 'recovery-realtime-readiness.json'), '{}');
    writeFileSync(join(runtime, 'operator.png'), 'safe pixels');
    writeFileSync(join(runtime, 'operator.json'), '{}');
    writeFileSync(join(output, 'runner.log'), 'safe runner');
    const reporterPath = join(output, 'browser-safe.json');
    writeFileSync(reporterPath, JSON.stringify({ status: 'PASS', total: 7, passed: 7,
      failed: 0, retried: 0, missing: 0, fatalCount: 0 }));
    const result = inspectTc18Outputs(output, control, 0);
    expect(result.status).toBe('PASS');
    expect(result.artifactScan.fileCount).toBe(47);
    expect(JSON.stringify(result).includes(submittedPin)).toBe(false);
    expect(code(() => inspectTc18Outputs(output, control, 1))).toBe('PIN_CANARY_BROWSER_FAILED');
    const safeReporter = readFileSync(reporterPath);
    writeFileSync(reporterPath, JSON.stringify({ leaked: submittedPin }));
    expect(code(() => inspectTc18Outputs(output, control, 0))).toBe('CANARY_LEAK_artifact');
    writeFileSync(reporterPath, safeReporter);
    writeFileSync(join(output, 'runner.log'), submittedPin);
    expect(code(() => inspectTc18Outputs(output, control, 0))).toBe('CANARY_LEAK_artifact');
    writeFileSync(join(output, 'runner.log'), 'safe');
    writeFileSync(control, records.map(row => JSON.stringify({ ...row, canaries: ['654321'] })).join('\n'));
    expect(code(() => inspectTc18Outputs(output, control, 0))).toBe('PIN_CANARY_DENIED_INPUT_MISSING');
    writeFileSync(control, records.map(row => JSON.stringify(row)).join('\n'));
    rmSync(join(runtime, 'operator.png'));
    expect(code(() => inspectTc18Outputs(output, control, 0))).toBe('PIN_CANARY_ARTIFACT_MISSING');
    writeFileSync(join(runtime, 'operator.png'), 'safe pixels');
    writeFileSync(control, records.slice(1).map(row => JSON.stringify(row)).join('\n'));
    expect(code(() => inspectTc18Outputs(output, control, 0))).toBe('PIN_CANARY_CONTROL_INCOMPLETE');
  });
});
