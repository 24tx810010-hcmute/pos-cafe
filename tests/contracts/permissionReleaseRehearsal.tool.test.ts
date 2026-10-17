import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { RELEASE_PREPARE_RESTORE_SQL } from '../../scripts/permission-release-cutover.mjs';
import { assertLegacyBootstrapAdmission, cleanupLegacyInflightSessions, createLegacyCutoverGuard, observePermissionReleaseProofs,
  parseReleaseRehearsalConfig, runPermissionReleaseFaultMatrix, waitForCutoverBarrier, waitForLock,
} from '../../scripts/permission-release-rehearsal.mjs';
import { ACTIVATION_SQL_ORDER } from '../../scripts/permission-activation-bundle.mjs';
import { applyActivationSteps } from '../../scripts/permission-activation-steps.mjs';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

function writePinned(directory: string, name: string, value: unknown) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value);
  writeFileSync(join(directory, name), bytes);
  return { path: name, sha256: digest(bytes) };
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'permission-release-rehearsal-'));
  directories.push(directory);
  const sourceFingerprint = '1'.repeat(64);
  const bundleHash = '2'.repeat(64);
  const projectRef = 'fixture-project';
  const metadata = writePinned(directory, 'metadata.json', { tableData: [
    { schema: 'public', name: 'stores', rowCount: '0', sha256: digest('') },
  ] });
  const backupManifest = writePinned(directory, 'manifest.json', {
    status: 'VALIDATED_LOGICAL_BACKUP', projectRef, tableDataCount: 1, files: { 'metadata.json': metadata.sha256 },
  });
  const restoreInstanceId = 'fixture-restore-instance';
  const backupDirectory = 'C:\\protected\\backup';
  const restoreInputManifest = writePinned(directory, 'restore-input.json', {
    backupManifestSha256: backupManifest.sha256, restoreInstanceId, backupDirectory,
  });
  const image = `sha256:${'3'.repeat(64)}`;
  const restoreExecution = writePinned(directory, 'restore-execution.json', {
    container: 'fixture-source', restoreInstanceId, backupDirectory, image,
    backupManifestSha256: backupManifest.sha256, restoreInputManifestSha256: restoreInputManifest.sha256,
    liveMutations: false, roleFlagsRestored: true,
  });
  const restoreComparison = writePinned(directory, 'comparison.json', {
    status: 'RESTORE_DATA_AND_RECORDED_METADATA_MATCHED', failedCount: 0, liveMutations: false,
    container: 'fixture-source', backupDirectory,
    checks: Array.from({ length: 74 }, (_, index) => ({ name: `check-${index}`, matched: true })),
  });
  const independentComparison = writePinned(directory, 'independent.json', {
    status: 'INDEPENDENT_SCHEMA_AND_GLOBAL_ROLES_COMPARISON_PASSED', container: 'fixture-source', restoreInstanceId,
    readOnlyDatabaseOperations: true, liveDatabaseConnections: false,
  });
  const isolationProof = writePinned(directory, 'environment.json', {
    name: 'fixture-derivative', volume: 'fixture-derivative-data', image,
    sourceRestore: 'fixture-source', sourceVolume: 'fixture-source-data',
    copyMethod: 'offline cp -a from readonly validated source volume', network: 'none', ports: [],
    dbSocket: '/restore', database: 'postgres', executionRole: 'postgres', createdAt: '2026-09-30T00:00:00.000Z',
  });
  const targetIds = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
  const storageProof = writePinned(directory, 'storage.json', { objects: [
    { id: '30000000-0000-4000-8000-000000000001', bucket: 'menu-item-images', object: `${targetIds[0]}/one.png`, version: 'one', size: 1, sha256: '4'.repeat(64) },
    { id: '30000000-0000-4000-8000-000000000002', bucket: 'menu-item-images', object: `${targetIds[1]}/two.png`, version: 'two', size: 2, sha256: '5'.repeat(64) },
  ] });
  const inventory = writePinned(directory, 'inventory.json', { projectRef, currentStoreIds: targetIds });
  const preparePath = resolve('supabase/candidate/permission-compatibility-prepare.sql');
  const prepareSql = { path: preparePath, sha256: digest(readFileSync(preparePath)) };
  const restorePrepareSql = writePinned(directory, 'restore.sql', RELEASE_PREPARE_RESTORE_SQL);
  const bodyHash = digest('{}');
  const value = {
    schemaVersion: 1, kind: 'permission-release-rehearsal-proof-observation', projectRef,
    backendHost: 'unix:/restore', database: 'postgres', executionRole: 'postgres', sourceFingerprint, bundleHash,
    unixSocket: { host: '/restore', port: 5432, user: 'postgres' }, restProbeKeyEnv: 'PERMISSION_RELEASE_REHEARSAL_TEST_KEY',
    inventory, backupManifest, restoreComparison, restoreInputManifest, restoreExecution, independentComparison,
    isolationProof, storageProof, prepareSql, restorePrepareSql,
    restProbe: { url: 'http://127.0.0.1:3001/rest/v1/rpc/permission_contract_probe', method: 'POST', body: {},
      expectedStatus: 200, expectedBodySha256: bodyHash, expectedHookHeader: 'pass-through' },
    restoreProbe: { url: 'http://127.0.0.1:3001/rest/v1/rpc/permission_contract_probe', method: 'POST', body: {},
      expectedStatus: 404, expectedBodySha256: bodyHash, expectedHookHeader: null },
    catalogSupplementOutput: 'catalog-supplement.json', prepareProofOutput: 'prepare-proof.json',
    timeouts: { lockMs: 1000, statementMs: 5000, probeAttempts: 1, probeDelayMs: 0, probeTimeoutMs: 1000 },
  };
  const path = join(directory, 'rehearsal.json');
  writeFileSync(path, JSON.stringify(value));
  return { directory, path, value, sourceFingerprint, bundleHash };
}

function runtimeOptions(sourceFingerprint: string, bundleHash: string, restored = true) {
  const calls: string[] = [];
  class Client {
    async connect() { calls.push('connect'); }
    async end() { calls.push('end'); }
    async query(sql: string) {
      calls.push(sql);
      if (sql.startsWith('select current_database()')) return { rows: [{ database: 'postgres', server_addr: null, port: 5432 }] };
      return { rows: [] };
    }
  }
  const baseline = { inventoryCatalogHash: 'a'.repeat(64), releaseCatalogHash: 'b'.repeat(64), prepareStateHash: 'c'.repeat(64) };
  const prepared = { inventoryCatalogHash: 'd'.repeat(64), releaseCatalogHash: 'e'.repeat(64), prepareStateHash: 'f'.repeat(64) };
  let state = 0; let probe = 0;
  return { calls, options: {
    Client, permissionFingerprint: () => sourceFingerprint, activationBundleManifest: () => ({ sha256: bundleHash }),
    assertExecutionRole: async () => {}, assertPrepareBaselineAbsent: async () => {},
    capturePrepareState: async () => state++ === 0 ? baseline : state === 2 ? prepared : restored ? baseline : { ...baseline, prepareStateHash: '0'.repeat(64) },
    inspectCleanupClosure: async () => ({ relations: [{ schema: 'public', name: 'stores' }], fkHash: '9'.repeat(64) }),
    verifyBackupDigests: async () => [{ relation: 'public.stores', rowCount: '0', sha256: digest('') }],
    fetchImpl: async () => {
      const current = probe++;
      return new Response('{}', { status: current === 0 ? 200 : 404,
        headers: current === 0 ? { 'x-pos-permission-hook': 'pass-through' } : {} });
    },
  } };
}

describe('permission release proof observation (mocked tooling; no runtime claim)', () => {
  test('requires the accepted legacy call to execute as authenticated with function EXECUTE', async () => {
    await expect(assertLegacyBootstrapAdmission({ query: async () => ({ rows: [
      { role: 'authenticated', canExecute: true },
    ] }) } as any)).resolves.toEqual({ role: 'authenticated', canExecute: true });
    await expect(assertLegacyBootstrapAdmission({ query: async () => ({ rows: [
      { role: 'postgres', canExecute: true },
    ] }) } as any)).rejects.toMatchObject({ code: 'LEGACY_BOOTSTRAP_CLIENT_NOT_ADMITTED' });
    await expect(assertLegacyBootstrapAdmission({ query: async () => ({ rows: [
      { role: 'authenticated', canExecute: false },
    ] }) } as any)).rejects.toMatchObject({ code: 'LEGACY_BOOTSTRAP_CLIENT_NOT_ADMITTED' });
  });

  test('releases the blocker before settling bootstrap and preserves an original failure when cleanup also fails', async () => {
    const events: string[] = [];
    let releaseBootstrap!: () => void;
    const bootstrapOutcomePromise = new Promise(resolvePending => { releaseBootstrap = () => {
      events.push('bootstrap-settled'); resolvePending({ ok: false, sqlState: '23503' });
    }; });
    const blocker = {
      query: async () => { events.push('blocker-rollback-failed'); throw new Error('cleanup rollback failed'); },
      end: async () => { events.push('blocker-end'); releaseBootstrap(); },
    };
    const bootstrap = {
      query: async () => { events.push('bootstrap-rollback'); return { rows: [] }; },
      end: async () => { events.push('bootstrap-end'); },
    };
    const original = new Error('original runtime failure');
    const observed = await (async () => {
      try {
        throw original;
      } finally {
        await cleanupLegacyInflightSessions({ blocker, bootstrap, blockerConnected: true, bootstrapConnected: true,
          blockerOpen: true, bootstrapOpen: true, bootstrapOutcomePromise, releaseBeforeCommit: () => events.push('release-hook'),
          timeoutMs: 100 });
      }
    })().catch(error => error);
    expect(observed).toBe(original);
    expect(events).toEqual(['release-hook', 'blocker-rollback-failed', 'blocker-end', 'bootstrap-settled',
      'bootstrap-rollback', 'bootstrap-end']);
  });

  test('invalidates the PostgreSQL statistics snapshot before every lock-state poll', async () => {
    const lockCalls: string[] = [];
    let lockPoll = 0;
    const lockDb = { query: async (sql: string) => {
      lockCalls.push(sql);
      if (sql.includes('pg_stat_activity')) return { rows: lockPoll++ === 0 ? [] : [
        { pid: 4101, backendXid: '701', state: 'active', waitType: 'Lock', waitEvent: 'relation' },
      ] };
      return { rows: [] };
    } };
    await expect(waitForLock(lockDb as any, 'bootstrap', { waitMs: 1000, pollMs: 1 }))
      .resolves.toMatchObject({ pid: 4101, backendXid: '701', waitType: 'Lock', waitEvent: 'relation' });
    expect(lockCalls.map(sql => sql.includes('pg_stat_clear_snapshot') ? 'clear' : 'read'))
      .toEqual(['clear', 'read', 'clear', 'read']);

    const barrierCalls: string[] = [];
    let barrierPoll = 0;
    const barrierDb = { query: async (sql: string) => {
      barrierCalls.push(sql);
      if (sql.includes('pg_stat_activity')) return { rows: barrierPoll++ === 0 ? [] : [
        { pid: 4102, backendXid: '702', state: 'active', waitType: 'Lock', waitEvent: 'relation' },
      ] };
      return { rows: [] };
    } };
    await expect(waitForCutoverBarrier(barrierDb as any, { reached: false }, { waitMs: 1000, pollMs: 1 }))
      .resolves.toMatchObject({ kind: 'database-lock', pid: 4102, backendXid: '702', waitEvent: 'relation' });
    expect(barrierCalls.map(sql => sql.includes('pg_stat_clear_snapshot') ? 'clear' : 'read'))
      .toEqual(['clear', 'read', 'clear', 'read']);
  });

  test('an aborted harness rejects a controller paused at beforeCommit and cannot commit', async () => {
    const events: string[] = [];
    const guard = createLegacyCutoverGuard('advisory-wait-cutover-commits');
    let committed = false;
    const fakeRunner = (async () => {
      events.push('before-commit');
      await guard.beforeCommit();
      committed = true;
      events.push('commit');
    })();
    while (!guard.state.reached) await Promise.resolve();
    events.push('finally-abort');
    guard.abort();
    const outcome = await fakeRunner.catch(error => error);
    expect(outcome).toMatchObject({ code: 'LEGACY_HARNESS_ABORTED_BEFORE_COMMIT' });
    expect(committed).toBe(false);
    expect(events).toEqual(['before-commit', 'finally-abort']);
  });

  test('requires pass-through prepare probe and an explicit absent-header restore probe', () => {
    const item = fixture();
    item.value.restProbe.expectedHookHeader = null;
    writeFileSync(item.path, JSON.stringify(item.value));
    expect(() => parseReleaseRehearsalConfig(item.path)).toThrow('INVALID_REHEARSAL_CONFIG');
  });

  test('rejects corrupted historical 74-check lineage before constructing a database client', async () => {
    const item = fixture();
    const comparisonPath = join(item.directory, item.value.restoreComparison.path);
    const comparison = JSON.parse(readFileSync(comparisonPath, 'utf8'));
    comparison.checks.pop();
    const bytes = JSON.stringify(comparison);
    writeFileSync(comparisonPath, bytes);
    item.value.restoreComparison.sha256 = digest(bytes);
    writeFileSync(item.path, JSON.stringify(item.value));
    let constructed = false;
    class Client { constructor() { constructed = true; } }
    const error = await observePermissionReleaseProofs(parseReleaseRehearsalConfig(item.path), {
      Client, permissionFingerprint: () => item.sourceFingerprint, activationBundleManifest: () => ({ sha256: item.bundleHash }),
    }).catch(value => value);
    expect(error).toMatchObject({ code: 'REHEARSAL_EVIDENCE_INVALID' });
    expect(constructed).toBe(false);
  });

  test('uses one isolated repeatable-read snapshot, restores prepare exactly, then writes bound proofs', async () => {
    const item = fixture();
    process.env.PERMISSION_RELEASE_REHEARSAL_TEST_KEY = 'fixture-key';
    const runtime = runtimeOptions(item.sourceFingerprint, item.bundleHash);
    const result = await observePermissionReleaseProofs(parseReleaseRehearsalConfig(item.path), runtime.options);
    expect(result).toMatchObject({ status: 'PROOFS_OBSERVED_AND_PREPARE_RESTORED', relationCount: 1 });
    expect(runtime.calls).toContain('begin isolation level repeatable read read only');
    expect(runtime.calls.some(sql => /^lock table/i.test(sql))).toBe(false);
    const supplement = JSON.parse(readFileSync(join(item.directory, 'catalog-supplement.json'), 'utf8'));
    expect(supplement).toMatchObject({ container: 'fixture-derivative', freshBackupComparison: {
      status: 'MATCHED_REPEATABLE_READ_ISOLATED', tableCount: 1,
    } });
    expect(supplement.freshBackupComparison.observationsSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('does not write proofs when fixed restore fails the exact baseline comparison', async () => {
    const item = fixture();
    process.env.PERMISSION_RELEASE_REHEARSAL_TEST_KEY = 'fixture-key';
    const runtime = runtimeOptions(item.sourceFingerprint, item.bundleHash, false);
    const error = await observePermissionReleaseProofs(parseReleaseRehearsalConfig(item.path), runtime.options).catch(value => value);
    expect(error).toMatchObject({ code: 'PREPARE_RESTORE_MISMATCH' });
    expect(() => readFileSync(join(item.directory, 'catalog-supplement.json'))).toThrow();
    expect(() => readFileSync(join(item.directory, 'prepare-proof.json'))).toThrow();
  });

  test('enumerates cleanup, all eleven activation fragments, and precommit faults between clean controls', async () => {
    const item = fixture();
    const seen: number[] = [];
    const result = await runPermissionReleaseFaultMatrix(item.path, join(item.directory, 'fault-matrix.json'), {
      parseConfig: () => ({ mode: 'rehearsal-rollback', unixSocket: { host: '/restore' }, projectRef: 'fixture-project',
        backendHost: 'unix:/restore', database: 'postgres', sourceFingerprint: item.sourceFingerprint, bundleHash: item.bundleHash }),
      runner: async (_path: string, runOptions: Record<string, unknown>) => {
        if (typeof runOptions.afterCleanup === 'function' || typeof runOptions.beforeCommit === 'function') {
          const error = new Error('fault') as Error & { code: string };
          error.code = 'CUTOVER_TRANSACTION_FAILED';
          throw error;
        }
        if (Object.prototype.hasOwnProperty.call(runOptions, 'failAfterFragment')) {
          seen.push(runOptions.failAfterFragment as number);
          const error = new Error('fault') as Error & { code: string };
          error.code = 'SYNTHETIC_FRAGMENT_FAULT';
          throw error;
        }
        return { status: 'REHEARSAL_PASSED_ROLLED_BACK', prepareRestored: true };
      },
    });
    expect(result).toMatchObject({ status: 'PASSED', caseCount: 15 });
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const report = JSON.parse(readFileSync(join(item.directory, 'fault-matrix.json'), 'utf8'));
    expect(report.cases[0]).toMatchObject({ name: 'control-before', prepareRestored: true });
    expect(report.cases.at(-1)).toMatchObject({ name: 'control-after', prepareRestored: true });
  });

  test('can inject a fault immediately after activation fragment zero', async () => {
    let queries = 0;
    const db = { query: async () => ({ rows: queries++ === 0 ? [{ value: 'public.permission_contract_pre_request' }] : [] }) };
    const sqlFiles = new Map(ACTIVATION_SQL_ORDER.map(path => [path, 'select 1;']));
    await expect(applyActivationSteps(db, { plan: { stores: [] }, storeIds: [], failAfterFragment: 0, sqlFiles }))
      .rejects.toMatchObject({ code: 'SYNTHETIC_FRAGMENT_FAULT' });
    expect(queries).toBe(2);
  });
});
