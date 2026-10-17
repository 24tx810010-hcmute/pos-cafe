import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { activationBundleManifest } from './permission-activation-bundle.mjs';
import {
  assertReleaseExecutionRole, assertReleasePrepareBaselineAbsent, capturePrepareState,
  inspectReleaseCleanupClosure, probeReleaseRest, RELEASE_PREPARE_RESTORE_SQL,
  parseReleaseCutoverConfig, runPinnedSqlTransaction, runReleaseCutover, verifyBackupDigests,
} from './permission-release-cutover.mjs';
import { permissionFingerprint } from './permission-preflight-core.mjs';
import { backupV2MethodHash, requireBackupV2Cutover } from './permission-backup-v2-core.mjs';
import { guardHostedBackupForRelease } from './permission-backup-dispatch.mjs';

const sha = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export class ReleaseRehearsalError extends Error {
  constructor(code) { super(code); this.name = 'ReleaseRehearsalError'; this.code = code; }
}
const fail = code => { throw new ReleaseRehearsalError(code); };

function pinned(base, value, code) {
  if (!record(value) || Object.keys(value).some(key => !['path', 'sha256'].includes(key))
    || typeof value.path !== 'string' || !value.path || !sha.test(value.sha256 ?? '')) fail(`INVALID_${code}_REFERENCE`);
  return { path: resolve(base, value.path), sha256: value.sha256 };
}
function readPinned(ref, code, json = true) {
  let bytes;
  try { bytes = readFileSync(ref.path); } catch { fail(`${code}_MISSING`); }
  if (hash(bytes) !== ref.sha256) fail(`${code}_HASH_MISMATCH`);
  if (!json) return bytes.toString('utf8');
  try { return JSON.parse(bytes.toString('utf8')); } catch { fail(`${code}_INVALID_JSON`); }
}
function writeDurable(path, value) {
  let fd;
  try { fd = openSync(path, 'wx', 0o600); writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); }
  finally { if (fd !== undefined) closeSync(fd); }
}

function validProbe(value) {
  if (!record(value) || Object.keys(value).some(key => !['url', 'method', 'body', 'expectedStatus', 'expectedBodySha256', 'expectedHookHeader'].includes(key))
    || typeof value.url !== 'string' || !['GET', 'POST'].includes(value.method)
    || !Number.isInteger(value.expectedStatus) || value.expectedStatus < 100 || value.expectedStatus > 599
    || !sha.test(value.expectedBodySha256 ?? '') || !['pass-through', null].includes(value.expectedHookHeader)) return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1'
      && url.pathname === '/rest/v1/rpc/permission_contract_probe' && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

export function parseReleaseRehearsalConfig(path) {
  if (!path) fail('EXPLICIT_REHEARSAL_CONFIG_REQUIRED');
  const absolute = resolve(path); let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); } catch { fail('INVALID_REHEARSAL_CONFIG'); }
  const keys = ['schemaVersion', 'kind', 'projectRef', 'backendHost', 'database', 'executionRole', 'sourceFingerprint', 'bundleHash',
    'unixSocket', 'restProbeKeyEnv', 'inventory', 'backupManifest', 'restoreComparison', 'restoreInputManifest', 'restoreExecution',
    'independentComparison', 'isolationProof', 'storageProof', 'prepareSql', 'restorePrepareSql', 'restProbe', 'restoreProbe',
    'catalogSupplementOutput', 'prepareProofOutput', 'timeouts'];
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || value.schemaVersion !== 1
    || value.kind !== 'permission-release-rehearsal-proof-observation' || !record(value.unixSocket)
    || Object.keys(value.unixSocket).some(key => !['host', 'port', 'user'].includes(key))
    || !/^\/[A-Za-z0-9/_.-]+$/.test(value.unixSocket.host ?? '') || !Number.isInteger(value.unixSocket.port)
    || !/^[a-z_][a-z0-9_]*$/.test(value.unixSocket.user ?? '') || value.backendHost !== `unix:${value.unixSocket.host}`
    || value.database !== 'postgres' || typeof value.executionRole !== 'string' || !value.executionRole
    || !sha.test(value.sourceFingerprint ?? '') || !sha.test(value.bundleHash ?? '')
    || typeof value.restProbeKeyEnv !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.restProbeKeyEnv)
    || typeof value.catalogSupplementOutput !== 'string' || !value.catalogSupplementOutput
    || typeof value.prepareProofOutput !== 'string' || !value.prepareProofOutput || !record(value.timeouts)
    || Object.keys(value.timeouts).some(key => !['lockMs', 'statementMs', 'probeAttempts', 'probeDelayMs', 'probeTimeoutMs'].includes(key))
    || !Number.isInteger(value.timeouts.lockMs) || value.timeouts.lockMs < 1 || value.timeouts.lockMs > 120_000
    || !Number.isInteger(value.timeouts.statementMs) || value.timeouts.statementMs < 1 || value.timeouts.statementMs > 900_000
    || !Number.isInteger(value.timeouts.probeAttempts) || value.timeouts.probeAttempts < 1 || value.timeouts.probeAttempts > 60
    || !Number.isInteger(value.timeouts.probeDelayMs) || value.timeouts.probeDelayMs < 0 || value.timeouts.probeDelayMs > 5_000
    || !Number.isInteger(value.timeouts.probeTimeoutMs) || value.timeouts.probeTimeoutMs < 100 || value.timeouts.probeTimeoutMs > 30_000
    || !validProbe(value.restProbe) || value.restProbe.expectedHookHeader !== 'pass-through'
    || !validProbe(value.restoreProbe) || value.restoreProbe.expectedHookHeader !== null
    || new URL(value.restProbe.url).origin !== new URL(value.restoreProbe.url).origin) fail('INVALID_REHEARSAL_CONFIG');
  const base = dirname(absolute);
  const refs = ['inventory', 'backupManifest', 'restoreComparison', 'restoreInputManifest', 'restoreExecution',
    'independentComparison', 'isolationProof', 'storageProof', 'prepareSql', 'restorePrepareSql'];
  return { ...value, path: absolute, ...Object.fromEntries(refs.map(key => [key, pinned(base, value[key], key.toUpperCase())])),
    catalogSupplementOutput: resolve(base, value.catalogSupplementOutput), prepareProofOutput: resolve(base, value.prepareProofOutput) };
}

function validateHistoricalEvidence(config, documents) {
  const { backup, comparison, input, execution, independent, storage } = documents;
  if (backup?.status !== 'VALIDATED_LOGICAL_BACKUP' || backup.projectRef !== config.projectRef
    || input?.backupManifestSha256 !== config.backupManifest.sha256
    || execution?.backupManifestSha256 !== config.backupManifest.sha256
    || execution.restoreInputManifestSha256 !== config.restoreInputManifest.sha256 || execution.liveMutations !== false
    || execution.roleFlagsRestored !== true
    || comparison?.status !== 'RESTORE_DATA_AND_RECORDED_METADATA_MATCHED' || comparison.failedCount !== 0 || comparison.liveMutations !== false
    || !Array.isArray(comparison.checks) || comparison.checks.length !== 74 || comparison.checks.some(check => check.matched !== true)
    || independent?.status !== 'INDEPENDENT_SCHEMA_AND_GLOBAL_ROLES_COMPARISON_PASSED'
    || independent.readOnlyDatabaseOperations !== true || independent.liveDatabaseConnections !== false
    || input.restoreInstanceId !== execution.restoreInstanceId || independent.restoreInstanceId !== execution.restoreInstanceId
    || comparison.container !== execution.container || independent.container !== execution.container
    || comparison.backupDirectory !== input.backupDirectory || execution.backupDirectory !== input.backupDirectory
    || !Array.isArray(storage?.objects) || storage.objects.length !== 2) fail('REHEARSAL_EVIDENCE_INVALID');
}

async function verifyFreshBackupSnapshot(db, metadata, config, verifier) {
  if (!Array.isArray(metadata.tableData) || metadata.tableData.length === 0
    || metadata.tableData.some(row => !record(row) || !['auth', 'public', 'private', 'storage', 'realtime', 'vault'].includes(row.schema)
      || !/^[a-z_][a-z0-9_$]*$/i.test(row.name ?? ''))) fail('BACKUP_METADATA_INVALID');
  const relations = metadata.tableData.map(row => ({ schema: row.schema, name: row.name }));
  let begun = false;
  try {
    await db.query('begin isolation level repeatable read read only'); begun = true;
    await db.query(`set local lock_timeout=${Number(config.timeouts.lockMs)}`);
    await db.query(`set local statement_timeout=${Number(config.timeouts.statementMs)}`);
    const observations = await verifier(db, { backupMetadata: metadata }, relations);
    await db.query('rollback'); begun = false;
    return observations;
  } catch (error) {
    if (begun) await db.query('rollback').catch(() => {});
    throw error;
  }
}

export async function observePermissionReleaseProofs(config, options = {}) {
  if (existsSync(config.catalogSupplementOutput) || existsSync(config.prepareProofOutput)) fail('PROOF_OUTPUT_ALREADY_EXISTS');
  const fingerprint = options.permissionFingerprint ?? permissionFingerprint;
  const bundleManifest = options.activationBundleManifest ?? activationBundleManifest;
  if (fingerprint() !== config.sourceFingerprint) fail('SOURCE_FINGERPRINT_MISMATCH');
  if (bundleManifest().sha256 !== config.bundleHash) fail('BUNDLE_HASH_MISMATCH');
  const versionedBackup = readPinned(config.backupManifest, 'BACKUP_MANIFEST');
  guardHostedBackupForRelease(config.backupManifest, config);
  if (versionedBackup?.schemaVersion === 2 || versionedBackup?.kind === 'permission-logical-backup') {
    requireBackupV2Cutover(config.backupManifest, { sourceFingerprint: config.sourceFingerprint,
      projectRef: config.projectRef, methodSha256: backupV2MethodHash() });
    fail('BACKUP_V2_CUTOVER_ADAPTER_UNSUPPORTED');
  }
  const documents = {
    inventory: readPinned(config.inventory, 'INVENTORY'), backup: readPinned(config.backupManifest, 'BACKUP_MANIFEST'),
    comparison: readPinned(config.restoreComparison, 'RESTORE_COMPARISON'), input: readPinned(config.restoreInputManifest, 'RESTORE_INPUT'),
    execution: readPinned(config.restoreExecution, 'RESTORE_EXECUTION'), independent: readPinned(config.independentComparison, 'INDEPENDENT_COMPARISON'),
    isolation: readPinned(config.isolationProof, 'ISOLATION_PROOF'), storage: readPinned(config.storageProof, 'STORAGE_PROOF'),
  };
  const isolation = documents.isolation;
  if (!record(isolation) || typeof isolation.name !== 'string' || !isolation.name
    || typeof isolation.volume !== 'string' || !isolation.volume || typeof isolation.image !== 'string' || !isolation.image
    || isolation.sourceRestore !== documents.execution.container || isolation.sourceVolume !== `${documents.execution.container}-data`
    || isolation.copyMethod !== 'offline cp -a from readonly validated source volume'
    || isolation.network !== 'none' || !Array.isArray(isolation.ports) || isolation.ports.length !== 0
    || isolation.dbSocket !== config.unixSocket.host || isolation.database !== config.database
    || isolation.executionRole !== config.executionRole || isolation.image !== documents.execution.image
    || typeof isolation.createdAt !== 'string' || Number.isNaN(Date.parse(isolation.createdAt))) fail('REHEARSAL_EVIDENCE_INVALID');
  validateHistoricalEvidence(config, documents);
  const prepareSql = readPinned(config.prepareSql, 'PREPARE_SQL', false);
  const restoreSql = readPinned(config.restorePrepareSql, 'RESTORE_PREPARE_SQL', false);
  if (resolve(config.prepareSql.path) !== resolve('supabase/candidate/permission-compatibility-prepare.sql')
    || restoreSql.trim() !== RELEASE_PREPARE_RESTORE_SQL) fail('REHEARSAL_SQL_REFUSED');
  const metadataHash = documents.backup.files?.['metadata.json'];
  if (!sha.test(metadataHash ?? '')) fail('BACKUP_METADATA_INVALID');
  const metadataRef = { path: resolve(dirname(config.backupManifest.path), 'metadata.json'), sha256: metadataHash };
  const metadata = readPinned(metadataRef, 'BACKUP_METADATA');
  if (!Array.isArray(metadata.tableData) || metadata.tableData.length !== documents.backup.tableDataCount) fail('BACKUP_METADATA_INVALID');
  const targetIds = documents.inventory?.currentStoreIds;
  if (documents.inventory?.projectRef !== config.projectRef || !Array.isArray(targetIds) || targetIds.length === 0
    || !Array.isArray(documents.storage.objects) || documents.storage.objects.some(object => !record(object)
      || Object.keys(object).some(field => !['id', 'bucket', 'object', 'version', 'size', 'sha256'].includes(field))
      || typeof object.id !== 'string' || typeof object.bucket !== 'string' || !object.bucket
      || typeof object.object !== 'string' || !targetIds.includes(object.object.split('/')[0])
      || typeof object.version !== 'string' || !object.version || !Number.isInteger(object.size) || object.size < 0
      || !sha.test(object.sha256 ?? ''))
    || new Set(documents.storage.objects.map(object => object.id)).size !== documents.storage.objects.length
    || new Set(documents.storage.objects.map(object => `${object.bucket}/${object.object}`)).size !== documents.storage.objects.length) {
    fail('STORAGE_PROOF_INVALID');
  }
  const key = process.env[config.restProbeKeyEnv];
  if (typeof key !== 'string' || !key) fail('EXPLICIT_REST_PROBE_CREDENTIAL_REQUIRED');
  const Client = options.Client ?? pg.Client;
  const db = new Client({ host: config.unixSocket.host, port: config.unixSocket.port, user: config.unixSocket.user,
    database: config.database, ssl: false, application_name: 'pos-cafe-permission-release-proof-observation' });
  let connected = false; let prepared = false; let baseline;
  try {
    await db.connect(); connected = true;
    await (options.assertExecutionRole ?? assertReleaseExecutionRole)(db, config);
    const target = (await db.query("select current_database() database,inet_server_addr()::text server_addr,current_setting('port')::int port")).rows[0];
    if (target?.database !== config.database || target.server_addr !== null || target.port !== config.unixSocket.port) fail('REHEARSAL_TARGET_MISMATCH');
    await (options.assertPrepareBaselineAbsent ?? assertReleasePrepareBaselineAbsent)(db);
    baseline = await (options.capturePrepareState ?? capturePrepareState)(db);
    const closure = await (options.inspectCleanupClosure ?? inspectReleaseCleanupClosure)(db);
    const observations = await verifyFreshBackupSnapshot(db, metadata, config, options.verifyBackupDigests ?? verifyBackupDigests);
    await runPinnedSqlTransaction(db, prepareSql, config, 'PREPARE'); prepared = true;
    const preparedState = await (options.capturePrepareState ?? capturePrepareState)(db);
    await probeReleaseRest(config.restProbe, key, options.fetchImpl ?? fetch, config.timeouts);
    await runPinnedSqlTransaction(db, restoreSql, config, 'RESTORE_PREPARE'); prepared = false;
    const restored = await (options.capturePrepareState ?? capturePrepareState)(db);
    if (stable(restored) !== stable(baseline)) fail('PREPARE_RESTORE_MISMATCH');
    await probeReleaseRest(config.restoreProbe, key, options.fetchImpl ?? fetch, config.timeouts);
    if (fingerprint() !== config.sourceFingerprint || bundleManifest().sha256 !== config.bundleHash) fail('SOURCE_CHANGED_DURING_RUN');
    const binding = { projectRef: config.projectRef, backendHost: config.backendHost, database: config.database,
      sourceFingerprint: config.sourceFingerprint, bundleHash: config.bundleHash };
    const restoreArtifactHashes = { comparison: config.restoreComparison.sha256, inputManifest: config.restoreInputManifest.sha256,
      execution: config.restoreExecution.sha256, independentComparison: config.independentComparison.sha256 };
    const supplement = { schemaVersion: 1, kind: 'permission-release-catalog-supplement', binding,
      backupManifestSha256: config.backupManifest.sha256, restoreArtifactHashes,
      sourceContainer: documents.execution.container, sourceRestoreInstanceId: documents.execution.restoreInstanceId,
      container: documents.isolation.name, isolationProofSha256: config.isolationProof.sha256,
      observedAt: new Date().toISOString(), baseline, cleanupRelations: closure.relations.map(row => `${row.schema}.${row.name}`),
      cleanupFkHash: closure.fkHash, actor: { role: config.executionRole, superuser: false, bypassRls: true },
      freshBackupComparison: { status: 'MATCHED_REPEATABLE_READ_ISOLATED', metadataSha256: metadataHash,
        tableCount: observations.length, observationsSha256: hash(stable(observations)), observations } };
    const prepareProof = { schemaVersion: 1, kind: 'permission-release-prepare-proof', binding, baseline, prepared: preparedState,
      prepareSqlSha256: config.prepareSql.sha256, restorePrepareSqlSha256: config.restorePrepareSql.sha256,
      restProbe: config.restProbe, restoreProbe: config.restoreProbe, storageObjects: documents.storage.objects,
      cleanupRelations: supplement.cleanupRelations, cleanupFkHash: supplement.cleanupFkHash };
    writeDurable(config.catalogSupplementOutput, supplement);
    writeDurable(config.prepareProofOutput, prepareProof);
    return { status: 'PROOFS_OBSERVED_AND_PREPARE_RESTORED', catalogSupplementPath: config.catalogSupplementOutput,
      catalogSupplementSha256: hash(readFileSync(config.catalogSupplementOutput)), prepareProofPath: config.prepareProofOutput,
      prepareProofSha256: hash(readFileSync(config.prepareProofOutput)), relationCount: observations.length };
  } catch (error) {
    if (connected && prepared && error?.prepareState !== 'UNKNOWN') {
      try {
        await runPinnedSqlTransaction(db, restoreSql, config, 'RESTORE_PREPARE'); prepared = false;
        const restored = await (options.capturePrepareState ?? capturePrepareState)(db);
        if (stable(restored) !== stable(baseline)) fail('PREPARE_RESTORE_MISMATCH');
        await probeReleaseRest(config.restoreProbe, key, options.fetchImpl ?? fetch, config.timeouts);
      } catch (restoreError) {
        if (restoreError?.prepareState === 'UNKNOWN') throw restoreError;
        fail('PREPARE_RESTORE_FAILED');
      }
    }
    throw error;
  } finally { if (connected) await db.end().catch(() => {}); }
}

export async function runPermissionReleaseFaultMatrix(controllerConfigPath, reportPath, options = {}) {
  if (!controllerConfigPath || !reportPath) fail('EXPLICIT_FAULT_MATRIX_PATHS_REQUIRED');
  const absoluteConfig = resolve(controllerConfigPath);
  const absoluteReport = resolve(reportPath);
  if (existsSync(absoluteReport)) fail('FAULT_MATRIX_REPORT_ALREADY_EXISTS');
  const config = (options.parseConfig ?? parseReleaseCutoverConfig)(absoluteConfig);
  if (config.mode !== 'rehearsal-rollback' || !config.unixSocket) fail('FAULT_MATRIX_ISOLATED_ROLLBACK_REQUIRED');
  const runner = options.runner ?? runReleaseCutover;
  const fault = () => { throw new Error('synthetic rehearsal fault'); };
  const cases = [
    { name: 'control-before', expectedStatus: 'REHEARSAL_PASSED_ROLLED_BACK', runOptions: {} },
    { name: 'after-cleanup', expectedCode: 'CUTOVER_TRANSACTION_FAILED', runOptions: { afterCleanup: fault } },
    ...Array.from({ length: 11 }, (_, fragment) => ({ name: `after-activation-fragment-${fragment}`,
      expectedCode: 'SYNTHETIC_FRAGMENT_FAULT', runOptions: { failAfterFragment: fragment } })),
    { name: 'before-commit', expectedCode: 'CUTOVER_TRANSACTION_FAILED', runOptions: { beforeCommit: fault } },
    { name: 'control-after', expectedStatus: 'REHEARSAL_PASSED_ROLLED_BACK', runOptions: {} },
  ];
  const results = [];
  for (const testCase of cases) {
    try {
      const result = await runner(absoluteConfig, testCase.runOptions);
      if (result?.status !== testCase.expectedStatus || testCase.expectedCode) fail('FAULT_MATRIX_UNEXPECTED_RESULT');
      results.push({ name: testCase.name, outcome: result.status, prepareRestored: result.prepareRestored === true });
    } catch (error) {
      if (error?.code !== testCase.expectedCode || testCase.expectedStatus
        || error?.databaseCommitted === true || error?.databaseCommitOutcomeUnknown === true || error?.prepareState === 'UNKNOWN') {
        throw error instanceof ReleaseRehearsalError ? error : new ReleaseRehearsalError('FAULT_MATRIX_UNEXPECTED_RESULT');
      }
      results.push({ name: testCase.name, outcome: error.code, databaseCommitted: false, prepareState: 'KNOWN' });
    }
  }
  const report = { schemaVersion: 1, kind: 'permission-release-isolated-fault-matrix', status: 'PASSED',
    observedAt: new Date().toISOString(), controllerConfigSha256: hash(readFileSync(absoluteConfig)),
    binding: { projectRef: config.projectRef, backendHost: config.backendHost, database: config.database,
      sourceFingerprint: config.sourceFingerprint, bundleHash: config.bundleHash }, cases: results };
  writeDurable(absoluteReport, report);
  return { status: report.status, reportPath: absoluteReport, reportSha256: hash(readFileSync(absoluteReport)), caseCount: results.length };
}

function parseLegacyInflightSpec(path) {
  if (!path) fail('EXPLICIT_LEGACY_INFLIGHT_SPEC_REQUIRED');
  const absolute = resolve(path); let value;
  try { value = JSON.parse(readFileSync(absolute, 'utf8')); } catch { fail('INVALID_LEGACY_INFLIGHT_SPEC'); }
  const keys = ['schemaVersion', 'kind', 'variant', 'controllerConfig', 'userId', 'adminId', 'storeNo', 'displayName',
    'address', 'expectedAuthUsersAfter', 'timeouts'];
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || value.schemaVersion !== 1
    || value.kind !== 'permission-release-legacy-inflight-rehearsal'
    || !['advisory-wait-cutover-commits', 'table-wait-cutover-blocks'].includes(value.variant)
    || !uuid.test(value.userId ?? '') || !uuid.test(value.adminId ?? '') || value.userId === value.adminId
    || !Number.isInteger(value.storeNo) || value.storeNo < 1 || value.storeNo > 2_147_483_647
    || typeof value.displayName !== 'string' || [...value.displayName.trim()].length < 1 || [...value.displayName.trim()].length > 120
    || typeof value.address !== 'string' || [...value.address.trim()].length > 500
    || !Number.isInteger(value.expectedAuthUsersAfter) || value.expectedAuthUsersAfter < 1
    || !record(value.timeouts) || Object.keys(value.timeouts).some(key => !['waitMs', 'pollMs'].includes(key))
    || !Number.isInteger(value.timeouts.waitMs) || value.timeouts.waitMs < 1_000 || value.timeouts.waitMs > 120_000
    || !Number.isInteger(value.timeouts.pollMs) || value.timeouts.pollMs < 10 || value.timeouts.pollMs > 1_000) fail('INVALID_LEGACY_INFLIGHT_SPEC');
  return { ...value, path: absolute, controllerConfig: pinned(dirname(absolute), value.controllerConfig, 'CONTROLLER_CONFIG') };
}

export async function waitForLock(db, applicationName, timeouts) {
  const deadline = Date.now() + timeouts.waitMs;
  while (Date.now() < deadline) {
    await db.query('select pg_stat_clear_snapshot()');
    const row = (await db.query(`select pid,backend_xid::text "backendXid",state,wait_event_type "waitType",wait_event "waitEvent" from pg_stat_activity
      where application_name=$1 and pid<>pg_backend_pid()`, [applicationName])).rows[0];
    if (row?.waitType === 'Lock' && Number.isInteger(row.pid) && row.pid > 0) return {
      pid: row.pid, backendXid: row.backendXid ?? null, state: row.state, waitType: row.waitType, waitEvent: row.waitEvent,
    };
    await new Promise(done => setTimeout(done, timeouts.pollMs));
  }
  fail('LEGACY_INFLIGHT_WAIT_NOT_OBSERVED');
}

export async function waitForCutoverBarrier(db, hookState, timeouts) {
  const deadline = Date.now() + timeouts.waitMs;
  while (Date.now() < deadline) {
    await db.query('select pg_stat_clear_snapshot()');
    const row = (await db.query(`select pid,backend_xid::text "backendXid",state,wait_event_type "waitType",wait_event "waitEvent" from pg_stat_activity
      where application_name='pos-cafe-permission-release-cutover' and pid<>pg_backend_pid()`)).rows[0];
    if (Number.isInteger(row?.pid) && row.pid > 0 && (hookState.reached || row.waitType === 'Lock')) return {
      kind: hookState.reached ? 'before-commit' : 'database-lock', pid: row.pid, backendXid: row.backendXid ?? null,
      state: row.state, waitType: row.waitType ?? null, waitEvent: row.waitEvent ?? null,
    };
    await new Promise(done => setTimeout(done, timeouts.pollMs));
  }
  fail('LEGACY_CUTOVER_BARRIER_NOT_OBSERVED');
}

export async function assertLegacyBootstrapAdmission(db) {
  const row = (await db.query(`select current_user role,
    has_function_privilege(current_user,'public.bootstrap_store(uuid,integer,text,text)','EXECUTE') "canExecute"`)).rows[0];
  if (row?.role !== 'authenticated' || row.canExecute !== true) fail('LEGACY_BOOTSTRAP_CLIENT_NOT_ADMITTED');
  return { role: row.role, canExecute: row.canExecute };
}

async function settleWithin(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise).then(value => ({ settled: true, value }), error => ({ settled: true, error })),
      new Promise(resolveTimeout => { timer = setTimeout(() => resolveTimeout({ settled: false }), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function cleanupLegacyInflightSessions({ blocker, bootstrap, blockerConnected, bootstrapConnected,
  blockerOpen, bootstrapOpen, bootstrapOutcomePromise, cutoverOutcomePromise, releaseBeforeCommit, timeoutMs = 5_000 }) {
  try { releaseBeforeCommit?.(); } catch { /* cleanup must preserve the primary outcome */ }
  let blockerClosed = false;
  if (blockerConnected && blockerOpen) {
    const released = await settleWithin(blocker.query('rollback'), timeoutMs);
    if (!released.settled || released.error) {
      await settleWithin(blocker.end(), timeoutMs);
      blockerClosed = true;
    }
  }
  if (bootstrapOutcomePromise) await settleWithin(bootstrapOutcomePromise, timeoutMs);
  if (bootstrapConnected && bootstrapOpen) await settleWithin(bootstrap.query('rollback'), timeoutMs);
  let cutoverOutcome = 'NOT_STARTED';
  if (cutoverOutcomePromise) {
    const settled = await settleWithin(cutoverOutcomePromise, timeoutMs);
    if (!settled.settled) cutoverOutcome = 'UNKNOWN';
    else if (settled.error) cutoverOutcome = settled.error?.code ?? 'FAILED';
    else if (settled.value?.ok) cutoverOutcome = settled.value.value?.status ?? 'COMPLETED';
    else cutoverOutcome = settled.value?.error?.code ?? 'FAILED';
  }
  if (bootstrapConnected) await settleWithin(bootstrap.end(), timeoutMs);
  if (blockerConnected && !blockerClosed) await settleWithin(blocker.end(), timeoutMs);
  return { cutoverOutcome, cutoverOutcomeKnown: cutoverOutcome !== 'UNKNOWN' };
}

export function createLegacyCutoverGuard(variant) {
  const state = { reached: false, aborted: false };
  let releaseWait;
  const hold = new Promise(done => { releaseWait = done; });
  return {
    state,
    release() { releaseWait(); },
    abort() { state.aborted = true; releaseWait(); },
    async beforeCommit() {
      state.reached = true;
      if (variant === 'advisory-wait-cutover-commits') await hold;
      if (state.aborted) fail('LEGACY_HARNESS_ABORTED_BEFORE_COMMIT');
      if (variant === 'table-wait-cutover-blocks') fail('LEGACY_TABLE_CUTOVER_COMMIT_REFUSED');
    },
  };
}

export async function runPermissionReleaseLegacyInflight(specPath, reportPath, options = {}) {
  const spec = parseLegacyInflightSpec(specPath);
  const absoluteReport = resolve(reportPath ?? '');
  if (!reportPath || existsSync(absoluteReport)) fail('INVALID_LEGACY_INFLIGHT_REPORT');
  readPinned(spec.controllerConfig, 'CONTROLLER_CONFIG', false);
  const controller = parseReleaseCutoverConfig(spec.controllerConfig.path);
  if (controller.mode !== 'isolated-commit-rehearsal' || !controller.unixSocket) fail('LEGACY_INFLIGHT_ISOLATED_COMMIT_REQUIRED');
  const Client = options.Client ?? pg.Client;
  const connection = { host: controller.unixSocket.host, port: controller.unixSocket.port, user: controller.unixSocket.user,
    database: controller.database, ssl: false };
  const runId = randomUUID();
  const blocker = new Client({ ...connection, application_name: `perm-release-blocker-${runId.slice(0, 8)}` });
  const bootstrapApplication = `perm-release-bootstrap-${runId.slice(0, 8)}`;
  const bootstrap = new Client({ ...connection, application_name: bootstrapApplication });
  let blockerConnected = false; let bootstrapConnected = false; let blockerOpen = false; let bootstrapOpen = false;
  let cutoverOutcomeCode = null;
  let bootstrapOutcomePromise = null;
  let cutoverPromise = null;
  let harnessSucceeded = false;
  let harnessError = null;
  const cutoverGuard = createLegacyCutoverGuard(spec.variant);
  try {
    await blocker.connect(); blockerConnected = true;
    await bootstrap.connect(); bootstrapConnected = true;
    await blocker.query('begin'); blockerOpen = true;
    if (spec.variant === 'advisory-wait-cutover-commits') {
      await blocker.query("select pg_advisory_xact_lock(hashtext($1::text||':bootstrap'))", [spec.userId]);
    } else {
      await blocker.query('lock table public.stores in access exclusive mode');
    }
    await bootstrap.query('begin'); bootstrapOpen = true;
    await bootstrap.query('set local role authenticated');
    const admission = await (options.assertLegacyBootstrapAdmission ?? assertLegacyBootstrapAdmission)(bootstrap);
    await bootstrap.query("select set_config('request.jwt.claim.sub',$1,true)", [spec.userId]);
    bootstrapOutcomePromise = bootstrap.query('select public.bootstrap_store($1,$2,$3,$4) result',
      [spec.adminId, spec.storeNo, spec.displayName.trim(), spec.address.trim()])
      .then(value => ({ ok: true, legacyOk: value.rows[0]?.result?.ok === true }), error => ({ ok: false, sqlState: error?.code ?? null }));
    const bootstrapWait = await waitForLock(blocker, bootstrapApplication, spec.timeouts);
    if (bootstrapWait.waitEvent !== (spec.variant === 'advisory-wait-cutover-commits' ? 'advisory' : 'relation')) {
      fail('LEGACY_INFLIGHT_UNEXPECTED_WAIT');
    }
    cutoverPromise = (options.runReleaseCutover ?? runReleaseCutover)(spec.controllerConfig.path,
      { beforeCommit: cutoverGuard.beforeCommit })
      .then(value => ({ ok: true, value }), error => ({ ok: false, error }));
    let cutoverWait = null;
    if (spec.variant === 'advisory-wait-cutover-commits') {
      cutoverWait = await waitForCutoverBarrier(blocker, cutoverGuard.state, spec.timeouts);
      await blocker.query('commit'); blockerOpen = false;
      if (cutoverWait.kind === 'before-commit') {
        const strictWait = await waitForLock(blocker, bootstrapApplication, spec.timeouts);
        if (strictWait.waitEvent !== 'relation') fail('LEGACY_BOOTSTRAP_NOT_BLOCKED_BY_CUTOVER_LOCK');
      }
      cutoverGuard.release();
      const bootstrapOutcome = await bootstrapOutcomePromise;
      if (bootstrapOutcome.ok) fail('LEGACY_BOOTSTRAP_SURVIVED_CUTOVER');
      await bootstrap.query('rollback'); bootstrapOpen = false;
      const cutover = await cutoverPromise;
      if (!cutover.ok || cutover.value?.status !== 'ISOLATED_REHEARSAL_COMMITTED') fail('LEGACY_INFLIGHT_CUTOVER_DID_NOT_COMMIT');
    } else {
      cutoverWait = await waitForLock(blocker, 'pos-cafe-permission-release-cutover', spec.timeouts);
      await blocker.query('commit'); blockerOpen = false;
      const bootstrapOutcome = await bootstrapOutcomePromise;
      if (!bootstrapOutcome.ok || bootstrapOutcome.legacyOk !== true) fail('LEGACY_BOOTSTRAP_DID_NOT_COMPLETE_BEFORE_BLOCKED_CUTOVER');
      await bootstrap.query('commit'); bootstrapOpen = false;
      const cutover = await cutoverPromise;
      cutoverOutcomeCode = cutover.error?.code ?? null;
      if (cutover.ok || !['LOCKED_SCOPE_DRIFT', 'LOCKED_BACKUP_DATA_DRIFT'].includes(cutoverOutcomeCode)) {
        fail('LEGACY_DATA_DRIFT_DID_NOT_BLOCK_CUTOVER');
      }
    }
    const post = (await blocker.query(`select
      exists(select 1 from auth.users where id=$1) "authUserPreserved",
      exists(select 1 from public.stores where id=$1 or store_no=$2) "storeExists",
      (select count(*)::int from public.employees where store_id=$1) "employeeCount",
      (select count(*)::int from public.employees where store_id=$1 and role::text='admin') "adminCount",
      (select count(*)::int from auth.users) "authUserCount"`, [spec.userId, spec.storeNo])).rows[0];
    const expectedStore = spec.variant === 'table-wait-cutover-blocks';
    if (post?.authUserPreserved !== true || post.storeExists !== expectedStore
      || post.employeeCount !== (expectedStore ? 1 : 0) || post.adminCount !== (expectedStore ? 1 : 0)
      || post.authUserCount !== spec.expectedAuthUsersAfter) fail('LEGACY_INFLIGHT_POSTCONDITION_FAILED');
    const report = { schemaVersion: 1, kind: 'permission-release-legacy-inflight-report', status: 'PASSED',
      observedAt: new Date().toISOString(), variant: spec.variant, controllerConfigSha256: spec.controllerConfig.sha256,
      isolationProofSha256: controller.isolationProof.sha256, principalSha256: hash(spec.userId), adminSha256: hash(spec.adminId),
      admission, bootstrapWait, cutoverWait, cutoverOutcomeCode, post };
    writeDurable(absoluteReport, report);
    harnessSucceeded = true;
    return { status: 'PASSED', variant: spec.variant, reportPath: absoluteReport, reportSha256: hash(readFileSync(absoluteReport)) };
  } catch (error) {
    harnessError = error;
    throw error;
  } finally {
    if (!harnessSucceeded) cutoverGuard.abort();
    const cleanup = await cleanupLegacyInflightSessions({ blocker, bootstrap, blockerConnected, bootstrapConnected, blockerOpen, bootstrapOpen,
      bootstrapOutcomePromise, cutoverOutcomePromise: cutoverPromise, releaseBeforeCommit: cutoverGuard.release,
      timeoutMs: Math.min(spec.timeouts.waitMs, 5_000) });
    if (harnessError) {
      harnessError.cutoverOutcome = cleanup.cutoverOutcome;
      harnessError.cutoverOutcomeKnown = cleanup.cutoverOutcomeKnown;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = process.argv[2] === '--fault-matrix' ? await runPermissionReleaseFaultMatrix(process.argv[3], process.argv[4])
      : process.argv[2] === '--legacy-inflight' ? await runPermissionReleaseLegacyInflight(process.argv[3], process.argv[4])
        : await observePermissionReleaseProofs(parseReleaseRehearsalConfig(process.argv[2]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
  catch (error) { process.stderr.write(`${JSON.stringify({ status: 'BLOCKED', code: error?.code ?? 'REHEARSAL_PROOF_OBSERVATION_FAILED', prepareState: error?.prepareState ?? 'KNOWN', cutoverOutcome: error?.cutoverOutcome, cutoverOutcomeKnown: error?.cutoverOutcomeKnown })}\n`); process.exitCode = 1; }
}
