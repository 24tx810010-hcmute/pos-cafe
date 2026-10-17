import { describe, expect, it } from 'vitest';
import { projectTestResults } from '../../scripts/permission-vitest-reporter.mjs';

const secret = 'SECRET_PASSWORD_TOKEN_QUERY_ROW_OBJECT_NAME';
function moduleFixture(errors: unknown[] = [], suites: unknown[] = []) {
  return { moduleId: 'permissionImagesRuntime.contract.test.ts', errors: () => errors,
    children: { allSuites: () => suites, allTests: () => [{ fullName: 'image body passes',
      result: () => ({ state: 'passed', errors: [{ message: secret, stack: secret }] }) }] } };
}
function cleanupError(diagnostics: unknown[]) {
  return Object.assign(new Error(`IMAGE_FIXTURE_CLEANUP_FAILED:${secret}`), {
    stack: secret, cause: { message: secret }, query: secret, rows: [secret],
    permissionCleanupDiagnostics: diagnostics,
  });
}
function pinError(diagnostics: unknown) {
  return Object.assign(new Error('PIN_SURFACE_SETUP_FAILED'), {
    stack: secret, cause: { message: secret }, query: secret, rows: [secret],
    permissionPinDiagnostics: diagnostics,
  });
}

describe('permission reporter safe hook diagnostics', () => {
  it('reports failed module cleanup despite passing bodies and no unhandled errors', () => {
    const error = cleanupError([{ phase: 'database-surface', step: 'verify-schema',
      code: 'IMAGE_SCHEMA_RESTORE_MISMATCH', sqlstate: '42501', message: secret, objectName: secret }]);
    const report = projectTestResults([moduleFixture([error])], [], 'failed');
    expect(report).toMatchObject({ success: false, errorCount: 0, hookErrorCount: 1,
      hookErrors: [{ phase: 'database-surface', step: 'verify-schema', code: 'IMAGE_SCHEMA_RESTORE_MISMATCH', sqlstate: '42501' }],
      testResults: [{ assertionResults: [{ fullName: 'image body passes', status: 'passed' }] }] });
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it('collects nested suite hooks and rejects success even with a passed run reason', () => {
    const suite = { errors: () => [new Error('IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH')] };
    const report = projectTestResults([moduleFixture([], [suite])], [], 'passed');
    expect(report.success).toBe(false);
    expect(report.hookErrorCount).toBe(1);
    expect(report.hookErrors).toEqual([{ code: 'IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH' }]);
  });

  it('keeps the strict run reason and existing global error count', () => {
    expect(projectTestResults([moduleFixture()], [], 'passed').success).toBe(true);
    for (const reason of ['failed', 'interrupted', undefined])
      expect(projectTestResults([moduleFixture()], [], reason).success).toBe(false);
    const report = projectTestResults([moduleFixture()], [new Error(secret)], 'passed');
    expect(report).toMatchObject({ success: false, errorCount: 1, hookErrorCount: 0,
      runErrors: [{ code: 'PERMISSION_ERROR_OPAQUE' }] });
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it('allows only fixed codes, phases, steps and SQLSTATEs, without serializing arbitrary fields', () => {
    const error = cleanupError([
      { code: `IMAGE_${secret}`, phase: secret, step: secret, sqlstate: 'ZZZZZ', cause: secret },
      { code: 'IMAGE_STORAGE_METADATA_RESTORE_MISMATCH', phase: 'database-surface', step: 'verify-storage-metadata', sqlstate: '42P01', token: secret },
      { code: 'IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH', phase: 'database-surface', step: 'verify-sentinel-metadata', sqlstate: null },
      null, secret,
    ]);
    const report = projectTestResults([moduleFixture([error])], [], 'failed');
    expect(report.hookErrors).toEqual([
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
      { code: 'IMAGE_STORAGE_METADATA_RESTORE_MISMATCH', phase: 'database-surface', step: 'verify-storage-metadata', sqlstate: '42P01' },
      { code: 'IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH', phase: 'database-surface', step: 'verify-sentinel-metadata', sqlstate: null },
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
    ]);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(JSON.stringify(report)).not.toContain('ZZZZZ');
  });

  it('handles unknown, malformed and empty structured errors opaquely', () => {
    const errors = [cleanupError([]), cleanupError(secret as unknown as unknown[]),
      { message: secret, stack: secret, cause: secret }, secret, null];
    const report = projectTestResults([moduleFixture(errors)], [], 'failed');
    expect(report.hookErrorCount).toBe(errors.length);
    expect(report.hookErrors).toEqual(errors.map(() => ({ code: 'PERMISSION_ERROR_OPAQUE' })));
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it('projects PIN setup hooks and blocks PASS despite every body passing', () => {
    const steps = ['connect', 'guard', 'activity', 'baseline', 'transaction', 'locks', 'baseline-recheck', 'view'];
    for (const step of steps) {
      const error = pinError([{ code: 'PIN_SURFACE_FIXTURE_DRIFT', phase: 'pin-surface',
        step, sqlstate: '42501', message: secret, token: secret }]);
      const report = projectTestResults([moduleFixture([error])], [], 'passed');
      expect(report).toMatchObject({ success: false, errorCount: 0, hookErrorCount: 1,
        hookErrors: [{ code: 'PIN_SURFACE_FIXTURE_DRIFT', phase: 'pin-surface', step, sqlstate: '42501' }],
        testResults: [{ assertionResults: [{ status: 'passed' }] }] });
      expect(JSON.stringify(report).includes(secret)).toBe(false);
    }
  });

  it('recognizes only the finite PIN code vocabulary in structured and plain errors', () => {
    const codes = ['PIN_SURFACE_SETUP_FAILED', 'PIN_SURFACE_CANDIDATE_PROFILE_REFUSED',
      'PIN_SURFACE_API_BINDING_REFUSED', 'PIN_SURFACE_ACTIVITY_REFUSED',
      'PIN_SURFACE_PREFLIGHT_DRIFT', 'PIN_SURFACE_FIXTURE_DRIFT',
      'PIN_RESTRICTED_ROUTE_MUTATION', 'PIN_RESTRICTED_DENIAL_MISMATCH',
      'PIN_RESTRICTED_ROUTE_PROBE_FAILED', 'PIN_RESTRICTED_ROUTE_ROLLBACK_FAILED'];
    for (const code of codes) {
      const report = projectTestResults([moduleFixture([pinError([
        { code, phase: 'pin-surface', step: 'guard', sqlstate: null },
      ])])], [Object.assign(new Error(code), { stack: secret, cause: secret })], 'passed');
      expect(report.hookErrors).toEqual([{ code, phase: 'pin-surface', step: 'guard', sqlstate: null }]);
      expect(report.runErrors).toEqual([{ code }]);
      expect(report.success).toBe(false);
      expect(JSON.stringify(report).includes(secret)).toBe(false);
    }
  });

  it('discards PIN canaries and refuses image vocabulary in the PIN projection', () => {
    const report = projectTestResults([moduleFixture([pinError([
      { code: `PIN_${secret}`, phase: secret, step: secret, sqlstate: secret,
        message: secret, cause: secret, stack: secret, query: secret, rows: [secret] },
      { code: 'IMAGE_SCHEMA_RESTORE_MISMATCH', phase: 'database-surface',
        step: 'verify-schema', sqlstate: 'ZZZZZ', objectName: secret },
      { code: 'PIN_SURFACE_PREFLIGHT_DRIFT', phase: 'pin-surface',
        step: 'baseline-recheck', sqlstate: '42P01', token: secret },
      null, secret,
    ])])], [], 'failed');
    expect(report.hookErrors).toEqual([
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
      { code: 'PIN_SURFACE_PREFLIGHT_DRIFT', phase: 'pin-surface', step: 'baseline-recheck', sqlstate: '42P01' },
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
      { code: 'PERMISSION_ERROR_OPAQUE', phase: null, step: null, sqlstate: null },
    ]);
    expect(JSON.stringify(report).includes(secret)).toBe(false);
    expect(JSON.stringify(report).includes('ZZZZZ')).toBe(false);
  });

  it('falls back to a safe PIN setup code for empty or malformed diagnostic arrays', () => {
    const errors = [pinError([]), pinError(secret), pinError(null),
      Object.assign(new Error(`PIN_${secret}`), { permissionPinDiagnostics: [] })];
    const report = projectTestResults([moduleFixture(errors)], [], 'passed');
    expect(report.success).toBe(false);
    expect(report.hookErrorCount).toBe(4);
    expect(report.hookErrors).toEqual([
      { code: 'PIN_SURFACE_SETUP_FAILED' }, { code: 'PIN_SURFACE_SETUP_FAILED' },
      { code: 'PIN_SURFACE_SETUP_FAILED' }, { code: 'PERMISSION_ERROR_OPAQUE' },
    ]);
    expect(JSON.stringify(report).includes(secret)).toBe(false);
  });
});
