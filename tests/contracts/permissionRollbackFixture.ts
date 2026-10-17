import { expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { assertBridgeFixture, parseBridgeEnvironment, STORE_IDS, EMPLOYEE_IDS, PROJECT } from '../../scripts/permission-identity-runtime.mjs';
import { captureSnapshot, permissionFingerprint, snapshotsEqual } from '../../scripts/permission-preflight-core.mjs';
import { collectInventory } from '../../scripts/permission-inventory.mjs';
import { activateDatabase } from '../../scripts/permission-activate.mjs';
import { activationBundleManifest } from '../../scripts/permission-activation-bundle.mjs';
import { runReleasePreflight } from '../../scripts/permission-release-preflight.mjs';
import { assessPermissionRestore } from '../../scripts/permission-restore-assessment.mjs';
import { prepareCompatibilityHook,restoreCompatibilityPreparation,verifyCompatibilityRestRouting } from '../../scripts/permission-compatibility-prepare.mjs';

const env = parseBridgeEnvironment();
const db = new pg.Client({ connectionString: env.dsn, statement_timeout: 30_000 });
const directory = mkdtempSync(join(tmpdir(), 'permission-rollback-'));
const source = permissionFingerprint();
const proof: Record<string, unknown> = { physicalBackupRestore: 'NOT_RUN', fixtureSnapshotOnly: true };
let bound = false;
let compatibilityReceipt: {installedByCaller:boolean}|undefined;

export async function setupRollbackFixture() { await db.connect(); proof.runtime = await assertBridgeFixture(db, env); bound = true;
  compatibilityReceipt=await prepareCompatibilityHook(db);await verifyCompatibilityRestRouting({restUrl:env.api+'/rest/v1',anonKey:env.anonKey}); }
export async function cleanupRollbackFixture() {
  if (bound) await db.query('rollback');
  if(compatibilityReceipt)await restoreCompatibilityPreparation(db,compatibilityReceipt);
  await db.end();
  if (process.env.PERM_ROLLBACK_EVIDENCE_FILE) writeFileSync(process.env.PERM_ROLLBACK_EVIDENCE_FILE,
    JSON.stringify({ sourceFingerprint: source, sourceAfter: permissionFingerprint(), proof }, null, 2));
}

export async function verifyAdditiveRevert() {
  expect(bound).toBe(true);
  const before = await captureSnapshot(db), catalog = await collectInventory(db);
  await db.query(readFileSync('supabase/migrations/017_permission_catalog_bridge.sql', 'utf8'));
  expect((await db.query("select to_regclass('public.permission_catalog') present")).rows[0].present).toBeTruthy();
  await db.query(readFileSync('scripts/sql/permission-t02-revert.sql', 'utf8'));
  expect(snapshotsEqual(before, await captureSnapshot(db))).toBe(true);
  expect((await collectInventory(db)).catalogHash).toBe(catalog.catalogHash);
  proof.additiveRevert = { dataUnchanged: true, catalogAndGrantsUnchanged: true };
}

export async function verifyReadOnlyLauncher() {
  expect(bound).toBe(true);
  const before = await captureSnapshot(db), catalog = await collectInventory(db);
  const path = join(directory, 'target.json');
  const target = { schemaVersion: 1, mode: 'release-read-only-preflight', connectionString: env.dsn,
    projectRef: PROJECT, backendHost: '127.0.0.1', database: 'postgres', storeIds: STORE_IDS,
    catalogHash: catalog.catalogHash, sourceFingerprint: source, bundleHash: activationBundleManifest().sha256, mappingFiles: [] };
  for (const patch of [{ backendHost: 'other.invalid' }, { projectRef: '' }, { database: 'other' }, { bundleHash: undefined },
    { connectionString: 'postgresql://reader@db.projecta.supabase.co/postgres', backendHost: 'db.projecta.supabase.co', projectRef: 'projectb' }]) {
    writeFileSync(path, JSON.stringify({ ...target, ...patch }));
    const connect = vi.spyOn(pg.Client.prototype, 'connect').mockRejectedValue(new Error('NEGATIVE_CONTROL_CONNECTION_REFUSED'));
    try { await expect(runReleasePreflight(path)).rejects.toBeTruthy(); expect(connect).not.toHaveBeenCalled(); }
    finally { connect.mockRestore(); }
  }
  writeFileSync(path, JSON.stringify(target));
  const report = await runReleasePreflight(path);
  expect(report).toMatchObject({ status: 'NEEDS_REVIEW', readOnlyTransaction: true, humanIdentityVerifiedByTool: false });
  expect(report.missingMappingStoreIds).toEqual(STORE_IDS);
  const serialized = JSON.stringify(report);
  for (const secret of [env.dsn, env.storeJwt, env.anonKey]) expect(serialized).not.toContain(secret);
  const forbiddenKeys = new Set(['passcode_hash', 'token_hash', 'receipt_snapshot', 'request_mac', 'connectionString']);
  const inspectKeys = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { expect(forbiddenKeys.has(key)).toBe(false); inspectKeys(child); }
  };
  inspectKeys(report);
  expect(snapshotsEqual(before, await captureSnapshot(db))).toBe(true);
  expect((await collectInventory(db)).catalogHash).toBe(catalog.catalogHash);
  proof.releasePreflight = { rejectedBeforeConnection: 5, discoveryReadOnly: true, fullDataUnchanged: true };
}

export async function verifyPostBackupRecovery() {
  expect(bound).toBe(true);
  const before = await captureSnapshot(db);
  const paths = [0, 1].map(index => {
    const path = join(directory, `owner-${index}.json`);
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, storeId: STORE_IDS[index], ownerId: EMPLOYEE_IDS[index === 0 ? 0 : 3],
      verifiedByRef: 'synthetic:rollback-owner', evidenceRefs: ['synthetic:rollback-fixture'], sourceSnapshotHash: before.hash }));
    return path;
  });
  await activateDatabase({ schemaVersion: 1, mode: 'synthetic-activation', connectionString: env.dsn, database: 'postgres',
    marker: env.marker, storeIds: STORE_IDS, sourceFingerprint: source, bundleHash: activationBundleManifest().sha256, mappingFiles: paths });
  // Explicit synthetic membership for SQL app calls; never used on live.
  await db.query('begin');
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' })]);
  const login = (await db.query('select public.permission_start_session($1,$2) result', [EMPLOYEE_IDS[0], '384729'])).rows[0].result;
  expect(login.ok).toBe(true);
  const token = login.token;
  await db.query('commit');
  // A complete observer snapshot is the logical fixture backup. It is not a
  // claimed pg_dump/PITR recovery rehearsal.
  const backup = await captureSnapshot(db);
  const order = (await db.query("select id,lock_version from public.orders where store_id=$1 and status='open' order by id limit 1", [STORE_IDS[0]])).rows[0];
  expect(order).toBeTruthy();
  const key = randomUUID(), paymentId = randomUUID();
  const payload = { schemaVersion: 1, kind: 'pay_order', orderId: order.id, paymentId, expectedVersion: Number(order.lock_version), method: 'cash', receivedAmount: 50_000 };
  const app = async (name: 'register_write_operation' | 'execute_write_operation') => {
    await db.query('begin');
    try {
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",
        [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' }), JSON.stringify({ 'x-pos-employee-token': token })]);
      const result = (await db.query(`select public.${name}($1::uuid,$2::jsonb) result`, [key, payload])).rows[0].result;
      await db.query('commit'); return result;
    } catch (error) { await db.query('rollback'); throw error; }
  };
  expect((await app('register_write_operation')).operation.status).toBe('pending');
  const applied = await app('execute_write_operation'); expect(applied.operation.status).toBe('applied');
  const financialHash = async () => (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) hash
    from (select 'orders' kind,to_jsonb(o) row from public.orders o union all select 'order_items',to_jsonb(i) from public.order_items i
    union all select 'order_item_options',to_jsonb(i) from public.order_item_options i union all select 'payments',to_jsonb(p) from public.payments p
    union all select 'write_operations',to_jsonb(w) from public.write_operations w union all select 'order_events',to_jsonb(e) from public.order_events e) x`)).rows[0].hash;
  const hashAfterPayment = await financialHash();
  expect(assessPermissionRestore(backup, await captureSnapshot(db), false)).toMatchObject({ reason: 'WRITES_NOT_QUIESCED' });
  // The rehearsal stops all business-table writers with DB locks. An operator
  // must separately stop application traffic before using a live runbook.
  await db.query('begin');
  try {
    await db.query('lock table public.orders,public.order_items,public.order_item_options,public.payments,public.write_operations,public.order_events in share mode');
    const locked = await captureSnapshot(db);
    expect(assessPermissionRestore(backup, locked, true)).toMatchObject({ decision: 'BLOCKED', reason: 'POST_BACKUP_STATE_DIFFERS', next: 'FORWARD_FIX_OR_RECONCILE' });
    expect(assessPermissionRestore(locked, locked, true).decision).toBe('OPERATOR_REVIEW_REQUIRED');
    expect(assessPermissionRestore(JSON.parse(JSON.stringify(locked)), locked, true).decision).toBe('BLOCKED');
    // Reinstall one compatible definition as a targeted forward-fix rehearsal.
    // The original fragment is intentionally one-shot CREATE/DROP DDL and is
    // not a safe repeat migration. pg_get_functiondef yields CREATE OR REPLACE.
    const forwardDefinition = (await db.query("select pg_get_functiondef('private.permission_financial_checkpoint(uuid[])'::regprocedure) definition")).rows[0].definition;
    expect(forwardDefinition).toMatch(/^CREATE OR REPLACE FUNCTION/);
    await db.query(forwardDefinition);
    expect(await financialHash()).toBe(hashAfterPayment);
    expect((await db.query('select count(*)::int n from public.payments where id=$1', [paymentId])).rows[0].n).toBe(1);
    expect((await db.query("select status,result from public.write_operations where operation_id=$1", [key])).rows[0]).toMatchObject({ status: 'applied' });
    const legacy = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('submit_order_changes','pay_order','pay_order_items','void_order')`)).rows;
    for (const row of legacy) expect((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') ok", [row.signature])).rows[0].ok).toBe(false);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)",
      [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' }), JSON.stringify({ 'x-pos-employee-token': token })]);
    expect((await db.query('select public.get_write_capabilities() result')).rows[0].result).toMatchObject({ permissionContractVersion: 2, writeProtocolVersion: 1 });
    const recovered = (await db.query('select public.get_write_operation($1) result', [key])).rows[0].result;
    expect(recovered.operation.status).toBe('applied');
    expect(recovered.operation.result).toEqual(applied.operation.result);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  expect(await financialHash()).toBe(hashAfterPayment);
  proof.postBackup = { paymentPreserved: true, financialRowsAndKAndR1Unchanged: true, staleRestoreBlocked: true, forwardFixApplied: true };
}
