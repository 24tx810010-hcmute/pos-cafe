import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const ACTIVATION_SQL_ORDER = Object.freeze([
  'supabase/migrations/017_permission_catalog_bridge.sql',
  'supabase/candidate/permission-identity.sql',
  'supabase/candidate/permission-administration.sql',
  'supabase/candidate/permission-financial.sql',
  'supabase/candidate/permission-read.sql',
  'supabase/candidate/permission-changes.sql',
  'supabase/candidate/permission-images.sql',
  'supabase/candidate/permission-signals.sql',
  'supabase/candidate/permission-print.sql',
  'supabase/candidate/permission-seed.sql',
  'supabase/candidate/permission-compatibility-activate.sql',
]);

// This is the reviewed pre-activation tenant inventory. Catalog/global tables
// are intentionally absent. Discovery below rejects an added or missing
// store-scoped relation instead of silently treating an incomplete count as an
// empty target.
export const EMPTY_TARGET_RELATIONS = Object.freeze([
  'private.employee_sessions',
  'public.categories',
  'public.employees',
  'public.floor_areas',
  'public.floor_decor_items',
  'public.menu_item_option_groups',
  'public.menu_items',
  'public.option_groups',
  'public.option_values',
  'public.order_events',
  'public.order_item_options',
  'public.order_items',
  'public.orders',
  'public.payments',
  'public.store_settings',
  'public.stores',
  'public.tables',
  'public.write_operations',
]);

const quoteIdentifier = value => '"' + value.replaceAll('"', '""') + '"';
const quoteRelation = value => value.split('.').map(quoteIdentifier).join('.');
const sameStrings = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

async function discoverTenantRelations(db) {
  return (await db.query(`with recursive tenant_relations(oid) as (
    select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and n.nspname in ('public','private') and
    (n.nspname='public' and c.relname='stores' or exists(select 1 from pg_attribute a
      where a.attrelid=c.oid and a.attname='store_id' and a.attnum>0 and not a.attisdropped))
    union
    select child.oid from tenant_relations parent
      join pg_constraint fk on fk.confrelid=parent.oid and fk.contype='f'
      join pg_class child on child.oid=fk.conrelid
      join pg_namespace ns on ns.oid=child.relnamespace
      where child.relkind in ('r','p') and ns.nspname in ('public','private')
    ) select n.nspname as schema_name,c.relname as relation_name
      from tenant_relations t join pg_class c on c.oid=t.oid join pg_namespace n on n.oid=c.relnamespace
      order by n.nspname,c.relname`)).rows.map(row => `${row.schema_name}.${row.relation_name}`);
}

async function inspectTenantRows(db, relations) {
  const storeIds = (await db.query('select id::text id from public.stores order by id')).rows.map(row => row.id);
  const employeeIds = (await db.query('select id::text id,store_id::text as store_id from public.employees order by store_id,id')).rows;
  const countsSql = relations.map((relation, index) => {
    const [schema, name] = relation.split('.');
    return `select $${index + 1}::text relation,count(*)::text row_count from ${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
  }).join(' union all ');
  const rowCounts = (await db.query(countsSql, relations)).rows.map(row => ({
    relation: row.relation,
    rowCount: row.row_count,
  }));
  return {
    empty: storeIds.length === 0 && employeeIds.length === 0 && rowCounts.every(row => row.rowCount === '0'),
    storeIds,
    employeeIds,
    rowCounts,
  };
}

// Postflight uses the bundle-produced inventory, including audit, signals,
// bootstrap/image/print registries, and indirect children such as seed-stage receipts.
export async function inspectAllTenantRows(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('A connected pg-compatible client is required');
  const actualRelations = await discoverTenantRelations(db);
  return { actualRelations, ...await inspectTenantRows(db, actualRelations) };
}

/**
 * Inspect the explicitly empty pre-activation target. With lockTables=true,
 * SHARE table locks are acquired in a deterministic order before IDs and row
 * counts are read. Those locks conflict with INSERT/UPDATE/DELETE table locks
 * and remain held by the caller's transaction through activation.
 *
 * The returned evidence is deliberately data-minimal. Callers choose their own
 * public error namespace and must reject schemaMatches=false or empty=false.
 */
export async function inspectExpectedEmptyTarget(db, { lockTables = false } = {}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('A connected pg-compatible client is required');
  let actualRelations = await discoverTenantRelations(db);
  if (!sameStrings(actualRelations, EMPTY_TARGET_RELATIONS)) {
    return { schemaMatches: false, empty: false, actualRelations, storeIds: [], employeeIds: [], rowCounts: [] };
  }
  if (lockTables) {
    await db.query(`lock table ${EMPTY_TARGET_RELATIONS.map(quoteRelation).join(',')} in share mode`);
    // Under the empty activation's READ COMMITTED transaction, this is a fresh
    // catalog snapshot after any data writer that held a conflicting lock has
    // completed. The acquired relation locks prevent drop/alter afterwards.
    // Release preflight does not request locks and remains read-only.
    actualRelations = await discoverTenantRelations(db);
    if (!sameStrings(actualRelations, EMPTY_TARGET_RELATIONS)) {
      return { schemaMatches: false, empty: false, actualRelations, storeIds: [], employeeIds: [], rowCounts: [] };
    }
  }

  const rows = await inspectTenantRows(db, EMPTY_TARGET_RELATIONS);
  return {
    schemaMatches: true,
    actualRelations,
    ...rows,
  };
}

export function activationBundleManifest(root = process.cwd()) {
  const files = ACTIVATION_SQL_ORDER.map(path => {
    const bytes = readFileSync(`${root}/${path}`);
    return { path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  });
  return { schemaVersion: 1, atomic: true, transactionBoundary: 'scripts/permission-activate.mjs:single-transaction',
    isolation: { mapped: 'serializable', explicitEmpty: 'read committed' }, files,
    sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

export function assertActivationEligibility({ preflight, mappings, sourceFingerprint, expectedSourceFingerprint, expectedEmptyStoreSet = false }) {
  if (sourceFingerprint !== expectedSourceFingerprint) throw new Error('SOURCE_FINGERPRINT_MISMATCH');
  if (expectedEmptyStoreSet) {
    if (preflight?.status !== 'READY' || preflight.expectedEmptyStoreSet !== true
      || !Array.isArray(preflight.stores) || preflight.stores.length !== 0
      || preflight.emptyTarget?.schemaMatches !== true || preflight.emptyTarget?.empty !== true)
      throw new Error('OWNER_MIGRATION_REVIEW_REQUIRED');
    if (!Array.isArray(mappings) || mappings.length !== 0) throw new Error('MAPPING_SET_INCOMPLETE');
    return true;
  }
  if (preflight?.status !== 'READY' || !Array.isArray(preflight.stores) || preflight.stores.length === 0
    || preflight.stores.some(store => store.status !== 'READY'))
    throw new Error('OWNER_MIGRATION_REVIEW_REQUIRED');
  if (!Array.isArray(mappings) || mappings.length !== preflight.stores.length) throw new Error('MAPPING_SET_INCOMPLETE');
  for (const store of preflight.stores) {
    const matches = mappings.filter(mapping => mapping.storeId === store.storeId && mapping.ownerId === store.candidateOwnerId
      && mapping.sourceSnapshotHash === preflight.safety.before.hash);
    if (matches.length !== 1) throw new Error('LOCKED_MAPPING_RECHECK_FAILED');
  }
  return true;
}
