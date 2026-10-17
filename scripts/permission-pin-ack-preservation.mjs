import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { collectInventory } from './permission-inventory.mjs';

const OLD = 'pos-cafe-perm-s31-t04-20261013';
const PRIVATE = '/var/tmp/pos-cafe-perm-t08-20262922/isolated-gates-20261008/private/fixture-restored-01';
const BASELINE = '/var/tmp/pos-cafe-perm-g2a-20261009/private/g1-baseline.json';
const local = path => process.platform === 'win32' ? `\\\\wsl.localhost\\Ubuntu-24.04${path.replaceAll('/', '\\')}` : path;
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const command = args => execFileSync(process.platform === 'win32' ? 'wsl' : args[0],
  process.platform === 'win32' ? ['--', ...args] : args.slice(1),
  { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function env() {
  const input = readFileSync(local(`${PRIVATE}/bridge.env`), 'utf8');
  const values = Object.fromEntries(input.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map(match => [match[1], match[2]]));
  const db = new URL(values.IDEM_OBSERVER_DSN), api = new URL(values.PERM_API_URL);
  if (values.PERM_TEST_PROFILE !== 'supabase-identity-v1' || db.hostname !== '127.0.0.1' || db.port !== '62422'
    || db.pathname !== '/postgres' || api.origin !== 'http://127.0.0.1:62421'
    || !/^pos-cafe-perm-[a-f0-9]{40}$/.test(values.IDEM_TEST_MARKER)) fail('PIN_ACK_G1_ENV_REFUSED');
  return values;
}

async function snapshot(db, values) {
  const marker = (await db.query('select marker,engine from private.idempotency_test_environment where singleton')).rows;
  if (marker.length !== 1 || marker[0].marker !== values.IDEM_TEST_MARKER || marker[0].engine !== 'supabase-identity-v1')
    fail('PIN_ACK_G1_MARKER_REFUSED');
  const names = JSON.parse(command(['docker', 'inspect', `supabase_db_${OLD}`, `supabase_kong_${OLD}`, `supabase_storage_${OLD}`]));
  if (names.some(container => container.Config.Labels?.['com.supabase.cli.project'] !== OLD || !container.State.Running)
    || !names[0].Mounts.some(mount => mount.Type === 'volume' && mount.Name === `supabase_db_${OLD}`))
    fail('PIN_ACK_G1_RUNTIME_REFUSED');
  const tables = (await db.query(`select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and n.nspname in ('public','private','auth','storage') order by n.nspname,c.relname`)).rows;
  const rows = [];
  for (const table of tables) {
    const q = value => '"' + value.replaceAll('"', '""') + '"';
    const result = await db.query(`select count(*)::int n,
      encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]'),'UTF8'),'sha256'),'hex') h
      from ${q(table.schema)}.${q(table.name)} t`);
    rows.push([table.schema, table.name, result.rows[0].n, result.rows[0].h]);
  }
  const catalogHash = (await collectInventory(db)).catalogHash;
  const sessions = (await db.query('select count(*)::int n from private.employee_sessions')).rows[0].n;
  const objects = (await db.query('select bucket_id,name from storage.objects order by bucket_id,name')).rows;
  if (objects.length !== 6) fail('PIN_ACK_G1_STORAGE_COUNT_REFUSED');
  const statusRaw = command([`/var/tmp/${OLD}/bin/supabase`, 'status', '--workdir', `/var/tmp/${OLD}/stack`, '-o', 'json']);
  const status = JSON.parse(statusRaw.slice(statusRaw.indexOf('{')));
  if (status.API_URL !== values.PERM_API_URL || !status.SERVICE_ROLE_KEY) fail('PIN_ACK_G1_STORAGE_ENDPOINT_REFUSED');
  const bytes = [];
  for (const object of objects) {
    const path = `${encodeURIComponent(object.bucket_id)}/${object.name.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(`${values.PERM_API_URL}/storage/v1/object/${path}`, {
      headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) fail('PIN_ACK_G1_STORAGE_READ_REFUSED');
    bytes.push(sha(Buffer.from(await response.arrayBuffer())));
  }
  return { rows, catalogHash, sessions, bytes };
}

async function main() {
  const phase = process.argv[2];
  if (!['before', 'after'].includes(phase) || process.argv.length !== 3) fail('PIN_ACK_G1_PHASE_REQUIRED');
  const values = env();
  const db = new pg.Client({ connectionString: values.IDEM_OBSERVER_DSN, connectionTimeoutMillis: 5000, statement_timeout: 120000 });
  await db.connect();
  try {
    await db.query('begin isolation level repeatable read read only');
    let current;
    try { current = await snapshot(db, values); } finally { await db.query('rollback'); }
    if (phase === 'before') {
      if (existsSync(local(BASELINE))) fail('PIN_ACK_G1_BASELINE_EXISTS');
      writeFileSync(local(BASELINE), JSON.stringify(current), { mode: 0o600 });
      console.log(JSON.stringify({ phase, status: 'PASS', tables: current.rows.length,
        storageObjects: current.bytes.length, sessions: current.sessions }));
    } else {
      const before = JSON.parse(readFileSync(local(BASELINE), 'utf8'));
      const proof = { phase, wholeRowsUnchanged: JSON.stringify(before.rows) === JSON.stringify(current.rows),
        catalogUnchanged: before.catalogHash === current.catalogHash,
        storageBytesUnchanged: JSON.stringify(before.bytes) === JSON.stringify(current.bytes),
        sessionsUnchanged: before.sessions === current.sessions,
        tables: current.rows.length, storageObjects: current.bytes.length, sessions: current.sessions };
      console.log(JSON.stringify(proof));
      if (!proof.wholeRowsUnchanged || !proof.catalogUnchanged || !proof.storageBytesUnchanged || !proof.sessionsUnchanged)
        fail('PIN_ACK_G1_PRESERVATION_FAILED');
    }
  } finally { await db.end(); }
}

try { await main(); } catch (error) {
  const code = error instanceof Error && /^PIN_ACK_[A-Z_]+$/.test(error.message) ? error.message : 'PIN_ACK_G1_CHECK_FAILED';
  console.error(code); process.exitCode = 1;
}
