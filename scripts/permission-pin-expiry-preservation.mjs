import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { collectInventory } from './permission-inventory.mjs';

// Independent, read-only preservation of the three older local projects. The
// baseline file is private because it contains hashes of auth and Storage data.
const G1 = 'pos-cafe-perm-s31-t04-20261013';
const G2A = 'pos-cafe-perm-g2a-20261009';
const G2B = 'pos-cafe-perm-g2b-20261009';
const G1_ENV = '/var/tmp/pos-cafe-perm-t08-20262922/isolated-gates-20261008/private/fixture-restored-01/bridge.env';
// G2a was rebuilt through attempt 05. Earlier private env files remain as
// historical evidence but their markers no longer identify the current DB.
const G2A_ENV = `/var/tmp/${G2A}/private-attempt-05/pin-ack.env`;
const G2B_ENV = `/var/tmp/${G2B}/private-attempt-02/pin-race.env`;
const CLI = `/var/tmp/${G1}/bin/supabase`;
const TARGETS = [
  { id: 'g1', project: G1, dbPort: '62422', apiPort: '62421', markerTable: 'private.idempotency_test_environment' },
  { id: 'g2a', project: G2A, dbPort: '59522', apiPort: '59521', markerTable: 'private.pin_ack_test_environment' },
  { id: 'g2b', project: G2B, dbPort: '59622', apiPort: '59621', markerTable: 'private.pin_race_test_environment' },
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const local = path => process.platform === 'win32' ? `\\\\wsl.localhost\\Ubuntu-24.04${path.replaceAll('/', '\\')}` : path;
const quote = value => `"${value.replaceAll('"', '""')}"`;

function command(args) {
  try {
    return execFileSync(process.platform === 'win32' ? 'wsl' : args[0],
      process.platform === 'win32' ? ['--', ...args] : args.slice(1),
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { return fail('PIN_EXPIRY_PRESERVE_RUNTIME_COMMAND_FAILED'); }
}

function readEnv(path) {
  let source;
  try { source = readFileSync(local(path), 'utf8'); }
  catch { return fail('PIN_EXPIRY_PRESERVE_ENV_UNREADABLE'); }
  const entries = source.split(/\r?\n/).filter(Boolean);
  const parsed = entries.map(line => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/));
  if (parsed.some(entry => !entry) || new Set(parsed.map(entry => entry[1])).size !== parsed.length)
    fail('PIN_EXPIRY_PRESERVE_ENV_INVALID');
  return Object.fromEntries(parsed.map(entry => [entry[1], entry[2]]));
}

function endpoint(raw, port, protocol) {
  let url;
  try { url = new URL(raw); }
  catch { return fail('PIN_EXPIRY_PRESERVE_ENDPOINT_REFUSED'); }
  if (url.protocol !== protocol || url.hostname !== '127.0.0.1' || url.port !== port
    || url.pathname !== (protocol === 'postgresql:' ? '/postgres' : '/') || url.search || url.hash)
    fail('PIN_EXPIRY_PRESERVE_ENDPOINT_REFUSED');
  return url;
}

function environment(target, g2aEnv) {
  const values = readEnv(target.id === 'g1' ? G1_ENV : target.id === 'g2a' ? g2aEnv : G2B_ENV);
  if (target.id === 'g1') {
    if (values.PERM_TEST_PROFILE !== 'supabase-identity-v1'
      || !/^pos-cafe-perm-[a-f0-9]{40}$/.test(values.IDEM_TEST_MARKER))
      fail('PIN_EXPIRY_PRESERVE_PROFILE_REFUSED');
    endpoint(values.IDEM_OBSERVER_DSN, target.dbPort, 'postgresql:');
    endpoint(values.PERM_API_URL, target.apiPort, 'http:');
    return { dsn: values.IDEM_OBSERVER_DSN, api: values.PERM_API_URL, marker: values.IDEM_TEST_MARKER };
  }
  const prefix = target.id === 'g2a' ? 'PIN_ACK' : 'PIN_RACE';
  const keys = ['PROFILE', 'PROJECT', 'MARKER', 'API_URL', 'OBSERVER_DSN', 'ANON_KEY', 'VITE_PORT'].map(key => `${prefix}_${key}`);
  if (JSON.stringify(Object.keys(values).sort()) !== JSON.stringify(keys.sort())
    || values[`${prefix}_PROFILE`] !== (target.id === 'g2a' ? 'local-g2a-v1' : 'local-g2b-v1')
    || values[`${prefix}_PROJECT`] !== target.project
    || !new RegExp(`^pos-cafe-perm-${target.id}-[a-f0-9]{40}$`).test(values[`${prefix}_MARKER`])
    || values[`${prefix}_VITE_PORT`] !== (target.id === 'g2a' ? '5179' : '5180'))
    fail('PIN_EXPIRY_PRESERVE_PROFILE_REFUSED');
  endpoint(values[`${prefix}_OBSERVER_DSN`], target.dbPort, 'postgresql:');
  endpoint(values[`${prefix}_API_URL`], target.apiPort, 'http:');
  return { dsn: values[`${prefix}_OBSERVER_DSN`], api: values[`${prefix}_API_URL`], marker: values[`${prefix}_MARKER`] };
}

function runtime(target, env) {
  const config = command(['cat', `/var/tmp/${target.project}/stack/supabase/config.toml`]);
  const expected = readFileSync('tests/permissions/runtime/identity.toml', 'utf8')
    .replaceAll(G1, target.project)
    .replaceAll('6242', target.id === 'g1' ? '6242' : target.id === 'g2a' ? '5952' : '5962')
    .replace('inspector_port = 8084', target.id === 'g2b' ? 'inspector_port = 8086' : 'inspector_port = 8084');
  const normalize = source => source.replaceAll('\r\n', '\n').trim();
  if (sha(normalize(config)) !== sha(normalize(expected)) || command([CLI, '--version']).trim() !== '2.117.0')
    fail('PIN_EXPIRY_PRESERVE_CONFIG_REFUSED');
  const services = ['db', 'auth', 'rest', 'kong', 'storage', 'realtime', 'edge_runtime',
    'studio', 'pg_meta', 'inbucket', 'vector', 'analytics'];
  const containers = JSON.parse(command(['docker', 'inspect', ...services
    .map(service => `supabase_${service}_${target.project}`)]));
  if (containers.length !== services.length || containers.some(container =>
    container.Config.Labels?.['com.supabase.cli.project'] !== target.project)
    || [0, 3, 4].some(index => !containers[index].State.Running))
    fail('PIN_EXPIRY_PRESERVE_RUNTIME_REFUSED');
  if (!containers[0].Mounts.some(mount => mount.Type === 'volume' && mount.Name === `supabase_db_${target.project}`))
    fail('PIN_EXPIRY_PRESERVE_VOLUME_REFUSED');
  for (const container of containers) for (const bindings of Object.values(container.NetworkSettings.Ports ?? {}))
    for (const binding of bindings ?? []) if (!['127.0.0.1', '::1'].includes(binding.HostIp))
      fail('PIN_EXPIRY_PRESERVE_NONLOCAL_PORT_REFUSED');
  const network = JSON.parse(command(['docker', 'network', 'inspect', `supabase_network_${target.project}`]));
  const options = network[0]?.Options;
  const expectedOptions = target.id === 'g1'
    ? options && Object.keys(options).length === 0
    : options?.['com.docker.network.bridge.host_binding_ipv4'] === '127.0.0.1';
  if (network.length !== 1 || !expectedOptions)
    fail('PIN_EXPIRY_PRESERVE_NETWORK_REFUSED');
  const raw = command([CLI, 'status', '--workdir', `/var/tmp/${target.project}/stack`, '-o', 'json']);
  let status;
  try { status = JSON.parse(raw.slice(raw.indexOf('{'))); }
  catch { return fail('PIN_EXPIRY_PRESERVE_STATUS_REFUSED'); }
  endpoint(status.DB_URL, target.dbPort, 'postgresql:');
  endpoint(status.API_URL, target.apiPort, 'http:');
  if (status.API_URL !== env.api || !status.SERVICE_ROLE_KEY) fail('PIN_EXPIRY_PRESERVE_STATUS_REFUSED');
  return status.SERVICE_ROLE_KEY;
}

async function marker(db, target, env) {
  const rows = target.id === 'g1'
    ? (await db.query(`select current_database() db,marker,engine from ${target.markerTable} where singleton`)).rows
    : (await db.query(`select current_database() db,marker,project from ${target.markerTable} where singleton`)).rows;
  if (rows.length !== 1 || rows[0].db !== 'postgres' || rows[0].marker !== env.marker
    || (target.id === 'g1' ? rows[0].engine !== 'supabase-identity-v1' : rows[0].project !== target.project))
    fail(`PIN_EXPIRY_PRESERVE_${target.id.toUpperCase()}_MARKER_REFUSED`);
}

async function snapshot(db, target, env, serviceRoleKey) {
  await marker(db, target, env);
  const tables = (await db.query(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p')
    and n.nspname in ('public','private','auth','storage') order by n.nspname,c.relname`)).rows;
  const rows = [];
  for (const table of tables) {
    const result = await db.query(`select count(*)::text n,
      encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]'),'UTF8'),'sha256'),'hex') h
      from ${quote(table.schema)}.${quote(table.name)} t`);
    rows.push([table.schema, table.name, result.rows[0].n, result.rows[0].h]);
  }
  const sequenceNames = (await db.query(`select n.nspname as schema,c.relname as name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='S'
    and n.nspname in ('public','private','auth','storage') order by n.nspname,c.relname`)).rows;
  const sequences = [];
  for (const sequence of sequenceNames) {
    const state = (await db.query(`select last_value::text,is_called from ${quote(sequence.schema)}.${quote(sequence.name)}`)).rows[0];
    sequences.push([sequence.schema, sequence.name, state.last_value, state.is_called]);
  }
  const catalogHash = (await collectInventory(db)).catalogHash;
  const sessionGraph = {};
  for (const [name, sql] of Object.entries({
    employeeSessions: 'select count(*)::int n from private.employee_sessions',
    authSessions: 'select count(*)::int n from auth.sessions',
    refreshTokens: 'select count(*)::int n from auth.refresh_tokens',
    authUsers: 'select count(*)::int n from auth.users',
  })) sessionGraph[name] = (await db.query(sql)).rows[0].n;
  const objects = (await db.query('select bucket_id,name from storage.objects order by bucket_id,name')).rows;
  const storageBytes = [];
  for (const object of objects) {
    const path = `${encodeURIComponent(object.bucket_id)}/${object.name.split('/').map(encodeURIComponent).join('/')}`;
    let response;
    try {
      response = await fetch(`${env.api}/storage/v1/object/${path}`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch { return fail('PIN_EXPIRY_PRESERVE_STORAGE_READ_FAILED'); }
    if (!response.ok) fail('PIN_EXPIRY_PRESERVE_STORAGE_READ_FAILED');
    storageBytes.push([sha(`${object.bucket_id}\0${object.name}`), sha(Buffer.from(await response.arrayBuffer()))]);
  }
  return { rows, sequences, catalogHash, sessionGraph, storageBytes };
}

async function main() {
  const [phase, g2aEnv, privateDir] = process.argv.slice(2);
  if (!['before', 'after'].includes(phase) || process.argv.length !== 5
    || !/^\/var\/tmp\/pos-cafe-perm-g2c-[a-z0-9-]+\/private$/.test(privateDir)
    || g2aEnv !== G2A_ENV)
    fail('PIN_EXPIRY_PRESERVE_ARGUMENT_REFUSED');
  const output = local(`${privateDir}/old-targets-preservation.json`);
  if (!existsSync(local(privateDir)) || !lstatSync(local(privateDir)).isDirectory()
    || lstatSync(local(privateDir)).isSymbolicLink()) fail('PIN_EXPIRY_PRESERVE_PRIVATE_DIR_REFUSED');
  const directoryMode = Number.parseInt(command(['stat', '-c', '%a', privateDir]).trim(), 8);
  if (!Number.isInteger(directoryMode) || (directoryMode & 0o077) !== 0)
    fail('PIN_EXPIRY_PRESERVE_PRIVATE_DIR_REFUSED');
  if (phase === 'before' && existsSync(output)) fail('PIN_EXPIRY_PRESERVE_BASELINE_EXISTS');
  if (phase === 'after' && !existsSync(output)) fail('PIN_EXPIRY_PRESERVE_BASELINE_MISSING');
  if (phase === 'after') {
    const baselineMode = Number.parseInt(command(['stat', '-c', '%a', `${privateDir}/old-targets-preservation.json`]).trim(), 8);
    if (!Number.isInteger(baselineMode) || (baselineMode & 0o077) !== 0)
      fail('PIN_EXPIRY_PRESERVE_BASELINE_PERMISSIONS_REFUSED');
  }
  const current = {};
  for (const target of TARGETS) {
    let stage = 'ENV';
    try {
      const env = environment(target, g2aEnv);
      stage = 'RUNTIME';
      const serviceRoleKey = runtime(target, env);
      stage = 'CONNECT';
      const db = new pg.Client({ connectionString: env.dsn, connectionTimeoutMillis: 5000, statement_timeout: 120000 });
      try {
        await db.connect();
        stage = 'SNAPSHOT';
        await db.query('begin isolation level repeatable read read only');
        try { current[target.id] = await snapshot(db, target, env, serviceRoleKey); }
        finally { await db.query('rollback'); }
      } finally { await db.end(); }
    } catch (error) {
      if (error instanceof Error && /^PIN_EXPIRY_PRESERVE_[A-Z0-9_]+$/.test(error.message)) throw error;
      fail(`PIN_EXPIRY_PRESERVE_${target.id.toUpperCase()}_${stage}_FAILED`);
    }
  }
  if (phase === 'before') {
    writeFileSync(output, JSON.stringify({ version: 1, current }), { flag: 'wx', mode: 0o600 });
    command(['chmod', '600', `${privateDir}/old-targets-preservation.json`]);
    const mode = Number.parseInt(command(['stat', '-c', '%a', `${privateDir}/old-targets-preservation.json`]).trim(), 8);
    if (!Number.isInteger(mode) || (mode & 0o077) !== 0)
      fail('PIN_EXPIRY_PRESERVE_BASELINE_PERMISSIONS_REFUSED');
    console.log(JSON.stringify({ phase, status: 'PASS', targets: TARGETS.map(target => ({
      id: target.id, tables: current[target.id].rows.length, sequences: current[target.id].sequences.length,
      storageObjects: current[target.id].storageBytes.length, sessions: current[target.id].sessionGraph.employeeSessions,
    })) }));
    return;
  }
  let baseline;
  try { baseline = JSON.parse(readFileSync(output, 'utf8')); }
  catch { return fail('PIN_EXPIRY_PRESERVE_BASELINE_INVALID'); }
  if (baseline.version !== 1 || !baseline.current?.g1 || !baseline.current?.g2a || !baseline.current?.g2b)
    fail('PIN_EXPIRY_PRESERVE_BASELINE_INVALID');
  const result = TARGETS.map(target => {
    const before = baseline.current[target.id], after = current[target.id];
    return { id: target.id, wholeRowsUnchanged: JSON.stringify(before.rows) === JSON.stringify(after.rows),
      catalogUnchanged: before.catalogHash === after.catalogHash,
      sequencesUnchanged: JSON.stringify(before.sequences) === JSON.stringify(after.sequences),
      storageBytesUnchanged: JSON.stringify(before.storageBytes) === JSON.stringify(after.storageBytes),
      sessionGraphUnchanged: JSON.stringify(before.sessionGraph) === JSON.stringify(after.sessionGraph),
      tables: after.rows.length, sequences: after.sequences.length, storageObjects: after.storageBytes.length,
      sessions: after.sessionGraph.employeeSessions };
  });
  const pass = result.every(row => row.wholeRowsUnchanged && row.catalogUnchanged && row.sequencesUnchanged
    && row.storageBytesUnchanged && row.sessionGraphUnchanged);
  console.log(JSON.stringify({ phase, status: pass ? 'PASS' : 'FAIL', targets: result }));
  if (!pass) fail('PIN_EXPIRY_PRESERVE_MISMATCH');
}

try { await main(); }
catch (error) {
  const code = error instanceof Error && /^PIN_EXPIRY_PRESERVE_[A-Z0-9_]+$/.test(error.message)
    ? error.message : 'PIN_EXPIRY_PRESERVE_CHECK_FAILED';
  console.error(code); process.exitCode = 1;
}
