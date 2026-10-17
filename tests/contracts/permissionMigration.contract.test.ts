import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { parseObserverEnvironment, runPreflight, captureSnapshot, snapshotsEqual, permissionFingerprint, digest, PreflightError } from '../../scripts/permission-preflight-core.mjs';
import { collectInventory } from '../../scripts/permission-inventory.mjs';

// Dedicated fixture only. No phase-27 globalSetup (which creates employee sessions).
const env = parseObserverEnvironment();
const sourceFingerprint = permissionFingerprint();
const executionProfile = (catalogHash = env.expectedCatalogHash) => ({ kind: 'legacy', configId: env.profile,
  backend: { reference: env.backendRef, database: env.database, engine: env.engine, host: env.host, port: env.port },
  fixtureIds: env.storeIds, markerProof: digest(env.marker), catalogHash });
const control = JSON.parse(readFileSync(join(dirname(process.env.IDEM_ENV_FILE!), 'fixture-control.json'), 'utf8'));
const controlUrl = new URL(control.setupDsn);
if (controlUrl.hostname !== env.host || Number(controlUrl.port) !== env.port || controlUrl.pathname !== '/' + env.database)
  throw new Error('FIXTURE_CONTROL_TARGET_MISMATCH');
const admin = new pg.Client({ connectionString: control.setupDsn, connectionTimeoutMillis: 5000 });
let baseline: Array<Record<string, unknown>>;
let primaryMapping: Record<string, unknown>;
let markerChecksums: Record<string, string>;
const executions: Array<Record<string, unknown>> = [];
const cases: Array<Record<string, unknown>> = [];
let activeCase: { testName: string | undefined; startedAt: string; executionStart: number; sourceFingerprint: string;
  catalogHashAtStart?: string } | undefined;

beforeAll(async () => {
  await admin.connect();
  if ((await admin.query('show data_directory')).rows[0].data_directory !== control.expectedDataDirectory)
    throw new Error('FIXTURE_CLUSTER_MISMATCH');
  const marker = (await admin.query('select marker,migration_checksums from private.idempotency_test_environment')).rows;
  if (marker.length !== 1 || marker[0].marker !== env.marker) throw new Error('FIXTURE_MARKER_MISMATCH');
  markerChecksums = marker[0].migration_checksums;
  baseline = (await admin.query(`select id,store_id,name,role,is_active,permission_overrides,
    to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
    to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at from public.employees order by id`)).rows;
  primaryMapping = JSON.parse(readFileSync(join(dirname(process.env.IDEM_ENV_FILE!), 'primary-mapping.json'), 'utf8'));
});
async function resetFixture() {
  await admin.query('begin');
  try {
    await admin.query('alter table public.employees disable trigger user');
    for (const row of baseline) await admin.query(`update public.employees set name=$2,role=$3,is_active=$4,created_at=$5,permission_overrides=$6,updated_at=$7 where id=$1`,
      [row.id, row.name, row.role, row.is_active, row.created_at, row.permission_overrides, row.updated_at]);
    await admin.query('alter table public.employees enable trigger user');
    await admin.query('alter table public.employees alter column created_at set not null');
    await admin.query('update private.employee_sessions set revoked_at=null where employee_id=any($1::uuid[])', [control.employeeIds]);
    await admin.query('update private.idempotency_test_environment set marker=$1,store_ids=$2,migration_checksums=$3', [env.marker, env.storeIds, markerChecksums]);
    await admin.query('commit');
  } catch (error) { await admin.query('rollback'); throw error; }
}
beforeEach(async () => {
  activeCase = { testName: expect.getState().currentTestName, startedAt: new Date().toISOString(),
    executionStart: executions.length, sourceFingerprint: permissionFingerprint() };
  await resetFixture();
  activeCase.catalogHashAtStart = (await collectInventory(admin)).catalogHash;
});
afterEach(async () => {
  if (!activeCase) return;
  let catalogHashAtEnd: string | undefined;
  try {
    // Case boundaries describe the restored fixture. Event metadata separately
    // records the actual catalog observed during intentional drift controls.
    await resetFixture();
    catalogHashAtEnd = (await collectInventory(admin)).catalogHash;
  } finally {
    const events = executions.slice(activeCase.executionStart);
    cases.push({ testName: activeCase.testName, startedAt: activeCase.startedAt, finishedAt: new Date().toISOString(),
      sourceFingerprint: activeCase.sourceFingerprint, executionProfile: executionProfile(activeCase.catalogHashAtStart),
      catalogHashAtStart: activeCase.catalogHashAtStart, catalogHashAtEnd,
      scope: events.length === 0 ? 'direct-observer-control' : 'preflight-observer-control', events });
    activeCase = undefined;
  }
});
afterAll(async () => {
  try {
    if (baseline) {
      await resetFixture();
      writeFileSync(join(dirname(process.env.IDEM_ENV_FILE!), 'primary-mapping.json'), JSON.stringify({
        ...primaryMapping, sourceSnapshotHash: (await captureSnapshot(admin)).hash,
      }, null, 2) + '\n');
    }
  } finally {
    await admin.end();
    if (process.env.PERM_EXECUTIONS_FILE) writeFileSync(process.env.PERM_EXECUTIONS_FILE, JSON.stringify({
      schemaVersion: 1, runId: process.env.PERM_RUN_ID, sourceFingerprint, executionProfile: executionProfile(), cases, executions,
    }, null, 2) + '\n');
  }
});

async function execute(options: { mappingOverrides?: Array<Record<string, unknown>>; envOverrides?: Record<string, unknown>; mapping?: boolean } = {}) {
  const before = await captureSnapshot(admin);
  const mappings = options.mappingOverrides ?? (options.mapping === false ? [] : [{ ...primaryMapping, sourceSnapshotHash: before.hash }]);
  const inventory = await collectInventory(admin);
  const observedSourceFingerprint = permissionFingerprint();
  const startedAt = new Date().toISOString();
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('REST is outside T01'));
  try {
    const result = await runPreflight({ ...env, expectedCatalogHash: inventory.catalogHash, ...options.envOverrides },
      { mappings, runId: process.env.PERM_RUN_ID });
    executions.push({ testName: expect.getState().currentTestName, ...result.header, execution: result.execution,
      catalogHash: inventory.catalogHash, status: result.preflight.status, blockerReasons: reasons(result), safety: {
        readOnlyTransaction: result.preflight.safety.readOnlyTransaction,
        completeObserver: result.preflight.safety.completeObserver,
        databaseUnchanged: result.preflight.safety.databaseUnchanged,
      } });
    expect(result.preflight.safety.databaseUnchanged).toBe(true);
    expect(result.preflight.safety.readOnlyTransaction).toBe(true);
    // Column names in catalog metadata are intentional; never emit their row values.
    const output = JSON.stringify(result.preflight);
    for (const field of ['passcode_hash', 'token_hash', 'postgresql://', 'setupDsn']) expect(output).not.toContain(field);
    return result;
  } catch (error) {
    if (error instanceof PreflightError) executions.push({ testName: expect.getState().currentTestName,
      runId: process.env.PERM_RUN_ID, sourceFingerprint: observedSourceFingerprint,
      executionProfile: executionProfile(inventory.catalogHash),
      execution: { commandId: 'permission:t01:preflight', startedAt, finishedAt: new Date().toISOString(), outcome: 'BLOCKED' },
      reason: error.reason, catalogHash: inventory.catalogHash, fixtureIds: env.storeIds, configId: env.profile });
    throw error;
  } finally {
    try {
      expect(fetch).not.toHaveBeenCalled();
      expect(snapshotsEqual(before, await captureSnapshot(admin))).toBe(true);
    } finally { fetch.mockRestore(); }
  }
}
const reasons = (result: Awaited<ReturnType<typeof runPreflight>>) => result.preflight.stores.flatMap((s: { blockers: { reason: string }[] }) => s.blockers.map(b => b.reason));

describe('TC-PERM-48 preflight only on real legacy PostgreSQL', () => {
  test('verified primary and unique earliest admin; no session or business mutation', async () => {
    for (const table of ['public.orders', 'public.order_items', 'public.payments', 'public.write_operations', 'public.order_events', 'private.employee_sessions']) {
      const { rows } = await admin.query(`select count(*)::integer as count from ${table}`);
      expect(rows[0].count, table).toBeGreaterThan(0);
    }
    const identity = await admin.query(`select count(*)::integer as count from public.orders
      where created_by_employee_id is not null and last_modified_by_employee_id is not null`);
    expect(identity.rows[0].count).toBeGreaterThan(0);
    const result = await execute();
    expect(result.preflight.status).toBe('READY');
    expect(result.preflight.stores[0].candidateOwnerId).toBe(control.employeeIds[0]);
    expect(result.preflight.stores[1].candidateOwnerId).toBe(control.employeeIds[3]);
    expect(result.inventory.surfaces.some((s: {kind:string}) => s.kind === 'RPC')).toBe(true);
    expect(result.inventory.surfaces.some((s: {kind:string}) => s.kind === 'publication')).toBe(true);
  });
});

describe('TC-PERM-49 read-only ambiguity and environment controls', () => {
  test('primary UUID without provenance blocks whole run including otherwise-ready store', async () => {
    const result = await execute({ mapping: false });
    expect(result.preflight.status).toBe('BLOCKED'); expect(reasons(result)).toContain('UNVERIFIED_PRIMARY');
    expect(result.preflight.stores[1].status).toBe('READY');
  });
  test.each([
    ['tie', "update public.employees set created_at='2026-08-01T00:00:00Z' where id=$1", 'TIED_EARLIEST_ADMIN'],
    ['no active admin', 'update public.employees set is_active=false where store_id=$1', 'NO_ACTIVE_ADMIN'],
    ['invalid name', 'update public.employees set name=repeat(chr(128512),121) where id=$1', 'INVALID_NAME'],
    ['unknown override', `update public.employees set permission_overrides='{"grants":["unknown.permission"],"denies":[]}'::jsonb where id=$1`, 'UNKNOWN_OVERRIDE'],
  ])('%s blocks eligibility and preserves DB', async (name, sql, expected) => {
    await admin.query(sql, [name === 'no active admin' ? env.storeIds[1] : control.employeeIds[4]]);
    const result = await execute(); expect(result.preflight.status).toBe('BLOCKED'); expect(reasons(result)).toContain(expected);
  });
  test('missing timestamp blocks instead of UUID tie-break', async () => {
    await admin.query('alter table public.employees alter column created_at drop not null');
    await admin.query('update public.employees set created_at=null where id=$1', [control.employeeIds[3]]);
    const result = await execute(); expect(reasons(result)).toContain('MISSING_CREATED_AT');
  });
  test('inactive primary cannot be silently reactivated', async () => {
    await admin.query('update public.employees set is_active=false where id=$1', [control.employeeIds[0]]);
    const result = await execute({ mapping: false }); expect(reasons(result)).toContain('INACTIVE_PRIMARY');
  });
  test('owner deny is not silently discarded', async () => {
    await admin.query(`update public.employees set permission_overrides='{"grants":[],"denies":["payment.take"]}'::jsonb where id=$1`, [control.employeeIds[0]]);
    const result = await execute(); expect(reasons(result)).toContain('OWNER_DENIES');
  });
  test('120 Unicode code points remain valid', async () => {
    await admin.query('update public.employees set name=repeat(chr(128512),120) where id=$1', [control.employeeIds[4]]);
    expect((await execute()).preflight.status).toBe('READY');
  });
  test('microsecond timestamps remain distinct', async () => {
    await admin.query("update public.employees set created_at='2026-08-01T00:00:00.000001Z' where id=$1", [control.employeeIds[3]]);
    await admin.query("update public.employees set created_at='2026-08-01T00:00:00.000002Z' where id=$1", [control.employeeIds[4]]);
    expect((await execute()).preflight.status).toBe('READY');
  });
  test('supplied mapping resolves tied fixture with matching snapshot', async () => {
    await admin.query("update public.employees set created_at='2026-08-01T00:00:00Z' where store_id=$1", [env.storeIds[1]]);
    const hash = (await captureSnapshot(admin)).hash;
    const mapping = { ...primaryMapping, sourceSnapshotHash: hash };
    const second = { ...mapping, storeId: env.storeIds[1], ownerId: control.employeeIds[4] };
    expect((await execute({ mappingOverrides: [mapping, second] })).preflight.status).toBe('READY');
    expect((await execute({ mappingOverrides: [{ ...mapping, sourceSnapshotHash: '0'.repeat(64) }, second] })).preflight.status).toBe('BLOCKED');
  });
  test.each([
    ['marker', { marker: 'pos-cafe-perm-' + '0'.repeat(40) }, 'DATABASE_MARKER_MISMATCH'],
    ['database', { database: 'pos_cafe_idem_test_perm_000000000000' }, 'OBSERVER_DATABASE_MISMATCH'],
    ['storeIds', { storeIds: [] }, 'FIXTURE_MARKER_MISMATCH'],
    ['catalog', { expectedCatalogHash: '0'.repeat(64) }, 'CATALOG_STATE_MISMATCH'],
  ])('wrong environment fails before employee reads: %s', async (_label, envOverrides, code) => {
    const before = await captureSnapshot(admin);
    await expect(execute({ envOverrides })).rejects.toThrow(new PreflightError(code));
    expect(snapshotsEqual(before, await captureSnapshot(admin))).toBe(true);
  });
  test('missing marker row fails closed', async () => {
    await admin.query('begin');
    // Do not remove marker on the runner target: exercise same shared gate on this transaction.
    try {
      await admin.query('delete from private.idempotency_test_environment');
      const { observerPreflight } = await import('./observerPreflight.ts');
      await expect(observerPreflight(admin, env)).rejects.toThrow('DATABASE_MARKER_MISMATCH');
    } finally { await admin.query('rollback'); }
  });
  test('a fixture ID in both marker and config must exist in the database', async () => {
    const stores = [...env.storeIds, '10000000-0000-4000-8000-000000000099'];
    await admin.query('update private.idempotency_test_environment set store_ids=$1', [stores]);
    try {
      await expect(execute({ envOverrides: { storeIds: stores } })).rejects.toThrow('FIXTURE_STORE_SET_MISMATCH');
    } finally {
      await admin.query('update private.idempotency_test_environment set store_ids=$1', [env.storeIds]);
    }
  });
  test('an observer subject to tenant RLS cannot report an empty fixture as safe', async () => {
    await admin.query('alter role perm_observer nobypassrls');
    try {
      await expect(execute()).rejects.toThrow('OBSERVER_CANNOT_READ_COMPLETE_FIXTURE');
    } finally { await admin.query('alter role perm_observer bypassrls'); }
  });
  test('live catalog drift is rejected even when the migration marker checksum is unchanged', async () => {
    const expectedCatalogHash = (await collectInventory(admin)).catalogHash;
    await admin.query("alter table public.employees alter column name set default 'Synthetic catalog drift'");
    try {
      const marker = (await admin.query('select migration_checksums from private.idempotency_test_environment')).rows[0];
      expect(marker.migration_checksums).toEqual(markerChecksums);
      expect((await collectInventory(admin)).catalogHash).not.toBe(expectedCatalogHash);
      await expect(execute({ envOverrides: { expectedCatalogHash } })).rejects.toThrow('CATALOG_STATE_MISMATCH');
    } finally { await admin.query('alter table public.employees alter column name drop default'); }
    expect((await collectInventory(admin)).catalogHash).toBe(expectedCatalogHash);
  });
  test('a stale migration marker checksum blocks the observer', async () => {
    const changed = { ...markerChecksums, [Object.keys(markerChecksums)[0]]: '0'.repeat(64) };
    await admin.query('update private.idempotency_test_environment set migration_checksums=$1', [changed]);
    try {
      await expect(execute()).rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
    } finally {
      await admin.query('update private.idempotency_test_environment set migration_checksums=$1', [markerChecksums]);
    }
  });
  test.each([
    ['marker table', 'grant select on private.idempotency_test_environment to authenticated', 'revoke select on private.idempotency_test_environment from authenticated'],
    ['anonymous marker table', 'grant select on private.idempotency_test_environment to anon', 'revoke select on private.idempotency_test_environment from anon'],
    ['private schema through PUBLIC', 'grant usage on schema private to public', 'revoke usage on schema private from public'],
    ['anonymous private schema', 'grant usage on schema private to anon', 'revoke usage on schema private from anon'],
    ['anonymous private helper', 'grant execute on function private.write_clock() to anon', 'revoke execute on function private.write_clock() from anon'],
    ['private helper through PUBLIC', 'grant execute on function private.write_clock() to public', 'revoke execute on function private.write_clock() from public'],
  ])('%s exposure blocks the observer', async (_name, grant, revoke) => {
    await admin.query(grant);
    try {
      await expect(execute()).rejects.toThrow('PRIVATE_TEST_SCHEMA_EXPOSED');
    } finally { await admin.query(revoke); }
  });
  test.each([
    ['session credential hash', "update private.employee_sessions set token_hash=extensions.digest(extensions.gen_random_bytes(32),'sha256')"],
    ['ledger replay counter', 'update public.write_operations set replay_count=replay_count+1'],
  ])('serialized snapshot omits %s but internal equality detects its change', async (_name, sql) => {
    const before = await captureSnapshot(admin);
    await admin.query('begin');
    try {
      await admin.query(sql);
      const changed = await captureSnapshot(admin);
      expect(changed.hash).toBe(before.hash);
      expect(JSON.stringify(changed)).toBe(JSON.stringify(before));
      expect(snapshotsEqual(before, changed)).toBe(false);
      expect(snapshotsEqual(before, JSON.parse(JSON.stringify(before)))).toBe(false);
      expect(JSON.stringify(changed)).not.toContain('token_hash');
      expect(JSON.stringify(changed)).not.toContain('integrity');
    } finally { await admin.query('rollback'); }
    expect(snapshotsEqual(before, await captureSnapshot(admin))).toBe(true);
  });
  test('database enforces observer read-only writes', async () => {
    const db = new pg.Client({ connectionString: env.observerDsn }); await db.connect();
    try {
      await db.query('begin read only');
      await expect(db.query('update public.employees set name=name')).rejects.toMatchObject({ code: '25006' });
    } finally { await db.query('rollback'); await db.end(); }
  });
});
