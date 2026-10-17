import { writeFileSync } from 'node:fs';
import IdempotencyExecutionReporter from './idempotency-vitest-reporter.mjs';

// This vocabulary is deliberately finite: arbitrary error codes can contain secrets.
const diagnosticCodes = new Set([
  'IMAGE_COMPATIBILITY_STATE_DRIFT', 'IMAGE_STORAGE_SCOPE_REFUSED', 'IMAGE_STORAGE_TRACKING_DRIFT',
  'IMAGE_STORAGE_PREEXISTING_OBJECT_REFUSED', 'IMAGE_STORAGE_DELETE_FAILED', 'IMAGE_STORAGE_DELETE_UNCONFIRMED',
  'IMAGE_STORAGE_BYTES_REMAIN', 'IMAGE_STAGING_BUCKET_DELETE_FAILED', 'IMAGE_STAGING_BUCKET_NOT_EMPTY',
  'IMAGE_CONTRACT_GATE_MISSING', 'IMAGE_SCHEMA_RESTORE_MISMATCH', 'IMAGE_STORAGE_METADATA_RESTORE_MISMATCH',
  'IMAGE_SENTINEL_METADATA_RESTORE_MISMATCH', 'IMAGE_SENTINEL_BYTES_RESTORE_MISMATCH',
  'IMAGE_STORAGE_PROOF_COUNT_MISMATCH', 'IMAGE_STORAGE_BASELINE_UNREADABLE', 'IMAGE_CLEANUP_STEP_FAILED',
  'IMAGE_FIXTURE_MARKER_REFUSED', 'IMAGE_FIXTURE_CLEANUP_IN_PROGRESS',
]);
const diagnosticPhases = new Set(['compatibility', 'storage-objects', 'database-surface', 'read-fixture', 'source-runtime']);
const diagnosticSteps = new Set([
  'restore-compatibility', 'delete-owned-storage', 'restore-functions', 'drop-image-tables', 'restore-storage',
  'restore-change-acl', 'restore-contract-gate', 'reload-schema', 'verify-schema', 'verify-storage-metadata',
  'verify-sentinel-metadata', 'verify-sentinel-bytes', 'cleanup-read', 'verify-source-runtime',
]);
const diagnosticSqlstates = new Set([
  '0A000', '42501', '42704', '42P01', '42883', '42710', '2BP01', '23505', '23503',
  '23514', '55000', '57014', '40001', '40P01', '25P02', '42601', '22P02',
]);
const pinDiagnosticCodes = new Set([
  'PIN_SURFACE_SETUP_FAILED', 'PIN_SURFACE_CANDIDATE_PROFILE_REFUSED', 'PIN_SURFACE_API_BINDING_REFUSED',
  'PIN_SURFACE_ACTIVITY_REFUSED', 'PIN_SURFACE_PREFLIGHT_DRIFT', 'PIN_SURFACE_FIXTURE_DRIFT',
  'PIN_RESTRICTED_ROUTE_MUTATION', 'PIN_RESTRICTED_DENIAL_MISMATCH',
  'PIN_RESTRICTED_ROUTE_PROBE_FAILED', 'PIN_RESTRICTED_ROUTE_ROLLBACK_FAILED',
]);
const pinDiagnosticSteps = new Set([
  'connect', 'guard', 'activity', 'baseline', 'transaction', 'locks', 'baseline-recheck', 'view',
]);

function projectError(error) {
  const value = error && typeof error === 'object' ? error : {};
  if (Array.isArray(value.permissionCleanupDiagnostics) && value.permissionCleanupDiagnostics.length) {
    return value.permissionCleanupDiagnostics.map(item => {
      const diagnostic = item && typeof item === 'object' ? item : {};
      return {
        code: diagnosticCodes.has(diagnostic.code) ? diagnostic.code : 'PERMISSION_ERROR_OPAQUE',
        phase: diagnosticPhases.has(diagnostic.phase) ? diagnostic.phase : null,
        step: diagnosticSteps.has(diagnostic.step) ? diagnostic.step : null,
        sqlstate: diagnosticSqlstates.has(diagnostic.sqlstate) ? diagnostic.sqlstate : null,
      };
    });
  }
  if (Array.isArray(value.permissionPinDiagnostics) && value.permissionPinDiagnostics.length) {
    return value.permissionPinDiagnostics.map(item => {
      const diagnostic = item && typeof item === 'object' ? item : {};
      return {
        code: pinDiagnosticCodes.has(diagnostic.code) ? diagnostic.code : 'PERMISSION_ERROR_OPAQUE',
        phase: diagnostic.phase === 'pin-surface' ? 'pin-surface' : null,
        step: pinDiagnosticSteps.has(diagnostic.step) ? diagnostic.step : null,
        sqlstate: diagnosticSqlstates.has(diagnostic.sqlstate) ? diagnostic.sqlstate : null,
      };
    });
  }
  return [{ code: diagnosticCodes.has(value.message) || pinDiagnosticCodes.has(value.message)
    ? value.message : 'PERMISSION_ERROR_OPAQUE' }];
}

// Never ask the JSON reporter to serialize failureMessages, stacks or diffs.
export function projectTestResults(modules, errors, reason) {
  // Vitest TestModule/Suite.errors() includes failed afterAll hooks even when
  // every test body passed and the run's unhandled errors array is empty.
  const hookErrors = modules.flatMap(module => [module, ...(module.children.allSuites?.() ?? [])]
    .flatMap(suite => typeof suite.errors === 'function' ? suite.errors() : Array.isArray(suite.errors) ? suite.errors : []));
  return { success: reason === 'passed' && errors.length === 0 && hookErrors.length === 0, errorCount: errors.length,
    hookErrorCount: hookErrors.length, hookErrors: hookErrors.flatMap(projectError),
    runErrors: errors.flatMap(projectError),
    testResults: modules.map(module => ({ name: module.moduleId,
      assertionResults: [...module.children.allTests()].map(test => ({
        fullName: test.fullName, status: test.result().state,
      })),
    })) };
}
export default class PermissionExecutionReporter extends IdempotencyExecutionReporter {
  onTestRunEnd(modules, errors, reason) {
    super.onTestRunEnd(modules, errors, reason);
    if (!process.env.PERM_RESULTS_FILE) throw new Error('PERM_RESULTS_FILE_REQUIRED');
    writeFileSync(process.env.PERM_RESULTS_FILE, JSON.stringify(projectTestResults(modules, errors, reason), null, 2) + '\n');
  }
}
