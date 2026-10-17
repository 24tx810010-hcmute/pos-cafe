import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';
import { migrationChecksums } from '../tests/contracts/observerPreflight.ts';
import { applyActivationSteps } from './permission-activation-steps.mjs';
import { inspectExpectedEmptyTarget } from './permission-activation-bundle.mjs';

const PROJECT = 'pos-cafe-perm-g2a-20261009';
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
    .replaceAll('pos-cafe-perm-s31-t04-20261013', PROJECT).replaceAll('6242', '5952');
  if (sha(config.replaceAll('\r\n', '\n').trim()) !== sha(expected.replaceAll('\r\n', '\n').trim())) fail('G2A_CONFIG_MISMATCH');
  if (wsl([CLI, '--version']).trim() !== '2.117.0') fail('G2A_CLI_MISMATCH');
  const names = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime', 'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
  const containers = JSON.parse(wsl(['docker', 'inspect', ...names.map(name => `supabase_${name}_${PROJECT}`)]));
  for (const container of containers) {
    if (container.Config.Labels?.['com.supabase.cli.project'] !== PROJECT || !container.State.Running
      || (container.State.Health && container.State.Health.Status !== 'healthy')) fail('G2A_SERVICE_UNHEALTHY');
    for (const bindings of Object.values(container.NetworkSettings.Ports ?? {})) for (const binding of bindings ?? [])
      if (!['127.0.0.1', '::1'].includes(binding.HostIp)) fail('G2A_NONLOCAL_PORT');
  }
  if (!containers[0].Mounts.some(mount => mount.Type === 'volume' && mount.Name === `supabase_db_${PROJECT}`)) fail('G2A_VOLUME_MISMATCH');
  return { configHash: sha(config), containers: containers.map(c => ({ name: c.Name.slice(1), id: c.Id, imageId: c.Image })) };
}

function status() {
  const value = JSON.parse(wsl([CLI, 'status', '--workdir', `${ROOT}/stack`, '-o', 'json']));
  const db = new URL(value.DB_URL), api = new URL(value.API_URL);
  if (db.protocol !== 'postgresql:' || db.hostname !== '127.0.0.1' || db.port !== '59522' || db.pathname !== '/postgres'
    || db.search || db.hash || api.origin !== 'http://127.0.0.1:59521' || api.pathname !== '/' || api.search || api.hash)
    fail('G2A_ENDPOINT_MISMATCH');
  const anon = JSON.parse(Buffer.from(value.ANON_KEY.split('.')[1], 'base64url').toString());
  if (anon.role !== 'anon') fail('G2A_ANON_ROLE_MISMATCH');
  return value;
}

async function prepare(directory) {
  const proof = runtimeProof();
  const value = status();
  const target = resolve(directory);
  if (existsSync(join(target, 'pin-ack.env'))) fail('G2A_ALREADY_PREPARED');
  mkdirSync(target, { recursive: true, mode: 0o700 });
  const db = new pg.Client({ connectionString: value.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 120000 });
  await db.connect();
  try {
    if ((await db.query("select to_regclass('public.stores') present")).rows[0].present) fail('G2A_DATABASE_NOT_EMPTY');
    const checksums = migrationChecksums(process.cwd(), 16);
    for (const name of Object.keys(checksums)) await db.query(readFileSync(join('supabase/migrations', name), 'utf8'));
    await db.query(readFileSync('supabase/candidate/permission-compatibility-prepare.sql', 'utf8'));
    await db.query('begin');
    try {
      const pre = await inspectExpectedEmptyTarget(db, { lockTables: true });
      if (!pre.schemaMatches || !pre.empty) fail('G2A_NOT_EMPTY_BEFORE_ACTIVATION');
      await applyActivationSteps(db, { plan: { stores: [] }, storeIds: [], expectedEmptyStoreSet: true });
      await db.query('commit');
    } catch (error) { await db.query('rollback'); throw error; }
    const marker = `pos-cafe-perm-g2a-${randomBytes(20).toString('hex')}`;
    await db.query(`create table private.pin_ack_test_environment (
      singleton boolean primary key check(singleton), marker text not null,
      project text not null, migration_checksums jsonb not null,
      activation_hash text not null);
      revoke all on private.pin_ack_test_environment from public,anon,authenticated,service_role`);
    const activationPaths = (await import('./permission-activation-bundle.mjs')).ACTIVATION_SQL_ORDER;
    const activationHash = sha(JSON.stringify(activationPaths.map(path => [path, sha(readFileSync(path))])));
    await db.query('insert into private.pin_ack_test_environment values(true,$1,$2,$3,$4)', [marker, PROJECT, checksums, activationHash]);
    await db.query(`create function public.permission_pin_ack_fixture_identity() returns jsonb
      language sql stable security definer set search_path=pg_catalog as $$
      select jsonb_build_object('marker',marker,'project',project,'database',current_database())
      from private.pin_ack_test_environment where singleton $$;
      revoke all on function public.permission_pin_ack_fixture_identity() from public,anon,authenticated,service_role;
      grant execute on function public.permission_pin_ack_fixture_identity() to anon;
      notify pgrst,'reload schema'`);
    const phase = (await db.query("select strict,contract_version from private.permission_contract_gate where singleton")).rows;
    if (phase.length !== 1 || !phase[0].strict || phase[0].contract_version !== 2) fail('G2A_ACTIVATION_FAILED');
    writeFileSync(join(target, 'pin-ack.env'), [
      `PIN_ACK_PROFILE=local-g2a-v1`, `PIN_ACK_PROJECT=${PROJECT}`, `PIN_ACK_MARKER=${marker}`,
      `PIN_ACK_API_URL=${value.API_URL}`, `PIN_ACK_OBSERVER_DSN=${value.DB_URL}`,
      `PIN_ACK_ANON_KEY=${value.ANON_KEY}`, `PIN_ACK_VITE_PORT=5179`,
    ].join('\n') + '\n', { mode: 0o600 });
    return { project: PROJECT, configHash: proof.configHash, serviceCount: proof.containers.length,
      migrationCount: Object.keys(checksums).length, activationCount: activationPaths.length, activated: true };
  } finally { await db.end(); }
}

try {
  if (process.argv.length !== 3) fail('G2A_PREPARE_ARGUMENT_REQUIRED');
  console.log(JSON.stringify(await prepare(process.argv[2])));
} catch (error) {
  const code = error instanceof Error && /^G2A_[A-Z_]+$/.test(error.message) ? error.message : 'G2A_PREPARE_FAILED';
  console.error(code); process.exitCode = 1;
}
