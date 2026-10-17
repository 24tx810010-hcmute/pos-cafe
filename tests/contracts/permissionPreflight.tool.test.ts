import { afterEach, describe, test, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { parseObserverEnvironment } from '../../scripts/permission-preflight-core.mjs';
import { migrationChecksums, observerPreflight, PreflightError } from './observerPreflight.ts';
import { parseTestEnvironment, preflight } from './preflight.ts';

const directory = mkdtempSync(join(tmpdir(), 'permission-parser-'));
const envFile = join(directory, 'observer.env');
writeFileSync(envFile, '');
const config = () => ({ IDEM_ENV_FILE: envFile, PERM_TEST_PROFILE: 'legacy-observer-v1',
  IDEM_OBSERVER_DSN: 'postgresql://perm_observer@127.0.0.1:55449/pos_cafe_idem_test_perm_0123456789ab',
  IDEM_TEST_MARKER: 'pos-cafe-perm-' + 'a'.repeat(40), IDEM_TEST_ENGINE: 'postgres-observer',
  IDEM_FIXTURE_STORE_IDS: '10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002',
  PERM_EXPECTED_CATALOG_HASH: 'b'.repeat(64), PERM_BACKEND_REF: 'synthetic:fixture' });

describe('T01 observer configuration has no REST dependency', () => {
  test('accepts explicit observer-only config without API keys, JWT or URL', () => {
    const result = parseObserverEnvironment(config());
    expect(result.database).toBe('pos_cafe_idem_test_perm_0123456789ab');
    expect(Object.keys(result)).not.toContain('apiUrl');
    expect(Object.keys(result)).not.toContain('storeJwt');
  });
  test.each(([
    [{ IDEM_ENV_FILE: undefined }, 'EXPLICIT_ENV_FILE_REQUIRED'],
    [{ IDEM_ENV_FILE: join(directory, '.env.local') }, 'APPLICATION_ENV_REFUSED'],
    [{ PERM_TEST_PROFILE: 'candidate' }, 'LEGACY_OBSERVER_PROFILE_REQUIRED'],
    [{ IDEM_OBSERVER_DSN: 'postgres://secret:password@remote.invalid/postgres' }, 'NONLOCAL_OBSERVER_REFUSED'],
    [{ IDEM_OBSERVER_DSN: 'postgres://postgres@127.0.0.1/postgres' }, 'DATABASE_NAME_IS_NOT_ISOLATED'],
    [{ IDEM_TEST_MARKER: '' }, 'INVALID_TEST_MARKER'],
    [{ IDEM_FIXTURE_STORE_IDS: '10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000001' }, 'INVALID_FIXTURE_STORE_IDS'],
    [{ PERM_EXPECTED_CATALOG_HASH: '' }, 'CATALOG_PROOF_REQUIRED'],
    [{ PERM_BACKEND_REF: '' }, 'BACKEND_REFERENCE_REQUIRED'],
  ] as const).map(([patch, reason]) => ({ patch, reason })))('fails closed for $reason', ({ patch, reason }) => expect(() => parseObserverEnvironment({ ...config(), ...patch })).toThrow(reason));
});

describe('extracted phase-27 observer guards', () => {
  const env = parseObserverEnvironment(config());
  function client(change = '') {
    return { query: vi.fn(async (sql: string) => {
      if (sql.includes('current_database()')) return { rows: [{ database: change === 'database' ? 'other' : env.database }] };
      if (sql.includes('select marker, engine')) return { rowCount: change === 'missing' ? 0 : 1, rows: [{
        marker: change === 'marker' ? 'other' : env.marker, engine: env.engine,
        migration_checksums: change === 'checksums' ? {} : migrationChecksums(),
        store_ids: change === 'fixtures' ? [] : env.storeIds,
      }] };
      if (sql.includes('from public.stores')) return { rows: [{ count: change === 'extra-store' ? 1 : 0 }] };
      if (sql.includes('has_table_privilege')) return { rows: [{ exposed: change === 'exposed' }] };
      throw new Error('unexpected query');
    }) };
  }
  test('valid fixture checks are all reads and do not call fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('REST must not run'));
    try {
      const db = client();
      await observerPreflight(db as never, env);
      expect(db.query).toHaveBeenCalledTimes(4);
      expect(db.query.mock.calls.every(([sql]) => sql.startsWith('select '))).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  test.each([
    ['database', 'OBSERVER_DATABASE_MISMATCH'], ['missing', 'DATABASE_MARKER_MISMATCH'],
    ['marker', 'DATABASE_MARKER_MISMATCH'], ['checksums', 'MIGRATION_CHECKSUM_MISMATCH'],
    ['fixtures', 'FIXTURE_MARKER_MISMATCH'], ['extra-store', 'DATABASE_CONTAINS_NONFIXTURE_STORES'],
    ['exposed', 'PRIVATE_TEST_SCHEMA_EXPOSED'],
  ])('rejects %s before allowing caller reads', async (change, reason) => {
    await expect(observerPreflight(client(change) as never, env)).rejects.toThrow(new PreflightError(reason));
  });
});

const legacyStoreIds = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const fixtureEmployeeId = '00000000-0000-4000-8000-00000000000b';
const fixtureToken = 'S'.repeat(43);
const fixtureJwt = (claims: object) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.synthetic-signature`;
const legacyConfig = (): NodeJS.ProcessEnv => ({
  IDEM_ENV_FILE: undefined,
  VITE_DATA_MODE: 'supabase',
  VITE_SUPABASE_URL: 'http://127.0.0.1:55440',
  VITE_SUPABASE_ANON_KEY: fixtureJwt({ role: 'anon' }),
  IDEM_STORE_JWT: fixtureJwt({ role: 'authenticated', sub: legacyStoreIds[0], exp: Math.floor(Date.now() / 1000) + 3600 }),
  IDEM_OBSERVER_DSN: 'postgresql://observer@127.0.0.1:55439/pos_cafe_idem_test_preflight_regression',
  IDEM_TEST_MARKER: `pos-cafe-idem-${'a'.repeat(24)}`,
  IDEM_TEST_ENGINE: 'postgres-postgrest-gotrue',
  IDEM_FIXTURE_STORE_IDS: legacyStoreIds.join(','),
});

describe('phase-27 parser retains its original identity and service requirements', () => {
  test('accepts the original phase-27 fixture namespace and requires full REST credentials', () => {
    const parsed = parseTestEnvironment(legacyConfig());
    expect(parsed).toMatchObject({
      database: 'pos_cafe_idem_test_preflight_regression', engine: 'postgres-postgrest-gotrue',
      storeIds: legacyStoreIds, apiUrl: 'http://127.0.0.1:55440',
    });
    expect(parsed.anonKey).toBeTruthy();
    expect(parsed.storeJwt).toBeTruthy();
  });
  test.each(([
    [{ VITE_DATA_MODE: 'mock' }, 'VITE_DATA_MODE_MUST_BE_SUPABASE'],
    [{ VITE_SUPABASE_URL: undefined }, 'MISSING_VITE_SUPABASE_URL'],
    [{ VITE_SUPABASE_URL: 'https://remote.invalid' }, 'NONLOCAL_VITE_SUPABASE_URL_REFUSED'],
    [{ IDEM_OBSERVER_DSN: 'postgresql://observer@remote.invalid/pos_cafe_idem_test_remote' }, 'NONLOCAL_IDEM_OBSERVER_DSN_REFUSED'],
    [{ IDEM_OBSERVER_DSN: 'postgresql://observer@127.0.0.1/postgres' }, 'DATABASE_NAME_IS_NOT_ISOLATED_TEST_DATABASE'],
    [{ VITE_SUPABASE_ANON_KEY: undefined }, 'MISSING_VITE_SUPABASE_ANON_KEY'],
    [{ VITE_SUPABASE_ANON_KEY: fixtureJwt({ role: 'authenticated' }) }, 'ANON_KEY_ROLE_REQUIRED'],
    [{ IDEM_STORE_JWT: fixtureJwt({ role: 'authenticated', sub: legacyStoreIds[1], exp: 4102444800 }) }, 'STORE_JWT_MUST_BE_AUTHENTICATED_FIXTURE_CALLER'],
    [{ IDEM_STORE_JWT: fixtureJwt({ role: 'anon', sub: legacyStoreIds[0], exp: 4102444800 }) }, 'STORE_JWT_MUST_BE_AUTHENTICATED_FIXTURE_CALLER'],
    [{ IDEM_STORE_JWT: fixtureJwt({ role: 'authenticated', sub: legacyStoreIds[0], exp: 1 }) }, 'STORE_JWT_EXPIRED'],
    [{ IDEM_FIXTURE_STORE_IDS: config().IDEM_FIXTURE_STORE_IDS }, 'INVALID_FIXTURE_STORE_IDS'],
    [{ IDEM_TEST_MARKER: config().IDEM_TEST_MARKER }, 'INVALID_TEST_MARKER'],
    [{ IDEM_TEST_ENGINE: 'postgres-observer' }, 'INVALID_TEST_ENGINE'],
  ] as const).map(([patch, reason], index) => ({ patch, reason, caseId: index + 1 })))('rejects incompatible phase-27 configuration $caseId ($reason)', ({ patch, reason }) => {
    expect(() => parseTestEnvironment({ ...legacyConfig(), ...patch })).toThrow(new PreflightError(reason));
  });
});

describe('full phase-27 preflight after observer extraction (all I/O mocked)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  function fixture(change = '', patch: NodeJS.ProcessEnv = {}) {
    const raw = { ...legacyConfig(), ...patch };
    for (const [key, value] of Object.entries(raw)) vi.stubEnv(key, value);
    const env = parseTestEnvironment(raw);
    const trace: string[] = [];
    const clients: Array<{ connect: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }> = [];
    const query = vi.fn(async (sql: string, _values?: unknown[]) => {
      if (change === 'driver-error') throw new Error('synthetic-driver-secret-must-not-escape');
      if (sql.includes('current_database()')) {
        trace.push('observer:database');
        return { rows: [{ database: change === 'observer-database' ? 'other' : env.database }] };
      }
      if (sql.includes('select marker, engine')) {
        trace.push('observer:marker');
        return { rowCount: 1, rows: [{ marker: env.marker, engine: change === 'observer-engine' ? 'wrong' : env.engine,
          migration_checksums: migrationChecksums(), store_ids: env.storeIds }] };
      }
      if (sql.includes('from public.stores')) { trace.push('observer:scope'); return { rows: [{ count: 0 }] }; }
      if (sql.includes('has_table_privilege')) { trace.push('observer:private'); return { rows: [{ exposed: false }] }; }
      if (sql.includes('revoked_at is null')) {
        trace.push('db:token-binding');
        return { rows: [{ count: change === 'binding-missing' ? 0 : change === 'binding-duplicate' ? 2 : 1 }] };
      }
      if (sql.includes('revoked_at is not null')) {
        trace.push('db:revoked-binding');
        return { rows: [{ count: change === 'revoke-invisible' ? 0 : change === 'revoke-duplicate' ? 2 : 1 }] };
      }
      throw new Error('UNEXPECTED_MOCK_DATABASE_QUERY');
    });
    const constructor = vi.spyOn(pg, 'Client').mockImplementation(function () {
      const client = { connect: vi.fn(async () => undefined), end: vi.fn(async () => undefined), query };
      clients.push(client);
      return client;
    } as never);
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const route = String(url).split('/').at(-1);
      trace.push(`rpc:${route}`);
      const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
      if (route === 'start_employee_session') {
        if (change === 'start-http') return json({}, 503);
        return json({ token: change === 'token-missing' ? undefined : change === 'token-invalid' ? 'invalid-token' : fixtureToken });
      }
      if (route === 'get_write_capabilities') {
        if (change === 'capabilities-http') return json({}, 503);
        if (change === 'fetch-error') throw new Error('synthetic-fetch-secret-must-not-escape');
        return json({ writeProtocolVersion: change === 'protocol' ? 2 : 1,
          maxPayloadBytes: change === 'payload-size' ? 262145 : 262144,
          pendingTtlSeconds: change === 'ttl' ? 86401 : 86400 });
      }
      if (route === 'revoke_employee_session') {
        if (change === 'revoke-http') return json({}, 503);
        return json(change === 'revoke-empty' ? {} : { ok: change !== 'revoke-rejected' });
      }
      if (route === 'health') return json({}, change === 'auth-health' ? 503 : 200);
      throw new Error('UNEXPECTED_MOCK_HTTP_REQUEST');
    });
    return { env, trace, clients, query, constructor, fetch };
  }

  test('preserves start → DB token binding → capabilities → revoke → DB revoked proof in order', async () => {
    const f = fixture();
    await expect(preflight()).resolves.toEqual(f.env);
    expect(f.trace).toEqual([
      'observer:database', 'observer:marker', 'observer:scope', 'observer:private',
      'rpc:start_employee_session', 'db:token-binding', 'rpc:get_write_capabilities',
      'rpc:revoke_employee_session', 'db:revoked-binding',
    ]);
    expect(f.constructor).toHaveBeenCalledTimes(3);
    expect(f.constructor).toHaveBeenCalledWith(expect.objectContaining({ connectionString: f.env.observerDsn, application_name: 'pos-cafe-idem-observer' }));
    expect(f.clients.every((client) => client.connect.mock.calls.length === 1 && client.end.mock.calls.length === 1)).toBe(true);
    const expectedHash = createHash('sha256').update(fixtureToken).digest();
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('employee_id=$3 and revoked_at is null and expires_at>private.write_clock()'),
      [expectedHash, legacyStoreIds[0], fixtureEmployeeId],
    );
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('token_hash=$1 and store_id=$2 and revoked_at is not null'), [expectedHash, legacyStoreIds[0]],
    );
    expect(f.fetch).toHaveBeenNthCalledWith(1, `${f.env.apiUrl}/rest/v1/rpc/start_employee_session`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ p_employee_id: fixtureEmployeeId, p_pin: '123456' }),
      headers: { apikey: f.env.anonKey, Authorization: `Bearer ${f.env.storeJwt}`, 'Content-Type': 'application/json' },
    }));
    for (const index of [1, 2]) {
      expect(f.fetch.mock.calls[index][1]).toMatchObject({
        method: 'POST', body: '{}', headers: { apikey: f.env.anonKey, Authorization: `Bearer ${f.env.storeJwt}`, 'x-pos-employee-token': fixtureToken },
      });
    }
  });

  test.each([
    ['observer-database', 'OBSERVER_DATABASE_MISMATCH'], ['observer-engine', 'DATABASE_MARKER_MISMATCH'],
  ])('still invokes extracted observer guards before any HTTP: %s', async (change, reason) => {
    const f = fixture(change);
    await expect(preflight()).rejects.toThrow(new PreflightError(reason));
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.clients[0].end).toHaveBeenCalledOnce();
  });

  test.each([
    ['start-http', 'FIXTURE_EMPLOYEE_SESSION_FAILED'], ['token-missing', 'FIXTURE_EMPLOYEE_TOKEN_INVALID'],
    ['token-invalid', 'FIXTURE_EMPLOYEE_TOKEN_INVALID'], ['binding-missing', 'API_AND_OBSERVER_DATABASE_MISMATCH'],
    ['binding-duplicate', 'API_AND_OBSERVER_DATABASE_MISMATCH'], ['capabilities-http', 'CAPABILITIES_HTTP_FAILURE'],
    ['protocol', 'WRITE_PROTOCOL_CAPABILITY_MISMATCH'], ['payload-size', 'WRITE_PROTOCOL_CAPABILITY_MISMATCH'],
    ['ttl', 'WRITE_PROTOCOL_CAPABILITY_MISMATCH'], ['revoke-http', 'PREFLIGHT_SESSION_REVOKE_FAILED'],
    ['revoke-rejected', 'PREFLIGHT_SESSION_REVOKE_FAILED'], ['revoke-empty', 'PREFLIGHT_SESSION_REVOKE_FAILED'],
    ['revoke-invisible', 'API_REVOKE_NOT_VISIBLE_IN_OBSERVER_DATABASE'], ['revoke-duplicate', 'API_REVOKE_NOT_VISIBLE_IN_OBSERVER_DATABASE'],
  ])('rejects %s instead of certifying the full preflight', async (change, reason) => {
    const f = fixture(change);
    await expect(preflight()).rejects.toThrow(new PreflightError(reason));
    expect(f.clients.every((client) => client.end.mock.calls.length === 1)).toBe(true);
    if (change.startsWith('binding-')) expect(f.trace).not.toContain('rpc:get_write_capabilities');
    if (change.startsWith('revoke-') && !['revoke-invisible', 'revoke-duplicate'].includes(change)) expect(f.trace).not.toContain('db:revoked-binding');
  });

  test('requires GoTrue and an actual successful health response for the browser profile', async () => {
    const f = fixture();
    await expect(preflight({ requireBrowserStack: true })).resolves.toEqual(f.env);
    expect(f.trace.slice(-2)).toEqual(['db:revoked-binding', 'rpc:health']);
    expect(f.fetch).toHaveBeenLastCalledWith(`${f.env.apiUrl}/auth/v1/health`, expect.objectContaining({ headers: { apikey: f.env.anonKey } }));
  });
  test('does not let a PostgREST-only engine masquerade as the browser Auth stack', async () => {
    const f = fixture('', { IDEM_TEST_ENGINE: 'postgres-postgrest' });
    await expect(preflight({ requireBrowserStack: true })).rejects.toThrow(new PreflightError('REAL_GOTRUE_AUTH_STACK_REQUIRED_FOR_E2E'));
    expect(f.trace).not.toContain('rpc:health');
  });
  test('rejects unhealthy Auth after the same session revoke verification', async () => {
    const f = fixture('auth-health');
    await expect(preflight({ requireBrowserStack: true })).rejects.toThrow(new PreflightError('SUPABASE_AUTH_NOT_HEALTHY'));
    expect(f.trace.slice(-2)).toEqual(['db:revoked-binding', 'rpc:health']);
  });
  test.each(['driver-error', 'fetch-error'])('sanitizes %s without leaking driver/request details', async (change) => {
    fixture(change);
    const error = await preflight().catch((caught: unknown) => caught);
    expect(error).toEqual(new PreflightError('DATABASE_OR_API_UNAVAILABLE_OR_MIGRATIONS_MISSING'));
    expect(String(error)).not.toContain('synthetic-driver-secret');
    expect(String(error)).not.toContain('synthetic-fetch-secret');
  });
});
