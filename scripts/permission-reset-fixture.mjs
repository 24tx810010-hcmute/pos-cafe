import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { bootstrapBridgeRuntime, parseBridgeEnvironment, runtimeProof, PROJECT, STORE_IDS } from './permission-identity-runtime.mjs';

const sameIds = (actual, expected) => Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const fail = code => { throw new Error(code); };
function assertResetDeployment() {
  const proof = runtimeProof();
  const database = proof?.containers?.find(container => container.name === `supabase_db_${PROJECT}`);
  const bindings = database?.ports?.['5432/tcp'];
  if (proof?.project !== PROJECT || !Array.isArray(bindings)
    || !bindings.some(binding => binding.HostIp === '127.0.0.1' && binding.HostPort === '62422')
    || bindings.some(binding => !['127.0.0.1', '::1'].includes(binding.HostIp) || binding.HostPort !== '62422')) fail('RESET_DATABASE_PORT_BINDING_MISMATCH');
}

// Intentionally separate from production tooling. A loopback port alone never
// proves it is safe to destroy a database. Require the dedicated deployment,
// its out-of-band fixture record and the complete in-DB tenant/auth identity.
export async function resetPermissionFixture(envFile, outputDirectory) {
  if (typeof envFile !== 'string' || !envFile || typeof outputDirectory !== 'string' || !outputDirectory) fail('EXPLICIT_RESET_PATHS_REQUIRED');
  const destination = resolve(outputDirectory), sourceDirectory = dirname(resolve(envFile));
  if (destination === sourceDirectory || existsSync(destination) || !existsSync(dirname(destination))) fail('NEW_FIXTURE_DIRECTORY_REQUIRED');
  const env = parseBridgeEnvironment({ IDEM_ENV_FILE: resolve(envFile) });
  assertResetDeployment();
  let control;
  try { control = JSON.parse(readFileSync(env.controlPath, 'utf8')); } catch { fail('FIXTURE_CONTROL_REQUIRED'); }
  if (control.project !== PROJECT || control.marker !== env.marker || !sameIds(control.storeIds, STORE_IDS)) fail('FIXTURE_CONTROL_MISMATCH');

  const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5_000, statement_timeout: 30_000,
    application_name: 'pos-cafe-isolated-fixture-reset' });
  let begun = false, resetCommitted = false;
  try {
    await db.connect();
    await db.query('begin'); begun = true;
    await db.query('set local row_security=off');
    const observer = (await db.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
    if (!observer || (!observer.rolsuper && !observer.rolbypassrls)) fail('RESET_OBSERVER_INCOMPLETE');
    await db.query("select pg_advisory_xact_lock(hashtext('pos-cafe:permission-fixture-reset'))");
    await db.query('lock table private.idempotency_test_environment,public.stores,auth.users in access exclusive mode');
    const markers = (await db.query('select current_database() database,marker,engine,store_ids from private.idempotency_test_environment')).rows;
    const stores = (await db.query('select id from public.stores order by id')).rows.map(row => row.id);
    const users = (await db.query('select id from auth.users order by id')).rows.map(row => row.id);
    if (markers.length !== 1 || markers[0].database !== 'postgres' || markers[0].marker !== env.marker
      || markers[0].engine !== 'supabase-identity-v1' || !sameIds(markers[0].store_ids, STORE_IDS)
      || !sameIds(stores, STORE_IDS) || !sameIds(users, STORE_IDS)) fail('RESET_FIXTURE_SCOPE_MISMATCH');
    const hooks=(await db.query(`select split_part(setting,'=',2) value from pg_db_role_setting s join pg_roles r on r.oid=s.setrole,
      lateral unnest(s.setconfig) setting where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%'`)).rows.map(row=>row.value).filter(Boolean);
    if(hooks.length>1||hooks.some(value=>value!=='public.permission_contract_pre_request'))fail('RESET_UNEXPECTED_DB_PRE_REQUEST');
    // Recheck external identity after acquiring locks and before any DDL.
    assertResetDeployment();
    if (existsSync(destination)) fail('NEW_FIXTURE_DIRECTORY_REQUIRED');
    if(hooks.length===1)await db.query("alter role authenticator reset pgrst.db_pre_request; notify pgrst,'reload config'");
    await db.query('drop schema public cascade');
    await db.query('drop schema private cascade');
    await db.query('create schema public');
    await db.query('grant all on schema public to postgres; grant usage on schema public to anon,authenticated,service_role');
    await db.query('delete from auth.users where id=any($1::uuid[])', [STORE_IDS]);
    await db.query('commit'); begun = false; resetCommitted = true;
  } catch (error) {
    if (begun) await db.query('rollback').catch(() => {});
    throw new Error(['RESET_DATABASE_PORT_BINDING_MISMATCH', 'RESET_OBSERVER_INCOMPLETE', 'RESET_FIXTURE_SCOPE_MISMATCH', 'RESET_UNEXPECTED_DB_PRE_REQUEST', 'NEW_FIXTURE_DIRECTORY_REQUIRED'].includes(error.message) ? error.message : 'ISOLATED_RESET_REFUSED_OR_ROLLED_BACK');
  } finally { await db.end().catch(() => {}); }
  try {
    const result = await bootstrapBridgeRuntime(destination);
    return { status: 'RESET_AND_BOOTSTRAPPED', resetCommitted, ...result };
  } catch {
    // Auth HTTP provisioning and bootstrap are a second stage. Never pretend
    // their failure rolled back the already committed, isolated fixture reset.
    throw new Error('ISOLATED_RESET_COMMITTED_BOOTSTRAP_FAILED');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(await resetPermissionFixture(process.argv[2], process.argv[3])) + '\n'); }
  catch (error) {
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'ISOLATED_RESET_FAILED';
    process.stderr.write(JSON.stringify({ status: 'BLOCKED', code }) + '\n'); process.exitCode = 1;
  }
}
