import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { activationBundleManifest } from '../../scripts/permission-activation-bundle.mjs';
import { permissionFingerprint } from '../../scripts/permission-preflight-core.mjs';
import {
  assertReleaseExecutionRole, assertReleaseStrictPostflight, executeCutoverTransaction, loadReleaseEvidence, parseReleaseCutoverConfig,
  RELEASE_PREPARE_RESTORE_SQL, ReleaseCutoverError, runReleaseCutover, verifyBackupDigests,
} from '../../scripts/permission-release-cutover.mjs';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

function writePinned(directory: string, name: string, value: unknown) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value);
  writeFileSync(join(directory, name), bytes);
  return { path: name, sha256: hash(bytes) };
}

function fixture(mode: 'rehearsal-rollback' | 'release-commit' = 'rehearsal-rollback') {
  const directory = mkdtempSync(join(tmpdir(), 'permission-release-cutover-'));
  directories.push(directory);
  const sourceFingerprint = permissionFingerprint();
  const bundleHash = activationBundleManifest().sha256;
  const binding = { projectRef: 'fixture-project', backendHost: '127.0.0.1', database: 'fixture', sourceFingerprint, bundleHash };
  const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
  const inventory = writePinned(directory, 'inventory.json', {
    projectRef: binding.projectRef, baselineStoreIds: ids, currentStoreIds: ids,
    authUsers: { matchedScopeStoreIds: 2, outsideScope: 3 },
    storage: { totalObjects: 3, objectCountsByBucketAndStorePrefix: [
      { prefix_in_scope: true, total_objects: 2 }, { prefix_in_scope: false, total_objects: 1 },
    ] },
  });
  const metadata = writePinned(directory, 'metadata.json', { tableData: [] });
  const backup = writePinned(directory, 'backup.json', {
    status: 'VALIDATED_LOGICAL_BACKUP', projectRef: binding.projectRef, storeBaselineExactMatch: true, storeBaselineCount: 2,
    tableDataCount: 0,
    files: { 'metadata.json': metadata.sha256 },
  });
  const restoreInstanceId = 'fixture-restore-instance';
  const backupDirectory = 'C:\\protected\\backup';
  const restoreInput = writePinned(directory, 'restore-input.json', { backupManifestSha256: backup.sha256, restoreInstanceId, backupDirectory });
  const restoreExecution = writePinned(directory, 'restore-execution.json', {
    container: 'fixture-container', restoreInstanceId, backupDirectory, backupManifestSha256: backup.sha256,
    restoreInputManifestSha256: restoreInput.sha256, liveMutations: false, roleFlagsRestored: true,
  });
  const restoreComparison = writePinned(directory, 'restore-comparison.json', {
    status: 'RESTORE_DATA_AND_RECORDED_METADATA_MATCHED', container: 'fixture-container', backupDirectory,
    failedCount: 0, liveMutations: false, checks: [{ kind: 'table', name: 'public.stores', matched: true }],
  });
  const independentComparison = writePinned(directory, 'restore-independent.json', {
    status: 'INDEPENDENT_SCHEMA_AND_GLOBAL_ROLES_COMPARISON_PASSED', container: 'fixture-container', restoreInstanceId,
    readOnlyDatabaseOperations: true, liveDatabaseConnections: false,
  });
  const preparePath = join(process.cwd(), 'supabase/candidate/permission-compatibility-prepare.sql');
  const prepareSql = { path: preparePath, sha256: hash(readFileSync(preparePath)) };
  const restorePrepareSql = writePinned(directory, 'restore.sql', RELEASE_PREPARE_RESTORE_SQL);
  const baseline = { inventoryCatalogHash: '1'.repeat(64), releaseCatalogHash: '7'.repeat(64), prepareStateHash: '2'.repeat(64) };
  const prepared = { inventoryCatalogHash: '3'.repeat(64), releaseCatalogHash: '8'.repeat(64), prepareStateHash: '4'.repeat(64) };
  const emptyBody = hash('{}');
  const restoreArtifactHashes = { comparison: restoreComparison.sha256, inputManifest: restoreInput.sha256,
    execution: restoreExecution.sha256, independentComparison: independentComparison.sha256 };
  const catalogSupplement = writePinned(directory, 'catalog-supplement.json', {
    schemaVersion: 1, kind: 'permission-release-catalog-supplement', binding,
    backupManifestSha256: backup.sha256, restoreArtifactHashes, container: 'fixture-container', restoreInstanceId,
    baseline, cleanupRelations: ['public.stores'], cleanupFkHash: '9'.repeat(64),
    actor: { role: 'postgres', superuser: false, bypassRls: true },
    freshBackupComparison: { status: 'MATCHED_REPEATABLE_READ_ISOLATED', metadataSha256: metadata.sha256,
      tableCount: 0, observationsSha256: hash('[]'), observations: [] },
  });
  const restoreProof = { comparison: restoreComparison, inputManifest: restoreInput, execution: restoreExecution,
    independentComparison, catalogSupplement };
  const prepareProof = writePinned(directory, 'prepare-proof.json', {
    schemaVersion: 1, kind: 'permission-release-prepare-proof', binding, baseline, prepared,
    prepareSqlSha256: prepareSql.sha256, restorePrepareSqlSha256: restorePrepareSql.sha256,
    restProbe: { url: 'http://127.0.0.1:54321/rest/v1/rpc/permission_contract_probe', method: 'POST', body: {}, expectedStatus: 200, expectedBodySha256: emptyBody, expectedHookHeader: 'pass-through' },
    restoreProbe: { url: 'http://127.0.0.1:54321/rest/v1/rpc/permission_contract_probe', method: 'POST', body: {}, expectedStatus: 404, expectedBodySha256: emptyBody, expectedHookHeader: null },
    cleanupRelations: ['public.stores'], cleanupFkHash: '9'.repeat(64),
    storageObjects: [
      { id: '30000000-0000-4000-8000-000000000001', bucket: 'menu-item-images', object: `${ids[0]}/one.png`, version: 'v-one', size: 10, sha256: '5'.repeat(64) },
      { id: '30000000-0000-4000-8000-000000000002', bucket: 'menu-item-images', object: `${ids[1]}/two.png`, version: 'v-two', size: 20, sha256: '6'.repeat(64) },
    ],
  });
  const config = {
    schemaVersion: 1, mode, connectionString: 'postgresql://postgres@127.0.0.1/fixture',
    ...binding, executionRole: 'postgres', inventory, backupProof: backup, restoreProof, prepareProof,
    prepareSql, restorePrepareSql, restProbeKeyEnv: 'PERMISSION_RELEASE_TEST_KEY', storageJournalPath: 'storage-journal.json',
    timeouts: { lockMs: 1000, statementMs: 5000, probeAttempts: 1, probeDelayMs: 0, probeTimeoutMs: 1000 },
  };
  const path = join(directory, 'cutover.json');
  writeFileSync(path, JSON.stringify(config));
  return { directory, path, config, baseline, prepared };
}

describe('permission release cutover evidence envelope (mocked tooling; no runtime claim)', () => {
  test('binds target/source/bundle and every pinned proof before database access', () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    expect(loadReleaseEvidence(config)).toMatchObject({ targetIds: expect.arrayContaining([
      '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    ]) });
    const value = JSON.parse(readFileSync(item.path, 'utf8'));
    value.inventory.sha256 = '0'.repeat(64);
    writeFileSync(item.path, JSON.stringify(value));
    expect(() => loadReleaseEvidence(parseReleaseCutoverConfig(item.path))).toThrow('INVENTORY_HASH_MISMATCH');
  });

  test('refuses application env files and pg query routing overrides', () => {
    const item = fixture();
    writeFileSync(join(item.directory, '.env.local'), '{}');
    expect(() => parseReleaseCutoverConfig(join(item.directory, '.env.local'))).toThrow('APPLICATION_ENV_REFUSED');
    const value = JSON.parse(readFileSync(item.path, 'utf8'));
    value.connectionString += '?host=other.invalid';
    writeFileSync(item.path, JSON.stringify(value));
    expect(() => parseReleaseCutoverConfig(item.path)).toThrow('TARGET_BINDING_MISMATCH');
  });

  test('allows isolated commit rehearsal only on an explicitly proved Unix-socket target', () => {
    const item = fixture();
    const value = JSON.parse(readFileSync(item.path, 'utf8'));
    delete value.connectionString;
    value.mode = 'isolated-commit-rehearsal';
    value.backendHost = 'unix:/restore';
    value.unixSocket = { host: '/restore', port: 5432, user: 'postgres' };
    value.isolationProof = writePinned(item.directory, 'environment.json', {
      name: 'fixture-derivative', volume: 'fixture-derivative-data', image: `sha256:${'a'.repeat(64)}`,
      sourceRestore: 'fixture-container', sourceVolume: 'fixture-container-data',
      copyMethod: 'offline cp -a from readonly validated source volume', network: 'none', ports: [],
      dbSocket: '/restore', database: 'fixture', executionRole: 'postgres', createdAt: '2026-09-30T00:00:00.000Z',
    });
    writeFileSync(item.path, JSON.stringify(value));
    expect(parseReleaseCutoverConfig(item.path).mode).toBe('isolated-commit-rehearsal');
    value.mode = 'release-commit';
    writeFileSync(item.path, JSON.stringify(value));
    expect(() => parseReleaseCutoverConfig(item.path)).toThrow('INVALID_RELEASE_CUTOVER_CONFIG');
  });

  test('rejects a prepare proof that does not require the pass-through hook header', () => {
    const item = fixture();
    const configValue = JSON.parse(readFileSync(item.path, 'utf8'));
    const proofPath = join(item.directory, configValue.prepareProof.path);
    const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
    proof.restProbe.expectedHookHeader = null;
    const bytes = JSON.stringify(proof);
    writeFileSync(proofPath, bytes);
    configValue.prepareProof.sha256 = hash(bytes);
    writeFileSync(item.path, JSON.stringify(configValue));
    expect(() => loadReleaseEvidence(parseReleaseCutoverConfig(item.path))).toThrow('PREPARE_PROOF_INVALID');
  });
});

function mockDb() {
  const calls: string[] = [];
  return { calls, async query(sql: string) { calls.push(sql); return { rows: [] }; } };
}

const transactionOptions = (prepared: object, fault = false) => ({
  captureRollbackState: async () => ({ catalog: 'same', data: [], sequences: [] }),
  assertExecutionRole: async () => {}, lockCleanupClosure: async () => ({ relations: [{ schema: 'public', name: 'stores' }], fkHash: '9'.repeat(64) }),
  recheckLockedScope: async () => {}, capturePrepareState: async () => prepared,
  verifyBackupDigests: async () => {}, inspectExpectedEmptyTarget: async () => ({ schemaMatches: true, empty: true, storeIds: [] }),
  snapshotAndDeleteApprovedClosure: async () => ({ deletedRows: 9, relationCount: 1 }),
  applyActivationSteps: async () => { if (fault) throw new Error('fragment fault'); return { post: [], enumDependencies: 0 }; },
  assertStrictPostflight: async () => {},
});

describe('permission release cutover transaction boundary (mocked; SQL/runtime separately required)', () => {
  test('preflights the exact parameter and relation-owner capabilities before effects', async () => {
    const config = { executionRole: 'postgres' };
    const row = { role: 'postgres', superuser: false, bypass_rls: true, can_alter_roles: true, can_set_pgrst_hook: true,
      can_manage_storage_objects: true, storage_objects_owner: 'supabase_storage_admin' };
    const db = { query: async () => ({ rows: [row] }) };
    await expect(assertReleaseExecutionRole(db as any, config as any)).resolves.toBeUndefined();
    await expect(assertReleaseExecutionRole({ query: async () => ({ rows: [{ ...row, can_set_pgrst_hook: false }] }) } as any, config as any))
      .rejects.toMatchObject({ code: 'PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED' });
    await expect(assertReleaseExecutionRole({ query: async () => ({ rows: [{ ...row, can_alter_roles: false }] }) } as any, config as any))
      .rejects.toMatchObject({ code: 'ALTER_ROLE_PRIVILEGE_REQUIRED' });
    await expect(assertReleaseExecutionRole({ query: async () => ({ rows: [{ ...row, can_manage_storage_objects: false }] }) } as any, config as any))
      .rejects.toMatchObject({ code: 'STORAGE_OBJECTS_OWNERSHIP_REQUIRED' });
  });

  test('requires the exact five-role catalog including waiter in strict postflight', async () => {
    const valid = { roles: ['cashier', 'kitchen', 'manager', 'owner', 'waiter'], permissions: 15,
      role_fk: 1, employee_owner_trigger: 1, store_owner_trigger: 1 };
    const db = { query: async (sql: string) => sql === 'set constraints all immediate' ? { rows: [] } : { rows: [valid] } };
    await expect(assertReleaseStrictPostflight(db as any)).resolves.toBeUndefined();
    const missingWaiter = { ...valid, roles: valid.roles.filter(role => role !== 'waiter') };
    const drifted = { query: async (sql: string) => sql === 'set constraints all immediate' ? { rows: [] } : { rows: [missingWaiter] } };
    await expect(assertReleaseStrictPostflight(drifted as any)).rejects.toMatchObject({ code: 'STRICT_POSTFLIGHT_FAILED' });
  });

  test('keeps cleanup and all activation work in one READ COMMITTED transaction and rolls rehearsal back', async () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    await expect(executeCutoverTransaction(db as any, config, evidence, transactionOptions(item.prepared)))
      .resolves.toMatchObject({ status: 'REHEARSAL_PASSED_ROLLED_BACK', cleanup: { deletedRows: 9 } });
    expect(db.calls.filter(sql => /^begin/i.test(sql))).toEqual(['begin isolation level read committed']);
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['rollback']);
  });

  test('rolls back the same transaction when an activation fragment fails', async () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    await expect(executeCutoverTransaction(db as any, config, evidence, transactionOptions(item.prepared, true)))
      .rejects.toEqual(expect.objectContaining({ code: 'CUTOVER_TRANSACTION_FAILED' }));
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['rollback']);
  });

  test('preserves a concurrent locked-precheck drift code without comparing an unlocked rollback baseline', async () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    let captured = 0;
    const error = await executeCutoverTransaction(db as any, config, evidence, {
      ...transactionOptions(item.prepared), captureRollbackState: async () => { captured++; return { state: 'unused' }; },
      recheckLockedScope: async () => { throw new ReleaseCutoverError('LOCKED_SCOPE_DRIFT'); },
    }).catch(value => value);
    expect(error).toMatchObject({ code: 'LOCKED_SCOPE_DRIFT' });
    expect(captured).toBe(0);
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['rollback']);
  });

  test('captures rollback state under locks after all prechecks and immediately before cleanup', async () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    const events: string[] = [];
    const state = { catalog: 'same', data: [], sequences: [] };
    await executeCutoverTransaction(db as any, config, evidence, {
      ...transactionOptions(item.prepared),
      lockCleanupClosure: async () => { events.push('locked'); return { relations: [{ schema: 'public', name: 'stores' }], fkHash: '9'.repeat(64) }; },
      recheckLockedScope: async () => { events.push('scope'); },
      verifyBackupDigests: async () => { events.push('data'); },
      capturePrepareState: async () => { events.push('prepared'); return item.prepared; },
      captureRollbackState: async () => { events.push('baseline'); return state; },
      snapshotAndDeleteApprovedClosure: async () => { events.push('cleanup'); return { deletedRows: 9, relationCount: 1 }; },
    });
    expect(events.slice(0, 6)).toEqual(['locked', 'scope', 'data', 'prepared', 'baseline', 'cleanup']);
    expect(events.filter(event => event === 'baseline')).toHaveLength(2);
  });

  test('requires explicit commit mode and only then commits', async () => {
    const item = fixture('release-commit');
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    await expect(executeCutoverTransaction(db as any, config, evidence, transactionOptions(item.prepared)))
      .resolves.toMatchObject({ status: 'COMMITTED' });
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['commit']);
  });

  test('reports a distinct committed outcome for a disposable isolated rehearsal', async () => {
    const item = fixture();
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    await expect(executeCutoverTransaction(db as any, { ...config, mode: 'isolated-commit-rehearsal' }, evidence,
      transactionOptions(item.prepared))).resolves.toMatchObject({ status: 'ISOLATED_REHEARSAL_COMMITTED' });
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['commit']);
  });

  test('treats a lost COMMIT acknowledgement as UNKNOWN and never issues rollback or prepare restoration', async () => {
    const item = fixture('release-commit');
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = { calls: [] as string[], async query(sql: string) {
      this.calls.push(sql); if (sql === 'commit') throw new Error('connection lost after server accepted COMMIT'); return { rows: [] };
    } };
    const error = await executeCutoverTransaction(db as any, config, evidence, transactionOptions(item.prepared)).catch(value => value);
    expect(error).toMatchObject({ code: 'DATABASE_COMMIT_OUTCOME_UNKNOWN', databaseCommitOutcomeUnknown: true });
    expect(db.calls.filter(sql => sql === 'rollback')).toEqual([]);
  });

  test('blocks a count-preserving locked-row drift before cleanup DELETE', async () => {
    const evidence = { backupMetadata: { tableData: [
      { schema: 'auth', name: 'users', rowCount: '5', sha256: 'a'.repeat(64) },
      { schema: 'storage', name: 'objects', rowCount: '3', sha256: 'c'.repeat(64) },
    ] } };
    const calls: string[] = [];
    const db = { async query(sql: string) { calls.push(sql); return { rows: [{ rowCount: '5', sha256: 'b'.repeat(64) }] }; } };
    await expect(verifyBackupDigests(db as any, evidence as any, [{ schema: 'auth', name: 'users' }]))
      .rejects.toThrow('LOCKED_BACKUP_DATA_DRIFT');
    expect(calls.some(sql => /^delete/i.test(sql))).toBe(false);
  });

  test('rolls back when source or activation bundle changes before explicit commit', async () => {
    const item = fixture('release-commit');
    const config = parseReleaseCutoverConfig(item.path);
    const evidence = loadReleaseEvidence(config);
    const db = mockDb();
    await expect(executeCutoverTransaction(db as any, config, evidence, { ...transactionOptions(item.prepared), verifySource: () => false }))
      .rejects.toThrow('SOURCE_CHANGED_DURING_RUN');
    expect(db.calls.filter(sql => /^(commit|rollback)$/i.test(sql))).toEqual(['rollback']);
  });
});

describe('prepare lifecycle (mocked REST/catalog provenance; no live or isolated runtime)', () => {
  test('restores the exact baseline hook state after rehearsal rollback and creates no Storage journal', async () => {
    const item = fixture();
    const states = [item.baseline, item.prepared, item.prepared, item.baseline];
    const db = { calls: [] as string[], async connect() {}, async end() {}, async query(sql: string) {
      this.calls.push(sql); return { rows: sql.includes('select current_database() database') ? [{ database: 'fixture', server_addr: '127.0.0.1', port: 5432 }] : [] };
    } };
    const old = process.env.PERMISSION_RELEASE_TEST_KEY;
    process.env.PERMISSION_RELEASE_TEST_KEY = 'fixture-key';
    try {
      const result = await runReleaseCutover(item.path, {
        Client: class { constructor() { return db; } },
        ...transactionOptions(item.prepared),
        assertPrepareBaselineAbsent: async () => {},
        capturePrepareState: async () => states.shift(),
        fetchImpl: async () => states.length > 0
          ? new Response('{}', { status: 200, headers: { 'x-pos-permission-hook': 'pass-through' } })
          : new Response('{}', { status: 404 }),
      });
      expect(result).toMatchObject({ status: 'REHEARSAL_PASSED_ROLLED_BACK', prepareRestored: true, storageJournal: 'NOT_CREATED' });
      expect(db.calls.some(sql => sql.includes('create or replace function public.permission_contract_pre_request'))).toBe(true);
      expect(db.calls.some(sql => sql.includes('drop function public.permission_contract_pre_request'))).toBe(true);
      expect(readFileSync(item.path, 'utf8')).not.toContain('fixture-key');
    } finally {
      if (old === undefined) delete process.env.PERMISSION_RELEASE_TEST_KEY; else process.env.PERMISSION_RELEASE_TEST_KEY = old;
    }
  });

  test('preserves UNKNOWN when restore-prepare COMMIT loses its acknowledgement after an activation fault', async () => {
    const item = fixture();
    const states = [item.baseline, item.prepared, item.prepared];
    let commits = 0;
    const db = { calls: [] as string[], async connect() {}, async end() {}, async query(sql: string) {
      this.calls.push(sql);
      if (sql.includes('select current_database() database')) return { rows: [{ database: 'fixture', server_addr: '127.0.0.1', port: 5432 }] };
      if (sql === 'commit' && ++commits === 2) throw new Error('restore commit acknowledgement lost');
      return { rows: [] };
    } };
    const old = process.env.PERMISSION_RELEASE_TEST_KEY;
    process.env.PERMISSION_RELEASE_TEST_KEY = 'fixture-key';
    try {
      const error = await runReleaseCutover(item.path, {
        Client: class { constructor() { return db; } },
        ...transactionOptions(item.prepared, true),
        assertPrepareBaselineAbsent: async () => {},
        capturePrepareState: async () => states.shift(),
        fetchImpl: async () => new Response('{}', { status: 200, headers: { 'x-pos-permission-hook': 'pass-through' } }),
      }).catch(value => value);
      expect(error).toMatchObject({ code: 'RESTORE_PREPARE_COMMIT_OUTCOME_UNKNOWN', prepareState: 'UNKNOWN' });
      expect(commits).toBe(2);
      expect(db.calls.filter(sql => sql === 'rollback')).toHaveLength(1);
    } finally {
      if (old === undefined) delete process.env.PERMISSION_RELEASE_TEST_KEY; else process.env.PERMISSION_RELEASE_TEST_KEY = old;
    }
  });
});
