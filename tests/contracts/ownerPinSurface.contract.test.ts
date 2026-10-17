import { afterAll, beforeAll, expect, test } from "vitest";
import { actor, cleanupSurfaceFixture, db, EMPLOYEE_IDS as E, readRelations, setupSurfaceFixture, surfacePhase, surfaceSnapshot } from "./ownerPinSurfaceFixture";
import { ownerPinProtectedRoutes } from "./ownerPinProtectedRoutes";
import { probeRestrictedDenial } from "./ownerPinSurfaceOracle";

// A restricted credential is sent directly to each public business RPC. This
// inventory is compared with actual EXECUTE grants so a new route cannot bypass
// this test by being omitted from a hand-maintained list.
const routes = ownerPinProtectedRoutes(E[1]);
const nonBusinessRoutes = [
  // Activated strict-contract2 removes both this pure legacy helper and its enum.
  // The activated fixture guard requires their absence before using this profile.
  ...(surfacePhase === "legacy" ? ["has_employee_permission(employee_role,jsonb,text)"] : []),
  // Activated compatibility metadata: an inert probe and the contract hook.
  // Their actual outputs and lack of row/catalog effects are checked below.
  ...(surfacePhase === "activated-candidate" ? ["permission_contract_probe()", "permission_contract_pre_request()"] : []),
  "set_updated_at()", // Trigger-only function; PostgreSQL rejects direct RPC invocation.
  "permission_fixture_identity()", // Isolated fixture only; cannot exist in release.
  "permission_get_contract()", "permission_get_store_session()", "permission_list_roster()",
  "permission_start_session(uuid,text)", "permission_revoke_session()",
  "permission_check_required_pin_session()", "permission_complete_required_pin_change(jsonb)",
  "permission_reserve_store_no(uuid)", "permission_bootstrap_store(jsonb)",
];
let prepared = false;
let before: string;
const evidenceTables = [...readRelations.map(name => `public.${name}`),
  "private.employee_admin_requests", "private.initial_seed_workflows", "private.initial_seed_stages",
  "private.menu_image_assets", "private.menu_image_uploads", "private.initial_receipt_print_grants"];
async function fingerprint() {
  return surfaceSnapshot(); // Observe all fixture/evidence rows and catalog effects before rollback.
}

beforeAll(async () => {
  await setupSurfaceFixture();
  if (surfacePhase === "activated-candidate")
    await db.query("update public.employees set passcode_hash=extensions.crypt('384729',extensions.gen_salt('bf')) where id=$1", [E[0]]);
  await db.query("update public.employees set pin_change_required=true where id=$1", [E[0]]);
  await actor(db);
  const session = (await db.query("select public.permission_start_session($1,'384729') result", [E[0]])).rows[0].result;
  expect(session?.kind === "required_pin_change" && typeof session.token === "string").toBe(true);
  await actor(db, session.token);
  before = await fingerprint();
  prepared = true;
}, 120_000);

afterAll(async () => {
  await cleanupSurfaceFixture();
}, 120_000);

test("TC-PIN-03 the protected-route matrix covers every authenticated public RPC", async () => {
  expect(prepared).toBe(true);
  const actual = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p
    where p.pronamespace='public'::regnamespace and has_function_privilege('authenticated',p.oid,'EXECUTE') order by 1`))
    .rows.map(row => row.signature.replace(/^public\./, "")).sort();
  const expected = [...routes.map(route => route.signature), ...nonBusinessRoutes].sort();
  expect(actual, JSON.stringify({ unclassified: actual.filter(name => !expected.includes(name)),
    missing: expected.filter(name => !actual.includes(name)) })).toEqual(expected);
  if (surfacePhase === "activated-candidate") {
    const initial = await fingerprint();
    await db.query("savepoint contract_metadata");
    try {
      await db.query(`select set_config('request.headers',
        (coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)
        ||'{"x-pos-permission-contract":"2"}'::jsonb)::text,true),
        set_config('request.path','/rpc/permission_contract_probe',true),
        set_config('response.headers','[]',true)`);
      await db.query("set local role authenticated");
      expect((await db.query("select public.permission_contract_probe() result")).rows[0].result === true).toBe(true);
      await db.query("select public.permission_contract_pre_request()");
      expect((await db.query(`select current_setting('response.headers',true)::jsonb
        @> '[{"X-Pos-Permission-Hook":"strict"}]'::jsonb strict`)).rows[0].strict === true).toBe(true);
      expect(await fingerprint() === initial).toBe(true);
    } finally {
      await db.query("rollback to savepoint contract_metadata");
      await db.query("release savepoint contract_metadata");
    }
  }
});

test.each(routes)("TC-PIN-03 restricted credential denies $signature", async route => {
  const match = /^([a-z_]+)\((.*)\)$/.exec(route.signature)!;
  const types = match[2] ? match[2].split(",") : [];
  const placeholders = types.map((type, index) => `$${index + 1}::${type}`).join(",");
  await db.query("savepoint restricted_route");
  await probeRestrictedDenial({
    readSnapshot: fingerprint,
    invoke: async () => {
      await db.query("set local role authenticated");
      return (await db.query(`select public.${match[1]}(${placeholders}) result`, route.args)).rows[0].result;
    },
    cleanup: async () => {
      await db.query("rollback to savepoint restricted_route");
      await db.query("release savepoint restricted_route");
    },
  });
});

test("TC-PIN-03 the oracle catches a real SQL mutation plus denial before rollback", async () => {
  const initial = await fingerprint();
  await db.query("savepoint restricted_route");
  const mutationProbe = probeRestrictedDenial({
    readSnapshot: fingerprint,
    invoke: async () => {
      // Test-only observer negative control: no production route/grant is changed.
      await db.query("update public.employees set name=name||' oracle-negative-control' where id=$1", [E[0]]);
      return { ok: false, error: { code: "PIN_CHANGE_REQUIRED" } };
    },
    cleanup: async () => {
      await db.query("rollback to savepoint restricted_route");
      await db.query("release savepoint restricted_route");
    },
  });
  await expect(mutationProbe).rejects.toThrow("PIN_RESTRICTED_ROUTE_MUTATION");
  expect(await fingerprint() === initial).toBe(true); // Cleanup restored the state that previously concealed the defect.
});

test("TC-PIN-03 the oracle detects arbitrary-precision JSONB mutation", async () => {
  await db.query("savepoint oracle_control_fixture");
  try {
    await db.query("create table public.permission_pin_oracle_control(value jsonb,label varchar(20))");
    await db.query(`insert into public.permission_pin_oracle_control values ('{"n":1}'::jsonb,'control')`);
    const initial = await fingerprint();
    await db.query("savepoint restricted_route");
    await expect(probeRestrictedDenial({
      readSnapshot: fingerprint,
      invoke: async () => {
        await db.query(`update public.permission_pin_oracle_control set value='{"n":1.00000000000000001}'::jsonb`);
        return { ok: false, error: { code: "PIN_CHANGE_REQUIRED" } };
      },
      cleanup: async () => { await db.query("rollback to savepoint restricted_route"); await db.query("release savepoint restricted_route"); },
    })).rejects.toThrow("PIN_RESTRICTED_ROUTE_MUTATION");
    expect(await fingerprint() === initial).toBe(true);
  } finally { await db.query("rollback to savepoint oracle_control_fixture"); await db.query("release savepoint oracle_control_fixture"); }
});

test("TC-PIN-03 the oracle detects logical catalog mutations before rollback", async () => {
  await db.query("savepoint oracle_control_fixture");
  try {
    await db.query("create table public.permission_pin_oracle_control(value jsonb,label varchar(20))");
    await db.query("create index permission_pin_oracle_control_idx on public.permission_pin_oracle_control(label)");
    await db.query("create policy oracle_control_policy on public.permission_pin_oracle_control for select to authenticated using (true)");
    const changes = [
      "alter table public.permission_pin_oracle_control replica identity full",
      "alter table public.permission_pin_oracle_control set (fillfactor=70)",
      "alter table public.permission_pin_oracle_control alter column label type varchar(30)",
      "drop index public.permission_pin_oracle_control_idx; create index permission_pin_oracle_control_idx on public.permission_pin_oracle_control(value)",
      "drop policy oracle_control_policy on public.permission_pin_oracle_control; create policy oracle_control_policy on public.permission_pin_oracle_control as restrictive for select to authenticated using (true)",
    ];
    for (const sql of changes) {
      const initial = await fingerprint();
      await db.query("savepoint restricted_route");
      await expect(probeRestrictedDenial({
        readSnapshot: fingerprint,
        invoke: async () => { await db.query(sql); return { ok: false, error: { code: "PIN_CHANGE_REQUIRED" } }; },
        cleanup: async () => { await db.query("rollback to savepoint restricted_route"); await db.query("release savepoint restricted_route"); },
      })).rejects.toThrow("PIN_RESTRICTED_ROUTE_MUTATION");
      expect(await fingerprint() === initial).toBe(true);
    }
  } finally { await db.query("rollback to savepoint oracle_control_fixture"); await db.query("release savepoint oracle_control_fixture"); }
});

test("TC-PIN-03 restricted access has no raw-table bypass or business/evidence effects", async () => {
  expect(await fingerprint() === before).toBe(true);
  for (const table of evidenceTables) {
    expect((await db.query(`select has_table_privilege('authenticated',$1,'SELECT')
      or has_any_column_privilege('authenticated',$1,'SELECT') allowed`, [table])).rows[0].allowed, table).toBe(false);
  }
  // Signal subscriptions carry invalidation metadata only, never business rows.
  const published = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename"))
    .rows.map(row => row.tablename);
  expect(published).toEqual(["permission_catalog_signals", "store_change_signals"]);
  const privateCallable = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p
    where p.pronamespace='private'::regnamespace and p.proname like 'permission_%'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')`)).rows;
  expect(privateCallable, JSON.stringify(privateCallable)).toEqual([]);
});
