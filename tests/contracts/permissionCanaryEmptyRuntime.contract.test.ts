import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { test } from 'vitest';
import { assertNoCanaryLeaks } from './permissionCanaryOracle.ts';
// @ts-expect-error The existing activation runner is JavaScript without declarations.
import { activateDatabase } from '../../scripts/permission-activate.mjs';
// @ts-expect-error The existing bundle is JavaScript without declarations.
import { activationBundleManifest, EMPTY_TARGET_RELATIONS, inspectAllTenantRows } from '../../scripts/permission-activation-bundle.mjs';
// @ts-expect-error The existing preparation helper is JavaScript without declarations.
import { prepareCompatibilityHook } from '../../scripts/permission-compatibility-prepare.mjs';
// @ts-expect-error The existing preflight helper is JavaScript without declarations.
import { permissionFingerprint } from '../../scripts/permission-preflight-core.mjs';
// @ts-expect-error The release preflight runner is JavaScript without declarations.
import { runReleasePreflight } from '../../scripts/permission-release-preflight.mjs';
// @ts-expect-error The inventory runner is JavaScript without declarations.
import { collectInventory } from '../../scripts/permission-inventory.mjs';

const PROJECT = 'pos-cafe-perm-s31-canary-20261013';
const ROOT = `/var/tmp/${PROJECT}`;
const CLI = '/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase';
const BAD_STORE = '10000000-0000-4000-8000-000000009821';
const BAD_EMPLOYEE = '20000000-0000-4000-8000-000000009821';
const sha = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const fail = (code: string): never => { throw new Error(code); };

function command(args: [string, ...string[]]): string {
  const executable = process.platform === 'win32' ? 'wsl.exe' : args[0];
  const parameters = process.platform === 'win32' ? ['--exec', ...args] : args.slice(1);
  try { return execFileSync(executable, parameters, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'] }) as string; }
  catch (error: any) {
    if (args[0] === CLI && args[1] === 'status') fail(`CANARY_STATUS_COMMAND_${Number.isInteger(error?.status) ? error.status : 'SPAWN'}_FAILED`);
    return fail('CANARY_COMMAND_FAILED');
  }
}

function status() {
  const value = JSON.parse(command([CLI, 'status', '--workdir', `${ROOT}/stack`, '-o', 'json']));
  const api = new URL(value.API_URL);
  const db = new URL(value.DB_URL);
  if (api.origin !== 'http://127.0.0.1:62821' || api.pathname !== '/'
    || db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '62822'
    || db.pathname !== '/postgres' || db.search || db.hash || !value.SERVICE_ROLE_KEY || !value.ANON_KEY)
    fail('CANARY_ENDPOINT_REFUSED');
  return value as { API_URL: string; DB_URL: string; SERVICE_ROLE_KEY: string; ANON_KEY: string };
}

async function assertOwnedTarget(db: pg.Client) {
  const expectedConfig = readFileSync('tests/permissions/runtime/identity.toml', 'utf8')
    .replaceAll('pos-cafe-perm-s31-t04-20261013', PROJECT).replaceAll('6242', '6282')
    .replace('inspector_port = 8084', 'inspector_port = 8088')
    .replace('[db.seed]\nenabled = true', '[db.seed]\nenabled = false');
  const actualConfig = command(['cat', `${ROOT}/stack/supabase/config.toml`]);
  if (sha(actualConfig) !== sha(expectedConfig) || command([CLI, '--version']).trim() !== '2.117.0')
    fail('CANARY_CONFIG_REFUSED');
  const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
  const containers = JSON.parse(command(['docker', 'inspect', ...names.map(name => `supabase_${name}_${PROJECT}`)]));
  if (containers.length !== names.length || containers.some((c: any) => c.Config.Labels?.['com.supabase.cli.project'] !== PROJECT
    || !c.State.Running || (c.State.Health && c.State.Health.Status !== 'healthy')
    || Object.values(c.NetworkSettings.Ports ?? {}).some((bindings: any) => (bindings ?? []).some((b: any) => b.HostIp !== '127.0.0.1'))))
    fail('CANARY_CONTAINER_REFUSED');
  if (!containers[0].Mounts.some((m: any) => m.Type === 'volume' && m.Name === `supabase_db_${PROJECT}`))
    fail('CANARY_VOLUME_REFUSED');
  const network = JSON.parse(command(['docker', 'network', 'inspect', `supabase_network_${PROJECT}`]));
  if (network.length !== 1 || network[0].Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1')
    fail('CANARY_NETWORK_REFUSED');
  const database = (await db.query('select current_database() as name')).rows[0]?.name;
  const migrations = (await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0]?.n;
  const empty = await inspectAllTenantRows(db);
  const auth = (await db.query('select count(*)::int n from auth.users')).rows[0]?.n;
  const storage = (await db.query('select count(*)::int n from storage.objects')).rows[0]?.n;
  if (database !== 'postgres' || migrations !== 16 || !empty.empty || auth !== 0 || storage !== 0)
    fail('CANARY_PRISTINE_TARGET_REFUSED');
}

async function catalogHash(db: pg.Client) {
  const rows = (await db.query(`select kind,identity,metadata from (
    select 'relation' kind,n.nspname||'.'||c.relname identity,to_jsonb(c) metadata
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
    union all select 'function',n.nspname||'.'||p.proname||':'||p.oid::text,to_jsonb(p)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
    union all select 'type',n.nspname||'.'||t.typname,to_jsonb(t)
      from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','private')
    union all select 'namespace',n.nspname,to_jsonb(n)
      from pg_namespace n where n.nspname in ('public','private')
    union all select 'column',n.nspname||'.'||c.relname||'.'||a.attname,to_jsonb(a)
      from pg_attribute a join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and a.attnum>0 and not a.attisdropped
    ) x order by kind,identity`)).rows;
  const grants = (await db.query(`select r.rolname,s.setconfig from pg_db_role_setting s
    join pg_roles r on r.oid=s.setrole where r.rolname='authenticator'`)).rows;
  return sha({ rows, grants });
}

async function apiJson(api: string, key: string, path: string, method: string, body: unknown, code: string, apiKey = key) {
  const response = await fetch(`${api}${path}`, { method, headers: { apikey: apiKey, Authorization: `Bearer ${key}`,
    'content-type': 'application/json', ...(path.startsWith('/rest/v1/') ? { 'x-pos-permission-contract': '2' } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) }).catch(() => fail(code));
  const result = await response.json().catch(() => fail(code));
  if (!response.ok) fail(code);
  return result;
}

async function refused(config: object, code: string, options: object = {}) {
  try { await activateDatabase(config, options); } catch (error: any) {
    if (error?.code === code) return;
    const actual = typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code)
      ? error.code : 'UNKNOWN';
    fail(`CANARY_WRONG_REFUSAL_${actual}`);
  }
  fail('CANARY_UNEXPECTED_ACTIVATION');
}

async function releasePreflight(db: pg.Client, target: ReturnType<typeof status>, patch: object = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'perm-canary-release-'));
  const path = join(directory, 'target.json');
  const config = { schemaVersion: 1, mode: 'release-read-only-preflight', connectionString: target.DB_URL,
    projectRef: PROJECT, backendHost: '127.0.0.1', database: 'postgres', storeIds: [],
    catalogHash: (await collectInventory(db)).catalogHash, sourceFingerprint: permissionFingerprint(),
    bundleHash: activationBundleManifest().sha256, mappingFiles: [], expectedEmptyStoreSet: true, ...patch };
  try {
    writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
    return await runReleasePreflight(path);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

async function releaseRefused(db: pg.Client, target: ReturnType<typeof status>, patch: object, code: string) {
  try { await releasePreflight(db, target, patch); } catch (error: any) {
    if (error?.reason === code) return;
    fail('CANARY_WRONG_RELEASE_REFUSAL');
  }
  fail('CANARY_UNEXPECTED_RELEASE_READY');
}

async function waitForLock(observer: pg.Client, applicationName: string) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const row = (await observer.query(`select wait_event_type from pg_stat_activity
      where application_name=$1 and pid<>pg_backend_pid() order by pid desc limit 1`, [applicationName])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  fail('CANARY_EXPECTED_LOCK_WAIT_NOT_OBSERVED');
}

test('TC-PIN-19 isolated empty target: orphan, schema drift, post-DDL rollback, new owner and unrelated data', async () => {
  const target = status();
  const db = new pg.Client({ connectionString: target.DB_URL, application_name: 'perm-canary-fixture' });
  const observer = new pg.Client({ connectionString: target.DB_URL, application_name: 'perm-canary-observer' });
  const writer = new pg.Client({ connectionString: target.DB_URL, application_name: 'perm-canary-writer' });
  await db.connect();
  try {
    await assertOwnedTarget(db);
    const projectConfigBefore = sha(command(['cat', `${ROOT}/stack/supabase/config.toml`]));
    await observer.connect();
    await writer.connect();
    const marker = `pos-cafe-perm-canary-${randomBytes(20).toString('hex')}`;
    await db.query(`create table private.idempotency_test_environment(singleton boolean primary key check(singleton),
      marker text not null,store_ids uuid[] not null);
      revoke all on private.idempotency_test_environment from public,anon,authenticated,service_role`);
    await db.query('insert into private.idempotency_test_environment values(true,$1,$2::uuid[])', [marker, []]);
    await prepareCompatibilityHook(db);
    const config = { schemaVersion: 1, mode: 'synthetic-activation', connectionString: target.DB_URL,
      database: 'postgres', marker, storeIds: [], sourceFingerprint: permissionFingerprint(),
      bundleHash: activationBundleManifest().sha256, mappingFiles: [], expectedEmptyStoreSet: true };
    await refused({ ...config, expectedEmptyStoreSet: false }, 'INVALID_ACTIVATION_CONFIG');
    const { expectedEmptyStoreSet: _emptyOptIn, ...ordinaryConfig } = config;
    await refused(ordinaryConfig, 'INVALID_ACTIVATION_CONFIG');
    const releaseReady = await releasePreflight(db, target);
    if (releaseReady.status !== 'READY' || releaseReady.expectedEmptyStoreSet !== true
      || releaseReady.emptyTarget?.empty !== true || releaseReady.emptyTarget?.schemaMatches !== true
      || JSON.stringify(releaseReady.emptyTarget?.relations) !== JSON.stringify([...EMPTY_TARGET_RELATIONS].sort())
      || !Array.isArray(releaseReady.emptyTarget?.rowCounts)
      || releaseReady.emptyTarget.rowCounts.length !== EMPTY_TARGET_RELATIONS.length
      || JSON.stringify(releaseReady.emptyTarget.rowCounts.map((row: { relation: string }) => row.relation).sort())
        !== JSON.stringify([...EMPTY_TARGET_RELATIONS].sort())
      || releaseReady.emptyTarget.rowCounts.some((row: { rowCount: string }) => row.rowCount !== '0')
      || releaseReady.readOnlyTransaction !== true) fail('CANARY_RELEASE_DRY_RUN_NOT_READY');
    await releaseRefused(db, target, { expectedEmptyStoreSet: false }, 'INVALID_TARGET_CONFIG');
    await releaseRefused(db, target, { expectedEmptyStoreSet: undefined }, 'INVALID_TARGET_CONFIG');
    await releaseRefused(db, target, { backendHost: 'localhost' }, 'TARGET_BINDING_MISMATCH');
    await releaseRefused(db, target, { sourceFingerprint: '0'.repeat(64) }, 'SOURCE_FINGERPRINT_MISMATCH');
    await releaseRefused(db, target, { bundleHash: '0'.repeat(64) }, 'BUNDLE_HASH_MISMATCH');
    await refused({ ...config, marker: 'wrong-canary-marker' }, 'ACTIVATION_TARGET_BINDING_MISMATCH');
    await refused({ ...config, database: 'wrong_database' }, 'ACTIVATION_DATABASE_MISMATCH');
    await refused({ ...config, sourceFingerprint: '0'.repeat(64) }, 'SOURCE_FINGERPRINT_MISMATCH');
    await refused({ ...config, bundleHash: '0'.repeat(64) }, 'BUNDLE_HASH_MISMATCH');

    // Auth and Storage objects are deliberately outside the tenant table set.
    const unrelatedIds: string[] = [];
    const unrelatedPassword = randomBytes(24).toString('hex');
    for (let index = 0; index < 66; index += 1) {
      const id = randomUUID();
      unrelatedIds.push(id);
      const user = await apiJson(target.API_URL, target.SERVICE_ROLE_KEY, '/auth/v1/admin/users', 'POST',
        { id, email: `canary-${id}@example.test`, password: index === 0 ? unrelatedPassword : randomBytes(24).toString('hex'),
          email_confirm: true }, 'CANARY_AUTH_FIXTURE_FAILED');
      if (user.id !== id) fail('CANARY_AUTH_FIXTURE_MISMATCH');
    }
    if ((await db.query('select count(*)::int n from auth.users')).rows[0]?.n !== 66
      || (await db.query('select count(*)::int n from auth.identities')).rows[0]?.n !== 66)
      fail('CANARY_AUTH_66_NOT_PRESENT');
    // public.stores.id has a real FK to auth.users.id. Use one of the unrelated
    // synthetic Auth identities for both writer races; the Auth row itself is
    // still covered by the before/after preservation hashes.
    const writerStoreId = unrelatedIds[0];
    await apiJson(target.API_URL, target.SERVICE_ROLE_KEY, '/storage/v1/bucket', 'POST',
      { id: 'canary-unrelated', name: 'canary-unrelated', public: false }, 'CANARY_BUCKET_FIXTURE_FAILED');
    const bytes = randomBytes(37);
    const objectResponse = await fetch(`${target.API_URL}/storage/v1/object/canary-unrelated/preserved.bin`, {
      method: 'POST', headers: { apikey: target.SERVICE_ROLE_KEY, Authorization: `Bearer ${target.SERVICE_ROLE_KEY}`,
        'content-type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(10_000),
    }).catch(() => fail('CANARY_OBJECT_FIXTURE_FAILED'));
    if (!objectResponse.ok) fail('CANARY_OBJECT_FIXTURE_FAILED');
    const authBefore = sha((await db.query('select to_jsonb(u) value from auth.users u where id=any($1::uuid[]) order by id', [unrelatedIds])).rows);
    const identitiesBefore = sha((await db.query('select to_jsonb(i) value from auth.identities i where user_id=any($1::uuid[]) order by id', [unrelatedIds])).rows);
    const storageBefore = sha((await db.query("select to_jsonb(o) value from storage.objects o where bucket_id='canary-unrelated' order by id")).rows);
    const bucketBefore = sha((await db.query("select to_jsonb(b) value from storage.buckets b where id='canary-unrelated'")).rows);

    await db.query('set session_replication_role=replica');
    await db.query(`insert into public.employees(id,store_id,name,role,passcode_hash)
      values($1,$2,'Canary orphan','cashier','opaque-fixture')`, [BAD_EMPLOYEE, BAD_STORE]);
    await db.query('set session_replication_role=origin');
    await refused(config, 'ACTIVATION_TARGET_NOT_EMPTY');
    await releaseRefused(db, target, {}, 'RELEASE_TARGET_NOT_EMPTY');
    await db.query('delete from public.employees where id=$1', [BAD_EMPLOYEE]);

    await db.query('set session_replication_role=replica');
    await db.query(`insert into public.categories(id,store_id,name) values($1,$2,'Canary orphan category')`, [randomUUID(), BAD_STORE]);
    await db.query('set session_replication_role=origin');
    await refused(config, 'ACTIVATION_TARGET_NOT_EMPTY');
    await releaseRefused(db, target, {}, 'RELEASE_TARGET_NOT_EMPTY');
    await db.query('delete from public.categories where store_id=$1', [BAD_STORE]);

    await db.query('create table public.canary_extra_tenant(id uuid primary key,store_id uuid not null)');
    await refused(config, 'ACTIVATION_TENANT_SCHEMA_MISMATCH');
    await releaseRefused(db, target, {}, 'TARGET_TENANT_SCHEMA_MISMATCH');
    await db.query('drop table public.canary_extra_tenant');

    // The earlier writer must become visible after the activation waits for
    // SHARE locks. The empty opt-in must reject its committed store ID.
    await writer.query('begin');
    let writerOpen = true;
    try {
      await writer.query("insert into public.stores(id,store_no,name) values($1,9822,'Canary writer before lock')", [writerStoreId]);
      const blockedActivation = refused(config, 'ACTIVATION_STORE_SET_MISMATCH');
      await waitForLock(observer, 'pos-cafe-permission-activate');
      await writer.query('commit');
      writerOpen = false;
      await blockedActivation;
    } finally { if (writerOpen) await writer.query('rollback').catch(() => {}); }
    if ((await db.query('select count(*)::int n from public.stores where id=$1', [writerStoreId])).rows[0]?.n !== 1)
      fail('CANARY_WRITER_BEFORE_LOCK_NOT_COMMITTED');
    await releaseRefused(db, target, {}, 'TARGET_STORE_SET_MISMATCH');
    await db.query('delete from public.stores where id=$1', [writerStoreId]);
    if (!(await inspectAllTenantRows(db)).empty) fail('CANARY_WRITER_BEFORE_LOCK_CLEANUP_FAILED');

    const beforeFault = await catalogHash(db);
    await refused(config, 'SYNTHETIC_FRAGMENT_FAULT', { failAfterFragment: 3 });
    if (await catalogHash(db) !== beforeFault) fail('CANARY_POST_DDL_ROLLBACK_FAILED');

    // The later writer starts only while activation owns every tenant-table
    // SHARE lock. It must wait, then be denied by the activated store policy.
    const writerOutcome: { current?: Promise<{ ok: true } | { ok: false; code: string | undefined }> } = {};
    let lockedCountEvidence = false;
    const activated = await activateDatabase(config, { afterEmptyTargetLocked: async (evidence: {
      schemaMatches: boolean; empty: boolean; actualRelations: string[]; storeIds: string[];
      employeeIds: unknown[]; rowCounts: Array<{ relation: string; rowCount: string }>;
    }) => {
      lockedCountEvidence = evidence.schemaMatches === true && evidence.empty === true
        && evidence.storeIds.length === 0 && evidence.employeeIds.length === 0
        && JSON.stringify(evidence.actualRelations) === JSON.stringify([...EMPTY_TARGET_RELATIONS].sort())
        && Array.isArray(evidence.rowCounts) && evidence.rowCounts.length === EMPTY_TARGET_RELATIONS.length
        && evidence.rowCounts.every(row => row.rowCount === '0')
        && JSON.stringify(evidence.rowCounts.map(row => row.relation).sort()) === JSON.stringify([...EMPTY_TARGET_RELATIONS].sort());
      if (!lockedCountEvidence) fail('CANARY_LOCKED_COUNTS_NOT_ZERO');
      writerOutcome.current = writer.query("insert into public.stores(id,store_no,name) values($1,9823,'Canary writer after lock')", [writerStoreId])
        .then(() => ({ ok: true as const }), (error: { code?: string }) => ({ ok: false as const, code: error?.code }));
      await waitForLock(observer, 'perm-canary-writer');
    } });
    if (activated.status !== 'ACTIVATED' || !activated.expectedEmptyStoreSet || activated.stores.length !== 0)
      fail('CANARY_EMPTY_ACTIVATION_FAILED');
    if (!lockedCountEvidence) fail('CANARY_LOCKED_COUNTS_NOT_CAPTURED');
    const pendingWriterOutcome = writerOutcome.current;
    if (!pendingWriterOutcome) fail('CANARY_WRITER_AFTER_LOCK_NOT_STARTED');
    const afterLock = await pendingWriterOutcome;
    if (!afterLock || afterLock.ok !== false || afterLock.code !== '23514')
      fail('CANARY_WRITER_AFTER_LOCK_WRONG_RESULT');
    const postflight = await inspectAllTenantRows(db);
    if (!postflight.empty || !postflight.rowCounts.length
      || postflight.rowCounts.some((row: { rowCount: string }) => row.rowCount !== '0'))
      fail('CANARY_EMPTY_POSTFLIGHT_FAILED');
    const catalogState = (await db.query(`select
      (select count(*)::int from public.permission_roles) roles,
      (select count(*)::int from public.permission_catalog) permissions,
      (select count(*)::int from public.role_permission_defaults) defaults,
      (select count(*)::int from public.permission_catalog_state) state_rows`)).rows[0];
    if (catalogState?.roles !== 5 || catalogState?.permissions !== 15
      || catalogState?.defaults !== 37 || catalogState?.state_rows !== 1)
      fail('CANARY_GLOBAL_CATALOG_NOT_RETAINED');
    if (sha(command(['cat', `${ROOT}/stack/supabase/config.toml`])) !== projectConfigBefore)
      fail('CANARY_PROJECT_CONFIG_CHANGED');
    if (sha((await db.query('select to_jsonb(u) value from auth.users u where id=any($1::uuid[]) order by id', [unrelatedIds])).rows) !== authBefore
      || sha((await db.query('select to_jsonb(i) value from auth.identities i where user_id=any($1::uuid[]) order by id', [unrelatedIds])).rows) !== identitiesBefore
      || sha((await db.query("select to_jsonb(o) value from storage.objects o where bucket_id='canary-unrelated' order by id")).rows) !== storageBefore
      || sha((await db.query("select to_jsonb(b) value from storage.buckets b where id='canary-unrelated'")).rows) !== bucketBefore)
      fail('CANARY_UNRELATED_METADATA_CHANGED');
    const objectRead = await fetch(`${target.API_URL}/storage/v1/object/authenticated/canary-unrelated/preserved.bin`, {
      headers: { apikey: target.SERVICE_ROLE_KEY, Authorization: `Bearer ${target.SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => fail('CANARY_UNRELATED_BYTES_UNAVAILABLE'));
    if (!objectRead.ok || !Buffer.from(await objectRead.arrayBuffer()).equals(bytes)) fail('CANARY_UNRELATED_BYTES_CHANGED');

    const ownerId = randomUUID();
    const ownerEmployeeId = randomUUID();
    const ownerPassword = randomBytes(24).toString('hex');
    const owner = await apiJson(target.API_URL, target.SERVICE_ROLE_KEY, '/auth/v1/admin/users', 'POST',
      { id: ownerId, email: 'store9821@store.pos.local', password: ownerPassword, email_confirm: true }, 'CANARY_OWNER_AUTH_FAILED');
    if (owner.id !== ownerId) fail('CANARY_OWNER_AUTH_MISMATCH');
    const login = await apiJson(target.API_URL, target.ANON_KEY, '/auth/v1/token?grant_type=password', 'POST',
      { email: 'store9821@store.pos.local', password: ownerPassword }, 'CANARY_OWNER_LOGIN_FAILED');
    if (!login.access_token) fail('CANARY_OWNER_LOGIN_FAILED');
    const bootstrap = await apiJson(target.API_URL, login.access_token, '/rest/v1/rpc/permission_bootstrap_store', 'POST',
      { p_request: { requestId: randomUUID(), ownerId: ownerEmployeeId, storeNo: 9821, displayName: 'Canary',
        address: '', seedDemo: false } }, 'CANARY_BOOTSTRAP_HTTP_FAILED', target.ANON_KEY);
    if (bootstrap.ok !== true || bootstrap.data?.ownerId !== ownerEmployeeId)
      fail('CANARY_BOOTSTRAP_RESULT_FAILED');
    const ownerState = (await db.query(`select role,pin_change_required from public.employees where id=$1 and store_id=$2`,
      [ownerEmployeeId, ownerId])).rows;
    if (ownerState.length !== 1 || ownerState[0].role !== 'owner' || ownerState[0].pin_change_required !== true)
      fail('CANARY_NEW_OWNER_NOT_RESTRICTED');
    const restricted = await apiJson(target.API_URL, login.access_token, '/rest/v1/rpc/permission_start_session', 'POST',
      { p_employee_id: ownerEmployeeId, p_pin: '123456' }, 'CANARY_NEW_OWNER_SESSION_HTTP_FAILED', target.ANON_KEY);
    if (restricted.ok !== true || restricted.kind !== 'required_pin_change' || restricted.pinChangeRequired !== true
      || restricted.employeeId !== ownerEmployeeId || typeof restricted.token !== 'string'
      || !restricted.token || Object.hasOwn(restricted, 'authority'))
      fail('CANARY_NEW_OWNER_SESSION_NOT_RESTRICTED');
    const sessionRows = (await db.query(`select purpose,extract(epoch from expires_at-issued_at)::int ttl
      from private.employee_sessions where store_id=$1 and employee_id=$2`, [ownerId, ownerEmployeeId])).rows;
    if (sessionRows.length !== 1 || sessionRows[0].purpose !== 'required_pin_change' || sessionRows[0].ttl !== 300)
      fail('CANARY_NEW_OWNER_SESSION_TTL_WRONG');

    // TC-PIN-18 subset: capture actual SQL sinks after bootstrap/session, then
    // prove the oracle rejects a deliberately contaminated copy. The remaining
    // transitions and browser/Realtime sinks have their own matrix/gate.
    const audit = (await db.query('select to_jsonb(a) value from public.employee_admin_audit a where store_id=$1', [ownerId])).rows;
    const registry = {
      bootstrap: (await db.query('select to_jsonb(r) value from private.bootstrap_requests r where store_id=$1', [ownerId])).rows,
      seed: (await db.query('select to_jsonb(w) value from private.initial_seed_workflows w where store_id=$1', [ownerId])).rows,
      requests: (await db.query('select to_jsonb(r) value from private.employee_admin_requests r where store_id=$1', [ownerId])).rows,
    };
    const signal = (await db.query('select to_jsonb(s) value from public.store_change_signals s where store_id=$1', [ownerId])).rows;
    const secrets = [unrelatedPassword, ownerPassword, login.access_token, restricted.token];
    const observed = { audit: { captured: true as const, data: audit }, registry: { captured: true as const, data: registry },
      signal: { captured: true as const, data: signal } };
    const scan = assertNoCanaryLeaks({ canaries: secrets, requiredSinks: ['audit', 'registry', 'signal'], observations: observed });
    if (scan.checkedSinkCount !== 3) fail('CANARY_RUNTIME_SCAN_INCOMPLETE');
    let detected = false;
    try { assertNoCanaryLeaks({ canaries: secrets, requiredSinks: ['registry'],
      observations: { registry: { captured: true, data: { ...registry, injected: ownerPassword } } } }); }
    catch (error) { detected = (error as Error).message === 'CANARY_LEAK_registry'; }
    if (!detected) fail('CANARY_RUNTIME_NEGATIVE_CONTROL_FAILED');
  } finally { await Promise.allSettled([db.end(), observer.end(), writer.end()]); }
}, 240_000);
