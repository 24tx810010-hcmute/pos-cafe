import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import pg from 'pg';
import { candidateFingerprint, hashFile } from './idempotency-artifacts.mjs';
import { loadTestEnvironmentFile } from '../tests/contracts/preflight.ts';
import { observerPreflight, PreflightError, migrationChecksums } from '../tests/contracts/observerPreflight.ts';
import { collectInventory } from './permission-inventory.mjs';
import { planMigration, validMappingEvidence, MIGRATION_PLAN_CONTRACT, MIGRATION_BLOCKER_REASONS } from './permission-migration-plan.mjs';

export { PreflightError };
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256 = /^[0-9a-f]{64}$/;
const quote = value => '"' + value.replaceAll('"', '""') + '"';

export function permissionFingerprint() {
  // Reuse phase-27 source hashing, but include the pre-existing pnpm lockfile.
  return digest({ head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    source: candidateFingerprint(), pnpmLock: existsSync('pnpm-lock.yaml') ? hashFile('pnpm-lock.yaml') : null });
}

export function parseObserverEnvironment(input = process.env) {
  const env = { ...input };
  if (!env.IDEM_ENV_FILE) throw new PreflightError('EXPLICIT_ENV_FILE_REQUIRED');
  if (['.env', '.env.local'].includes(basename(env.IDEM_ENV_FILE).toLowerCase())) throw new PreflightError('APPLICATION_ENV_REFUSED');
  loadTestEnvironmentFile(env);
  if (env.PERM_TEST_PROFILE !== 'legacy-observer-v1') throw new PreflightError('LEGACY_OBSERVER_PROFILE_REQUIRED');
  let connection;
  try { connection = new URL(env.IDEM_OBSERVER_DSN); } catch { throw new PreflightError('INVALID_OBSERVER_DSN'); }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname)
    || connection.search || connection.hash) throw new PreflightError('NONLOCAL_OBSERVER_REFUSED');
  const database = decodeURIComponent(connection.pathname.slice(1));
  if (!/^pos_cafe_idem_test_perm_[a-f0-9]{12}$/.test(database)) throw new PreflightError('DATABASE_NAME_IS_NOT_ISOLATED_TEST_DATABASE');
  const storeIds = (env.IDEM_FIXTURE_STORE_IDS ?? '').split(',');
  if (storeIds.length !== 2 || new Set(storeIds).size !== 2 || storeIds.some(id => !uuid.test(id)
    || !id.startsWith('10000000-0000-4000-8000-'))) throw new PreflightError('INVALID_FIXTURE_STORE_IDS');
  if (!/^pos-cafe-perm-[a-f0-9]{40}$/.test(env.IDEM_TEST_MARKER ?? '')) throw new PreflightError('INVALID_TEST_MARKER');
  if (env.IDEM_TEST_ENGINE !== 'postgres-observer') throw new PreflightError('INVALID_TEST_ENGINE');
  if (!sha256.test(env.PERM_EXPECTED_CATALOG_HASH ?? '')) throw new PreflightError('CATALOG_PROOF_REQUIRED');
  if (!/^synthetic:[a-z0-9:/._-]{1,160}$/i.test(env.PERM_BACKEND_REF ?? '')) throw new PreflightError('BACKEND_REFERENCE_REQUIRED');
  return { observerDsn: env.IDEM_OBSERVER_DSN, database, marker: env.IDEM_TEST_MARKER, storeIds,
    engine: env.IDEM_TEST_ENGINE, expectedCatalogHash: env.PERM_EXPECTED_CATALOG_HASH, backendRef: env.PERM_BACKEND_REF,
    profile: 'legacy-observer-v1', host: connection.hostname, port: Number(connection.port || 5432) };
}

const privateIntegrity = new WeakMap();
// An explicit public projection; unknown columns never enter a report digest.
// Whole-row checksums stay in memory solely for the no-change assertion.
export const SNAPSHOT_FIELDS = Object.freeze(['id', 'store_id', 'employee_id', 'name', 'display_name',
  'role', 'is_active', 'permission_overrides', 'created_at', 'updated_at', 'issued_at', 'revoked_at',
  'expires_at', 'status', 'state', 'lock_version', 'order_id', 'order_no', 'business_date',
  'amount', 'received_amount', 'change_amount', 'subtotal', 'total', 'quantity', 'unit_price',
  'price_delta', 'event_type', 'kind']);
export function snapshotsEqual(before, after) {
  return privateIntegrity.has(before) && privateIntegrity.has(after)
    && before.hash === after.hash && privateIntegrity.get(before) === privateIntegrity.get(after);
}

// PIN/hash/token values stay inside PostgreSQL. Their digest is never serialized.
export async function captureSnapshot(db) {
  const tables = (await db.query(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
    and n.nspname in ('public','private','auth','storage') order by n.nspname,c.relname`)).rows;
  const records = [];
  const integrity = [];
  for (const table of tables) {
    const result = await db.query(`select count(*)::text as count,
      md5(coalesce(string_agg(md5(p.value::text),'' order by md5(p.value::text)),'')) as checksum,
      md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as integrity
      from ${quote(table.schema)}.${quote(table.name)} t cross join lateral
      (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) as value from jsonb_each(to_jsonb(t)) where key=any($1::text[])) p`, [SNAPSHOT_FIELDS]);
    const row = result.rows[0];
    records.push({ table: `${table.schema}.${table.name}`, count: row.count, checksum: row.checksum });
    integrity.push({ table: `${table.schema}.${table.name}`, count: row.count, checksum: row.integrity });
  }
  const snapshot = { algorithm: 'sha256-of-counts-and-md5-whitelisted-projections', fields: SNAPSHOT_FIELDS, hash: digest(records), tables: records };
  privateIntegrity.set(snapshot, digest(integrity));
  return snapshot;
}

export function readMappingFiles(paths) {
  return paths.map(path => {
    try {
      const mapping = JSON.parse(readFileSync(path, 'utf8'));
      if (!validMappingEvidence(mapping)) throw new Error();
      return mapping;
    } catch { throw new PreflightError('INVALID_MAPPING_FILE'); }
  });
}

export async function runPreflight(env, { mappings = [], runId = randomUUID(), commandId = 'permission:t01:preflight' } = {}) {
  if (!uuid.test(runId)) throw new PreflightError('INVALID_RUN_ID');
  const startedAt = new Date().toISOString();
  const sourceFingerprint = permissionFingerprint();
  const db = new pg.Client({ connectionString: env.observerDsn, connectionTimeoutMillis: 5000,
    statement_timeout: 30000, application_name: 'pos-cafe-permission-readonly' });
  let connected = false;
  try {
    await db.connect(); connected = true;
    await db.query('begin isolation level repeatable read read only');
    const observer = (await db.query('select rolname,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
    if (!observer || (!observer.rolsuper && !observer.rolbypassrls)) throw new PreflightError('OBSERVER_CANNOT_READ_COMPLETE_FIXTURE');
    await db.query('set local row_security=off');
    await observerPreflight(db, env, 16);
    // 016 grants authenticated USAGE + is_verified_admin for its existing RLS.
    // Preserve that legacy baseline; marker/write_clock remain test-private.
    const privateAccess = (await db.query(`select has_schema_privilege('anon','private','USAGE')
      or has_table_privilege('anon','private.idempotency_test_environment','SELECT')
      or has_function_privilege('anon','private.write_clock()','EXECUTE') as exposed`)).rows[0];
    if (privateAccess.exposed) throw new PreflightError('PRIVATE_TEST_SCHEMA_EXPOSED');
    const inventory = await collectInventory(db);
    if (inventory.catalogHash !== env.expectedCatalogHash) throw new PreflightError('CATALOG_STATE_MISMATCH');
    const roles = (await db.query(`select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
      join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='employee_role' order by e.enumsortorder`)).rows.map(r => r.enumlabel);
    if (JSON.stringify(roles) !== JSON.stringify(['admin', 'cashier', 'kitchen'])) throw new PreflightError('LEGACY_ROLE_CATALOG_REQUIRED');
    const before = await captureSnapshot(db);
    const stores = (await db.query(`select s.id,s.name,ss.display_name as "displayName"
      from public.stores s left join public.store_settings ss on ss.store_id=s.id order by s.id`)).rows;
    if (JSON.stringify(stores.map(s => s.id).sort()) !== JSON.stringify([...env.storeIds].sort())) throw new PreflightError('FIXTURE_STORE_SET_MISMATCH');
    const employees = (await db.query(`select id,store_id as "storeId",name,role,is_active as "isActive",
      to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",
      permission_overrides as "permissionOverrides" from public.employees order by id`)).rows;
    const plan = planMigration({ stores, employees, mappings, snapshotHash: before.hash });
    const readOnly = (await db.query('show transaction_read_only')).rows[0].transaction_read_only === 'on';
    const serverVersion = (await db.query('show server_version')).rows[0].server_version;
    await db.query('commit');
    // A fresh snapshot can observe committed changes; comparing within one MVCC snapshot cannot.
    await db.query('begin isolation level repeatable read read only');
    await db.query('set local row_security=off');
    await observerPreflight(db, env, 16);
    const after = await captureSnapshot(db);
    const afterCatalog = (await collectInventory(db)).catalogHash;
    await db.query('commit');
    if (!readOnly || !snapshotsEqual(before, after) || inventory.catalogHash !== afterCatalog) throw new PreflightError('READONLY_SNAPSHOT_CHANGED');
    if (permissionFingerprint() !== sourceFingerprint) throw new PreflightError('SOURCE_CHANGED_DURING_RUN');
    const executionProfile = { kind: 'legacy', configId: env.profile, backend: { reference: env.backendRef,
      host: env.host, port: env.port, database: env.database, engine: env.engine }, fixtureIds: env.storeIds,
      markerProof: digest(env.marker), catalogHash: inventory.catalogHash, appliedMigrationHashes: migrationChecksums(process.cwd(), 16),
      runtime: { node: process.version, postgres: serverVersion, pg: JSON.parse(readFileSync('node_modules/pg/package.json', 'utf8')).version },
      services: { Auth: 'NOT_RUN', REST: 'NOT_RUN', Storage: 'NOT_RUN', Realtime: 'NOT_RUN' } };
    const header = { schemaVersion: 1, runId, sourceFingerprint, executionProfile };
    return { header, inventory: { ...header, ...inventory }, preflight: { ...header, ...plan,
      contract: MIGRATION_PLAN_CONTRACT, blockerReasons: MIGRATION_BLOCKER_REASONS,
      safety: { readOnlyTransaction: readOnly, completeObserver: true, before, after, databaseUnchanged: true },
      inputMappingHashes: mappings.map(m => validMappingEvidence(m) ? digest(m) : null) }, execution: { commandId, startedAt,
      finishedAt: new Date().toISOString(), outcome: plan.status, scope: 'TC48-preflight/TC49-data; no activation' } };
  } catch (error) {
    if (connected) await db.query('rollback').catch(() => {});
    if (error instanceof PreflightError) throw error;
    // Driver errors and arbitrary input rows can contain secrets; never print them.
    throw new PreflightError('PREFLIGHT_UNAVAILABLE');
  } finally { await db.end().catch(() => {}); }
}
