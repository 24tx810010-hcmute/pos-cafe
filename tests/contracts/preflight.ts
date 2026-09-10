import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

export class PreflightError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(`BLOCKED_DB_TESTS: ${reason}`); this.reason = reason; }
}
export type TestEnvironment = {
  apiUrl: string; anonKey: string; observerDsn: string; storeJwt: string;
  marker: string; database: string; storeIds: string[]; engine: 'supabase' | 'postgres-postgrest' | 'postgres-postgrest-gotrue';
};

// Deliberately does not load .env or .env.local: those may point to the user's remote store.
export function loadTestEnvironmentFile(env: NodeJS.ProcessEnv = process.env) {
  if (!env.IDEM_ENV_FILE) return;
  if (!existsSync(env.IDEM_ENV_FILE)) throw new PreflightError('IDEM_ENV_FILE_NOT_FOUND');
  for (const raw of readFileSync(env.IDEM_ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || match[1].startsWith('#')) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (env[match[1]] === undefined) env[match[1]] = value;
  }
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new PreflightError(`MISSING_${key}`);
  return value;
}

function localUrl(value: string, key: string, protocols: string[]): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new PreflightError(`INVALID_${key}`); }
  if (!protocols.includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new PreflightError(`NONLOCAL_${key}_REFUSED`);
  }
  return url;
}

function jwtClaims(value: string, key: string): Record<string, unknown> {
  try {
    const pieces = value.split('.');
    if (pieces.length !== 3 || pieces.some((piece) => !piece)) throw new Error();
    const parsed: unknown = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new PreflightError(`INVALID_${key}`); }
}

export function parseTestEnvironment(env: NodeJS.ProcessEnv = process.env): TestEnvironment {
  if (env.VITE_DATA_MODE !== 'supabase') throw new PreflightError('VITE_DATA_MODE_MUST_BE_SUPABASE');
  const apiUrl = localUrl(required(env, 'VITE_SUPABASE_URL'), 'VITE_SUPABASE_URL', ['http:', 'https:']);
  const observerDsn = required(env, 'IDEM_OBSERVER_DSN');
  const dbUrl = localUrl(observerDsn, 'IDEM_OBSERVER_DSN', ['postgres:', 'postgresql:']);
  const database = decodeURIComponent(dbUrl.pathname.slice(1));
  if (!/^pos_cafe_idem_test_[a-z0-9_]+$/.test(database)) throw new PreflightError('DATABASE_NAME_IS_NOT_ISOLATED_TEST_DATABASE');
  const anonKey = required(env, 'VITE_SUPABASE_ANON_KEY');
  const storeJwt = required(env, 'IDEM_STORE_JWT');
  if (jwtClaims(anonKey, 'VITE_SUPABASE_ANON_KEY').role !== 'anon') throw new PreflightError('ANON_KEY_ROLE_REQUIRED');
  const claims = jwtClaims(storeJwt, 'IDEM_STORE_JWT');
  const storeIds = required(env, 'IDEM_FIXTURE_STORE_IDS').split(',').map((part) => part.trim());
  if (storeIds.length !== 2 || new Set(storeIds).size !== 2 || storeIds.some((id) => !/^00000000-0000-4000-8000-[0-9a-f]{12}$/.test(id))) {
    throw new PreflightError('INVALID_FIXTURE_STORE_IDS');
  }
  if (claims.role !== 'authenticated' || claims.sub !== storeIds[0]) throw new PreflightError('STORE_JWT_MUST_BE_AUTHENTICATED_FIXTURE_CALLER');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new PreflightError('STORE_JWT_EXPIRED');
  const marker = required(env, 'IDEM_TEST_MARKER');
  if (!/^pos-cafe-idem-[a-z0-9-]{16,}$/.test(marker)) throw new PreflightError('INVALID_TEST_MARKER');
  const engine = env.IDEM_TEST_ENGINE;
  if (engine !== 'supabase' && engine !== 'postgres-postgrest' && engine !== 'postgres-postgrest-gotrue') throw new PreflightError('INVALID_TEST_ENGINE');
  return { apiUrl: apiUrl.origin, anonKey, observerDsn, storeJwt, marker, database, storeIds, engine };
}

export function migrationChecksums(root = process.cwd()): Record<string, string> {
  const dir = resolve(root, 'supabase/migrations');
  return Object.fromEntries(readdirSync(dir).filter((name) => name.endsWith('.sql')).sort().map((name) =>
    [name, createHash('sha256').update(readFileSync(resolve(dir, name))).digest('hex')],
  ));
}

export async function withObserver<T>(env: TestEnvironment, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: env.observerDsn, connectionTimeoutMillis: 5000, statement_timeout: 30000, application_name: 'pos-cafe-idem-observer' });
  await client.connect();
  try { return await run(client); } finally { await client.end(); }
}

export async function preflight(options: { requireBrowserStack?: boolean } = {}): Promise<TestEnvironment> {
  loadTestEnvironmentFile();
  const env = parseTestEnvironment();
  try {
    await withObserver(env, async (db) => {
      const identity = await db.query('select current_database() as database, pg_backend_pid() as pid');
      if (identity.rows[0].database !== env.database) throw new PreflightError('OBSERVER_DATABASE_MISMATCH');
      const marker = await db.query('select marker, engine, migration_checksums, store_ids from private.idempotency_test_environment where singleton = true');
      if (marker.rowCount !== 1 || marker.rows[0].marker !== env.marker || marker.rows[0].engine !== env.engine) throw new PreflightError('DATABASE_MARKER_MISMATCH');
      if (JSON.stringify([...marker.rows[0].store_ids].sort()) !== JSON.stringify([...env.storeIds].sort())) throw new PreflightError('FIXTURE_MARKER_MISMATCH');
      const expected = migrationChecksums();
      const actual = marker.rows[0].migration_checksums as Record<string, string>;
      if (Object.keys(expected).length !== Object.keys(actual).length || Object.entries(expected).some(([file, hash]) => actual[file] !== hash)) throw new PreflightError('MIGRATION_CHECKSUM_MISMATCH');
      const otherStores = await db.query('select count(*)::int as count from public.stores where not(id = any($1::uuid[]))', [env.storeIds]);
      if (otherStores.rows[0].count !== 0) throw new PreflightError('DATABASE_CONTAINS_NONFIXTURE_STORES');
      const markerPrivilege = await db.query("select has_table_privilege('authenticated','private.idempotency_test_environment','SELECT') or has_function_privilege('authenticated','private.write_clock()','EXECUTE') as exposed");
      if (markerPrivilege.rows[0].exposed) throw new PreflightError('PRIVATE_TEST_SCHEMA_EXPOSED');
    });
    const sessionResponse = await fetch(`${env.apiUrl}/rest/v1/rpc/start_employee_session`, {
      method: 'POST', headers: { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_employee_id: '00000000-0000-4000-8000-00000000000b', p_pin: '123456' }), signal: AbortSignal.timeout(5000),
    });
    if (!sessionResponse.ok) throw new PreflightError('FIXTURE_EMPLOYEE_SESSION_FAILED');
    const session = await sessionResponse.json() as { token?: string };
    if (!session.token || !/^[A-Za-z0-9_-]{43}$/.test(session.token)) throw new PreflightError('FIXTURE_EMPLOYEE_TOKEN_INVALID');
    const tokenHash = createHash('sha256').update(session.token).digest();
    await withObserver(env, async (db) => {
      const binding = await db.query('select count(*)::int as count from private.employee_sessions where token_hash=$1 and store_id=$2 and employee_id=$3 and revoked_at is null and expires_at>private.write_clock()', [tokenHash, env.storeIds[0], '00000000-0000-4000-8000-00000000000b']);
      if (binding.rows[0].count !== 1) throw new PreflightError('API_AND_OBSERVER_DATABASE_MISMATCH');
    });
    const response = await fetch(`${env.apiUrl}/rest/v1/rpc/get_write_capabilities`, {
      method: 'POST', headers: { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, 'Content-Type': 'application/json', 'x-pos-employee-token': session.token },
      body: '{}', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new PreflightError('CAPABILITIES_HTTP_FAILURE');
    const capabilities = await response.json() as Record<string, unknown>;
    if (capabilities.writeProtocolVersion !== 1 || capabilities.maxPayloadBytes !== 262144 || capabilities.pendingTtlSeconds !== 86400) throw new PreflightError('WRITE_PROTOCOL_CAPABILITY_MISMATCH');
    const revoke = await fetch(`${env.apiUrl}/rest/v1/rpc/revoke_employee_session`, {
      method:'POST', headers:{apikey:env.anonKey,Authorization:`Bearer ${env.storeJwt}`,'Content-Type':'application/json','x-pos-employee-token':session.token},
      body:'{}',signal:AbortSignal.timeout(5000),
    });
    if (!revoke.ok || (await revoke.json() as {ok?:boolean}).ok !== true) throw new PreflightError('PREFLIGHT_SESSION_REVOKE_FAILED');
    await withObserver(env,async(db)=>{
      const binding=await db.query('select count(*)::int as count from private.employee_sessions where token_hash=$1 and store_id=$2 and revoked_at is not null',[tokenHash,env.storeIds[0]]);
      if(binding.rows[0].count!==1)throw new PreflightError('API_REVOKE_NOT_VISIBLE_IN_OBSERVER_DATABASE');
    });
    if (options.requireBrowserStack) {
      if (env.engine !== 'supabase' && env.engine !== 'postgres-postgrest-gotrue') throw new PreflightError('REAL_GOTRUE_AUTH_STACK_REQUIRED_FOR_E2E');
      const health = await fetch(`${env.apiUrl}/auth/v1/health`, { headers: { apikey: env.anonKey }, signal: AbortSignal.timeout(5000) });
      if (!health.ok) throw new PreflightError('SUPABASE_AUTH_NOT_HEALTHY');
    }
    return env;
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    // Driver and HTTP errors may contain a DSN, SQL values or headers. Never serialize them.
    throw new PreflightError('DATABASE_OR_API_UNAVAILABLE_OR_MIGRATIONS_MISSING');
  }
}
