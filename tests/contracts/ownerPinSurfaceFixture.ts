import { readFileSync } from "node:fs";
import { db, env, setupReadFixture, cleanupReadFixture, STORE_IDS } from "./permissionReadFixture";
import { runtimeProof } from "../../scripts/permission-identity-runtime.mjs";
import { assertActivatedCandidate } from "../supabase/permissionCandidateEnvironment";

export { db, actor, EMPLOYEE_IDS, readRelations } from "./permissionReadFixture";
export const surfacePhase = process.env.PERM_PIN_SURFACE_FIXTURE ?? "legacy";
if (!["legacy", "activated-candidate"].includes(surfacePhase)) throw new Error("PIN_SURFACE_PROFILE_REFUSED");
let connected = false, transaction = false, originalState = "";
const q = (value: string) => '"' + value.replaceAll('"', '""') + '"';

// This value never leaves memory or appears in assertion/error diagnostics.
async function fixtureState() {
  const schemas = ["public", "private", "auth", "storage"];
  const relations = (await db.query(`select n.nspname schema,c.relname name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[])
    and c.relkind in ('r','p') order by n.nspname,c.relname`, [schemas])).rows;
  const data = [];
  for (const relation of relations) data.push([relation.schema, relation.name, (await db.query(
    `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text value
    from ${q(relation.schema)}.${q(relation.name)} t`)).rows[0].value]);
  const catalog = [];
  for (const sql of [
    `select n.nspname,c.relname,
      (to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'])::text relation_metadata,
      c.oid,c.relkind,c.relowner,c.relacl,c.reloptions,c.relpersistence,
      c.relreplident,c.relispartition,pg_get_expr(c.relpartbound,c.oid) partition_bound,
      pg_get_partkeydef(c.oid) partition_key,c.relrowsecurity,c.relforcerowsecurity,
      case when c.relkind in ('v','m') then pg_get_viewdef(c.oid) else null end definition
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[])
      order by n.nspname,c.relname`,
    `select n.nspname,c.relname,a.attname,to_jsonb(a)::text attribute_metadata,a.atttypid::regtype::text type,a.attnotnull,a.attacl,
      pg_get_expr(d.adbin,d.adrelid) default_expression from pg_attribute a join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname=any($1::text[]) and a.attnum>0 and not a.attisdropped order by n.nspname,c.relname,a.attnum`,
    `select n.nspname,p.oid::regprocedure::text signature,to_jsonb(p)::text function_metadata,
      case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) else null end definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname=any($1::text[]) order by n.nspname,p.oid::regprocedure::text`,
    `select n.nspname,c.relname,x.conname,to_jsonb(x)::text constraint_metadata,pg_get_constraintdef(x.oid) definition from pg_constraint x
      left join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=x.connamespace
      where n.nspname=any($1::text[]) order by n.nspname,c.relname,x.conname`,
    `select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
      where schemaname=any($1::text[]) order by schemaname,tablename,policyname`,
    `select n.nspname,c.relname,p.polname,to_jsonb(p)::text policy_metadata from pg_policy p
      join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=any($1::text[]) order by n.nspname,c.relname,p.polname`,
    `select n.nspname,c.relname,t.tgname,to_jsonb(t)::text trigger_metadata,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t
      join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=any($1::text[]) order by n.nspname,c.relname,t.tgname`,
    `select * from pg_sequences where schemaname=any($1::text[]) order by schemaname,sequencename`,
    `select nspname,nspowner,nspacl from pg_namespace where nspname=any($1::text[]) order by nspname`,
    `select d.* from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
      where d.defaclnamespace=0 or n.nspname=any($1::text[]) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype`,
    `select n.nspname,c.relname,to_jsonb(i)::text index_metadata,pg_get_indexdef(i.indexrelid) definition
      from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname=any($1::text[]) order by n.nspname,c.relname`,
    `select n.nspname,t.typname,to_jsonb(t)::text type_metadata from pg_type t
      join pg_namespace n on n.oid=t.typnamespace where n.nspname=any($1::text[]) order by n.nspname,t.typname`,
    `select n.nspname,t.typname,to_jsonb(e)::text enum_metadata from pg_enum e join pg_type t on t.oid=e.enumtypid
      join pg_namespace n on n.oid=t.typnamespace where n.nspname=any($1::text[]) order by n.nspname,t.typname,e.enumsortorder`,
    `select n.nspname,t.typname,to_jsonb(r)::text range_metadata from pg_range r join pg_type t on t.oid=r.rngtypid
      join pg_namespace n on n.oid=t.typnamespace where n.nspname=any($1::text[]) order by n.nspname,t.typname`,
    `select n.nspname,c.collname,to_jsonb(c)::text collation_metadata from pg_collation c
      join pg_namespace n on n.oid=c.collnamespace where n.nspname=any($1::text[]) order by n.nspname,c.collname,c.oid`,
    `select n.nspname,c.relname,r.rulename,to_jsonb(r)::text rule_metadata,pg_get_ruledef(r.oid) definition from pg_rewrite r join pg_class c on c.oid=r.ev_class
      join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[]) order by n.nspname,c.relname,r.rulename`,
    `select n.nspname,c.relname,to_jsonb(i)::text inheritance_metadata from pg_inherits i join pg_class c on c.oid=i.inhrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[]) order by n.nspname,c.relname,i.inhseqno`,
    `select n.nspname,p.proname,to_jsonb(a)::text aggregate_metadata from pg_aggregate a join pg_proc p on p.oid=a.aggfnoid
      join pg_namespace n on n.oid=p.pronamespace where n.nspname=any($1::text[]) order by n.nspname,p.oid::regprocedure::text`,
  ]) catalog.push((await db.query(sql, [schemas])).rows);
  for (const sql of [
    "select * from pg_publication order by pubname",
    "select * from pg_publication_tables order by pubname,schemaname,tablename",
    "select * from pg_db_role_setting order by setdatabase,setrole",
    "select * from pg_auth_members order by roleid,member,grantor",
    "select to_jsonb(r)::text role_metadata from pg_roles r order by rolname",
  ]) catalog.push((await db.query(sql)).rows);
  return JSON.stringify({ data, catalog });
}

export async function surfaceSnapshot() {
  await db.query("reset role");
  return fixtureState(); // Same transaction, including every fixture row and evidence relation.
}

async function candidateGuard() {
  runtimeProof();
  await assertActivatedCandidate(db, { ...env, fixtureFile: process.env.IDEM_ENV_FILE! });
  const profile = (await db.query(`select to_regtype('public.employee_role') is null enum_absent,
    not exists(select from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='has_employee_permission') helper_absent,
    (select data_type='text' from information_schema.columns where table_schema='public' and table_name='employees' and column_name='role') role_text,
    exists(select from public.employees where id=$1 and store_id=$2 and role='owner' and is_active) synthetic_owner`,
    ["20000000-0000-4000-8000-000000000001", STORE_IDS[0]])).rows[0];
  if (!profile || Object.values(profile).some(value => value !== true)) throw new Error("PIN_SURFACE_CANDIDATE_PROFILE_REFUSED");
  const headers = { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, "Content-Type": "application/json" };
  const marked = await fetch(`${env.api}/rest/v1/rpc/permission_get_store_session`, {
    method: "POST", headers: { ...headers, "x-pos-permission-contract": "2" }, body: "{}", signal: AbortSignal.timeout(10_000),
  });
  const value = await marked.json();
  const unmarked = await fetch(`${env.api}/rest/v1/rpc/permission_get_store_session`, {
    method: "POST", headers, body: "{}", signal: AbortSignal.timeout(10_000),
  });
  if (marked.status !== 200 || value?.ok !== true || value.data?.storeId !== STORE_IDS[0]
    || marked.headers.get("x-pos-permission-hook") !== "strict" || unmarked.status !== 426)
    throw new Error("PIN_SURFACE_API_BINDING_REFUSED");
}

export async function setupSurfaceFixture() {
  if (surfacePhase === "legacy") {
    await setupReadFixture();
    await db.query("begin");
    for (const file of ["permission-changes", "permission-images", "permission-signals", "permission-print", "permission-seed"])
      await db.query(readFileSync(`supabase/candidate/${file}.sql`, "utf8"));
    return;
  }
  let step = "connect";
  try {
    await db.connect(); connected = true;
    step = "guard";
    await candidateGuard();
    step = "activity";
    const activity = (await db.query(`select (select count(*)::int from pg_prepared_xacts) prepared,
      (select count(*)::int from pg_locks where not granted) pending,
      (select count(*)::int from pg_stat_activity where state='idle in transaction' and pid<>pg_backend_pid()) idle`)).rows[0];
    if (Object.values(activity).some(value => value !== 0)) throw new Error("PIN_SURFACE_ACTIVITY_REFUSED");
    step = "baseline"; originalState = await fixtureState();
    step = "transaction";
    await db.query("begin"); transaction = true;
    await db.query("set local lock_timeout='5s'");
    step = "locks";
    const relations = (await db.query(`select n.nspname schema,c.relname name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage')
      and c.relkind in ('r','p') order by n.nspname,c.relname`)).rows;
    for (const relation of relations) {
      // Managed schemas grant this observer SELECT only. Do not elevate it or
      // change their ACL: retain every row in the before/after drift checks.
      // Business/evidence schemas block concurrent writers; managed relations
      // keep read locks, and any observed background drift fails the suite.
      const mode = ["auth", "storage"].includes(relation.schema) ? "access share" : "share row exclusive";
      await db.query(`lock table ${q(relation.schema)}.${q(relation.name)} in ${mode} mode`);
    }
    step = "baseline-recheck";
    if (originalState !== await fixtureState()) throw new Error("PIN_SURFACE_PREFLIGHT_DRIFT");
    step = "view";
    if (!(await db.query("select to_regclass('public.history_entries') present")).rows[0].present)
      await db.query("create view public.history_entries with (security_invoker=true) as select * from public.orders");
  } catch (error) {
    if (transaction) { await db.query("rollback"); transaction = false; }
    const value = error as { message?: string; code?: string };
    const allowed = ["PIN_SURFACE_CANDIDATE_PROFILE_REFUSED", "PIN_SURFACE_API_BINDING_REFUSED", "PIN_SURFACE_ACTIVITY_REFUSED", "PIN_SURFACE_PREFLIGHT_DRIFT"];
    const sqlstates = ["0A000", "42501", "42704", "42P01", "42883", "42710", "2BP01", "23505", "23503", "23514", "55000", "57014", "40001", "40P01", "25P02", "42601", "22P02"];
    throw Object.assign(new Error("PIN_SURFACE_SETUP_FAILED"), { permissionPinDiagnostics: [{
      code: allowed.includes(value?.message ?? "") ? value.message : "PIN_SURFACE_SETUP_FAILED",
      phase: "pin-surface", step, sqlstate: sqlstates.includes(value?.code ?? "") ? value.code : null,
    }] });
  }
}

export async function cleanupSurfaceFixture() {
  if (surfacePhase === "legacy") {
    try { await db.query("rollback"); await db.query("reset role"); }
    finally { await cleanupReadFixture(); }
    return;
  }
  if (!connected) return;
  try {
    if (transaction) { await db.query("rollback"); transaction = false; }
    await db.query("reset role");
    if (originalState && originalState !== await fixtureState()) throw new Error("PIN_SURFACE_FIXTURE_DRIFT");
    await candidateGuard();
  } finally { await db.end(); connected = false; }
}
