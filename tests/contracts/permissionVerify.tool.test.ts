import { describe, expect, test } from 'vitest';
import legacyConfig from '../../vitest.contract.config';
import permissionConfig from '../../vitest.permission.config';
import { verifySuite, verifyProfiles } from '../../scripts/permission-verify.mjs';
import { projectTestResults } from '../../scripts/permission-vitest-reporter.mjs';

const file = 'D:/fixture/tests/contracts/permissionMigration.contract.test.ts';
const name = 'TC-PERM-49 cannot silently select an owner';
function fixture() {
  return {
    discovered: [{ name, file }],
    report: { success: true, testResults: [{ name: file, assertionResults: [{ fullName: name, status: 'passed' }] }] },
    options: { runner: 'vitest-actual-options-v1', reason: 'passed', errorCount: 0, tests: [{ name, file, state: 'passed', options: { fails: false, retry: 0, repeats: 0, mode: 'run' } }] },
  };
}
describe('T01 evidence verifier', () => {
  test('matches actual discovery, results and every test option', () => {
    const f = fixture(); expect(verifySuite(f.discovered, f.report, f.options, ['permissionMigration.contract.test.ts']).valid).toBe(true);
  });
  test.each(['skipped', 'todo', 'failed'])('rejects result %s', status => {
    const f = fixture(); f.report.testResults[0].assertionResults[0].status = status;
    expect(verifySuite(f.discovered, f.report, f.options, []).valid).toBe(false);
  });
  test.each([['fails', true], ['retry', 1], ['repeats', 1], ['mode', 'skip']])('rejects nonstandard pass option %s', (option, value) => {
    const f = fixture(); Object.assign(f.options.tests[0].options, { [String(option)]: value });
    expect(verifySuite(f.discovered, f.report, f.options, []).valid).toBe(false);
  });
  test('rejects missing files, missing execution and duplicate evidence', () => {
    const f = fixture(); expect(verifySuite(f.discovered, f.report, f.options, ['missing.test.ts']).valid).toBe(false);
    expect(verifySuite([...f.discovered, { name: 'missing', file }], f.report, f.options, []).valid).toBe(false);
    expect(verifySuite([...f.discovered, ...f.discovered], f.report, f.options, []).valid).toBe(false);
    f.options.tests.push(f.options.tests[0]); expect(verifySuite(f.discovered, f.report, f.options, []).valid).toBe(false);
  });
  test('isolates the T01 fixture suite from the phase-27 suite without conditional skipping', () => {
    const path = 'tests/contracts/permissionMigration.contract.test.ts';
    expect(legacyConfig.test?.exclude).toContain(path); expect(permissionConfig.test?.include).toEqual([path]);
    expect(permissionConfig.test?.globalSetup).toBeUndefined(); expect(permissionConfig.envDir).toBe(false);
  });
  test('rejects a deleted required variant even when another passing test remains in the same file', () => {
    const f = fixture();
    const required = [{ file: 'permissionMigration.contract.test.ts', name }, { file: 'permissionMigration.contract.test.ts', name: 'TC-PERM-49 required negative control' }];
    expect(verifySuite(f.discovered, f.report, f.options, ['permissionMigration.contract.test.ts'], required).valid).toBe(false);
  });
  test('never serializes failure exception, diff, PIN, credential hash or MAC', () => {
    const secret = 'PIN_SENTINEL_123456_TOKEN_HASH_MAC_SENTINEL';
    const modules = [{ moduleId: file, errors: [secret], children: { allTests: () => [{ fullName: name,
      result: () => ({ state: 'failed', errors: [{ message: secret, stack: secret, diff: secret, passcode_hash: secret }] }) }] } }];
    const result = projectTestResults(modules, [new Error(secret)], 'failed');
    expect(JSON.stringify(result)).not.toContain(secret); expect(result.success).toBe(false);
    expect(result.testResults[0].assertionResults).toEqual([{ fullName: name, status: 'failed' }]);
  });
});

function profileFixture() {
  const executionProfile = { kind: 'legacy', configId: 'legacy-observer-v1', backend: { database: 'isolated', reference: 'synthetic:fixture' },
    fixtureIds: ['S1', 'S2'], markerProof: 'a'.repeat(64), catalogHash: 'b'.repeat(64) };
  const header = { schemaVersion: 1, runId: 'same-run', sourceFingerprint: 'c'.repeat(64), executionProfile };
  const event = { ...structuredClone(header), testName: name, execution: { startedAt: '2026-09-15T01:00:00Z', finishedAt: '2026-09-15T01:00:01Z' } };
  return { header, results: [{ name, file, status: 'passed' }], profiles: { ...structuredClone(header), cases: [{
    testName: name, sourceFingerprint: header.sourceFingerprint, executionProfile: structuredClone(executionProfile),
    catalogHashAtStart: executionProfile.catalogHash, catalogHashAtEnd: executionProfile.catalogHash,
    startedAt: '2026-09-15T01:00:00Z', finishedAt: '2026-09-15T01:00:02Z', scope: 'preflight-observer-control', events: [event],
  }] } };
}
describe('T01 profile evidence binding', () => {
  test('requires every case and event to belong to the same source and fixture', () => {
    const f = profileFixture(); expect(verifyProfiles(f.profiles, f.results, f.header, [{ name, expectedEventCount: 1 }]).valid).toBe(true);
    expect(verifyProfiles(null, f.results, f.header, [{ name, expectedEventCount: 1 }]).valid).toBe(false);
  });
  test.each(['source', 'run', 'backend', 'marker', 'catalog', 'fixture', 'missing case', 'missing event', 'event source', 'event backend'])('rejects %s mismatch', variant => {
    const f = profileFixture();
    if (variant === 'source') f.profiles.sourceFingerprint = 'd'.repeat(64);
    if (variant === 'run') f.profiles.runId = 'different-run';
    if (variant === 'backend') f.profiles.executionProfile.backend.database = 'different';
    if (variant === 'marker') f.profiles.executionProfile.markerProof = 'd'.repeat(64);
    if (variant === 'catalog') f.profiles.cases[0].catalogHashAtEnd = 'd'.repeat(64);
    if (variant === 'fixture') f.profiles.executionProfile.fixtureIds = ['other'];
    if (variant === 'missing case') f.profiles.cases = [];
    if (variant === 'missing event') f.profiles.cases[0].events = [];
    if (variant === 'event source') f.profiles.cases[0].events[0].sourceFingerprint = 'd'.repeat(64);
    if (variant === 'event backend') f.profiles.cases[0].events[0].executionProfile.backend.database = 'different';
    expect(verifyProfiles(f.profiles, f.results, f.header, [{ name, expectedEventCount: 1 }]).valid).toBe(false);
  });
  test('a missing event cannot exempt itself by claiming to be a direct control', () => {
    const f = profileFixture(); f.profiles.cases[0].events = []; f.profiles.cases[0].scope = 'direct-observer-control';
    expect(verifyProfiles(f.profiles, f.results, f.header, [{ name, expectedEventCount: 1 }]).valid).toBe(false);
    expect(verifyProfiles(f.profiles, f.results, f.header, [{ name, expectedEventCount: 0 }]).valid).toBe(true);
  });
});
