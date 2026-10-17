import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';
import { migrationChecksums } from '../tests/contracts/observerPreflight.ts';
import { applyActivationSteps } from './permission-activation-steps.mjs';
import { inspectExpectedEmptyTarget } from './permission-activation-bundle.mjs';

const PROJECT = 'pos-cafe-perm-g2c-20261009';
const ROOT = `/var/tmp/${PROJECT}`;
const CLI = '/var/tmp/pos-cafe-perm-s31-t04-20261013/bin/supabase';
const CONFIG = `${ROOT}/stack/supabase/config.toml`;
const isWin = process.platform === 'win32';
const wsl = (command) => execFileSync(isWin ? 'wsl' : command[0], isWin ? ['--', ...command] : command.slice(1), {
  encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };

function runtimeProof() {
  const config = wsl(['cat', CONFIG]);
  const expected = readFileSync('tests/permissions/runtime/identity.toml', 'utf8')
    .replaceAll('pos-cafe-perm-s31-t04-20261013', PROJECT).replaceAll('6242', '5972')
    .replace('inspector_port = 8084', 'inspector_port = 8087');
  if (sha(config.replaceAll('\r\n', '\n').trim()) !== sha(expected.replaceAll('\r\n', '\n').trim())) fail('G2C_CONFIG_MISMATCH');
  if (wsl([CLI, '--version']).trim() !== '2.117.0') fail('G2C_CLI_MISMATCH');
  const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
  const containers = JSON.parse(wsl(['docker', 'inspect', ...names.map(name => `supabase_${name}_${PROJECT}`)]));
  if (containers.length !== names.length) fail('G2C_SERVICE_COUNT_MISMATCH');
  const peer = JSON.parse(wsl(['docker', 'inspect', ...names.map(name => `supabase_${name}_pos-cafe-perm-g2b-20261009`)]));
  if (peer.length !== names.length || containers.some((container, index) =>
    container.Image !== peer[index].Image || container.Config.Image !== peer[index].Config.Image))
    fail('G2C_IMAGE_MISMATCH');
  for (const container of containers) {
    if (container.Config.Labels?.['com.supabase.cli.project'] !== PROJECT || !container.State.Running
      || (container.State.Health && container.State.Health.Status !== 'healthy')) fail('G2C_SERVICE_UNHEALTHY');
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) for (const binding of bindings ?? [])
      if (!['127.0.0.1', '::1'].includes(binding.HostIp)) fail('G2C_NONLOCAL_PORT');
  }
  if (!containers[0].Mounts.some(mount => mount.Type === 'volume' && mount.Name === `supabase_db_${PROJECT}`)) fail('G2C_VOLUME_MISMATCH');
  const network = JSON.parse(wsl(['docker', 'network', 'inspect', `supabase_network_${PROJECT}`]));
  if (network.length !== 1 || network[0].Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1')
    fail('G2C_NETWORK_MISMATCH');
  return { configHash: sha(config), containers: containers.map(c => ({ name: c.Name.slice(1), id: c.Id, imageId: c.Image })) };
}

function status() {
  const value = JSON.parse(wsl([CLI, 'status', '--workdir', `${ROOT}/stack`, '-o', 'json']));
  const db = new URL(value.DB_URL), api = new URL(value.API_URL);
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '59722' || db.pathname !== '/postgres'
    || db.search || db.hash || api.origin !== 'http://127.0.0.1:59721' || api.pathname !== '/' || api.search || api.hash)
    fail('G2C_ENDPOINT_MISMATCH');
  const anon = JSON.parse(Buffer.from(value.ANON_KEY.split('.')[1], 'base64url').toString());
  if (anon.role !== 'anon') fail('G2C_ANON_ROLE_MISMATCH');
  return value;
}

async function prepare(directory) {
  const proof = runtimeProof();
  const value = status();
  const target = resolve(directory);
  if (existsSync(join(target, 'pin-expiry.env'))) fail('G2C_ALREADY_PREPARED');
  mkdirSync(target, { recursive: true, mode: 0o700 });
  const db = new pg.Client({ connectionString: value.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 120000 });
  await db.connect();
  try {
    if ((await db.query("select to_regclass('public.stores') present")).rows[0].present) fail('G2C_DATABASE_NOT_EMPTY');
    const checksums = migrationChecksums(process.cwd(), 16);
    for (const name of Object.keys(checksums)) await db.query(readFileSync(join('supabase/migrations', name), 'utf8'));
    await db.query(readFileSync('supabase/candidate/permission-compatibility-prepare.sql', 'utf8'));
    await db.query('begin');
    try {
      const pre = await inspectExpectedEmptyTarget(db, { lockTables: true });
      if (!pre.schemaMatches || !pre.empty) fail('G2C_NOT_EMPTY_BEFORE_ACTIVATION');
      await applyActivationSteps(db, { plan: { stores: [] }, storeIds: [], expectedEmptyStoreSet: true });
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; }
    const marker = `pos-cafe-perm-g2c-${randomBytes(20).toString('hex')}`;
    await db.query(`create table private.pin_expiry_test_environment (
      singleton boolean primary key check(singleton), marker text not null,
      project text not null, migration_checksums jsonb not null,
      activation_hash text not null, catalog_hash text);
      revoke all on private.pin_expiry_test_environment from public,anon,authenticated,service_role`);
    const activationPaths = (await import('./permission-activation-bundle.mjs')).ACTIVATION_SQL_ORDER;
    const activationHash = sha(JSON.stringify(activationPaths.map(path => [path, sha(readFileSync(path))])));
    await db.query('insert into private.pin_expiry_test_environment values(true,$1,$2,$3,$4)', [marker, PROJECT, checksums, activationHash]);
    await db.query(`create function public.permission_pin_expiry_fixture_identity() returns jsonb
      language sql stable security definer set search_path=pg_catalog as $$
      select jsonb_build_object('marker',marker,'project',project,'database',current_database())
      from private.pin_expiry_test_environment where singleton $$;
      revoke all on function public.permission_pin_expiry_fixture_identity() from public,anon,authenticated,service_role;
      grant execute on function public.permission_pin_expiry_fixture_identity() to anon;
      notify pgrst,'reload schema'`);
    const functionCatalog = (await db.query(`select n.nspname,p.proname,p.oid,to_jsonb(p) metadata
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('private','public') order by n.nspname,p.proname,p.oid`)).rows;
    await db.query('update private.pin_expiry_test_environment set catalog_hash=$1 where singleton',
      [sha(JSON.stringify(functionCatalog))]);
    const phase = (await db.query("select strict,contract_version from private.permission_contract_gate where singleton")).rows;
    if (phase.length !== 1 || !phase[0].strict || phase[0].contract_version !== 2) fail('G2C_ACTIVATION_FAILED');
    writeFileSync(join(target, 'pin-expiry.env'), [
      `PIN_EXPIRY_PROFILE=local-g2c-v1`, `PIN_EXPIRY_PROJECT=${PROJECT}`, `PIN_EXPIRY_MARKER=${marker}`,
      `PIN_EXPIRY_API_URL=${value.API_URL}`, `PIN_EXPIRY_OBSERVER_DSN=${value.DB_URL}`,
      `PIN_EXPIRY_ANON_KEY=${value.ANON_KEY}`, `PIN_EXPIRY_VITE_PORT=5181`,
    ].join('\n') + '\n', { mode: 0o600 });
    return { project: PROJECT, configHash: proof.configHash, serviceCount: proof.containers.length,
      migrationCount: Object.keys(checksums).length, activationCount: activationPaths.length, activated: true };
  } finally { await db.end(); }
}

try {
  if (process.argv.length !== 3) fail('G2C_PREPARE_ARGUMENT_REQUIRED');
  console.log(JSON.stringify(await prepare(process.argv[2])));
} catch (error) {
  const code = error instanceof Error && /^G2C_[A-Z_]+$/.test(error.message) ? error.message : 'G2C_PREPARE_FAILED';
  console.error(code); process.exitCode = 1;
}
