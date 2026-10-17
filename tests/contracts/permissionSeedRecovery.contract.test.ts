import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { observeCandidateStage } from './permissionStageObservation';
import { createSupabasePorts } from '../../src/adapters/supabase/repos';
import { deterministicUuid } from '../../src/adapters/supabase/deterministicId';
import { createStoreForSession, loadStoreSession, pairStoreForSession, retrySeedForSession } from '../../src/features/session/sessionFlow';
import { assertBridgeFixture, parseBridgeEnvironment, runtimeProof, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';

const env = parseBridgeEnvironment();
const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 60_000 });
const faultFunction = 'private.tc52_seed_failure';
let testClient: ReturnType<typeof createClient> | undefined;
let ownedStoreId: string | undefined;
let originalSequence: { last_value: string; is_called: boolean } | undefined;
let fixtureVerified = false;

beforeAll(async () => {
  await db.connect();
  await assertBridgeFixture(db, env, 'bridge');
  fixtureVerified = true;
  await observeCandidateStage(db);
});

afterAll(async () => {
  if (!fixtureVerified) {
    await db.end();
    return;
  }
  try {
    runtimeProof();
    const authenticated = testClient ? (await testClient.auth.getUser()).data.user : null;
    if (authenticated && ownedStoreId && authenticated.id !== ownedStoreId) throw new Error('TC52_OWNED_IDENTITY_MISMATCH');
    ownedStoreId ??= authenticated?.id;

    await db.query('begin');
    const marker = (await db.query('select marker from private.idempotency_test_environment where singleton')).rows;
    if (marker.length !== 1 || marker[0].marker !== env.marker) throw new Error('TC52_FIXTURE_MARKER_MISMATCH');
    await db.query('drop trigger if exists tc52_seed_failure on public.categories; drop function if exists private.tc52_seed_failure()');

    const candidate = (await db.query(`select s.id,u.email from public.stores s join auth.users u on u.id=s.id
      where s.store_no=101 and u.email='store101@store.pos.local'`)).rows;
    if (candidate.length > 1 || (candidate[0] && ownedStoreId && candidate[0].id !== ownedStoreId)) throw new Error('TC52_PROVISIONED_IDENTITY_AMBIGUOUS');
    ownedStoreId ??= candidate[0]?.id;
    const allowedStores = [...STORE_IDS, ...(candidate[0] ? [candidate[0].id] : [])].sort();
    const allowedUsers = [...STORE_IDS, ...(ownedStoreId ? [ownedStoreId] : [])].sort();
    const stores = (await db.query('select id from public.stores order by id')).rows.map(row => row.id).sort();
    const users = (await db.query('select id from auth.users order by id')).rows.map(row => row.id).sort();
    if (JSON.stringify(stores) !== JSON.stringify(allowedStores) || JSON.stringify(users) !== JSON.stringify(allowedUsers)) {
      throw new Error('TC52_FIXTURE_SCOPE_CHANGED');
    }
    if (ownedStoreId) {
      for (const table of ['bootstrap_requests', 'employee_admin_requests', 'employee_sessions', 'menu_image_assets', 'menu_image_uploads']) {
        await db.query(`delete from private.${table} where store_id=$1`, [ownedStoreId]);
      }
      await db.query('delete from public.employee_admin_audit where store_id=$1; ', [ownedStoreId]);
      await db.query('delete from public.store_change_signals where store_id=$1', [ownedStoreId]);
      await db.query('delete from private.initial_seed_workflows where store_id=$1', [ownedStoreId]);
      await db.query('delete from private.store_no_reservations where store_no=101');
      const removed = await db.query("delete from auth.users where id=$1 and email='store101@store.pos.local' returning id", [ownedStoreId]);
      if (removed.rowCount !== 1) throw new Error('TC52_OWNED_AUTH_CLEANUP_FAILED');
    }
    if (originalSequence) await db.query("select setval('public.store_no_seq',$1::bigint,$2::boolean)", [originalSequence.last_value, originalSequence.is_called]);
    const remainingStores = (await db.query('select id from public.stores order by id')).rows.map(row => row.id);
    const remainingUsers = (await db.query('select id from auth.users order by id')).rows.map(row => row.id);
    if (JSON.stringify(remainingStores) !== JSON.stringify(STORE_IDS) || JSON.stringify(remainingUsers) !== JSON.stringify(STORE_IDS)) {
      throw new Error('TC52_FIXTURE_RESTORE_FAILED');
    }
    await db.query('commit');
  } catch (error) {
    await db.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
});

test('TC-PERM-52 onboarding flow preserves Store Key, owner and changed PIN when demo seed fails then retries seed only', async () => {
  // The bridge fixture preloads store_no 1 and 2 with explicit values, so move its
  // sequence to the test plan's S-new boundary before exercising real provisioning.
  originalSequence = (await db.query('select last_value::text,is_called from public.store_no_seq')).rows[0];
  await db.query("select setval('public.store_no_seq', 100, true)");
  await db.query(`create function ${faultFunction}() returns trigger language plpgsql as $$ begin raise exception 'synthetic seed fault'; end $$;
    create trigger tc52_seed_failure before insert on public.categories for each row when (new.seed_key is not null)
    execute function ${faultFunction}()`);

  const client = testClient = createClient(env.api, env.anonKey, {
    global: { headers: { 'x-pos-permission-contract': '2' } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const ports = createSupabasePorts(client, env.api);
  const created = await createStoreForSession(ports, { displayName: ' Cà phê Seed Recovery ', address: '', seedDemo: true });
  ownedStoreId = created.store.storeId;
  expect(created.store).toMatchObject({ seedStatus: 'pending', canRetrySeed: false, adminPin: '123456' });
  expect(created.store.storeNo).toBe(101);
  expect(created.store.storeKey).toMatch(/^\d{4}-[A-Z0-9]{8}$/);
  expect(created.session).toEqual({ storeId: created.store.storeId, storeNo: created.store.storeNo });

  const ownerId = await deterministicUuid(created.store.storeId, 'owner.primary');
  const persisted = (await db.query(`select s.id,s.store_no,s.seed_status,ss.display_name,e.id owner_id,e.role,e.is_active,
      e.passcode_hash=extensions.crypt('123456',e.passcode_hash) initial_pin
    from public.stores s join public.store_settings ss on ss.store_id=s.id
    join public.employees e on e.store_id=s.id and e.role='owner' where s.id=$1`, [created.store.storeId])).rows;
  expect(persisted).toEqual([{ id: created.store.storeId, store_no: created.store.storeNo, seed_status: 'pending',
    display_name: 'Cà phê Seed Recovery', owner_id: ownerId, role: 'owner', is_active: true, initial_pin: true }]);
  expect((await db.query('select count(*)::int count from auth.users where id=$1', [created.store.storeId])).rows[0].count).toBe(1);
  expect((await db.query("select count(*)::int count from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [created.store.storeId])).rows[0].count).toBe(0);

  const initialSession = await ports.permission!.session.startSession(ownerId, created.store.adminPin);
  expect(initialSession.kind).toBe('required_pin_change');
  if (initialSession.kind !== 'required_pin_change') throw new Error('EXPECTED_REQUIRED_PIN_SESSION');
  await expect(ports.permission.initialSeed.getStatus()).rejects.toMatchObject({ code: 'PIN_CHANGE_REQUIRED' });
  const changed = await ports.permission!.session.completeRequiredPinChange({ requestId: randomUUID(),
    expectedRevision: initialSession.employeeRevision, newPin: '654321' });
  expect(changed).toMatchObject({ outcome: 'applied', credentialChanged: true });
  await ports.permission!.session.startSession(ownerId, '654321');

  await expect(ports.seed.seedDemo(created.store.storeId)).rejects.toMatchObject({ code: 'PERMISSION_UPDATE_UNAVAILABLE' });
  const partial = await ports.permission.initialSeed.getStatus();
  expect(partial.status).toBe('needs_retry');
  expect(partial.stages.map(s => [s.stage, s.status])).toEqual([['employee', 'committed'], ['menu', 'pending'], ['floor', 'pending']]);
  const cashier = (await db.query("select id,permission_revision from public.employees where store_id=$1 and seed_key='demo.employee.demo-emp-cashier'", [created.store.storeId])).rows[0];
  expect(await ports.permission.employeeAdmin.resetPin({ requestId: randomUUID(), targetId: cashier.id,
    expectedRevision: Number(cashier.permission_revision), newPin: '558899' })).toMatchObject({ ok: true, outcome: 'applied' });
  await db.query('drop trigger tc52_seed_failure on public.categories; drop function private.tc52_seed_failure()');

  const loaded = await loadStoreSession(ports);
  expect(loaded).toEqual({ status: 'paired', session: created.session });
  const rpcSpy = vi.spyOn(client, 'rpc');
  await retrySeedForSession(ports, loaded.status === 'paired' ? loaded.session : created.session);
  const retryRpcNames = rpcSpy.mock.calls.map(call => call[0]);
  expect(retryRpcNames).toEqual(['permission_get_initial_seed_status', 'permission_begin_initial_seed', 'permission_run_initial_seed_stage', 'permission_run_initial_seed_stage']);
  expect(rpcSpy.mock.calls.filter(call => call[0] === 'permission_run_initial_seed_stage').map(call => (call[1] as any).p_request.stage)).toEqual(['menu', 'floor']);
  expect(retryRpcNames).not.toContain('permission_bootstrap_store');

  expect((await db.query("select seed_status from public.stores where id=$1", [created.store.storeId])).rows[0].seed_status).toBe('seeded');
  expect((await db.query("select count(*)::int owners,bool_and(passcode_hash=extensions.crypt('654321',passcode_hash)) pin_preserved from public.employees where store_id=$1 and role='owner'", [created.store.storeId])).rows[0])
    .toEqual({ owners: 1, pin_preserved: true });
  expect((await db.query("select passcode_hash=extensions.crypt('558899',passcode_hash) preserved from public.employees where id=$1", [cashier.id])).rows[0].preserved).toBe(true);
  await expect(ports.permission!.session.startSession(ownerId, created.store.adminPin)).rejects.toMatchObject({ code: 'INVALID_PIN' });
  await expect(ports.permission!.session.startSession(ownerId, '654321')).resolves.toMatchObject({ authority: { snapshot: { employeeId: ownerId, role: 'owner' } } });

  const secondClient = createClient(env.api, env.anonKey, {
    global: { headers: { 'x-pos-permission-contract': '2' } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const secondPorts = createSupabasePorts(secondClient, env.api);
  await expect(pairStoreForSession(secondPorts, created.store.storeKey)).resolves.toEqual(created.session);
  expect((await db.query('select count(*)::int count from public.employees where store_id=$1 and role=\'owner\'', [created.store.storeId])).rows[0].count).toBe(1);
});
