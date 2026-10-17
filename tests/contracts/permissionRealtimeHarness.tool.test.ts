import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertActivatedCandidate, refreshStoreSession } from '../supabase/permissionCandidateEnvironment';
import { migrationChecksums } from './preflight';
import { PROJECT, STORE_IDS } from '../../scripts/permission-identity-runtime.mjs';

vi.mock('../../playwright.permission-candidate.config', () => ({ default: {
  testDir: './tests/supabase', globalSetup: './tests/supabase/permissionCandidateGlobalSetup.ts',
  use: { baseURL: 'http://127.0.0.1:5178', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
} }));

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.resetModules();
  directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true }));
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'permission-session-tool-')); directories.push(directory);
  const controlPath = join(directory, 'control.json'), fixtureFile = join(directory, 'bridge.env');
  writeFileSync(controlPath, JSON.stringify({ refreshToken: 'synthetic-refresh-0', marker: 'synthetic-marker' }));
  writeFileSync(fixtureFile, 'PERM_STORE_JWT=synthetic-access-0\nOTHER=preserved\n');
  return { controlPath, fixtureFile, api: 'http://127.0.0.1:62421', anonKey: 'synthetic-anon' } as Parameters<typeof refreshStoreSession>[0];
}
function token(index: number, lifetime = 3600) {
  return { access_token: `synthetic-access-${index}`, refresh_token: `synthetic-refresh-${index}`, expires_at: Math.floor(Date.now() / 1000) + lifetime };
}

describe('TC55 session rotation and private artifacts', () => {
  it('shares one refresh across concurrent clients and persists both rotated credentials', async () => {
    const env = fixture()!;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(token(1)), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([refreshStoreSession(env), refreshStoreSession(env)]);
    expect(first).toBe(second); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(env.controlPath, 'utf8'))).toEqual({ marker: 'synthetic-marker', refreshToken: 'synthetic-refresh-1' });
    expect(readFileSync(env.fixtureFile, 'utf8')).toBe('PERM_STORE_JWT=synthetic-access-1\nOTHER=preserved\n');
    expect(await refreshStoreSession(env)).toBe(first); expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the persisted rotated token after the cached session reaches its lifetime margin', async () => {
    vi.useFakeTimers(); const env = fixture()!;
    const usedTokens: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      usedTokens.push(JSON.parse(options.body).refresh_token);
      return new Response(JSON.stringify(token(usedTokens.length)), { status: 200 });
    }));
    await refreshStoreSession(env); vi.setSystemTime(Date.now() + 3_001_000);
    const [first, second] = await Promise.all([refreshStoreSession(env), refreshStoreSession(env)]);
    expect(first).toBe(second); expect(first.access_token).toBe('synthetic-access-2');
    expect(usedTokens).toEqual(['synthetic-refresh-0', 'synthetic-refresh-1']);
  });

  it('refuses insufficient expiry and exposes no Auth response or network error details', async () => {
    const env = fixture()!;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...token(1, 599), detail: 'SYNTHETIC_SECRET' }))));
    await expect(refreshStoreSession(env)).rejects.toThrow(/^FIXTURE_SESSION_REFRESH_FAILED$/);
    expect(JSON.parse(readFileSync(env.controlPath, 'utf8')).refreshToken).toBe('synthetic-refresh-0');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('SYNTHETIC_SECRET'); }));
    await expect(refreshStoreSession(env)).rejects.toThrow(/^FIXTURE_SESSION_REFRESH_FAILED$/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(token(2)))));
    expect((await refreshStoreSession(env)).access_token).toBe('synthetic-access-2');
  });

  it('requires an explicit absolute private output path for Realtime reports', async () => {
    for (const path of ['', 'artifacts/private/run', join(tmpdir(), 'public-artifacts')]) {
      vi.stubEnv('PERM_REALTIME_PRIVATE_ARTIFACT_DIR', path); vi.resetModules();
      await expect(import('../../playwright.permission-realtime.config')).rejects.toThrow('REALTIME_PRIVATE_ARTIFACT_DIRECTORY_REQUIRED');
    }
    vi.stubEnv('PERM_REALTIME_PRIVATE_ARTIFACT_DIR', join(tmpdir(), 'private', 'tc55'));
    vi.resetModules();
    const { default: config } = await import('../../playwright.permission-realtime.config');
    expect(config).toMatchObject({ retries: 0, repeatEach: 1, workers: 1, forbidOnly: true,
      use: { baseURL: 'http://127.0.0.1:5178', trace: 'off', screenshot: 'off', video: 'off' } });
    expect(config.outputDir).toBe(join(tmpdir(), 'private', 'tc55', 'test-results'));
    expect(config.globalSetup).toBeUndefined();
    expect(config.reporter).toEqual([
      ['json', { outputFile: join(tmpdir(), 'private', 'tc55', 'permission-realtime-e2e.json') }],
      ['./scripts/permission-playwright-options-reporter.mjs'],
    ]);
  });

  it('accepts only the bound activated candidate with strict contract2 and exact synthetic stores/Auth', async () => {
    const env = { ...fixture()!, marker: 'synthetic-marker' };
    writeFileSync(env.controlPath, JSON.stringify({ project: PROJECT, marker: env.marker, storeIds: STORE_IDS }));
    const valid = {
      fixture: [{ database: 'postgres', marker: env.marker, engine: 'supabase-identity-v1', store_ids: STORE_IDS,
        migration_checksums: migrationChecksums(process.cwd(), 16) }],
      phase: [{ catalog: 'permission_catalog', catalog_state: 'permission_catalog_state', catalog_signals: 'permission_catalog_signals', contract_gate: 'permission_contract_gate' }],
      gate: [{ strict: true, contract_version: 2 }], stores: STORE_IDS.map(id => ({ id })), users: STORE_IDS.map(id => ({ id })),
    };
    function dbFor(patch = {}) {
      const rows = { ...valid, ...patch };
      return { query: vi.fn(async (sql: string) => ({ rows: sql.includes('idempotency_test_environment') ? rows.fixture
        : sql.includes('to_regclass') ? rows.phase : sql.includes('select strict') ? rows.gate
        : sql.includes('auth.users') ? rows.users : rows.stores })) } as unknown as import('pg').Client;
    }
    await expect(assertActivatedCandidate(dbFor(), env)).resolves.toBeUndefined();
    for (const gate of [[], [{ strict: false, contract_version: 2 }], [{ strict: true, contract_version: 1 }]])
      await expect(assertActivatedCandidate(dbFor({ gate }), env)).rejects.toThrow('STRICT_CONTRACT_2_REQUIRED');
    await expect(assertActivatedCandidate(dbFor({ phase: [{ catalog: null }] }), env)).rejects.toThrow('ACTIVATED_CANDIDATE_REQUIRED');
    for (const key of ['stores', 'users'])
      await expect(assertActivatedCandidate(dbFor({ [key]: [{ id: STORE_IDS[0] }] }), env)).rejects.toThrow('EXACT_SYNTHETIC_STORES_AUTH_REQUIRED');
    await expect(assertActivatedCandidate(dbFor({ fixture: [{ ...valid.fixture[0], migration_checksums: {} }] }), env)).rejects.toThrow('FIXTURE_IDENTITY_MISMATCH');
    writeFileSync(env.controlPath, JSON.stringify({ project: 'other-project', marker: env.marker, storeIds: STORE_IDS }));
    const db = dbFor();
    await expect(assertActivatedCandidate(db, env)).rejects.toThrow('FIXTURE_CONTROL_MISMATCH');
    expect(db.query).not.toHaveBeenCalled();
  });
});
