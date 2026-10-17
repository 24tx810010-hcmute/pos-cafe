import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { activateDatabase } from '../../scripts/permission-activate.mjs';
import { activationBundleManifest } from '../../scripts/permission-activation-bundle.mjs';
import { assertBridgeFixture, EMPLOYEE_IDS, parseBridgeEnvironment, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';
import { collectInventory } from '../../scripts/permission-inventory.mjs';
import { discoverLegacyPrimaryId, planMigration } from '../../scripts/permission-migration-plan.mjs';
import { captureSnapshot, permissionFingerprint, snapshotsEqual } from '../../scripts/permission-preflight-core.mjs';
import { prepareCompatibilityHook,verifyCompatibilityRestRouting } from '../../scripts/permission-compatibility-prepare.mjs';

const env = parseBridgeEnvironment();
const directory = mkdtempSync(join(tmpdir(), 'permission-transition-'));
const sourceFingerprint = permissionFingerprint();
const db = new pg.Client({ connectionString: env.dsn, statement_timeout: 60_000, connectionTimeoutMillis: 5_000 });
const K = {
  minus: '50000000-0000-4000-8000-000000000053',
  exact: '50000000-0000-4000-8000-000000000054',
  plus: '50000000-0000-4000-8000-000000000056',
  terminal: '50000000-0000-4000-8000-000000000055',
  absent: '50000000-0000-4000-8000-000000000099',
};
let legacySnapshot: Awaited<ReturnType<typeof captureSnapshot>>;
let financialBefore = '';
let pendingPayload: Record<string, unknown>;
let terminalBefore: Record<string, unknown>;
let legacyToken = '';
const manualPrimary = discoverLegacyPrimaryId(STORE_IDS[0]);
const inactiveAdmin = '20000000-0000-4000-8000-000000000006';

async function financialHash() {
  return (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) hash
    from (select 'orders' kind,to_jsonb(o) row from public.orders o union all select 'order_items',to_jsonb(i) from public.order_items i
    union all select 'order_item_options',to_jsonb(i) from public.order_item_options i union all select 'payments',to_jsonb(p) from public.payments p
    union all select 'write_operations',to_jsonb(w) from public.write_operations w union all select 'order_events',to_jsonb(e) from public.order_events e) x`)).rows[0].hash;
}
async function businessEffectHash() {
  return (await db.query(`select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) hash
    from (select 'orders' kind,to_jsonb(o) row from public.orders o union all select 'order_items',to_jsonb(i) from public.order_items i
    union all select 'order_item_options',to_jsonb(i) from public.order_item_options i union all select 'payments',to_jsonb(p) from public.payments p
    union all select 'order_events',to_jsonb(e) from public.order_events e) x`)).rows[0].hash;
}

async function app(token: string, sql: string, values: unknown[] = [], storeId = STORE_IDS[0]) {
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)", [
      JSON.stringify({ sub: storeId, role: 'authenticated' }), JSON.stringify({ 'x-pos-employee-token': token }),
    ]);
    const result = await db.query(sql, values);
    await db.query('commit');
    return result.rows[0]?.result;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

async function start(employeeId = EMPLOYEE_IDS[0], pin = '384729', storeId = STORE_IDS[0]) {
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: storeId, role: 'authenticated' })]);
    const result = (await db.query('select public.permission_start_session($1,$2) result', [employeeId, pin])).rows[0].result;
    await db.query('commit');
    expect(result.ok).toBe(true);
    return result.token as string;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

beforeAll(async () => {
  await db.connect();
  await assertBridgeFixture(db, env, 'legacy');
  await prepareCompatibilityHook(db);await verifyCompatibilityRestRouting({restUrl:env.api+'/rest/v1',anonKey:env.anonKey});
  await db.query(`insert into public.employees(id,store_id,name,role,is_active,passcode_hash,permission_overrides,created_at)
    values($1,$2,'Primary verified','admin',true,extensions.crypt('384729',extensions.gen_salt('bf')),null,'2026-01-01T00:00:00Z'),
      ($3,$4,'Inactive legacy admin','admin',false,extensions.crypt('384729',extensions.gen_salt('bf')),null,'2026-01-01T00:00:00Z')`,
  [manualPrimary, STORE_IDS[0], inactiveAdmin, STORE_IDS[1]]);
  await db.query("update public.employees set permission_overrides=$2 where id=$1", [EMPLOYEE_IDS[2], { grants: ['order.voidPaid'], denies: ['payment.take'] }]);
  await db.query("update public.employees set created_at=case id when $1 then '2026-01-02T00:00:00Z'::timestamptz when $2 then '2026-01-03T00:00:00Z'::timestamptz else created_at end where id=any($3::uuid[])",
  [EMPLOYEE_IDS[3], EMPLOYEE_IDS[4], [EMPLOYEE_IDS[3], EMPLOYEE_IDS[4]]]);
  legacySnapshot = await captureSnapshot(db);
  financialBefore = await financialHash();
  const open = (await db.query("select id,lock_version,total from public.orders where store_id=$1 and status='open' order by id limit 1", [STORE_IDS[0]])).rows[0];
  expect(open).toBeTruthy();
  pendingPayload = { schemaVersion: 1, kind: 'pay_order', orderId: open.id, paymentId: randomUUID(), expectedVersion: Number(open.lock_version), method: 'cash', receivedAmount: Number(open.total) };
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: STORE_IDS[0], role: 'authenticated' })]);
    const session = (await db.query("select public.start_employee_session($1,'384729') result", [EMPLOYEE_IDS[0]])).rows[0].result;
    expect(session.ok).toBe(true); legacyToken = session.token;
    await db.query("select set_config('request.headers',$1,true)", [JSON.stringify({ 'x-pos-employee-token': legacyToken })]);
    for (const key of [K.minus, K.exact, K.plus])
      expect((await db.query('select public.register_write_operation($1,$2) result', [key, pendingPayload])).rows[0].result.operation)
        .toMatchObject({ operationId: key, status: 'pending', payload: pendingPayload });
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
  terminalBefore = (await db.query("select to_jsonb(w) row from public.write_operations w where store_id=$1 and status='applied' order by registered_at limit 1", [STORE_IDS[0]])).rows[0]?.row;
  expect(terminalBefore).toBeTruthy();
  legacySnapshot = await captureSnapshot(db);
  financialBefore = await financialHash();
});

afterAll(async () => { await db.end(); });

test('TC-PERM-48 transition maps approved primary owners and preserves legacy identity, overrides, K and R1', async () => {
  const employeesBefore = (await db.query('select id,store_id,role::text role,is_active,permission_overrides from public.employees order by id')).rows;
  const migrationEmployees = (await db.query(`select id,store_id as "storeId",name,role::text,"is_active" as "isActive",
    to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",permission_overrides as "permissionOverrides"
    from public.employees order by id`)).rows;
  const stores = (await db.query('select id,name from public.stores order by id')).rows;
  const paths = [0, 1].map(index => {
    const path = join(directory, `owner-${index}.json`);
    writeFileSync(path, JSON.stringify({ schemaVersion: 1, storeId: STORE_IDS[index], ownerId: index === 0 ? manualPrimary : EMPLOYEE_IDS[3],
      verifiedByRef: `synthetic:approved-${index === 0 ? 'primary' : 'earliest-fallback'}`, evidenceRefs: ['synthetic:transition-fixture'], sourceSnapshotHash: legacySnapshot.hash }));
    return path;
  });
  const activation = { schemaVersion: 1 as const, mode: 'synthetic-activation' as const, connectionString: env.dsn, database: 'postgres', marker: env.marker,
    storeIds: STORE_IDS, sourceFingerprint, bundleHash: activationBundleManifest().sha256, mappingFiles: paths };
  const mappings = paths.map(path => JSON.parse(readFileSync(path, 'utf8')));
  const discoveredPlan = planMigration({ stores, employees: migrationEmployees, mappings: [], snapshotHash: legacySnapshot.hash });
  expect(discoveredPlan.stores[0]).toMatchObject({ candidateOwnerId: manualPrimary, provenance: { source: 'deterministic-primary-discovery' } });
  expect(discoveredPlan.stores[0].blockers).toContainEqual(expect.objectContaining({ reason: 'UNVERIFIED_PRIMARY', targetId: manualPrimary }));
  expect(discoveredPlan.stores[1]).toMatchObject({ status: 'READY', candidateOwnerId: EMPLOYEE_IDS[3], provenance: { source: 'earliest-active-admin' } });
  const approvedPlan = planMigration({ stores, employees: migrationEmployees, mappings, snapshotHash: legacySnapshot.hash });
  expect(approvedPlan.status).toBe('READY');
  expect(approvedPlan.stores.map(store => [store.storeId, store.candidateOwnerId, store.provenance.source])).toEqual([
    [STORE_IDS[0], manualPrimary, 'supplied-mapping'], [STORE_IDS[1], EMPLOYEE_IDS[3], 'supplied-mapping'],
  ]);
  const cashier = approvedPlan.stores[0].normalizedOverrides.find(row => row.employeeId === EMPLOYEE_IDS[2]);
  const cashierDiff = approvedPlan.stores[0].diff.find(row => row.employeeId === EMPLOYEE_IDS[2]);
  expect(cashier).toEqual({ employeeId: EMPLOYEE_IDS[2], valid: true, overrides: { grants: ['order.voidPaid'], denies: ['payment.take'] } });
  expect(cashierDiff).toMatchObject({ added: ['receipt.reprint'], removed: [] });

  const rollbackSnapshot = async () => ({ snapshot: await captureSnapshot(db), catalogHash: (await collectInventory(db)).catalogHash });
  const expectUnchanged = async (before: Awaited<ReturnType<typeof rollbackSnapshot>>) => {
    expect(snapshotsEqual(before.snapshot, await captureSnapshot(db))).toBe(true);
    expect((await collectInventory(db)).catalogHash).toBe(before.catalogHash);
  };
  const readyBefore = await rollbackSnapshot();
  await expect(activateDatabase({ ...activation, mappingFiles: paths.slice(0, 1) })).rejects.toMatchObject({ code: 'LOCKED_MAPPING_RECHECK_FAILED' });
  await expectUnchanged(readyBefore);
  await expect(activateDatabase(activation, { failAfterFragment: 3 })).rejects.toMatchObject({ code: 'SYNTHETIC_FRAGMENT_FAULT' });
  await expectUnchanged(readyBefore);

  await db.query('update public.employees set is_active=false where store_id=$1 and role=\'admin\'', [STORE_IDS[1]]);
  const blocked = await rollbackSnapshot();
  const blockedPath = join(directory, 'blocked-primary-only.json');
  writeFileSync(blockedPath, JSON.stringify({ ...mappings[0], sourceSnapshotHash: blocked.snapshot.hash }));
  await expect(activateDatabase({ ...activation, mappingFiles: [blockedPath] })).rejects.toMatchObject({ code: 'OWNER_MIGRATION_REVIEW_REQUIRED' });
  await expectUnchanged(blocked);
  await db.query('update public.employees set is_active=true where id=any($1::uuid[])', [[EMPLOYEE_IDS[3], EMPLOYEE_IDS[4]]]);
  legacySnapshot = await captureSnapshot(db);
  paths.forEach((path, index) => writeFileSync(path, JSON.stringify({ ...mappings[index], sourceSnapshotHash: legacySnapshot.hash })));
  expect((await collectInventory(db)).catalogHash).toBe(readyBefore.catalogHash);
  const result = await activateDatabase(activation);
  expect(result).toMatchObject({ status: 'ACTIVATED', legacyEnumTeardown: 'COMPLETE', legacyEnumDependencies: 0 });
  const employeesAfter = (await db.query('select id,store_id,role,is_active,permission_overrides from public.employees order by id')).rows;
  expect(employeesAfter.map(row => row.id)).toEqual(employeesBefore.map(row => row.id));
  expect(employeesAfter.filter(row => row.role === 'owner' && row.is_active).map(row => row.id).sort()).toEqual([manualPrimary, EMPLOYEE_IDS[3]].sort());
  for (const before of employeesBefore) {
    const after = employeesAfter.find(row => row.id === before.id)!;
    expect(after.is_active).toBe(before.is_active);
    expect(after.permission_overrides).toEqual(before.permission_overrides);
    expect(after.role).toBe(before.role === 'admin' ? ([manualPrimary, EMPLOYEE_IDS[3]].includes(before.id) ? 'owner' : 'manager') : before.role);
  }
  expect((await db.query('select count(*)::int count from public.permission_catalog')).rows[0].count).toBe(15);
  expect(await financialHash()).toBe(financialBefore);
});

test('TC-PERM-51 server activation is all-or-nothing, closes legacy grants and preserves candidate session access', async () => {
  expect((await db.query("select to_regtype('public.employee_role') legacy_enum,to_regprocedure('public.verify_employee_pin(uuid,text)') legacy_login")).rows[0])
    .toEqual({ legacy_enum: null, legacy_login: null });
  const legacy = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('submit_order_changes','pay_order','pay_order_items','void_order')`)).rows;
  for (const row of legacy) expect((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') allowed", [row.signature])).rows[0].allowed).toBe(false);
  expect(await app(legacyToken, 'select public.permission_get_authority() result')).toMatchObject({ ok: true, data: { snapshot: { employeeId: EMPLOYEE_IDS[0] } } });
  const token = await start();
  expect(await app(token, 'select public.get_write_capabilities() result')).toMatchObject({ permissionContractVersion: 2, writeProtocolVersion: 1 });
  const authority = await app(token, 'select public.permission_get_authority() result');
  expect(authority).toMatchObject({ ok: true, data: { snapshot: { employeeId: EMPLOYEE_IDS[0], role: 'manager' } } });
  expect((await db.query("select count(*)::int count from public.employees where role='owner' and is_active group by store_id order by store_id")).rows.map(row => row.count)).toEqual([1, 1]);
});

test('TC-PERM-52 candidate bootstrap is atomic, replays without replacing owner or PIN, and rolls back owner faults', async () => {
  const storeId = '10000000-0000-4000-8000-000000000003';
  const ownerId = '20000000-0000-4000-8000-000000000201';
  await db.query('begin');
  try {
    await db.query("insert into auth.users(id,email) values($1,'store101@store.pos.local')", [storeId]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: storeId, role: 'authenticated' })]);
    await db.query('set local role authenticated');
    const request = { requestId: '60000000-0000-4000-8000-000000000052', ownerId, storeNo: 101, displayName: ' Cà phê An ', address: '', seedDemo: false };
    const call = async (value: object) => (await db.query('select public.permission_bootstrap_store($1) result', [value])).rows[0].result;
    expect(await call({ ...request, pin: '111111' })).toMatchObject({ error: { code: 'INVALID_WRITE_REQUEST' } });
    expect(await call(request)).toMatchObject({ ok: true, outcome: 'applied', data: { storeId, ownerId, storeNo: 101 } });
    expect(await call(request)).toMatchObject({ ok: true, outcome: 'replayed', data: { storeId, ownerId } });
    expect(await call({ ...request, ownerId: randomUUID() })).toMatchObject({ error: { code: 'BOOTSTRAP_CONFLICT' } });
    await db.query('reset role');
    expect((await db.query("select role,is_active,passcode_hash=extensions.crypt('123456',passcode_hash) initial_pin from public.employees where store_id=$1", [storeId])).rows)
      .toEqual([{ role: 'owner', is_active: true, initial_pin: true }]);
  } finally { await db.query('rollback'); }

  const faultStore = randomUUID();
  await db.query('begin');
  try {
    await db.query("insert into auth.users(id,email) values($1,'store102@store.pos.local')", [faultStore]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: faultStore, role: 'authenticated' })]);
    await db.query("create function private.transition_owner_fault() returns trigger language plpgsql as $$ begin raise exception 'synthetic owner fault'; end $$; create trigger transition_owner_fault before insert on public.employees for each row execute function private.transition_owner_fault()");
    await db.query('set local role authenticated');
    const result = (await db.query('select public.permission_bootstrap_store($1) result', [{ requestId: randomUUID(), ownerId: randomUUID(), storeNo: 102, displayName: 'Fault', address: '', seedDemo: false }])).rows[0].result;
    expect(result).toMatchObject({ error: { code: 'PERMISSION_UPDATE_UNAVAILABLE' } });
    await db.query('reset role');
    expect((await db.query('select count(*)::int count from public.stores where id=$1', [faultStore])).rows[0].count).toBe(0);
  } finally { await db.query('rollback'); }
});

test('TC-PERM-54 pre-migration K observes TTL, payload identity, tenant hiding and immutable terminal R1', async () => {
  let token = await start();
  const pending = await app(token, 'select public.get_write_operation($1) result', [K.minus]);
  const exactPending = await app(token, 'select public.get_write_operation($1) result', [K.exact]);
  const plusPending = await app(token, 'select public.get_write_operation($1) result', [K.plus]);
  expect(pending.operation).toMatchObject({ operationId: K.minus, status: 'pending', payload: pendingPayload });
  const originalClock = (await db.query("select pg_get_functiondef('private.write_clock()'::regprocedure) definition")).rows[0].definition;
  await db.query('create table private.transition_write_clock(moment timestamptz not null)');
  await db.query('insert into private.transition_write_clock values($1::timestamptz-interval \'1 millisecond\')', [pending.operation.expiresAt]);
  await db.query("create or replace function private.write_clock() returns timestamptz language sql volatile set search_path=pg_catalog as $$select moment from private.transition_write_clock$$");
  try {
    token = await start();
    expect(await app(token, 'select public.get_write_operation($1) result', [K.minus])).toMatchObject({ operation: { status: 'pending' } });
    await db.query('update private.transition_write_clock set moment=$1', [exactPending.operation.expiresAt]);
    token = await start();
    const expired = await app(token, 'select public.execute_write_operation($1,$2) result', [K.exact, pendingPayload]);
    expect(expired).toMatchObject({ operation: { operationId: K.exact, status: 'expired' } });
    expect((await db.query('select status from public.write_operations where operation_id=$1', [K.exact])).rows[0].status).toBe('expired');
    await db.query("update private.transition_write_clock set moment=$1::timestamptz+interval '1 millisecond'", [plusPending.operation.expiresAt]);
    token = await start();
    expect(await app(token, 'select public.cancel_write_operation($1) result', [K.plus])).toMatchObject({ operation: { operationId: K.plus, status: 'expired' } });
  } finally {
    await db.query(originalClock);
    await db.query('drop table if exists private.transition_write_clock');
  }
  expect((await db.query('select status from public.orders where id=$1', [pendingPayload.orderId])).rows[0].status).toBe('open');
  const mismatched = { ...pendingPayload, receivedAmount: Number(pendingPayload.receivedAmount) + 1 };
  expect(await app(token, 'select public.execute_write_operation($1,$2) result', [K.exact, mismatched])).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  const financialBeforeReplay = await businessEffectHash();
  const terminal = await app(token, 'select public.get_write_operation($1) result', [terminalBefore.operation_id]);
  expect(terminal.operation).toMatchObject({ status: 'applied', payload: terminalBefore.payload, result: terminalBefore.result });
  expect(await app(token, 'select public.execute_write_operation($1,$2) result', [terminalBefore.operation_id, terminalBefore.payload]))
    .toMatchObject({ operation: { status: 'applied', result: terminalBefore.result } });
  const terminalAfter = (await db.query('select to_jsonb(w) row from public.write_operations w where operation_id=$1', [terminalBefore.operation_id])).rows[0].row;
  expect({ payload: terminalAfter.payload, result: terminalAfter.result, initiated: terminalAfter.initiated_by_employee_id, executed: terminalAfter.executed_by_employee_id })
    .toEqual({ payload: terminalBefore.payload, result: terminalBefore.result, initiated: terminalBefore.initiated_by_employee_id, executed: terminalBefore.executed_by_employee_id });
  const foreign = (await db.query('select operation_id from public.write_operations where store_id=$1 order by operation_id limit 1', [STORE_IDS[1]])).rows[0].operation_id;
  for (const key of [K.absent, foreign]) {
    expect(await app(token, 'select public.get_write_operation($1) result', [key])).toMatchObject({ error: { code: 'OPERATION_NOT_FOUND' } });
    expect(await app(token, 'select public.cancel_write_operation($1) result', [key])).toMatchObject({ error: { code: 'OPERATION_NOT_FOUND' } });
  }
  expect(await businessEffectHash()).toBe(financialBeforeReplay);
});
