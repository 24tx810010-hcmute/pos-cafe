import pg from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Executed only inside the identified network-none rehearsal namespace.
// The PostgreSQL route is a Unix socket; no remote or application env route.
const directory = resolve(process.argv[2]);
const db = new pg.Client({ host: '/restore', user: 'postgres', database: 'postgres' });
const key = readFileSync(`${directory}/anon-jwt`, 'utf8');
const nonce = randomUUID();
let installed = false;
await db.connect();
try {
  const actor = (await db.query(`select current_user actor,session_user session,
    r.rolsuper superuser,r.rolbypassrls bypass_rls from pg_roles r where rolname=current_user`)).rows[0];
  if (actor.actor !== 'postgres' || actor.session !== 'postgres' || actor.superuser || !actor.bypass_rls) {
    throw new Error('ACTOR_BINDING_FAILED');
  }
  await db.query(`create function public.release_runtime_binding_probe() returns jsonb
    language sql security invoker as $$select jsonb_build_object('nonce','${nonce}',
      'database',current_database(),'role',current_user,'backendPid',pg_backend_pid())$$`);
  installed = true;
  await db.query('grant execute on function public.release_runtime_binding_probe() to anon');
  await db.query("notify pgrst,'reload schema'");
  let matched = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch('http://127.0.0.1:3000/rpc/release_runtime_binding_probe', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
    }).catch(() => null);
    if (response?.status === 200) {
      const value = await response.json();
      matched = value.nonce === nonce && value.database === 'postgres' && value.role === 'anon';
      if (matched) break;
    }
    await new Promise(done => setTimeout(done, 200));
  }
  if (!matched) throw new Error('REST_DB_BINDING_FAILED');
  const response = await fetch('http://127.0.0.1:3001/rest/v1/rpc/permission_contract_probe', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  const report = { status: 'REST_BOUND_TO_SAME_RESTORED_DATABASE', actor, nonceMatched: matched,
    baselineProbeStatus: response.status, baselineHookHeader: response.headers.get('x-pos-permission-hook'),
    observedAt: new Date().toISOString(), localOnly: true,
    helperSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };
  writeFileSync(`${directory}/transport-binding.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ status: report.status, nonceMatched: matched, actor: actor.actor }));
} finally {
  if (installed) {
    await db.query('drop function public.release_runtime_binding_probe()');
    await db.query("notify pgrst,'reload schema'");
  }
  await db.end();
}
