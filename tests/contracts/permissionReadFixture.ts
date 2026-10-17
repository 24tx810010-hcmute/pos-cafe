import { readFileSync } from "node:fs";
import { digest } from "../../scripts/permission-preflight-core.mjs";
import { cleanupFinancialFixture, db, fixtureEvidence, resetFinancialFixture, setupFinancialFixture } from "./permissionFinancialFixture";
export * from "./permissionFinancialFixture";

export const readRelations = ["stores", "store_settings", "employees", "categories", "menu_items", "option_groups", "option_values", "menu_item_option_groups",
  "floor_areas", "tables", "floor_decor_items", "orders", "order_items", "order_item_options", "payments", "write_operations", "order_events",
  "employee_admin_audit", "permission_catalog", "permission_catalog_state", "permission_roles", "role_permission_defaults", "history_entries"];
let staged = false, createdLegacyView = false, originalReceipt = "", originalHash = "";
let originalReceiptAcl: any[] = [];
let employeeColumns = "", catalogStateColumns = "";
const originalRelationHashes = new Map<string, string>();
let tableAcl: any[] = [], columnAcl: any[] = [], candidateFunctions: string[] = [];
const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const role = (s: string) => s === "PUBLIC" ? "public" : q(s);
export async function readFingerprint() {
  const values = [];
  for (const name of readRelations) values.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${q(name)} t`)).rows[0].rows);
  return digest(values);
}
export async function setupReadFixture() {
  await setupFinancialFixture();
  if (!(await db.query("select to_regclass('public.history_entries') name")).rows[0].name) {
    // Migration010 removed this view. Reintroduce it only as an inherited-ACL
    // negative control: the fragment must also protect installations retaining it.
    await db.query("create view public.history_entries with (security_invoker=true) as select * from public.orders");
    createdLegacyView = true;
  }
  originalHash = await readFingerprint();
  for (const name of readRelations) originalRelationHashes.set(name, digest((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${q(name)} t`)).rows[0].rows));
  await db.query("create temporary table t07_employees as table public.employees");
  await db.query("create temporary table t07_catalog_state as table public.permission_catalog_state");
  employeeColumns = (await db.query("select attname from pg_attribute where attrelid='public.employees'::regclass and attnum>0 and not attisdropped and attgenerated='' and attname<>'id' order by attnum")).rows.map(r => q(r.attname)).join(",");
  catalogStateColumns = (await db.query("select attname from pg_attribute where attrelid='public.permission_catalog_state'::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum")).rows.map(r => q(r.attname)).join(",");
  originalReceipt = (await db.query("select pg_get_functiondef('public.get_payment_receipt(uuid)'::regprocedure) d")).rows[0].d;
  originalReceiptAcl = (await db.query(`select coalesce(r.rolname,'PUBLIC') grantee,a.privilege_type privilege,a.is_grantable grantable
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    left join pg_roles r on r.oid=a.grantee where p.oid='public.get_payment_receipt(uuid)'::regprocedure
    and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))`)).rows;
  tableAcl = (await db.query(`select c.relname,coalesce(r.rolname,'PUBLIC') rolname,x.privilege_type privilege from pg_class c
    cross join lateral aclexplode(c.relacl) x left join pg_roles r on r.oid=x.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and x.privilege_type='SELECT'
    and (x.grantee=0 or r.rolname in ('anon','authenticated','service_role'))`, [readRelations])).rows;
  columnAcl = (await db.query(`select c.relname,a.attname,coalesce(r.rolname,'PUBLIC') rolname,x.privilege_type privilege
    from pg_attribute a join pg_class c on c.oid=a.attrelid cross join lateral aclexplode(a.attacl) x left join pg_roles r on r.oid=x.grantee
    where c.relnamespace='public'::regnamespace and c.relname=any($1::text[]) and x.privilege_type='SELECT'
    and (x.grantee=0 or r.rolname in ('anon','authenticated','service_role'))`, [readRelations])).rows;
  await db.query("begin");
  // Candidate DDL must close actual inherited table AND column/view grants.
  for (const name of readRelations) {
    await db.query(`grant select on public.${q(name)} to anon,authenticated,service_role`);
    const col = (await db.query("select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped order by attnum limit 1", ["public." + name])).rows[0].attname;
    await db.query(`grant select(${q(col)}) on public.${q(name)} to public,anon,authenticated,service_role`);
  }
  const open = (await db.query("select has_any_column_privilege('authenticated','public.history_entries','SELECT') ok")).rows[0].ok;
  await db.query(readFileSync("supabase/candidate/permission-read.sql", "utf8"));
  for (const name of readRelations) for (const appRole of ["anon", "authenticated", "service_role"]) {
    if ((await db.query("select has_table_privilege($1,$2,'SELECT') or has_any_column_privilege($1,$2,'SELECT') ok", [appRole, "public." + name])).rows[0].ok)
      throw new Error("READ_GRANT_REMAINED: " + name);
  }
  fixtureEvidence.readAclNegativeControl = open;
  await db.query("commit"); staged = true;
  fixtureEvidence.readPhasePreserved = originalHash === await readFingerprint();
  candidateFunctions = (await db.query(`select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname like 'permission_read_%') or (n.nspname='public' and
      p.proname in ('permission_get_floor_operational','permission_get_pos_menu','permission_get_open_order_detail','permission_get_paid_order_for_void',
      'permission_list_order_history','permission_get_order_history_detail','get_payment_receipt','permission_get_sales_report','permission_list_report_orders','permission_get_menu_admin',
      'permission_get_floor_admin','permission_get_settings_admin','permission_get_store_display'))`)).rows.map(r => r.d);
  await db.query("notify pgrst,'reload schema'");
}
export async function resetReadFixture() {
  if (!staged) return;
  await db.query("rollback");
  for (const definition of candidateFunctions) await db.query(definition);
  await resetFinancialFixture();
  // Identity reset updates timestamps. Restore the native baseline precisely;
  // T07 also fingerprints employee read surfaces, not only financial rows.
  await db.query("begin");
  await db.query("alter table public.employees disable trigger user");
  await db.query(`update public.employees e set (${employeeColumns})=(select ${employeeColumns} from pg_temp.t07_employees b where b.id=e.id) where e.id in (select id from pg_temp.t07_employees)`);
  await db.query("alter table public.employees enable trigger user");
  await db.query("alter table public.permission_catalog_state disable trigger user");
  await db.query(`update public.permission_catalog_state set (${catalogStateColumns})=(select ${catalogStateColumns} from pg_temp.t07_catalog_state)`);
  await db.query("alter table public.permission_catalog_state enable trigger user");
  await db.query("commit");
}
export async function cleanupReadFixture() {
  try {
    if (staged) {
      await resetReadFixture();
      fixtureEvidence.readBusinessRestored = originalHash === await readFingerprint();
      if (!fixtureEvidence.readBusinessRestored) {
        const changed = [];
        for (const name of readRelations) if (originalRelationHashes.get(name) !== digest((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from public.${q(name)} t`)).rows[0].rows)) changed.push(name);
        throw new Error("READ_FIXTURE_DRIFT: " + changed.join(","));
      }
      await db.query(originalReceipt);
      await db.query('revoke all privileges on function public.get_payment_receipt(uuid) from PUBLIC,anon,authenticated,service_role');
      for (const grant of originalReceiptAcl) await db.query(`grant ${grant.privilege} on function public.get_payment_receipt(uuid) to ${role(grant.grantee)}${grant.grantable ? ' with grant option' : ''}`);
      for (const a of tableAcl) await db.query(`grant select on public.${q(a.relname)} to ${role(a.rolname)}`);
      for (const a of columnAcl) await db.query(`grant select(${q(a.attname)}) on public.${q(a.relname)} to ${role(a.rolname)}`);
    }
  } finally {
    if (createdLegacyView) await db.query("drop view public.history_entries");
    await cleanupFinancialFixture();
  }
}
