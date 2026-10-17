import { describe, expect, test, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EMPTY_TARGET_RELATIONS,
  assertActivationEligibility,
  inspectAllTenantRows,
  inspectExpectedEmptyTarget,
} from '../../scripts/permission-activation-bundle.mjs';
import { activationBeginStatement, validateActivationConfig } from '../../scripts/permission-activate.mjs';
import { buildReleaseReview, parseReleaseTargetConfig } from '../../scripts/permission-release-preflight.mjs';

const hash = (character: string) => character.repeat(64);
const catalogRows = EMPTY_TARGET_RELATIONS.map((relation) => {
  const [schema_name, relation_name] = relation.split('.');
  return { schema_name, relation_name };
});

function activationConfig(patch: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    mode: 'synthetic-activation',
    connectionString: 'postgresql://tester@127.0.0.1/postgres',
    database: 'postgres',
    marker: 'isolated-empty-fixture',
    storeIds: [],
    sourceFingerprint: hash('a'),
    bundleHash: hash('b'),
    mappingFiles: [],
    expectedEmptyStoreSet: true,
    ...patch,
  };
}

function releaseConfig(patch: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    mode: 'release-read-only-preflight',
    connectionString: 'postgresql://reader@db.projectx.supabase.co/postgres',
    projectRef: 'projectx',
    backendHost: 'db.projectx.supabase.co',
    database: 'postgres',
    storeIds: [],
    catalogHash: hash('c'),
    sourceFingerprint: hash('a'),
    bundleHash: hash('b'),
    mappingFiles: [],
    expectedEmptyStoreSet: true,
    ...patch,
  };
}

function emptyTargetDb(options: { stores?: string[]; employees?: Array<{ id: string; store_id: string }>; nonempty?: string } = {}) {
  const calls: string[] = [];
  const query = vi.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('from pg_class c join pg_namespace')) return { rows: catalogRows };
    if (sql.startsWith('lock table ')) return { rows: [] };
    if (sql.startsWith('select id::text id from public.stores')) return { rows: (options.stores ?? []).map((id) => ({ id })) };
    if (sql.startsWith('select id::text id,store_id::text')) return { rows: options.employees ?? [] };
    if (sql.includes('row_count from')) return {
      rows: EMPTY_TARGET_RELATIONS.map((relation) => ({
        relation,
        row_count: relation === options.nonempty ? '1' : '0',
      })),
    };
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { db: { query }, calls };
}

describe('explicit empty permission activation tooling', () => {
  test('accepts only an explicit empty synthetic target and retains loopback/marker guards', () => {
    expect(validateActivationConfig(activationConfig())).toMatchObject({
      expectedEmptyStoreSet: true,
      storeIds: [],
      mappingFiles: [],
      marker: 'isolated-empty-fixture',
    });
    expect(activationBeginStatement(activationConfig())).toBe('begin isolation level read committed');
    expect(activationBeginStatement({ expectedEmptyStoreSet: false })).toBe('begin isolation level serializable');
    expect(() => validateActivationConfig(activationConfig({ expectedEmptyStoreSet: undefined }))).toThrow('INVALID_ACTIVATION_CONFIG');
    expect(() => validateActivationConfig(activationConfig({ expectedEmptyStoreSet: false }))).toThrow('INVALID_ACTIVATION_CONFIG');
    expect(() => validateActivationConfig(activationConfig({ mappingFiles: ['fake-owner.json'] }))).toThrow('INVALID_ACTIVATION_CONFIG');
    expect(() => validateActivationConfig(activationConfig({ storeIds: ['10000000-0000-4000-8000-000000000001'] }))).toThrow('INVALID_ACTIVATION_CONFIG');
    expect(() => validateActivationConfig(activationConfig({ mode: 'empty-target' }))).toThrow('INVALID_ACTIVATION_CONFIG');
    expect(() => validateActivationConfig(activationConfig({ connectionString: 'postgresql://tester@db.example/postgres' }))).toThrow('NONLOCAL_ACTIVATION_REFUSED');
    expect(() => validateActivationConfig(activationConfig({ marker: '' }))).toThrow('INVALID_ACTIVATION_CONFIG');
  });

  test('accepts only an explicit empty release target without mapping files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-empty-release-'));
    const path = join(dir, 'target.json');
    writeFileSync(path, JSON.stringify(releaseConfig()));
    expect(parseReleaseTargetConfig(path)).toMatchObject({ expectedEmptyStoreSet: true, storeIds: [], mappingFiles: [] });
    for (const patch of [
      { expectedEmptyStoreSet: undefined },
      { expectedEmptyStoreSet: false },
      { mappingFiles: ['fake-owner.json'] },
      { storeIds: ['10000000-0000-4000-8000-000000000001'] },
      { mode: 'empty-target' },
    ]) {
      writeFileSync(path, JSON.stringify(releaseConfig(patch)));
      expect(() => parseReleaseTargetConfig(path)).toThrow('INVALID_TARGET_CONFIG');
    }
  });

  test('locks the reviewed tenant inventory before exact IDs, counts, and later snapshot work', async () => {
    const { db, calls } = emptyTargetDb();
    const evidence = await inspectExpectedEmptyTarget(db, { lockTables: true });
    expect(evidence).toMatchObject({ schemaMatches: true, empty: true, storeIds: [], employeeIds: [] });
    expect(evidence.actualRelations).toEqual(EMPTY_TARGET_RELATIONS);
    expect(evidence.rowCounts).toHaveLength(EMPTY_TARGET_RELATIONS.length);
    const lockIndex = calls.findIndex((sql) => sql.startsWith('lock table '));
    const storeReadIndex = calls.findIndex((sql) => sql.startsWith('select id::text id from public.stores'));
    const employeeReadIndex = calls.findIndex((sql) => sql.startsWith('select id::text id,store_id::text'));
    expect(lockIndex).toBeGreaterThan(-1);
    expect(storeReadIndex).toBeGreaterThan(lockIndex);
    expect(employeeReadIndex).toBeGreaterThan(lockIndex);
    expect(calls[lockIndex]).toContain('in share mode');
    for (const relation of EMPTY_TARGET_RELATIONS) expect(calls[lockIndex]).toContain(relation.split('.').map((part) => `"${part}"`).join('.'));
  });

  test('reports exact ID, orphan row, and tenant relation drift instead of trusting a total count', async () => {
    const store = await inspectExpectedEmptyTarget(emptyTargetDb({ stores: ['10000000-0000-4000-8000-000000000001'] }).db, { lockTables: true });
    expect(store).toMatchObject({ schemaMatches: true, empty: false, storeIds: ['10000000-0000-4000-8000-000000000001'] });

    const employee = await inspectExpectedEmptyTarget(emptyTargetDb({
      employees: [{ id: '20000000-0000-4000-8000-000000000001', store_id: '10000000-0000-4000-8000-000000000001' }],
    }).db, { lockTables: true });
    expect(employee).toMatchObject({ schemaMatches: true, empty: false });
    expect(employee.employeeIds).toHaveLength(1);

    const orphan = await inspectExpectedEmptyTarget(emptyTargetDb({ nonempty: 'public.order_items' }).db, { lockTables: true });
    expect(orphan).toMatchObject({ schemaMatches: true, empty: false });
    expect(orphan.rowCounts).toContainEqual({ relation: 'public.order_items', rowCount: '1' });

    const query = vi.fn(async () => ({ rows: [...catalogRows, { schema_name: 'public', relation_name: 'new_tenant_table' }] }));
    const drift = await inspectExpectedEmptyTarget({ query }, { lockTables: true });
    expect(drift).toMatchObject({ schemaMatches: false, empty: false });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('postflight discovers bundle-created tenant registries instead of limiting checks to the legacy list', async () => {
    const postRelations = [...EMPTY_TARGET_RELATIONS, 'public.employee_admin_audit', 'public.store_change_signals'].sort();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from pg_class c join pg_namespace')) return {
        rows: postRelations.map((relation) => {
          const [schema_name, relation_name] = relation.split('.');
          return { schema_name, relation_name };
        }),
      };
      if (sql.startsWith('select id::text id from public.stores')) return { rows: [] };
      if (sql.startsWith('select id::text id,store_id::text')) return { rows: [] };
      if (sql.includes('row_count from')) return {
        rows: postRelations.map((relation) => ({ relation, row_count: relation === 'public.store_change_signals' ? '1' : '0' })),
      };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const postflight = await inspectAllTenantRows({ query });
    expect(postflight.actualRelations).toEqual(postRelations);
    expect(postflight.empty).toBe(false);
    expect(postflight.rowCounts).toContainEqual({ relation: 'public.store_change_signals', rowCount: '1' });
  });

  test('marks an empty release review ready only with complete zero-row evidence', () => {
    const target = releaseConfig();
    const evidence = {
      schemaMatches: true,
      empty: true,
      actualRelations: [...EMPTY_TARGET_RELATIONS],
      storeIds: [],
      employeeIds: [],
      rowCounts: EMPTY_TARGET_RELATIONS.map((relation) => ({ relation, rowCount: '0' })),
    };
    expect(buildReleaseReview(target, [], [], hash('d'), [], evidence)).toMatchObject({
      status: 'READY',
      expectedEmptyStoreSet: true,
      stores: [],
      employees: [],
      inputMappingHashes: [],
      humanIdentityVerifiedByTool: false,
      emptyTarget: { schemaMatches: true, empty: true },
    });
    expect(buildReleaseReview(target, [], [], hash('d'), [])).toMatchObject({ status: 'NEEDS_REVIEW' });
    expect(buildReleaseReview(target, [], [], hash('d'), [{ storeId: 'fake' }], evidence)).toMatchObject({ status: 'NEEDS_REVIEW' });
  });

  test('uses a separate explicit eligibility branch and never requires a fake owner mapping', () => {
    const preflight = { status: 'READY', expectedEmptyStoreSet: true, stores: [], emptyTarget: { schemaMatches: true, empty: true } };
    expect(assertActivationEligibility({
      preflight,
      mappings: [],
      sourceFingerprint: hash('a'),
      expectedSourceFingerprint: hash('a'),
      expectedEmptyStoreSet: true,
    })).toBe(true);
    expect(() => assertActivationEligibility({
      preflight,
      mappings: [{ storeId: 'fake' }],
      sourceFingerprint: hash('a'),
      expectedSourceFingerprint: hash('a'),
      expectedEmptyStoreSet: true,
    })).toThrow('MAPPING_SET_INCOMPLETE');
    expect(() => assertActivationEligibility({
      preflight: { status: 'READY', stores: [] },
      mappings: [],
      sourceFingerprint: hash('a'),
      expectedSourceFingerprint: hash('a'),
      expectedEmptyStoreSet: true,
    })).toThrow('OWNER_MIGRATION_REVIEW_REQUIRED');
    expect(() => assertActivationEligibility({
      preflight: { status: 'READY', stores: [] },
      mappings: [],
      sourceFingerprint: hash('a'),
      expectedSourceFingerprint: hash('a'),
    })).toThrow('OWNER_MIGRATION_REVIEW_REQUIRED');
  });
});
