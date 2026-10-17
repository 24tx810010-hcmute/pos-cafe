import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { activationBundleManifest, inspectExpectedEmptyTarget } from './permission-activation-bundle.mjs';
import { ActivationError, applyActivationSteps, stripTopLevelTransactions } from './permission-activation-steps.mjs';
import { collectInventory } from './permission-inventory.mjs';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { backupV2MethodHash, requireBackupV2Cutover } from './permission-backup-v2-core.mjs';
import { guardHostedBackupForRelease } from './permission-backup-dispatch.mjs';

const sha = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);

export class ReleaseCutoverError extends Error {
  constructor(code) { super(code); this.name = 'ReleaseCutoverError'; this.code = code; }
}
const fail = code => { throw new ReleaseCutoverError(code); };
export const RELEASE_PREPARE_RESTORE_SQL = `alter role authenticator reset pgrst.db_pre_request;
drop function public.permission_contract_probe();
drop function public.permission_contract_pre_request();
drop function private.assert_permission_contract();
drop table private.permission_contract_gate;
notify pgrst,'reload config';
notify pgrst,'reload schema';`;

function writeExclusiveDurable(path, value) {
  let fd;
  try {
    fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify(value, null, 2));
    fsyncSync(fd);
  } finally { if (fd !== undefined) closeSync(fd); }
}

function readPinned(path, expectedHash, code, parseJson = true) {
  let bytes;
  try { bytes = readFileSync(path); } catch { fail(`${code}_MISSING`); }
  if (hash(bytes) !== expectedHash) fail(`${code}_HASH_MISMATCH`);
  if (!parseJson) return bytes.toString('utf8');
  try { return JSON.parse(bytes.toString('utf8')); } catch { fail(`${code}_INVALID_JSON`); }
}

function resolvePinned(base, value, code) {
  if (!record(value) || Object.keys(value).some(key => !['path', 'sha256'].includes(key))
    || typeof value.path !== 'string' || !value.path || !sha.test(value.sha256 ?? '')) fail(`INVALID_${code}_REFERENCE`);
  return { path: resolve(base, value.path), sha256: value.sha256 };
}

function resolveRestoreProof(base, value) {
  const keys = ['comparison', 'inputManifest', 'execution', 'independentComparison', 'catalogSupplement'];
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !record(value[key]))) fail('INVALID_RESTORE_PROOF_REFERENCE');
  return Object.fromEntries(keys.map(key => [key, resolvePinned(base, value[key], `RESTORE_${key.toUpperCase()}`)]));
}

function validateTargetUrl(value) {
  let url;
  try { url = new URL(value.connectionString); } catch { fail('INVALID_RELEASE_CUTOVER_CONFIG'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash
    || [...url.searchParams.keys()].some(key => key !== 'sslmode')
    || url.searchParams.getAll('sslmode').length > 1
    || (url.searchParams.has('sslmode') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')))
    || url.hostname !== value.backendHost || decodeURIComponent(url.pathname.slice(1)) !== value.database) fail('TARGET_BINDING_MISMATCH');
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  const pooler = /\.pooler\.supabase\.com$/.test(url.hostname);
  if ((direct && direct[1] !== value.projectRef)
    || (pooler && decodeURIComponent(url.username) !== `postgres.${value.projectRef}`)) fail('TARGET_BINDING_MISMATCH');
  const localTarget = ['127.0.0.1', 'localhost', '[::1]'].includes(value.backendHost);
  if ((!localTarget && url.searchParams.get('sslmode') !== 'verify-full') || (localTarget && url.searchParams.has('sslmode'))) fail('INVALID_TLS_BINDING');
}

export function parseReleaseCutoverConfig(path) {
  if (!path) fail('EXPLICIT_RELEASE_CUTOVER_CONFIG_REQUIRED');
  const absolute = resolve(path);
  if (['.env', '.env.local'].includes(basename(absolute).toLowerCase())) fail('APPLICATION_ENV_REFUSED');
  let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); } catch { fail('INVALID_RELEASE_CUTOVER_CONFIG'); }
  const keys = ['schemaVersion', 'mode', 'connectionString', 'projectRef', 'backendHost', 'database', 'executionRole',
    'sourceFingerprint', 'bundleHash', 'inventory', 'backupProof', 'restoreProof', 'prepareProof', 'prepareSql',
    'restorePrepareSql', 'tlsCa', 'unixSocket', 'isolationProof', 'restProbeKeyEnv', 'storageJournalPath', 'timeouts'];
  const socketMode = record(value?.unixSocket);
  const validSocket = socketMode && Object.keys(value.unixSocket).every(key => ['host', 'port', 'user'].includes(key))
    && typeof value.unixSocket.host === 'string' && /^\/[A-Za-z0-9/_.-]+$/.test(value.unixSocket.host)
    && Number.isInteger(value.unixSocket.port) && value.unixSocket.port > 0 && value.unixSocket.port <= 65535
    && typeof value.unixSocket.user === 'string' && /^[a-z_][a-z0-9_]*$/.test(value.unixSocket.user);
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || value.schemaVersion !== 1
    || (value.mode !== undefined && !['rehearsal-rollback', 'release-commit', 'isolated-commit-rehearsal'].includes(value.mode))
    || (!socketMode && (typeof value.connectionString !== 'string' || !value.connectionString))
    || (socketMode && (!validSocket || value.connectionString !== undefined || value.mode === 'release-commit' || !record(value.isolationProof)
      || value.backendHost !== `unix:${value.unixSocket.host}`))
    || (!socketMode && value.mode === 'isolated-commit-rehearsal')
    || !/^[-a-z0-9]{3,80}$/i.test(value.projectRef ?? '') || typeof value.backendHost !== 'string' || !value.backendHost
    || typeof value.database !== 'string' || !value.database || typeof value.executionRole !== 'string' || !value.executionRole
    || !sha.test(value.sourceFingerprint ?? '') || !sha.test(value.bundleHash ?? '')
    || typeof value.restProbeKeyEnv !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.restProbeKeyEnv)
    || typeof value.storageJournalPath !== 'string' || !value.storageJournalPath
    || !record(value.timeouts) || Object.keys(value.timeouts).some(key => !['lockMs', 'statementMs', 'probeAttempts', 'probeDelayMs', 'probeTimeoutMs'].includes(key))
    || !Number.isInteger(value.timeouts.lockMs) || value.timeouts.lockMs < 1 || value.timeouts.lockMs > 120_000
    || !Number.isInteger(value.timeouts.statementMs) || value.timeouts.statementMs < 1 || value.timeouts.statementMs > 900_000
    || !Number.isInteger(value.timeouts.probeAttempts) || value.timeouts.probeAttempts < 1 || value.timeouts.probeAttempts > 60
    || !Number.isInteger(value.timeouts.probeDelayMs) || value.timeouts.probeDelayMs < 0 || value.timeouts.probeDelayMs > 5_000
    || !Number.isInteger(value.timeouts.probeTimeoutMs) || value.timeouts.probeTimeoutMs < 100 || value.timeouts.probeTimeoutMs > 30_000) {
    fail('INVALID_RELEASE_CUTOVER_CONFIG');
  }
  if (!socketMode) validateTargetUrl(value);
  const base = dirname(absolute);
  const localTarget = socketMode || ['127.0.0.1', 'localhost', '[::1]'].includes(value.backendHost);
  if ((!localTarget && !record(value.tlsCa)) || (localTarget && value.tlsCa !== undefined)) fail('INVALID_TLS_BINDING');
  const result = {
    ...value, mode: value.mode ?? 'rehearsal-rollback', path: absolute, storageJournalPath: resolve(base, value.storageJournalPath),
    inventory: resolvePinned(base, value.inventory, 'INVENTORY'),
    backupProof: resolvePinned(base, value.backupProof, 'BACKUP_PROOF'),
    restoreProof: resolveRestoreProof(base, value.restoreProof),
    prepareProof: resolvePinned(base, value.prepareProof, 'PREPARE_PROOF'),
    prepareSql: resolvePinned(base, value.prepareSql, 'PREPARE_SQL'),
    restorePrepareSql: resolvePinned(base, value.restorePrepareSql, 'RESTORE_PREPARE_SQL'),
  };
  if (!localTarget) result.tlsCa = resolvePinned(base, value.tlsCa, 'TLS_CA');
  if (socketMode) result.isolationProof = resolvePinned(base, value.isolationProof, 'ISOLATION_PROOF');
  return result;
}

const binding = config => ({ projectRef: config.projectRef, backendHost: config.backendHost, database: config.database,
  sourceFingerprint: config.sourceFingerprint, bundleHash: config.bundleHash });

export function loadReleaseEvidence(config) {
  // Every file and source binding is checked before the first database query.
  guardHostedBackupForRelease(config.backupProof, config);
  const inventory = readPinned(config.inventory.path, config.inventory.sha256, 'INVENTORY');
  const backup = readPinned(config.backupProof.path, config.backupProof.sha256, 'BACKUP_PROOF');
  if (backup?.schemaVersion === 2 || backup?.kind === 'permission-logical-backup') {
    // v2 is recomputed from its pinned graph; B/I alone never opens C.
    requireBackupV2Cutover(config.backupProof, { sourceFingerprint: config.sourceFingerprint,
      projectRef: config.projectRef, methodSha256: backupV2MethodHash() });
    fail('BACKUP_V2_CUTOVER_ADAPTER_UNSUPPORTED');
  }
  const restore = {
    comparison: readPinned(config.restoreProof.comparison.path, config.restoreProof.comparison.sha256, 'RESTORE_COMPARISON'),
    inputManifest: readPinned(config.restoreProof.inputManifest.path, config.restoreProof.inputManifest.sha256, 'RESTORE_INPUT_MANIFEST'),
    execution: readPinned(config.restoreProof.execution.path, config.restoreProof.execution.sha256, 'RESTORE_EXECUTION'),
    independentComparison: readPinned(config.restoreProof.independentComparison.path, config.restoreProof.independentComparison.sha256, 'RESTORE_INDEPENDENT_COMPARISON'),
    catalogSupplement: readPinned(config.restoreProof.catalogSupplement.path, config.restoreProof.catalogSupplement.sha256, 'RESTORE_CATALOG_SUPPLEMENT'),
  };
  const prepare = readPinned(config.prepareProof.path, config.prepareProof.sha256, 'PREPARE_PROOF');
  const prepareSql = readPinned(config.prepareSql.path, config.prepareSql.sha256, 'PREPARE_SQL', false);
  const restorePrepareSql = readPinned(config.restorePrepareSql.path, config.restorePrepareSql.sha256, 'RESTORE_PREPARE_SQL', false);
  let isolation = null;
  if (config.unixSocket) {
    isolation = readPinned(config.isolationProof.path, config.isolationProof.sha256, 'ISOLATION_PROOF');
    if (!record(isolation) || typeof isolation.name !== 'string' || !isolation.name
      || typeof isolation.volume !== 'string' || !isolation.volume || typeof isolation.image !== 'string' || !isolation.image
      || typeof isolation.sourceRestore !== 'string' || !isolation.sourceRestore
      || typeof isolation.sourceVolume !== 'string' || !isolation.sourceVolume
      || isolation.copyMethod !== 'offline cp -a from readonly validated source volume'
      || isolation.network !== 'none' || !Array.isArray(isolation.ports) || isolation.ports.length !== 0
      || isolation.dbSocket !== config.unixSocket.host || isolation.database !== config.database
      || isolation.executionRole !== config.executionRole || typeof isolation.createdAt !== 'string') fail('ISOLATION_PROOF_INVALID');
  }
  const ids = inventory?.currentStoreIds;
  const expectedBinding = binding(config);
  if (inventory?.projectRef !== config.projectRef || !Array.isArray(ids) || ids.length === 0
    || ids.some(id => !uuid.test(id)) || new Set(ids).size !== ids.length
    || JSON.stringify([...ids].sort()) !== JSON.stringify([...(inventory.baselineStoreIds ?? [])].sort())
    || inventory.authUsers?.matchedScopeStoreIds !== ids.length || !Number.isInteger(inventory.authUsers?.outsideScope)
    || !Number.isInteger(inventory.storage?.totalObjects)) fail('INVENTORY_SCOPE_INVALID');
  if (backup?.status !== 'VALIDATED_LOGICAL_BACKUP' || backup.projectRef !== config.projectRef
    || backup.storeBaselineExactMatch !== true || backup.storeBaselineCount !== ids.length) fail('BACKUP_PROOF_INVALID');
  const comparison = restore.comparison;
  const input = restore.inputManifest;
  const execution = restore.execution;
  const independent = restore.independentComparison;
  const supplement = restore.catalogSupplement;
  const restoreHashes = Object.fromEntries(Object.entries(config.restoreProof).filter(([key]) => key !== 'catalogSupplement').map(([key, ref]) => [key, ref.sha256]));
  if (comparison?.status !== 'RESTORE_DATA_AND_RECORDED_METADATA_MATCHED' || comparison.failedCount !== 0 || comparison.liveMutations !== false
    || !Array.isArray(comparison.checks) || comparison.checks.length === 0 || comparison.checks.some(check => check.matched !== true)
    || input?.backupManifestSha256 !== config.backupProof.sha256
    || execution?.backupManifestSha256 !== config.backupProof.sha256 || execution.restoreInputManifestSha256 !== config.restoreProof.inputManifest.sha256
    || execution.liveMutations !== false || execution.roleFlagsRestored !== true
    || independent?.status !== 'INDEPENDENT_SCHEMA_AND_GLOBAL_ROLES_COMPARISON_PASSED'
    || independent.readOnlyDatabaseOperations !== true || independent.liveDatabaseConnections !== false
    || comparison.container !== execution.container || independent.container !== execution.container
    || input.restoreInstanceId !== execution.restoreInstanceId || independent.restoreInstanceId !== execution.restoreInstanceId
    || comparison.backupDirectory !== input.backupDirectory || execution.backupDirectory !== input.backupDirectory
    || supplement?.schemaVersion !== 1 || supplement.kind !== 'permission-release-catalog-supplement'
    || stable(supplement.binding) !== stable(expectedBinding) || supplement.backupManifestSha256 !== config.backupProof.sha256
    || stable(supplement.restoreArtifactHashes) !== stable(restoreHashes)
    || (config.unixSocket ? supplement.sourceContainer !== execution.container || supplement.sourceRestoreInstanceId !== execution.restoreInstanceId
      || supplement.container !== isolation?.name || isolation?.sourceRestore !== execution.container || isolation?.image !== execution.image
      || supplement.isolationProofSha256 !== config.isolationProof.sha256
      : supplement.container !== execution.container || supplement.restoreInstanceId !== execution.restoreInstanceId)
    || !record(supplement.baseline)
    || !sha.test(supplement.baseline.releaseCatalogHash ?? '') || !sha.test(supplement.baseline.inventoryCatalogHash ?? '')
    || !sha.test(supplement.baseline.prepareStateHash ?? '') || !Array.isArray(supplement.cleanupRelations)
    || !sha.test(supplement.cleanupFkHash ?? '') || supplement.actor?.superuser !== false || supplement.actor?.bypassRls !== true
    || !record(supplement.freshBackupComparison) || supplement.freshBackupComparison.status !== 'MATCHED_REPEATABLE_READ_ISOLATED'
    || supplement.freshBackupComparison.metadataSha256 !== backup.files?.['metadata.json']
    || !Number.isInteger(supplement.freshBackupComparison.tableCount) || supplement.freshBackupComparison.tableCount !== backup.tableDataCount
    || !Array.isArray(supplement.freshBackupComparison.observations)
    || supplement.freshBackupComparison.observations.length !== supplement.freshBackupComparison.tableCount
    || !sha.test(supplement.freshBackupComparison.observationsSha256 ?? '')
    || supplement.freshBackupComparison.observationsSha256 !== hash(stable(supplement.freshBackupComparison.observations))) fail('RESTORE_PROOF_INVALID');
  const proofKeys = ['schemaVersion', 'kind', 'binding', 'baseline', 'prepared', 'prepareSqlSha256',
    'restorePrepareSqlSha256', 'restProbe', 'restoreProbe', 'storageObjects', 'cleanupRelations', 'cleanupFkHash'];
  if (!record(prepare) || Object.keys(prepare).some(key => !proofKeys.includes(key)) || prepare.schemaVersion !== 1
    || prepare.kind !== 'permission-release-prepare-proof' || stable(prepare.binding) !== stable(expectedBinding)
    || prepare.prepareSqlSha256 !== config.prepareSql.sha256 || prepare.restorePrepareSqlSha256 !== config.restorePrepareSql.sha256
    || !record(prepare.baseline) || Object.keys(prepare.baseline).some(key => !['inventoryCatalogHash', 'releaseCatalogHash', 'prepareStateHash'].includes(key))
    || !record(prepare.prepared) || Object.keys(prepare.prepared).some(key => !['inventoryCatalogHash', 'releaseCatalogHash', 'prepareStateHash'].includes(key))
    || !sha.test(prepare.baseline.inventoryCatalogHash ?? '') || !sha.test(prepare.baseline.prepareStateHash ?? '')
    || !sha.test(prepare.baseline.releaseCatalogHash ?? '') || stable(prepare.baseline) !== stable(supplement.baseline)
    || !sha.test(prepare.prepared.inventoryCatalogHash ?? '') || !sha.test(prepare.prepared.prepareStateHash ?? '') || !sha.test(prepare.prepared.releaseCatalogHash ?? '')
    || !Array.isArray(prepare.cleanupRelations) || prepare.cleanupRelations.length === 0
    || prepare.cleanupRelations.some(value => typeof value !== 'string' || !/^(?:auth|public|private)\.[a-z_][a-z0-9_]*$/.test(value))
    || new Set(prepare.cleanupRelations).size !== prepare.cleanupRelations.length || !sha.test(prepare.cleanupFkHash ?? '')
    || stable([...prepare.cleanupRelations].sort()) !== stable([...supplement.cleanupRelations].sort()) || prepare.cleanupFkHash !== supplement.cleanupFkHash
    || !validProbe(prepare.restProbe) || !validProbe(prepare.restoreProbe)
    || prepare.restProbe.expectedHookHeader !== 'pass-through' || prepare.restoreProbe.expectedHookHeader !== null
    || !Array.isArray(prepare.storageObjects) || prepare.storageObjects.length !== inventory.storage.totalObjects - outsideStorageCount(inventory)
    || prepare.storageObjects.some(object => !record(object) || Object.keys(object).some(key => !['id', 'bucket', 'object', 'version', 'size', 'sha256'].includes(key))
      || typeof object.id !== 'string' || !uuid.test(object.id) || typeof object.bucket !== 'string' || !object.bucket || typeof object.object !== 'string' || !object.object
      || !ids.includes(object.object.split('/')[0]) || typeof object.version !== 'string' || !object.version
      || !Number.isInteger(object.size) || object.size < 0 || !sha.test(object.sha256 ?? ''))
    || new Set(prepare.storageObjects.map(object => `${object.bucket}/${object.object}`)).size !== prepare.storageObjects.length
    || new Set(prepare.storageObjects.map(object => object.id)).size !== prepare.storageObjects.length) {
    fail('PREPARE_PROOF_INVALID');
  }
  for (const sqlText of [prepareSql, restorePrepareSql]) {
    const visible = stripTopLevelTransactions(sqlText);
    if (/\b(?:vacuum|create\s+database|alter\s+system|reindex\s+concurrently|create\s+index\s+concurrently)\b/i.test(visible)
      || /\b(?:delete|insert|update|truncate)\s+(?:from\s+|into\s+)?(?:auth|public|storage)\./i.test(visible)) fail('PREPARE_SQL_SCOPE_REFUSED');
  }
  if (resolve(config.prepareSql.path) !== resolve('supabase/candidate/permission-compatibility-prepare.sql')) fail('PREPARE_SQL_PATH_REFUSED');
  if (restorePrepareSql.trim() !== RELEASE_PREPARE_RESTORE_SQL) fail('RESTORE_PREPARE_SQL_REFUSED');
  for (const probe of [prepare.restProbe, prepare.restoreProbe]) {
    const url = new URL(probe.url);
    const localTarget = Boolean(config.unixSocket) || ['127.0.0.1', 'localhost', '[::1]'].includes(config.backendHost);
    const validHost = localTarget ? ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      : url.hostname === `${config.projectRef}.supabase.co` && url.protocol === 'https:';
    if (!validHost || url.pathname !== '/rest/v1/rpc/permission_contract_probe' || url.search) fail('REST_PROBE_TARGET_MISMATCH');
  }
  let metadata;
  const metadataHash = backup.files?.['metadata.json'];
  if (!sha.test(metadataHash ?? '')) fail('BACKUP_PROOF_INVALID');
  metadata = readPinned(resolve(dirname(config.backupProof.path), 'metadata.json'), metadataHash, 'BACKUP_METADATA');
  if (!Array.isArray(metadata.tableData) || metadata.tableData.length !== backup.tableDataCount) fail('BACKUP_METADATA_INVALID');
  const expectedFreshObservations = metadata.tableData.map(row => ({ relation: `${row.schema}.${row.name}`,
    rowCount: row.rowCount, sha256: row.sha256 })).sort((left, right) => left.relation.localeCompare(right.relation));
  const freshObservations = [...supplement.freshBackupComparison.observations]
    .sort((left, right) => String(left?.relation).localeCompare(String(right?.relation)));
  if (stable(freshObservations) !== stable(expectedFreshObservations)) fail('RESTORE_PROOF_INVALID');
  const activationManifest = activationBundleManifest();
  const activationSqlFiles = new Map(activationManifest.files.map(file => [file.path,
    readPinned(resolve(file.path), file.sha256, 'ACTIVATION_SQL', false)]));
  return { inventory, backup, restore, prepare, prepareSql, restorePrepareSql, backupMetadata: metadata,
    activationSqlFiles, isolation, targetIds: [...ids].sort() };
}

function outsideStorageCount(inventory) {
  return (inventory.storage?.objectCountsByBucketAndStorePrefix ?? [])
    .filter(row => row.prefix_in_scope === false).reduce((sum, row) => sum + Number(row.total_objects ?? 0), 0);
}

function validProbe(value) {
  if (!record(value) || Object.keys(value).some(key => !['url', 'method', 'body', 'expectedStatus', 'expectedBodySha256', 'expectedHookHeader'].includes(key))
    || typeof value.url !== 'string' || !value.url || !['GET', 'POST'].includes(value.method)
    || !Number.isInteger(value.expectedStatus) || value.expectedStatus < 100 || value.expectedStatus > 599
    || !sha.test(value.expectedBodySha256 ?? '') || !['pass-through', null].includes(value.expectedHookHeader)) return false;
  try { const url = new URL(value.url); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash; } catch { return false; }
}

export async function capturePrepareState(db) {
  const inventory = await collectInventory(db);
  const setting = (await db.query(`select coalesce(d.datname,'*') database,coalesce(r.rolname,'*') role,setting
    from pg_db_role_setting s left join pg_database d on d.oid=nullif(s.setdatabase,0) left join pg_roles r on r.oid=nullif(s.setrole,0),
    lateral unnest(s.setconfig) setting where (s.setdatabase in(0,(select oid from pg_database where datname=current_database())))
    and (s.setrole in(0,(select oid from pg_roles where rolname='authenticator'))) and setting like 'pgrst.db_pre_request=%' order by 1,2,3`)).rows;
  const roleConfig = (await db.query("select rolname role,rolconfig config from pg_roles where rolname='authenticator'")).rows;
  const functions = (await db.query(`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,
    pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.proconfig config,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname,p.proname) in (('public','permission_contract_pre_request'),('public','permission_contract_probe'),('private','assert_permission_contract')) order by schema,name,arguments`)).rows;
  const gate = (await db.query("select to_regclass('private.permission_contract_gate')::text relation")).rows;
  return { inventoryCatalogHash: inventory.catalogHash, releaseCatalogHash: await captureReleaseCatalogHash(db),
    prepareStateHash: hash(stable({ setting, roleConfig, functions, gate })) };
}

export async function assertReleasePrepareBaselineAbsent(db) {
  const row = (await db.query(`select
    (select count(*)::int from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,lateral unnest(s.setconfig) setting
      where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%') settings,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
      (n.nspname,p.proname) in (('public','permission_contract_pre_request'),('public','permission_contract_probe'),('private','assert_permission_contract'))) functions,
    (to_regclass('private.permission_contract_gate') is not null) gate`)).rows[0];
  if (!row || row.settings !== 0 || row.functions !== 0 || row.gate !== false) fail('PREEXISTING_PREPARE_SURFACE_UNSUPPORTED');
}

export async function captureReleaseCatalogHash(db) {
  const rows = (await db.query(`select kind,canonical from (
    select 'relation' kind,jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity)::text canonical
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('auth','public','private','storage')
    union all select 'column',jsonb_build_object('schema',n.nspname,'relation',c.relname,'number',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(ad.adbin,ad.adrelid),'acl',a.attacl)::text
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum where a.attnum>0 and not a.attisdropped and n.nspname in('auth','public','private','storage')
    union all select 'constraint',jsonb_build_object('schema',n.nspname,'relation',c.relname,'name',x.conname,'type',x.contype,'delete',x.confdeltype,'definition',pg_get_constraintdef(x.oid,true),'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred)::text
      from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('auth','public','private','storage')
    union all select 'trigger',jsonb_build_object('schema',n.nspname,'relation',c.relname,'name',t.tgname,'enabled',t.tgenabled,'constraintName',x.conname,'definition',pg_get_triggerdef(t.oid,true))::text
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace left join pg_constraint x on x.oid=t.tgconstraint where not t.tgisinternal and n.nspname in('auth','public','private','storage')
    union all select 'routine',jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,'definition',pg_get_functiondef(p.oid))::text
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('auth','public','private','storage') and p.prokind in('f','p')
  ) catalog order by kind,canonical`)).rows;
  return hash(stable(rows));
}

export async function runPinnedSqlTransaction(db, sqlText, config, phase) {
  let begun = false; let commitAttempted = false;
  try {
    await db.query('begin isolation level read committed'); begun = true;
    await db.query(`set local lock_timeout=${Number(config.timeouts.lockMs)}`);
    await db.query(`set local statement_timeout=${Number(config.timeouts.statementMs)}`);
    await db.query(stripTopLevelTransactions(sqlText));
    commitAttempted = true; begun = false;
    try { await db.query('commit'); }
    catch {
      const error = new ReleaseCutoverError(`${phase}_COMMIT_OUTCOME_UNKNOWN`);
      error.prepareState = 'UNKNOWN';
      throw error;
    }
  } catch (error) {
    if (commitAttempted) throw error;
    if (begun) await db.query('rollback').catch(() => {});
    throw error;
  }
}

export async function probeReleaseRest(spec, key, fetchImpl, timeouts) {
  for (let attempt = 1; attempt <= timeouts.probeAttempts; attempt++) {
    try {
      const response = await fetchImpl(spec.url, { method: spec.method, redirect: 'error', signal: AbortSignal.timeout(timeouts.probeTimeoutMs), headers: {
        apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      }, body: spec.method === 'POST' ? JSON.stringify(spec.body ?? {}) : undefined });
      const body = Buffer.from(await response.arrayBuffer());
      if (response.status === spec.expectedStatus && hash(body) === spec.expectedBodySha256
        && response.headers.get('x-pos-permission-hook') === spec.expectedHookHeader) return { status: response.status, bodySha256: hash(body), hook: spec.expectedHookHeader };
    } catch { /* readiness is retried; details and credentials are never logged */ }
    if (attempt < timeouts.probeAttempts && timeouts.probeDelayMs) await new Promise(done => setTimeout(done, timeouts.probeDelayMs));
  }
  fail('REST_PROBE_FAILED');
}

export function hasSupportedSupabaseProviderCapabilities(row) {
  const tokens = value => {
    if (typeof value !== 'string') return [];
    const values = value.split(',').map(token => token.trim());
    return values.every(token => /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*|\.\*|\*)?$/.test(token)) ? values : [];
  };
  if (!row || row.provider_role_usable !== true
    || ![...tokens(row.shared_preload), ...tokens(row.session_preload)].includes('supautils')
    || !Array.isArray(row.provider_settings)) return false;
  const names = ['supautils.privileged_role', 'supautils.privileged_role_allowed_configs',
    'supautils.reserved_roles', 'supautils.policy_grants'];
  if (row.provider_settings.length !== names.length
    || row.provider_settings.some(setting => !record(setting) || !names.includes(setting.name)
      || typeof setting.setting !== 'string' || setting.context !== 'sighup'
      || !['configuration file', 'command line'].includes(setting.source) || setting.pending_restart !== false)
    || new Set(row.provider_settings.map(setting => setting.name)).size !== names.length) return false;
  const settings = Object.fromEntries(row.provider_settings.map(setting => [setting.name, setting.setting]));
  if (settings['supautils.privileged_role'] !== 'supabase_privileged_role'
    || !tokens(settings['supautils.privileged_role_allowed_configs']).some(token => ['pgrst.db_pre_request', 'pgrst.*'].includes(token))
    || !tokens(settings['supautils.reserved_roles']).includes('authenticator*')) return false;
  let grants;
  try { grants = JSON.parse(settings['supautils.policy_grants']); } catch { return false; }
  return record(grants) && Object.hasOwn(grants, row.role) && Array.isArray(grants[row.role])
    && grants[row.role].every(table => typeof table === 'string') && grants[row.role].includes('storage.objects');
}

export async function readReleaseExecutionCapabilities(db) {
  return (await db.query(`select current_user role,r.rolsuper superuser,r.rolbypassrls bypass_rls,r.rolcreaterole can_alter_roles,
    has_parameter_privilege(current_user,'pgrst.db_pre_request','SET') can_set_pgrst_hook,
    pg_has_role(current_user,c.relowner,'USAGE') can_manage_storage_objects,
    pg_get_userbyid(c.relowner) storage_objects_owner,
    current_setting('shared_preload_libraries') shared_preload,current_setting('session_preload_libraries') session_preload,
    exists(select 1 from pg_roles p where p.rolname='supabase_privileged_role'
      and pg_has_role(current_user,p.oid,'USAGE')) provider_role_usable,
    (select coalesce(jsonb_agg(jsonb_build_object('name',s.name,'setting',s.setting,'context',s.context,
      'source',s.source,'pending_restart',s.pending_restart) order by s.name),'[]'::jsonb) from pg_settings s
      where s.name in('supautils.privileged_role','supautils.privileged_role_allowed_configs',
        'supautils.reserved_roles','supautils.policy_grants')) provider_settings
    from pg_roles r cross join pg_class c where r.rolname=current_user and c.oid='storage.objects'::regclass`)).rows[0];
}

export async function assertReleaseExecutionRole(db, config) {
  const row = await readReleaseExecutionCapabilities(db);
  if (!row || row.role !== config.executionRole || row.superuser !== false || row.bypass_rls !== true) fail('PRODUCTION_EQUIVALENT_ROLE_REQUIRED');
  if (row.can_alter_roles !== true) fail('ALTER_ROLE_PRIVILEGE_REQUIRED');
  const provider = hasSupportedSupabaseProviderCapabilities(row);
  if (row.can_set_pgrst_hook !== true && !provider) fail('PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED');
  if (row.can_manage_storage_objects !== true && !provider) fail('STORAGE_OBJECTS_OWNERSHIP_REQUIRED');
}

export async function inspectReleaseCleanupClosure(db) {
  const edges = (await db.query(`select pn.nspname parent_schema,p.relname parent_name,cn.nspname child_schema,c.relname child_name,
    x.conname name,x.confdeltype delete_action,pg_get_constraintdef(x.oid,true) definition
    from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace cn on cn.oid=c.relnamespace
    join pg_class p on p.oid=x.confrelid join pg_namespace pn on pn.oid=p.relnamespace where x.contype='f'
    and (cn.nspname in('auth','public','private') or pn.nspname in('auth','public','private')) order by 1,2,3,4,5`)).rows;
  const relations = (await db.query(`with recursive closure(oid) as (
    select 'public.stores'::regclass::oid union select 'auth.users'::regclass::oid
    union select fk.conrelid from closure parent join pg_constraint fk on fk.confrelid=parent.oid
      where fk.contype='f'
  ) select distinct n.nspname schema,c.relname name from closure x join pg_class c on c.oid=x.oid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') order by 1,2`)).rows;
  const required = [['auth', 'refresh_tokens'], ['private', 'employee_sessions']];
  for (const [schema, name] of required) if (!relations.some(row => row.schema === schema && row.name === name)) relations.push({ schema, name });
  const ordered = relations.sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`));
  return { relations: ordered, fkHash: hash(stable(edges)) };
}

async function lockCleanupClosure(db) {
  const evidence = await inspectReleaseCleanupClosure(db);
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const ordered = evidence.relations;
  await db.query(`lock table ${ordered.map(row => `${quote(row.schema)}.${quote(row.name)}`).join(',')} in share row exclusive mode`);
  await db.query('lock table storage.objects in share mode');
  return evidence;
}

export async function verifyBackupDigests(db, evidence, lockedRelations) {
  const metadata = new Map(evidence.backupMetadata.tableData.map(row => [`${row.schema}.${row.name}`, row]));
  const locked = new Set(lockedRelations.map(row => `${row.schema}.${row.name}`));
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const observations = [];
  for (const relation of [...new Set([...locked, 'storage.objects'])].sort()) {
    const expected = metadata.get(relation);
    if (!expected || !/^\d+$/.test(expected.rowCount ?? '') || !sha.test(expected.sha256 ?? '')) fail('BACKUP_METADATA_INVALID');
    const [schema, name] = relation.split('.');
    const actual = (await db.query(`select count(*)::text "rowCount",encode(extensions.digest(convert_to(coalesce(string_agg(replace(canonical,chr(92),chr(92)||chr(92))||chr(10),'' order by canonical collate "C"),''),'UTF8'),'sha256'),'hex') sha256
      from(select to_jsonb(source_row)::text canonical from only ${quote(schema)}.${quote(name)} source_row) q`)).rows[0];
    if (actual.rowCount !== expected.rowCount || actual.sha256 !== expected.sha256) fail('LOCKED_BACKUP_DATA_DRIFT');
    observations.push({ relation, rowCount: actual.rowCount, sha256: actual.sha256 });
  }
  return observations;
}

async function recheckLockedScope(db, evidence) {
  await db.query('create temp table _release_target_ids(id uuid primary key) on commit drop');
  await db.query('insert into _release_target_ids select unnest($1::uuid[])', [evidence.targetIds]);
  const scope = (await db.query(`select
    (select count(*)::int from _release_target_ids) target_count,
    (select count(*)::int from _release_target_ids t left join public.stores s on s.id=t.id where s.id is null) missing_stores,
    (select count(*)::int from public.stores s left join _release_target_ids t on t.id=s.id where t.id is null) extra_stores,
    (select count(*)::int from auth.users u join _release_target_ids t on t.id=u.id) target_users,
    (select count(*)::int from auth.users u left join _release_target_ids t on t.id=u.id where t.id is null) outside_users,
    (select count(*)::int from storage.objects o where split_part(o.name,'/',1)=any($1::text[])) target_objects,
    (select count(*)::int from storage.objects o where not(split_part(o.name,'/',1)=any($1::text[]))) outside_objects`, [evidence.targetIds])).rows[0];
  const expectedOutsideObjects = outsideStorageCount(evidence.inventory);
  const expectedTargetObjects = evidence.inventory.storage.totalObjects - expectedOutsideObjects;
  if (scope.target_count !== evidence.targetIds.length || scope.missing_stores !== 0 || scope.extra_stores !== 0
    || scope.target_users !== evidence.targetIds.length || scope.outside_users !== evidence.inventory.authUsers.outsideScope
    || scope.target_objects !== expectedTargetObjects || scope.outside_objects !== expectedOutsideObjects) fail('LOCKED_SCOPE_DRIFT');
  const storageRows = (await db.query(`select id::text id,bucket_id bucket,name object,coalesce(version::text,id::text) version,
    coalesce((metadata->>'size')::bigint,0)::int size from storage.objects
    where split_part(name,'/',1)=any($1::text[]) order by bucket_id,name`, [evidence.targetIds])).rows;
  const expectedStorageRows = evidence.prepare.storageObjects.map(({ id, bucket, object, version, size }) => ({ id, bucket, object, version, size }))
    .sort((left, right) => `${left.bucket}/${left.object}`.localeCompare(`${right.bucket}/${right.object}`));
  if (stable(storageRows) !== stable(expectedStorageRows)) fail('LOCKED_STORAGE_METADATA_DRIFT');
}

async function snapshotAndDeleteApprovedClosure(db, lockedRelations) {
  await db.query('create temp table _release_before(schema_name text,table_name text,row_data jsonb) on commit drop');
  await db.query('create temp table _release_allowed(schema_name text,table_name text,row_data jsonb) on commit drop');
  await db.query('create unique index on _release_allowed(schema_name,table_name,row_data)');
  for (const row of lockedRelations) {
    const q = value => `"${value.replaceAll('"', '""')}"`;
    await db.query(`insert into _release_before select $1,$2,to_jsonb(source_row) from only ${q(row.schema)}.${q(row.name)} source_row`, [row.schema, row.name]);
  }
  await db.query(`insert into _release_allowed select * from _release_before where
    (schema_name='auth' and table_name='users' and (row_data->>'id')::uuid in(select id from _release_target_ids)) or
    (schema_name='auth' and table_name='refresh_tokens' and row_data->>'user_id' in(select id::text from _release_target_ids)) or
    (schema_name='private' and table_name='employee_sessions' and (row_data->>'store_id')::uuid in(select id from _release_target_ids)) on conflict do nothing`);
  await db.query(`do $closure$ declare fk record; predicate text; pass_count bigint; edge_count bigint; begin loop pass_count:=0;
    for fk in select con.oid,cn.nspname child_schema,c.relname child_table,pn.nspname parent_schema,p.relname parent_table
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace cn on cn.oid=c.relnamespace
      join pg_class p on p.oid=con.confrelid join pg_namespace pn on pn.oid=p.relnamespace
      where con.contype='f' and con.confdeltype='c' and cn.nspname in('auth','public','private') and pn.nspname in('auth','public','private') order by 2,3,con.conname
    loop select string_agg(format('(to_jsonb(child_row)->%L)=(parent_allowed.row_data->%L)',ca.attname,pa.attname),' and ' order by keys.ordinality) into predicate
      from pg_constraint x cross join lateral unnest(x.conkey,x.confkey) with ordinality keys(child_num,parent_num,ordinality)
      join pg_attribute ca on ca.attrelid=x.conrelid and ca.attnum=keys.child_num join pg_attribute pa on pa.attrelid=x.confrelid and pa.attnum=keys.parent_num where x.oid=fk.oid;
      execute format('insert into _release_allowed select %L,%L,to_jsonb(child_row) from only %I.%I child_row join _release_allowed parent_allowed on parent_allowed.schema_name=%L and parent_allowed.table_name=%L and %s on conflict do nothing',fk.child_schema,fk.child_table,fk.child_schema,fk.child_table,fk.parent_schema,fk.parent_table,predicate);
      get diagnostics edge_count=row_count; pass_count:=pass_count+edge_count; end loop; exit when pass_count=0; end loop; end $closure$`);
  await db.query('delete from private.employee_sessions where store_id in(select id from _release_target_ids)');
  await db.query("delete from auth.refresh_tokens where user_id::text in(select id::text from _release_target_ids)");
  await db.query('delete from auth.users where id in(select id from _release_target_ids)');
  await db.query('create temp table _release_after(like _release_before including all) on commit drop');
  for (const row of lockedRelations) {
    const q = value => `"${value.replaceAll('"', '""')}"`;
    await db.query(`insert into _release_after select $1,$2,to_jsonb(source_row) from only ${q(row.schema)}.${q(row.name)} source_row`, [row.schema, row.name]);
  }
  const diff = (await db.query(`with deleted as(select * from _release_before except all select * from _release_after),
    inserted as(select * from _release_after except all select * from _release_before)
    select (select count(*)::int from deleted) deleted,
      (select count(*)::int from inserted) inserted,
      (select count(*)::int from (select * from deleted except all select * from _release_allowed)x) unexpected_deleted,
      (select count(*)::int from (select * from _release_allowed except all select * from deleted)x) missing_deleted,
      (select count(*)::int from public.stores) stores,
      (select count(*)::int from public.employees) employees`)).rows[0];
  if (diff.inserted !== 0 || diff.unexpected_deleted !== 0 || diff.missing_deleted !== 0 || diff.stores !== 0 || diff.employees !== 0) fail('CLEANUP_CLOSURE_MISMATCH');
  return { deletedRows: diff.deleted, relationCount: lockedRelations.length };
}

async function captureSequenceState(db) {
  const sequences = (await db.query(`select n.nspname schema,c.relname name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='S' and n.nspname in('public','private') order by 1,2`)).rows;
  const result = [];
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  for (const sequence of sequences) {
    const row = (await db.query(`select last_value::text "lastValue",is_called "isCalled" from ${quote(sequence.schema)}.${quote(sequence.name)}`)).rows[0];
    result.push({ ...sequence, ...row });
  }
  return result;
}

async function captureRollbackState(db, evidence) {
  const names = [...evidence.prepare.cleanupRelations, 'storage.objects'];
  const relations = (await db.query(`select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in('r','p') and n.nspname||'.'||c.relname=any($1::text[]) order by 1,2`, [names])).rows;
  if (relations.length !== names.length) fail('CLEANUP_LOCK_SET_MISMATCH');
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const data = [];
  for (const relation of relations) {
    const row = (await db.query(`select count(*)::text count,encode(extensions.digest(convert_to(coalesce(string_agg(canonical||chr(10),'' order by canonical collate "C"),''),'UTF8'),'sha256'),'hex') sha256
      from(select to_jsonb(source_row)::text canonical from only ${quote(relation.schema)}.${quote(relation.name)} source_row) q`)).rows[0];
    data.push({ ...relation, ...row });
  }
  return { releaseCatalogHash: await captureReleaseCatalogHash(db), data, sequences: await captureSequenceState(db) };
}

export async function assertReleaseStrictPostflight(db) {
  await db.query('set constraints all immediate');
  const catalog = (await db.query(`select
    (select array_agg(code order by code) from public.permission_roles) roles,
    (select count(*)::int from public.permission_catalog) permissions,
    (select count(*)::int from pg_constraint where conrelid='public.employees'::regclass and conname='employees_permission_role_fk' and contype='f' and convalidated) role_fk,
    (select count(*)::int from pg_trigger where tgrelid='public.employees'::regclass and tgname='employees_owner_boundary' and tgconstraint<>0 and tgenabled<>'D') employee_owner_trigger,
    (select count(*)::int from pg_trigger where tgrelid='public.stores'::regclass and tgname='stores_owner_boundary' and tgconstraint<>0 and tgenabled<>'D') store_owner_trigger`)).rows[0];
  if (stable(catalog.roles) !== stable(['cashier', 'kitchen', 'manager', 'owner', 'waiter']) || catalog.permissions !== 15
    || catalog.role_fk !== 1 || catalog.employee_owner_trigger !== 1 || catalog.store_owner_trigger !== 1) fail('STRICT_POSTFLIGHT_FAILED');
}

export async function executeCutoverTransaction(db, config, evidence, options = {}) {
  const captureState = options.captureRollbackState ?? captureRollbackState;
  let beforeState; let ownMutationStarted = false;
  let begun = false; let commitAttempted = false;
  try {
    await db.query('begin isolation level read committed'); begun = true;
    await db.query(`set local lock_timeout=${Number(config.timeouts.lockMs)}`);
    await db.query(`set local statement_timeout=${Number(config.timeouts.statementMs)}`);
    await (options.assertExecutionRole ?? assertReleaseExecutionRole)(db, config);
    await db.query("select pg_advisory_xact_lock(hashtext('pos-cafe:permission-release-cutover'))");
    const lockEvidence = await (options.lockCleanupClosure ?? lockCleanupClosure)(db);
    const lockedRelations = lockEvidence.relations;
    if (stable(lockedRelations.map(row => `${row.schema}.${row.name}`).sort()) !== stable([...evidence.prepare.cleanupRelations].sort())
      || lockEvidence.fkHash !== evidence.prepare.cleanupFkHash) fail('CLEANUP_LOCK_SET_MISMATCH');
    await (options.recheckLockedScope ?? recheckLockedScope)(db, evidence);
    await (options.verifyBackupDigests ?? verifyBackupDigests)(db, evidence, lockedRelations);
    if (typeof options.afterLockedScope === 'function') await options.afterLockedScope();
    const preparedState = await (options.capturePrepareState ?? capturePrepareState)(db);
    if (stable(preparedState) !== stable(evidence.prepare.prepared)) fail('PREPARED_CATALOG_DRIFT');
    beforeState = await captureState(db, evidence);
    ownMutationStarted = true;
    const cleanup = await (options.snapshotAndDeleteApprovedClosure ?? snapshotAndDeleteApprovedClosure)(db, lockedRelations);
    const empty = await (options.inspectExpectedEmptyTarget ?? inspectExpectedEmptyTarget)(db);
    if (empty.schemaMatches !== true || empty.empty !== true || empty.storeIds.length !== 0) fail('CLEANUP_TARGET_NOT_EMPTY');
    if (typeof options.afterCleanup === 'function') await options.afterCleanup();
    const activation = options.applyActivationSteps ?? applyActivationSteps;
    const activated = await activation(db, { plan: { status: 'READY', stores: [] }, storeIds: [], expectedEmptyStoreSet: true,
      failAfterFragment: options.failAfterFragment, sqlFiles: evidence.activationSqlFiles });
    await (options.assertStrictPostflight ?? assertReleaseStrictPostflight)(db);
    const sourceStillPinned = options.verifySource ?? (() => permissionFingerprint() === config.sourceFingerprint
      && activationBundleManifest().sha256 === config.bundleHash);
    if (!sourceStillPinned()) fail('SOURCE_CHANGED_DURING_RUN');
    if (typeof options.beforeCommit === 'function') await options.beforeCommit();
    if (config.mode !== 'rehearsal-rollback') {
      commitAttempted = true; begun = false;
      try { await db.query('commit'); }
      catch {
        const unknown = new ReleaseCutoverError('DATABASE_COMMIT_OUTCOME_UNKNOWN');
        unknown.databaseCommitOutcomeUnknown = true;
        throw unknown;
      }
    }
    else {
      await db.query('rollback'); begun = false;
      if (stable(await captureState(db, evidence)) !== stable(beforeState)) fail('REHEARSAL_ROLLBACK_DRIFT');
    }
    return { status: config.mode === 'release-commit' ? 'COMMITTED'
      : config.mode === 'isolated-commit-rehearsal' ? 'ISOLATED_REHEARSAL_COMMITTED'
        : 'REHEARSAL_PASSED_ROLLED_BACK', cleanup, activated };
  } catch (error) {
    if (commitAttempted) throw error;
    if (begun) await db.query('rollback').catch(() => {});
    if (ownMutationStarted && stable(await captureState(db, evidence)) !== stable(beforeState)) {
      throw new ReleaseCutoverError('REHEARSAL_ROLLBACK_DRIFT');
    }
    if (error instanceof ReleaseCutoverError || error instanceof ActivationError) throw error;
    throw new ReleaseCutoverError('CUTOVER_TRANSACTION_FAILED');
  }
}

export async function runReleaseCutover(path, options = {}) {
  const config = parseReleaseCutoverConfig(path);
  if (permissionFingerprint() !== config.sourceFingerprint) fail('SOURCE_FINGERPRINT_MISMATCH');
  if (activationBundleManifest().sha256 !== config.bundleHash) fail('BUNDLE_HASH_MISMATCH');
  const evidence = loadReleaseEvidence(config);
  const restKey = process.env[config.restProbeKeyEnv];
  if (typeof restKey !== 'string' || !restKey) fail('EXPLICIT_REST_PROBE_CREDENTIAL_REQUIRED');
  const Client = options.Client ?? pg.Client;
  const tls = config.tlsCa ? { ca: readPinned(config.tlsCa.path, config.tlsCa.sha256, 'TLS_CA', false), rejectUnauthorized: true, servername: config.backendHost } : undefined;
  let connectionOptions;
  if (config.unixSocket) connectionOptions = { host: config.unixSocket.host, port: config.unixSocket.port,
    user: config.unixSocket.user, database: config.database, ssl: false };
  else {
    const connectionUrl = new URL(config.connectionString);
    connectionUrl.search = '';
    connectionOptions = { connectionString: connectionUrl.toString(), ssl: tls };
  }
  const db = new Client({ ...connectionOptions, connectionTimeoutMillis: 5_000,
    statement_timeout: config.timeouts.statementMs, application_name: 'pos-cafe-permission-release-cutover' });
  let connected = false; let prepareApplied = false; let committed = false;
  try {
    await db.connect(); connected = true;
    await (options.assertExecutionRole ?? assertReleaseExecutionRole)(db, config);
    const target = (await db.query("select current_database() database,inet_server_addr()::text server_addr,current_setting('port')::int port")).rows[0];
    if (target?.database !== config.database || (config.unixSocket && (target.server_addr !== null || target.port !== config.unixSocket.port))) fail('TARGET_BINDING_MISMATCH');
    if (config.mode !== 'rehearsal-rollback') {
      try {
        writeExclusiveDurable(config.storageJournalPath, config.mode === 'release-commit'
          ? { schemaVersion: 1, kind: 'permission-storage-cleanup-journal', binding: binding(config),
            databaseCommitted: false, status: 'PREPARED_BEFORE_DB_EFFECTS', objects: evidence.prepare.storageObjects }
          : { schemaVersion: 1, kind: 'permission-isolated-commit-rehearsal-journal', binding: binding(config),
            databaseCommitted: false, status: 'PREPARED_BEFORE_DB_EFFECTS', isolationProofSha256: config.isolationProof.sha256,
            storageApiMutationAllowed: false });
      } catch { fail('STORAGE_JOURNAL_PREPARE_FAILED'); }
    }
    const captureState = options.capturePrepareState ?? capturePrepareState;
    const baseline = await captureState(db);
    if (stable(baseline) !== stable(evidence.prepare.baseline)) fail('BASELINE_CATALOG_DRIFT');
    await (options.assertPrepareBaselineAbsent ?? assertReleasePrepareBaselineAbsent)(db);
    await runPinnedSqlTransaction(db, evidence.prepareSql, config, 'PREPARE'); prepareApplied = true;
    const prepared = await captureState(db);
    if (stable(prepared) !== stable(evidence.prepare.prepared)) fail('PREPARE_PROVENANCE_MISMATCH');
    await probeReleaseRest(evidence.prepare.restProbe, restKey, options.fetchImpl ?? fetch, config.timeouts);
    const result = await executeCutoverTransaction(db, config, evidence, options);
    committed = result.status === 'COMMITTED' || result.status === 'ISOLATED_REHEARSAL_COMMITTED';
    if (committed) {
      try {
        writeExclusiveDurable(`${config.storageJournalPath}.committed`, config.mode === 'release-commit'
          ? { schemaVersion: 1, kind: 'permission-storage-cleanup-commit-marker', binding: binding(config),
            databaseCommitted: true, status: 'PENDING_STORAGE_API' }
          : { schemaVersion: 1, kind: 'permission-isolated-commit-rehearsal-marker', binding: binding(config),
            databaseCommitted: true, status: 'ISOLATED_DATABASE_COMMITTED_NO_STORAGE_API',
            isolationProofSha256: config.isolationProof.sha256, storageApiMutationAllowed: false });
      } catch {
        const error = new ReleaseCutoverError('DATABASE_COMMITTED_JOURNAL_FINALIZE_FAILED');
        error.databaseCommitted = true;
        throw error;
      }
      prepareApplied = false;
      return { ...result, storageJournal: config.mode === 'release-commit' ? 'PENDING_STORAGE_API' : 'ISOLATED_NO_STORAGE_API' };
    }
    await runPinnedSqlTransaction(db, evidence.restorePrepareSql, config, 'RESTORE_PREPARE'); prepareApplied = false;
    const restored = await captureState(db);
    if (stable(restored) !== stable(evidence.prepare.baseline)) fail('PREPARE_RESTORE_MISMATCH');
    await probeReleaseRest(evidence.prepare.restoreProbe, restKey, options.fetchImpl ?? fetch, config.timeouts);
    if (permissionFingerprint() !== config.sourceFingerprint) fail('SOURCE_CHANGED_DURING_RUN');
    return { ...result, prepareRestored: true, storageJournal: 'NOT_CREATED' };
  } catch (error) {
    if (error?.databaseCommitOutcomeUnknown === true) committed = true;
    const prepareStateUnknown = error?.prepareState === 'UNKNOWN';
    if (connected && prepareApplied && !committed && !prepareStateUnknown) {
      try {
        await runPinnedSqlTransaction(db, evidence.restorePrepareSql, config, 'RESTORE_PREPARE');
        const restored = await (options.capturePrepareState ?? capturePrepareState)(db);
        if (stable(restored) !== stable(evidence.prepare.baseline)) throw new Error('state mismatch');
        await probeReleaseRest(evidence.prepare.restoreProbe, restKey, options.fetchImpl ?? fetch, config.timeouts);
      } catch (restoreError) {
        if (restoreError?.prepareState === 'UNKNOWN') throw restoreError;
        throw new ReleaseCutoverError('PREPARE_RESTORE_FAILED');
      }
    }
    if (committed) throw error;
    throw error instanceof ReleaseCutoverError || error instanceof ActivationError ? error : new ReleaseCutoverError('RELEASE_CUTOVER_FAILED');
  } finally { if (connected) await db.end().catch(() => {}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(`${JSON.stringify(await runReleaseCutover(process.argv[2]))}\n`); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'BLOCKED', code: error instanceof ReleaseCutoverError || error instanceof ActivationError ? error.code : 'RELEASE_CUTOVER_FAILED', databaseCommitted: error?.databaseCommitted === true ? true : error?.databaseCommitOutcomeUnknown === true ? 'UNKNOWN' : false, prepareState: error?.prepareState ?? 'KNOWN' })}\n`);
    process.exitCode = 1;
  }
}
