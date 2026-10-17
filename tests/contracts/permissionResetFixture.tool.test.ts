import { beforeEach, expect, test, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const f = vi.hoisted(() => ({
  stores: ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'],
  project: 'pos-cafe-perm-s31-t04-20261013', marker: 'pos-cafe-perm-fixture', control: '',
  markerWrong: false, storeWrong: false, userWrong: false, ddlFail: false, observerRestricted: false,
  calls: [] as string[], bootstrap: vi.fn(), runtime: vi.fn(),
}));
vi.mock('../../scripts/permission-identity-runtime.mjs', () => ({
  STORE_IDS: f.stores, PROJECT: f.project,
  parseBridgeEnvironment: () => ({ dsn: 'postgresql://fixture@127.0.0.1:62422/postgres', marker: f.marker, controlPath: f.control }),
  runtimeProof: f.runtime, bootstrapBridgeRuntime: f.bootstrap,
}));
vi.mock('pg', () => ({ default: { Client: class {
  constructor() { f.calls.push('construct'); }
  async connect() { f.calls.push('connect'); }
  async end() { f.calls.push('end'); }
  async query(sql: string) {
    f.calls.push(sql);
    if (sql.startsWith('select rolsuper')) return { rows: [{ rolsuper: !f.observerRestricted, rolbypassrls: false }] };
    if (sql.startsWith('select current_database')) return { rows: [{ database: 'postgres', marker: f.markerWrong ? 'wrong' : f.marker, engine: 'supabase-identity-v1', store_ids: f.stores }] };
    if (sql === 'select id from public.stores order by id') return { rows: (f.storeWrong ? [...f.stores, 'extra'] : f.stores).map(id => ({ id })) };
    if (sql === 'select id from auth.users order by id') return { rows: (f.userWrong ? [...f.stores, 'extra'] : f.stores).map(id => ({ id })) };
    if (f.ddlFail && sql === 'drop schema private cascade') throw new Error('injected fixture DDL failure');
    return { rows: [] };
  }
} } }));
import { resetPermissionFixture } from '../../scripts/permission-reset-fixture.mjs';

let root: string, input: string, output: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'permission-reset-tool-')); input = join(root, 'bridge.env'); output = join(root, 'fresh');
  f.control = join(root, 'control.json');
  writeFileSync(f.control, JSON.stringify({ project: f.project, marker: f.marker, storeIds: f.stores }));
  f.calls.length = 0; f.markerWrong = f.storeWrong = f.userWrong = f.ddlFail = f.observerRestricted = false;
  f.runtime.mockReset().mockImplementation(() => {
    f.calls.push('runtime-proof');
    return { project: f.project, containers: [{ name: `supabase_db_${f.project}`, ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '62422' }] } }] };
  });
  f.bootstrap.mockReset().mockResolvedValue({ profile: 'supabase-identity-v1' });
});

test('reset refuses missing or occupied output paths before connection', async () => {
  await expect(resetPermissionFixture(undefined, output)).rejects.toThrow('EXPLICIT_RESET_PATHS_REQUIRED');
  await expect(resetPermissionFixture(input, undefined)).rejects.toThrow('EXPLICIT_RESET_PATHS_REQUIRED');
  await expect(resetPermissionFixture(input, root)).rejects.toThrow('NEW_FIXTURE_DIRECTORY_REQUIRED');
  expect(f.calls).toEqual([]);
});
test('reset refuses wrong deployment/control before connection', async () => {
  f.runtime.mockImplementationOnce(() => { throw new Error('ISOLATED_RUNTIME_CONFIG_MISMATCH'); });
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('ISOLATED_RUNTIME_CONFIG_MISMATCH');
  expect(f.calls).not.toContain('construct');
  writeFileSync(f.control, JSON.stringify({ project: 'other', marker: f.marker, storeIds: f.stores }));
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('FIXTURE_CONTROL_MISMATCH');
  expect(f.calls).not.toContain('construct');
});
test('reset refuses an observer whose RLS view might hide non-fixture rows', async () => {
  f.observerRestricted = true;
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('RESET_OBSERVER_INCOMPLETE');
  expect(f.calls).toContain('set local row_security=off');
  expect(f.calls).not.toContain('select id from public.stores order by id');
  expect(f.calls.some(sql => /^(drop|delete|create|grant)/.test(sql))).toBe(false);
  expect(f.calls).toContain('rollback'); expect(f.bootstrap).not.toHaveBeenCalled();
});
test('reset refuses a dedicated container whose real port no longer binds the DSN', async () => {
  f.runtime.mockReturnValueOnce({ project: f.project, containers: [{ name: `supabase_db_${f.project}`, ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '62423' }] } }] });
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('RESET_DATABASE_PORT_BINDING_MISMATCH');
  expect(f.calls).not.toContain('construct');
});
test.each(['markerWrong', 'storeWrong', 'userWrong'] as const)('reset refuses %s before any destructive statement', async field => {
  f[field] = true;
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('RESET_FIXTURE_SCOPE_MISMATCH');
  expect(f.calls.some(sql => /^(drop|delete|create|grant)/.test(sql))).toBe(false);
  expect(f.calls).toContain('rollback'); expect(f.calls.at(-1)).toBe('end'); expect(f.bootstrap).not.toHaveBeenCalled();
});
test('reset locks and rechecks proof before transactional DDL, then bootstraps', async () => {
  expect(await resetPermissionFixture(input, output)).toMatchObject({ status: 'RESET_AND_BOOTSTRAPPED', resetCommitted: true });
  expect(f.calls[0]).toBe('runtime-proof');
  expect(f.calls.filter(sql => sql === 'runtime-proof')).toHaveLength(2);
  expect(f.calls.lastIndexOf('runtime-proof')).toBeLessThan(f.calls.indexOf('drop schema public cascade'));
  expect(f.calls.indexOf('begin')).toBeLessThan(f.calls.indexOf('drop schema public cascade'));
  expect(f.calls).toContain('commit'); expect(f.calls).not.toContain('rollback');
  expect(f.bootstrap).toHaveBeenCalledWith(output);
});
test('DDL failure rolls back and never starts bootstrap', async () => {
  f.ddlFail = true;
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('ISOLATED_RESET_REFUSED_OR_ROLLED_BACK');
  expect(f.calls).toContain('rollback'); expect(f.calls).not.toContain('commit'); expect(f.bootstrap).not.toHaveBeenCalled();
});
test('bootstrap failure truthfully reports that isolated reset already committed', async () => {
  f.bootstrap.mockRejectedValue(new Error('sensitive transport details'));
  await expect(resetPermissionFixture(input, output)).rejects.toThrow('ISOLATED_RESET_COMMITTED_BOOTSTRAP_FAILED');
  expect(f.calls).toContain('commit'); expect(f.calls).not.toContain('rollback');
});
