import { readFileSync } from "node:fs";
import pg from "pg";
import { digest } from "../../scripts/permission-preflight-core.mjs";
import { collectInventory } from "../../scripts/permission-inventory.mjs";
const profile = process.env.PIN_IDENTITY_RUNTIME;
if (profile !== undefined && profile !== "close1") throw new Error("PIN_IDENTITY_RUNTIME_REFUSED");
const runtime = profile === "close1"
  ? await import("../../scripts/permission-pin-identity-runtime.mjs")
  : await import("../../scripts/permission-identity-runtime.mjs");
const { assertBridgeFixture, parseBridgeEnvironment } = runtime;
export const STORE_IDS = runtime.STORE_IDS;
export const EMPLOYEE_IDS = runtime.EMPLOYEE_IDS;
export const env = parseBridgeEnvironment();
export const db = new pg.Client({ connectionString: env.dsn, statement_timeout: 20000, connectionTimeoutMillis: 5000 });
const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
let applied = false, staged = false, originalHelper = "", originalCatalogLock = "";
let employees: any[] = [], functions: string[] = [], acl: any[] = [], employeeAcl: any[] = [], employeeColumnAcl: any[] = [];
let businessBefore = "";
let catalogBefore = "";
async function semanticCatalogHash() {
  const inventory = await collectInventory(db);
  // PostgreSQL may materialize a default ACL after a fixture revokes and
  // restores grants. observedGrants still checks each effective privilege.
  return digest(inventory.surfaces.map(surface => surface.routine
    ? { ...surface, routine: { ...surface.routine, aclHash: "EFFECTIVE_GRANTS_CHECKED" } }
    : surface));
}
export const fixtureEvidence: Record<string, unknown> = {};
async function businessFingerprint() {
  const rows = [];
  for (const name of ["orders", "order_items", "order_item_options", "payments", "write_operations", "order_events"])
    rows.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${name} t`)).rows[0].rows);
  return digest(rows);
}
export async function setupIdentityFixture(administration = false) {
  await db.connect(); fixtureEvidence.runtime = await assertBridgeFixture(db, env);
  catalogBefore = await semanticCatalogHash();
  employees = (await db.query("select * from public.employees order by id")).rows;
  businessBefore = await businessFingerprint();
  originalHelper = (await db.query("select pg_get_functiondef('public.has_employee_permission(public.employee_role,jsonb,text)'::regprocedure) d")).rows[0].d;
  acl = (await db.query(`select p.oid::regprocedure::text signature,coalesce(r.rolname,'PUBLIC') rolname,a.privilege_type privilege from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a left join pg_roles r on r.oid=a.grantee
    where n.nspname='public' and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))`)).rows;
  employeeAcl = (await db.query("select grantee,privilege_type privilege from information_schema.role_table_grants where table_schema='public' and table_name='employees' and grantee in ('anon','authenticated','service_role')")).rows;
  employeeColumnAcl = (await db.query(`select a.attname column_name,r.rolname grantee,x.privilege_type privilege from pg_attribute a
    cross join lateral aclexplode(a.attacl) x join pg_roles r on r.oid=x.grantee
    where a.attrelid='public.employees'::regclass and r.rolname in ('anon','authenticated','service_role')`)).rows;
  await db.query(readFileSync("supabase/migrations/017_permission_catalog_bridge.sql", "utf8")); applied = true;
  functions = (await db.query("select p.oid::regprocedure::text s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')")).rows.map(r => r.s);
  originalCatalogLock = (await db.query("select pg_get_functiondef('private.permission_catalog_lock()'::regprocedure) d")).rows[0].d;
  await db.query("begin");
  // Explicit SYNTHETIC mapping for this dedicated runtime; not a release mapping/launcher.
  await db.query("alter table public.employees alter column role type text using role::text");
  await db.query("update public.employees set role=case when id=any($1::uuid[]) then 'owner' when role='admin' then 'manager' else role end,permission_overrides=null", [[EMPLOYEE_IDS[0], EMPLOYEE_IDS[3]]]);
  await db.query(readFileSync("supabase/candidate/permission-identity.sql", "utf8"));
  // Synthetic established stores are explicitly normal and have no requested
  // demo workflow. Production receives no implicit/backfill workflow.
  await db.query("update public.employees set pin_change_required=false");
  await db.query(`insert into private.initial_seed_workflows(workflow_id,store_id,requested,template_version,status,created_at,updated_at)
    select private.permission_stable_uuid(id,'initial-seed.workflow.v1'),id,false,1,'skipped',private.write_clock(),private.write_clock() from public.stores`);
  // Explicit synthetic operator membership; application/service roles never inherit it.
  await db.query("grant pos_owner_recovery to postgres");
  // Candidate identity gate: legacy endpoints are not a supported bypass.
  await db.query("revoke execute on all functions in schema public from anon,authenticated,service_role; revoke all on public.employees from anon,authenticated,service_role");
  await db.query(`grant execute on function public.permission_fixture_identity(),public.permission_start_session(uuid,text),public.permission_revoke_session(),
    public.permission_get_authority(),public.permission_get_revision(),public.permission_list_roster(),public.permission_change_own_pin(jsonb),
    public.permission_check_required_pin_session(),public.permission_complete_required_pin_change(jsonb),public.permission_reserve_store_no(uuid),
    public.permission_bootstrap_store(jsonb),public.permission_get_store_session(),public.permission_get_contract() to authenticated`);
  await db.query("grant execute on function public.permission_reserve_store_no(uuid),public.permission_get_contract() to anon");
  if (administration === true) {
    // Negative control: the T05 fragment itself must close inherited legacy
    // grants. Broad identity-fixture revokes must not mask a missing ACL step.
    await db.query("grant select,insert,update,delete on public.employees to authenticated");
    await db.query("grant select(name),update(name) on public.employees to authenticated");
    const legacy = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('create_employee','update_employee','reset_employee_pin','seed_employee','verify_employee_pin','hash_employee_pin','start_employee_session','revoke_employee_session','bootstrap_store')`)).rows;
    for (const f of legacy) await db.query(`grant execute on function ${f.signature} to authenticated`);
    const open = (await db.query("select has_table_privilege('authenticated','public.employees','UPDATE') ok")).rows[0].ok;
    await db.query(readFileSync("supabase/candidate/permission-administration.sql", "utf8"));
    const closed = !(await db.query("select has_table_privilege('authenticated','public.employees','UPDATE') or has_any_column_privilege('authenticated','public.employees','UPDATE') or has_any_column_privilege('authenticated','public.employees','SELECT') ok")).rows[0].ok;
    for (const f of legacy) {
      if ((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') ok", [f.signature])).rows[0].ok) throw new Error("ADMIN_LEGACY_GRANT_REMAINED");
    }
    fixtureEvidence.adminAclNegativeControl = open && closed && legacy.length > 0;
  }
  await db.query("commit"); staged = true;
  await db.query("notify pgrst,'reload schema'");
  // Schema-cache readiness, not a retry of a tested mutation.
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const result = await rpc("permission_list_roster", {});
    if (result.ok) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("IDENTITY_API_NOT_READY");
}
export async function resetIdentityFixture() {
  await db.query("rollback");
  await db.query("drop trigger if exists identity_test_fault on public.employee_admin_audit; drop trigger if exists identity_test_fault on public.store_change_signals; drop trigger if exists identity_test_fault on private.employee_admin_requests; drop trigger if exists identity_test_fault on public.employees; drop function if exists private.identity_test_fault()");
  await db.query("begin");
  await db.query("delete from private.employee_sessions; delete from public.employee_admin_audit; delete from private.employee_admin_requests; delete from public.store_change_signals; delete from private.store_no_reservations");
  await db.query("delete from private.initial_seed_stages; delete from private.initial_seed_workflows");
  await db.query("delete from public.employees where store_id=any($1::uuid[]) and not(id=any($2::uuid[]))", [STORE_IDS, employees.map(e => e.id)]);
  for (const e of employees) await db.query("update public.employees set name=$2,role=$3,is_active=$4,passcode_hash=$5,permission_overrides=null,permission_revision=0,pin_change_required=false where id=$1",
    [e.id, e.name, [EMPLOYEE_IDS[0], EMPLOYEE_IDS[3]].includes(e.id) ? "owner" : e.role === "admin" ? "manager" : e.role, e.is_active, e.passcode_hash]);
  await db.query(`insert into private.initial_seed_workflows(workflow_id,store_id,requested,template_version,status,created_at,updated_at)
    select private.permission_stable_uuid(id,'initial-seed.workflow.v1'),id,false,1,'skipped',private.write_clock(),private.write_clock() from public.stores`);
  await db.query("commit");
}
export async function cleanupIdentityFixture() {
  try {
    await db.query("rollback");
    if (staged) {
      await resetIdentityFixture();
      fixtureEvidence.businessUnchanged = businessBefore === await businessFingerprint();
      if (!fixtureEvidence.businessUnchanged) throw new Error("BUSINESS_FIXTURE_DRIFT");
      await db.query("begin");
      await db.query(`drop trigger employees_owner_boundary on public.employees; drop trigger stores_owner_boundary on public.stores;
        alter table public.employees drop constraint employees_pin_change_owner,drop constraint employees_owner_active,drop constraint employees_permission_role_fk;
        drop index public.employees_one_owner`);
      await db.query("drop trigger if exists permission_mac_keys_immutable on private.permission_request_mac_keys");
      const created = (await db.query("select p.oid::regprocedure::text s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and not(p.oid::regprocedure::text=any($1::text[]))", [functions])).rows;
      for (const f of created) await db.query(`drop function ${f.s}`);
      await db.query("drop table private.initial_seed_stages; drop table private.initial_seed_workflows; drop table private.store_no_reservations");
      await db.query("drop table public.employee_admin_audit; drop table public.store_change_signals");
      await db.query(originalCatalogLock);
      await db.query(`alter table private.employee_sessions drop constraint employee_sessions_purpose_ttl,
        drop column employee_revision,drop column purpose,add constraint employee_sessions_check check(expires_at=issued_at+interval '12 hours');
        alter table public.employees drop column pin_change_required`);
      for (const e of employees) await db.query("update public.employees set role=$2,permission_overrides=$3 where id=$1", [e.id, e.role, e.permission_overrides]);
      await db.query("alter table public.employees alter column role type public.employee_role using role::public.employee_role");
      for (const a of acl) await db.query(`grant ${a.privilege} on function ${a.signature} to ${a.rolname === 'PUBLIC' ? 'public' : q(a.rolname)}`);
      for (const a of employeeAcl) await db.query(`grant ${a.privilege} on public.employees to ${q(a.grantee)}`);
      for (const a of employeeColumnAcl) await db.query(`grant ${a.privilege}(${q(a.column_name)}) on public.employees to ${q(a.grantee)}`);
      await db.query("commit");
      await db.query("revoke pos_owner_recovery from postgres");
    }
    if (applied) { await db.query(readFileSync("scripts/sql/permission-t02-revert.sql", "utf8")); await db.query(originalHelper); }
    await db.query("notify pgrst,'reload schema'");
    await assertBridgeFixture(db, env);
    fixtureEvidence.catalogSemanticsUnchanged = catalogBefore === await semanticCatalogHash();
    if (!fixtureEvidence.catalogSemanticsUnchanged) throw new Error("IDENTITY_CATALOG_DRIFT");
    fixtureEvidence.reverted = true;
  } finally { await db.end(); }
}
export async function rpc(name: string, body: object = {}, token?: string, jwt = env.storeJwt) {
  const response = await fetch(env.api + "/rest/v1/rpc/" + name, { method: "POST", headers: {
    apikey: env.anonKey, Authorization: "Bearer " + jwt, "Content-Type": "application/json", ...(token ? { "x-pos-employee-token": token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  return response.json();
}
export async function actor(client: pg.Client, token?: string, storeId = STORE_IDS[0]) {
  await client.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)", [JSON.stringify({ sub: storeId, role: "authenticated" }), JSON.stringify({ "x-pos-employee-token": token ?? "" })]);
}
export async function connection() {
  const client = new pg.Client({ connectionString: env.dsn, statement_timeout: 15000, connectionTimeoutMillis: 5000 });
  await client.connect(); return client;
}
export async function waitBlocked(pid: number) {
  for (let i = 0; i < 100; i++) {
    const r = await db.query("select cardinality(pg_blocking_pids($1)) n", [pid]);
    if (r.rows[0].n > 0) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("EXPECTED_LOCK_WAIT_NOT_OBSERVED");
}
