import { readFileSync } from "node:fs";
import { digest } from "../../scripts/permission-preflight-core.mjs";
import { cleanupIdentityFixture, db, fixtureEvidence, resetIdentityFixture, setupIdentityFixture, STORE_IDS } from "./permissionIdentityFixture";
export * from "./permissionIdentityFixture";

// Only the marker-verified dedicated runtime may reach this fixture. Capture
// PostgreSQL rows in TEMP tables so timestamp/numeric precision survives restore.
const deletionOrder = ["order_events", "write_operations", "payments", "order_item_options", "order_items", "orders",
  "menu_item_option_groups", "option_values", "option_groups", "menu_items", "categories", "tables", "floor_decor_items", "floor_areas", "store_settings"];
const functionNames = ["get_write_capabilities", "register_write_operation", "write_operation_request", "execute_write_operation",
  "get_write_operation", "cancel_write_operation", "list_write_operations", "write_clock", "prepare_write", "apply_write", "lock_write_input"];
let staged = false;
let originalFunctions: string[] = [], candidateFunctions: string[] = [], functionSignatures: string[] = [], functionAcl: any[] = [], tableAcl: any[] = [], columnAcl: any[] = [];
let originalHash = "";
const columns = new Map<string, string>();
const q = (value: string) => '"' + value.replaceAll('"', '""') + '"';
async function financialFingerprint() {
  const rows = [];
  for (const name of deletionOrder) rows.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${name} t`)).rows[0].rows);
  return digest(rows);
}
export async function setupFinancialFixture() {
  await setupIdentityFixture(true);
  originalHash = await financialFingerprint();
  originalFunctions = (await db.query(`select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname=any($1::text[]) order by (n.nspname='private') desc,p.oid`, [functionNames])).rows.map(r => r.d);
  functionSignatures = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname=any($1::text[]) order by (n.nspname='private') desc,p.oid`, [functionNames])).rows.map(r => r.signature);
  functionAcl = (await db.query(`select p.oid::regprocedure::text signature,coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    left join pg_roles r on r.oid=a.grantee where n.nspname in ('public','private') and p.proname=any($1::text[])
    and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))`, [functionNames])).rows;
  tableAcl = (await db.query(`select c.relname,r.rolname,x.privilege_type privilege from pg_class c
    cross join lateral aclexplode(c.relacl) x join pg_roles r on r.oid=x.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and r.rolname in ('anon','authenticated','service_role')`, [deletionOrder])).rows;
  columnAcl = (await db.query(`select c.relname,a.attname,r.rolname,x.privilege_type privilege from pg_attribute a join pg_class c on c.oid=a.attrelid
    cross join lateral aclexplode(a.attacl) x join pg_roles r on r.oid=x.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and r.rolname in ('anon','authenticated','service_role')`, [deletionOrder])).rows;
  await db.query("begin");
  for (const name of deletionOrder) {
    await db.query(`create temporary table t06_${name} as table public.${name}`);
    columns.set(name, (await db.query("select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum", ["public." + name])).rows.map(r => q(r.attname)).join(","));
  }
  // Deliberately restore an unsafe inherited column grant before the candidate
  // applies its own DDL, so the test cannot pass via a broad fixture revoke.
  const legacy = (await db.query(`select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('submit_order_changes','pay_order','pay_order_items','void_order')`)).rows;
  for (const f of legacy) await db.query(`grant execute on function ${f.signature} to authenticated`);
  await db.query("grant update(total) on public.orders to authenticated; grant select(payload),update(payload) on public.write_operations to authenticated");
  const open = (await db.query("select has_column_privilege('authenticated','public.orders','total','UPDATE') ok")).rows[0].ok;
  await db.query(readFileSync("supabase/candidate/permission-financial.sql", "utf8"));
  const closed = !(await db.query("select has_any_column_privilege('authenticated','public.orders','UPDATE') ok")).rows[0].ok;
  const rawClosed = !(await db.query("select has_any_column_privilege('authenticated','public.write_operations','SELECT,UPDATE') ok")).rows[0].ok;
  for (const f of legacy) {
    if ((await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') ok", [f.signature])).rows[0].ok) throw new Error("FINANCIAL_LEGACY_GRANT_REMAINED");
  }
  fixtureEvidence.financialAclNegativeControl = open && closed && rawClosed && legacy.length > 0;
  await db.query("commit"); staged = true;
  fixtureEvidence.financialPhasePreserved = originalHash === await financialFingerprint();
  candidateFunctions = (await db.query(`select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and (p.proname=any($1::text[]) or p.proname like 'permission_financial_%') order by (n.nspname='private') desc,p.oid`, [functionNames])).rows.map(r => r.d);
  await db.query("notify pgrst,'reload schema'");
}
export async function resetFinancialFixture() {
  if (!staged) return;
  await db.query("rollback");
  for (const definition of candidateFunctions) await db.query(definition);
  await db.query("begin");
  for (const name of deletionOrder) await db.query(`alter table public.${name} disable trigger user`);
  for (const name of deletionOrder) await db.query(`delete from public.${name} where store_id=any($1::uuid[])`, [STORE_IDS]);
  for (const name of [...deletionOrder].reverse()) {
    const list = columns.get(name)!;
    await db.query(`insert into public.${name}(${list}) select ${list} from pg_temp.t06_${name}`);
  }
  for (const name of deletionOrder) await db.query(`alter table public.${name} enable trigger user`);
  await db.query("commit");
  await resetIdentityFixture();
}
export async function cleanupFinancialFixture() {
  try {
    if (staged) {
      await resetFinancialFixture();
      fixtureEvidence.financialBusinessRestored = originalHash === await financialFingerprint();
      if (!fixtureEvidence.financialBusinessRestored) throw new Error("FINANCIAL_FIXTURE_DRIFT");
      await db.query("drop function if exists public.execute_write_operation(uuid,jsonb,uuid); drop function if exists public.execute_write_operation(uuid,jsonb); drop function if exists public.get_write_operation(uuid); drop function if exists public.cancel_write_operation(uuid); drop function if exists private.write_operation_request(text,uuid,jsonb,uuid)");
      for (const definition of originalFunctions) await db.query(definition);
      for (const signature of functionSignatures) {
        await db.query(`revoke all privileges on function ${signature} from PUBLIC,anon,authenticated,service_role`);
        for (const grant of functionAcl.filter(entry => entry.signature === signature))
          await db.query(`grant ${grant.privilege} on function ${signature} to ${grant.grantee === 'PUBLIC' ? 'PUBLIC' : q(grant.grantee)}${grant.grantable ? ' with grant option' : ''}`);
      }
      for (const a of tableAcl) await db.query(`grant ${a.privilege} on public.${q(a.relname)} to ${q(a.rolname)}`);
      for (const a of columnAcl) await db.query(`grant ${a.privilege}(${q(a.attname)}) on public.${q(a.relname)} to ${q(a.rolname)}`);
    }
  } finally { await cleanupIdentityFixture(); }
}
