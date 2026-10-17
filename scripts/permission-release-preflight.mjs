import { readFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { captureSnapshot, permissionFingerprint, PreflightError, digest } from './permission-preflight-core.mjs';
import { planMigration, validMappingEvidence } from './permission-migration-plan.mjs';
import { collectInventory } from './permission-inventory.mjs';
import { activationBundleManifest, inspectExpectedEmptyTarget } from './permission-activation-bundle.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = /^[a-f0-9]{64}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = code => { throw new PreflightError(code); };
const bindingKeys = ['projectRef', 'backendHost', 'database', 'sourceFingerprint', 'bundleHash'];
const binding = target => Object.fromEntries(bindingKeys.map(key => [key, target[key]]));

export function parseReleaseTargetConfig(path) {
  if (!path) fail('EXPLICIT_TARGET_CONFIG_REQUIRED');
  const absolute = resolve(path);
  if (['.env', '.env.local'].includes(basename(absolute).toLowerCase())) fail('APPLICATION_ENV_REFUSED');
  let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); } catch { fail('INVALID_TARGET_CONFIG'); }
  const keys = ['schemaVersion', 'mode', 'connectionString', ...bindingKeys, 'storeIds', 'catalogHash', 'mappingFiles', 'expectedEmptyStoreSet'];
  const emptyOptIn = value?.expectedEmptyStoreSet === true;
  const normalSet = value?.expectedEmptyStoreSet === undefined || value?.expectedEmptyStoreSet === false;
  const validTargetSet = Array.isArray(value?.storeIds) && Array.isArray(value?.mappingFiles)
    && ((emptyOptIn && value.storeIds.length === 0 && value.mappingFiles.length === 0)
      || (normalSet && value.storeIds.length > 0));
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || value.schemaVersion !== 1
    || value.mode !== 'release-read-only-preflight' || typeof value.connectionString !== 'string'
    || !/^[-a-z0-9]{3,80}$/i.test(value.projectRef ?? '') || typeof value.backendHost !== 'string' || !value.backendHost
    || typeof value.database !== 'string' || !value.database || !validTargetSet
    || new Set(value.storeIds).size !== value.storeIds.length || value.storeIds.some(id => !uuid.test(id))
    || !sha.test(value.catalogHash ?? '') || !sha.test(value.sourceFingerprint ?? '') || !sha.test(value.bundleHash ?? '')
    || value.mappingFiles.some(item => typeof item !== 'string' || !item)) fail('INVALID_TARGET_CONFIG');
  let url;
  try { url = new URL(value.connectionString); } catch { fail('INVALID_TARGET_CONFIG'); }
  // The pg driver allows query host/user/port to override URL components.
  // Only SSL mode is supported; target routing must come from the bound URL.
  if (url.hash || [...url.searchParams.keys()].some(key => key !== 'sslmode')
    || url.searchParams.getAll('sslmode').length > 1
    || (url.searchParams.has('sslmode') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')))) fail('TARGET_BINDING_MISMATCH');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== value.backendHost
    || decodeURIComponent(url.pathname.slice(1)) !== value.database) fail('TARGET_BINDING_MISMATCH');
  // Match project identity encoded in Supabase direct hosts/pooler usernames.
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  const pooler = /\.pooler\.supabase\.com$/.test(url.hostname);
  if ((direct && direct[1] !== value.projectRef) || (pooler && decodeURIComponent(url.username) !== 'postgres.' + value.projectRef)) fail('TARGET_BINDING_MISMATCH');
  return { ...value, path: absolute, mappingFiles: value.mappingFiles.map(item => resolve(dirname(absolute), item)) };
}

// Separate live envelope; never translate synthetic proof into release proof.
export function readReleaseMappings(target) {
  return target.mappingFiles.map(path => {
    let value;
    try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { fail('INVALID_RELEASE_MAPPING'); }
    if (!record(value) || Object.keys(value).some(key => !['schemaVersion', 'kind', 'binding', 'mapping'].includes(key))
      || value.schemaVersion !== 1 || value.kind !== 'release-owner-mapping'
      || !record(value.binding) || Object.keys(value.binding).length !== bindingKeys.length
      || bindingKeys.some(key => value.binding[key] !== target[key])
      || !validMappingEvidence(value.mapping, 'release')) fail('INVALID_RELEASE_MAPPING');
    return value.mapping;
  });
}

export function buildReleaseReview(target, stores, employees, snapshotHash, mappings, emptyTargetEvidence = null) {
  if (target.expectedEmptyStoreSet === true) {
    const ready = stores.length === 0 && employees.length === 0 && mappings.length === 0
      && emptyTargetEvidence?.schemaMatches === true && emptyTargetEvidence?.empty === true;
    return {
      schemaVersion: 1, status: ready ? 'READY' : 'NEEDS_REVIEW', ...binding(target), snapshotHash,
      catalogHash: target.catalogHash, expectedEmptyStoreSet: true, humanIdentityVerifiedByTool: false,
      missingMappingStoreIds: [], inputMappingHashes: [], stores: [], employees: [],
      emptyTarget: emptyTargetEvidence ? {
        schemaMatches: emptyTargetEvidence.schemaMatches,
        empty: emptyTargetEvidence.empty,
        relations: emptyTargetEvidence.actualRelations,
        rowCounts: emptyTargetEvidence.rowCounts,
      } : null,
    };
  }
  const plan = planMigration({ stores, employees, mappings, snapshotHash, evidenceProfile: 'release' });
  const missingMappingStoreIds = stores.filter(store => !mappings.some(mapping => mapping.storeId === store.id)).map(store => store.id);
  return {
    schemaVersion: 1, status: plan.status === 'READY' && !missingMappingStoreIds.length ? 'READY' : 'NEEDS_REVIEW',
    ...binding(target), snapshotHash, catalogHash: target.catalogHash,
    expectedEmptyStoreSet: false, humanIdentityVerifiedByTool: false, missingMappingStoreIds,
    inputMappingHashes: mappings.map(mapping => digest(mapping)), stores: plan.stores,
    employees: employees.map(employee => ({ employeeId: employee.id, storeId: employee.storeId, name: employee.name, role: employee.role, isActive: employee.isActive })),
  };
}

export async function runReleasePreflight(path) {
  const target = parseReleaseTargetConfig(path);
  if (permissionFingerprint() !== target.sourceFingerprint) fail('SOURCE_FINGERPRINT_MISMATCH');
  if (activationBundleManifest().sha256 !== target.bundleHash) fail('BUNDLE_HASH_MISMATCH');
  const mappings = readReleaseMappings(target);
  const db = new pg.Client({ connectionString: target.connectionString, connectionTimeoutMillis: 5000, statement_timeout: 30000, application_name: 'pos-cafe-release-readonly' });
  let connected = false;
  try {
    await db.connect(); connected = true;
    await db.query('begin isolation level repeatable read read only');
    await db.query('set local row_security=off');
    const observer = (await db.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
    if (!observer || (!observer.rolsuper && !observer.rolbypassrls)) fail('OBSERVER_CANNOT_READ_COMPLETE_TARGET');
    const stores = (await db.query('select id,name from public.stores order by id')).rows;
    if (JSON.stringify(stores.map(store => store.id).sort()) !== JSON.stringify([...target.storeIds].sort())) fail('TARGET_STORE_SET_MISMATCH');
    const inventory = await collectInventory(db);
    if (inventory.catalogHash !== target.catalogHash) fail('CATALOG_STATE_MISMATCH');
    let emptyTargetEvidence = null;
    if (target.expectedEmptyStoreSet === true) {
      emptyTargetEvidence = await inspectExpectedEmptyTarget(db);
      if (!emptyTargetEvidence.schemaMatches) fail('TARGET_TENANT_SCHEMA_MISMATCH');
      if (emptyTargetEvidence.storeIds.length !== 0) fail('TARGET_STORE_SET_MISMATCH');
      if (!emptyTargetEvidence.empty) fail('RELEASE_TARGET_NOT_EMPTY');
    }
    const snapshot = await captureSnapshot(db);
    const employees = (await db.query(`select id,store_id as "storeId",name,role::text,is_active as "isActive",
      to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",
      permission_overrides as "permissionOverrides" from public.employees order by id`)).rows;
    const report = buildReleaseReview(target, stores, employees, snapshot.hash, mappings, emptyTargetEvidence);
    if ((await db.query('show transaction_read_only')).rows[0].transaction_read_only !== 'on') fail('READONLY_REQUIRED');
    await db.query('rollback');
    if (permissionFingerprint() !== target.sourceFingerprint) fail('SOURCE_CHANGED_DURING_RUN');
    return { ...report, readOnlyTransaction: true, observedAt: new Date().toISOString() };
  } catch (error) {
    if (connected) await db.query('rollback').catch(() => {});
    throw error instanceof PreflightError ? error : new PreflightError('PREFLIGHT_UNAVAILABLE');
  } finally { if (connected) await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await runReleasePreflight(process.argv[2]);
    process.stdout.write(JSON.stringify(report) + '\n');
    if (report.status !== 'READY') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({ status: 'BLOCKED', code: error instanceof PreflightError ? error.reason : 'PERMISSION_TOOL_UNAVAILABLE' }) + '\n');
    process.exitCode = 1;
  }
}
