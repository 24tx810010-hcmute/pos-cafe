export const LEGACY_BROWSER_READ_TABLES = Object.freeze(["orders", "order_items", "order_item_options", "payments"]);

const same = (actual, expected) => Array.isArray(actual)
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());

/**
 * The isolated reset recreates public after Supabase's schema-level default
 * privileges were installed, so 016's intentionally preserved financial
 * SELECT grants are absent. Restore only those four read grants required by
 * the archived phase-27 adapter; legacy financial DML remains revoked.
 */
export async function prepareLegacyBrowserSurface(db, { marker, storeIds }) {
  const fixture = (await db.query("select marker,engine,store_ids from private.idempotency_test_environment where singleton")).rows;
  if (fixture.length !== 1 || fixture[0].marker !== marker || fixture[0].engine !== "supabase-identity-v1"
    || !same(fixture[0].store_ids, storeIds)) throw new Error("LEGACY_BROWSER_FIXTURE_BINDING_MISMATCH");
  const actualStores = (await db.query("select id from public.stores order by id")).rows.map(row => row.id);
  if (!same(actualStores, storeIds)
    || (await db.query("select to_regclass('public.permission_catalog') value")).rows[0].value !== null
    || (await db.query("select to_regtype('public.employee_role') value")).rows[0].value !== "employee_role") {
    throw new Error("FRESH_LEGACY_BROWSER_FIXTURE_REQUIRED");
  }
  const protection = (await db.query(`select c.relname table_name,c.relrowsecurity,
      count(p.policyname)::int policies,
      bool_and(p.policyname=c.relname||'_store_is_auth_user' and p.cmd='ALL' and p.roles='{public}'::name[]
        and p.qual='(store_id = auth.uid())' and p.with_check='(store_id = auth.uid())') policy_matches
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
    where n.nspname='public' and c.relname=any($1::text[])
    group by c.relname,c.relrowsecurity order by c.relname`, [LEGACY_BROWSER_READ_TABLES])).rows;
  if (protection.length !== LEGACY_BROWSER_READ_TABLES.length
    || protection.some(row => row.relrowsecurity !== true || row.policies !== 1 || row.policy_matches !== true)) {
    throw new Error("LEGACY_BROWSER_TENANT_POLICY_REQUIRED");
  }
  const unexpected = (await db.query(`select grantee,table_name,privilege_type from information_schema.role_table_grants
    where table_schema='public' and table_name=any($1::text[]) and grantee in ('anon','authenticated')
      and (grantee<>'authenticated' or privilege_type<>'SELECT') order by grantee,table_name,privilege_type`, [LEGACY_BROWSER_READ_TABLES])).rows;
  if (unexpected.length) throw new Error("UNEXPECTED_LEGACY_FINANCIAL_GRANT");
  const before = (await db.query(`select c.relname table_name,has_table_privilege('authenticated',c.oid,'SELECT') allowed
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[]) order by c.relname`, [LEGACY_BROWSER_READ_TABLES])).rows;
  if (before.length !== LEGACY_BROWSER_READ_TABLES.length) throw new Error("LEGACY_BROWSER_TABLE_MISSING");
  await db.query("grant select on public.orders,public.order_items,public.order_item_options,public.payments to authenticated");
  const after = (await db.query(`select c.relname table_name,has_table_privilege('authenticated',c.oid,'SELECT') allowed
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[]) order by c.relname`, [LEGACY_BROWSER_READ_TABLES])).rows;
  if (after.some(row => row.allowed !== true)) throw new Error("LEGACY_BROWSER_READ_GRANT_RESTORE_FAILED");
  return { status: "LEGACY_BROWSER_READS_READY", protection, before, after,
    restored: before.filter(row => row.allowed !== true).map(row => row.table_name) };
}
