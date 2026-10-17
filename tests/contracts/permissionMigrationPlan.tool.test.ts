import { describe, expect, test } from 'vitest';
import { discoverLegacyPrimaryId, MIGRATION_BLOCKER_REASONS, MIGRATION_PLAN_CONTRACT, planMigration } from '../../scripts/permission-migration-plan.mjs';

const S1 = '10000000-0000-4000-8000-000000000001';
const S2 = '10000000-0000-4000-8000-000000000002';
const E1 = '20000000-0000-4000-8000-000000000001';
const E2 = '20000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000003';
const K = '20000000-0000-4000-8000-000000000004';
const OTHER = '20000000-0000-4000-8000-000000000101';
const PRIMARY = '010226d1-5d17-59c0-8232-62bf3a0f6f29';
const HASH = 'a'.repeat(64);
const NEW_HASH = 'b'.repeat(64);
const T1 = '2026-01-01T01:00:00.000000Z';
const T2 = '2026-01-02T01:00:00.000000Z';

const employee = (id = E1, patch: Record<string, unknown> = {}) => ({
  id, storeId: S1, name: 'Lan', role: 'admin', isActive: true, createdAt: T1, permissionOverrides: null, ...patch,
});
const mapping = (ownerId = E1, patch: Record<string, unknown> = {}) => ({
  schemaVersion: 1, storeId: S1, ownerId, verifiedByRef: 'synthetic:operator-review',
  evidenceRefs: ['synthetic:bootstrap-record'], sourceSnapshotHash: HASH, ...patch,
});
const input = (members = [employee()]) => ({
  stores: [{ id: S1, name: 'Cà phê An' }], employees: members, mappings: [], snapshotHash: HASH,
});
const reasons = (report: ReturnType<typeof planMigration>, index = 0) => report.stores[index].blockers.map((entry) => entry.reason);
const planWithMapping = (members: ReturnType<typeof employee>[], supplied = mapping()) => planMigration({ ...input(members), mappings: [supplied] });

describe('TC-PERM-48/tool preflight owner discovery and rights proposals only', () => {
  test('discovers the legacy UUID literally but requires evidence for an active primary', () => {
    expect(discoverLegacyPrimaryId(S1)).toBe(PRIMARY);
    expect(discoverLegacyPrimaryId(S2)).toBe('fb22b4d2-7ca5-5ce5-a9a5-38fef7831027');
    const members = [employee(PRIMARY, { createdAt: T2 }), employee()];
    const unverified = planMigration(input(members));
    expect(unverified.status).toBe('BLOCKED');
    expect(unverified.stores[0]).toMatchObject({ candidateOwnerId: PRIMARY, provenance: { source: 'deterministic-primary-discovery' } });
    expect(reasons(unverified)).toEqual(['UNVERIFIED_PRIMARY']);

    const supplied = planWithMapping(members, mapping(PRIMARY));
    expect(supplied.status).toBe('READY');
    expect(supplied.stores[0]).toMatchObject({
      candidateOwnerId: PRIMARY,
      provenance: { source: 'supplied-mapping', verifiedByRef: 'synthetic:operator-review', sourceSnapshotHash: HASH },
      employeeRoleMapping: [
        { employeeId: PRIMARY, oldRole: 'admin', newRole: 'owner', isActive: true },
        { employeeId: E1, oldRole: 'admin', newRole: 'manager', isActive: true },
      ],
    });
    expect(supplied.stores[0].inputMappingHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('selects a unique earliest active admin when primary is absent or has changed role', () => {
    const members = [employee(E2, { createdAt: T2 }), employee(), employee(C, { isActive: false, createdAt: '2025-01-01T00:00:00Z' })];
    for (const extras of [[], [employee(PRIMARY, { role: 'cashier' })]]) {
      const report = planMigration(input([...members, ...extras]));
      expect(report.status).toBe('READY');
      expect(report.stores[0].candidateOwnerId).toBe(E1);
      expect(report.stores[0].provenance.source).toBe('earliest-active-admin');
      expect(report.stores[0].employeeRoleMapping.find((row) => row.employeeId === C)).toMatchObject({ newRole: 'manager', isActive: false });
    }
  });

  test('compares 15-code capabilities while reporting legacy modules and inactive configured rights separately', () => {
    const members = [
      employee(), employee(E2, { createdAt: T2 }),
      employee(C, { role: 'cashier', isActive: false }), employee(K, { role: 'kitchen' }),
    ];
    const store = planMigration(input(members)).stores[0];
    expect(store.status).toBe('READY');
    const ownerBefore = store.rightsBefore.find((row) => row.employeeId === E1);
    expect(ownerBefore.codes).toHaveLength(15);
    expect(ownerBefore.legacyActionCodes).toEqual(['order.create', 'order.update', 'order.voidOpen', 'payment.take', 'order.voidPaid']);
    expect(ownerBefore.legacyModules).toContain('kitchen');
    expect(store.diff.find((row) => row.employeeId === E1)).toMatchObject({ valid: true, added: [], removed: [] });
    expect(store.diff.find((row) => row.employeeId === E2)).toMatchObject({
      added: [], removed: ['data.clearDemo', 'employee.permission.edit', 'settings.manage'],
    });
    expect(store.rightsAfter.find((row) => row.employeeId === E2).codes).toHaveLength(12);
    for (const key of ['rightsBefore', 'rightsAfter']) {
      expect(store[key].find((row) => row.employeeId === C)).toMatchObject({
        codes: ['floor.view', 'order.create', 'order.update', 'order.voidOpen', 'orderHistory.view', 'payment.take', 'receipt.reprint'],
        operationalCodes: [],
      });
    }
    expect(store.rightsBefore.find((row) => row.employeeId === K)).toMatchObject({ codes: [], legacyModules: ['kitchen'], roleEnabledInUi: false });
    expect(JSON.stringify(store)).not.toContain('kitchen.view');
    expect(MIGRATION_PLAN_CONTRACT.rightsBasis).toContain('not employee-enforced legacy DB SELECT');
  });

  test('keeps deny over overlapping grants and shows new reprint capability without erasing legacy deny', () => {
    const members = [employee(), employee(C, {
      role: 'cashier', permissionOverrides: {
        grants: ['payment.take', 'payment.take', 'order.voidPaid'], denies: ['payment.take', 'payment.take', 'order.voidPaid'],
      },
    })];
    const store = planMigration(input(members)).stores[0];
    expect(store.status).toBe('READY');
    expect(store.normalizedOverrides.find((row) => row.employeeId === C)).toEqual({
      employeeId: C, valid: true, overrides: { grants: [], denies: ['order.voidPaid', 'payment.take'] },
    });
    expect(store.rightsBefore.find((row) => row.employeeId === C).codes).not.toContain('payment.take');
    expect(store.rightsBefore.find((row) => row.employeeId === C).codes).not.toContain('receipt.reprint');
    expect(store.rightsAfter.find((row) => row.employeeId === C).codes).toContain('receipt.reprint');
    expect(store.rightsAfter.find((row) => row.employeeId === C).codes).not.toContain('order.voidPaid');
    expect(store.diff.find((row) => row.employeeId === C)).toMatchObject({ added: ['receipt.reprint'], removed: [] });
  });

  test('does not erase configured legacy kitchen grants but gates candidate operational rights', () => {
    const store = planMigration(input([employee(), employee(K, {
      role: 'kitchen', permissionOverrides: { grants: ['payment.take'], denies: [] },
    })])).stores[0];
    expect(store.rightsBefore.find((row) => row.employeeId === K)).toMatchObject({
      legacyActionCodes: ['payment.take'], codes: ['payment.take', 'receipt.reprint'],
      operationalCodes: ['payment.take', 'receipt.reprint'], legacyModules: ['kitchen'],
    });
    expect(store.rightsAfter.find((row) => row.employeeId === K)).toMatchObject({ codes: ['payment.take'], operationalCodes: [], roleEnabled: false });
  });

  test('normalizes redundant target grants and the array 100/101 boundary without changing legacy rights', () => {
    const members = [employee(), employee(C, { role: 'cashier', permissionOverrides: { grants: Array(100).fill('order.create'), denies: [] } })];
    const accepted = planMigration(input(members));
    expect(accepted.status).toBe('READY');
    expect(accepted.stores[0].normalizedOverrides.find((row) => row.employeeId === C)).toEqual({ employeeId: C, valid: true, overrides: null });
    expect(accepted.stores[0].diff.find((row) => row.employeeId === C)).toMatchObject({ added: [], removed: [] });
    const rejected = planMigration(input([employee(), employee(C, { role: 'cashier', permissionOverrides: { grants: Array(101).fill('order.create'), denies: [] } })]));
    expect(reasons(rejected)).toContain('INVALID_OVERRIDES');
  });
});

describe('TC-PERM-49/tool blocked fixtures and supplied mapping recovery', () => {
  test.each([
    ['inactive primary', [employee(PRIMARY, { isActive: false }), employee()], 'INACTIVE_PRIMARY'],
    ['inactive changed-role primary', [employee(PRIMARY, { isActive: false, role: 'cashier' }), employee()], 'INACTIVE_PRIMARY'],
    ['missing timestamp', [employee(), employee(E2, { createdAt: null })], 'MISSING_CREATED_AT'],
    ['invalid timestamp', [employee(), employee(E2, { createdAt: '2026-02-31T00:00:00Z' })], 'INVALID_CREATED_AT'],
    ['tied timestamps', [employee(), employee(E2)], 'TIED_EARLIEST_ADMIN'],
  ])('%s blocks discovery and can be resolved by a valid supplied mapping', (_label, members, reason) => {
    const report = planMigration(input(members));
    expect(report.status).toBe('BLOCKED');
    expect(reasons(report)).toContain(reason);
    const resolved = planWithMapping(members);
    expect(resolved.status).toBe('READY');
    expect(resolved.stores[0].candidateOwnerId).toBe(E1);
  });

  test('compares instants at microsecond precision and detects equal timestamps with different offsets', () => {
    const precise = planMigration(input([
      employee(E2, { createdAt: '2026-01-01T01:00:00.000002Z' }),
      employee(E1, { createdAt: '2026-01-01T01:00:00.000001Z' }),
    ]));
    expect(precise.status).toBe('READY');
    expect(precise.stores[0].candidateOwnerId).toBe(E1);
    const sameInstant = planMigration(input([employee(), employee(E2, { createdAt: '2026-01-01T08:00:00+07:00' })]));
    expect(reasons(sameInstant)).toEqual(['TIED_EARLIEST_ADMIN', 'TIED_EARLIEST_ADMIN']);
  });

  test('no active admin stays blocked and a supplied mapping cannot reactivate an employee', () => {
    const members = [employee(E1, { isActive: false }), employee(C, { role: 'cashier' })];
    expect(reasons(planMigration(input(members)))).toContain('NO_ACTIVE_ADMIN');
    expect(reasons(planWithMapping(members))).toContain('MAPPING_OWNER_INACTIVE');
    expect(reasons(planWithMapping(members, mapping(C)))).toContain('MAPPING_OWNER_NOT_ADMIN');
    expect(members[0].isActive).toBe(false);
  });

  test.each([
    { schemaVersion: 2 }, { verifiedByRef: 'operator:real' }, { verifiedByRef: 'synthetic:' },
    { evidenceRefs: [] }, { evidenceRefs: ['synthetic:'] }, { evidenceRefs: ['https://example.invalid/proof'] },
    { sourceSnapshotHash: 'invalid' }, { ownerId: 'invalid' }, { pin: 'synthetic-secret-must-not-echo' },
  ])('rejects malformed mapping instead of falling back: %j', (patch) => {
    const report = planWithMapping([employee()], mapping(E1, patch));
    expect(report.status).toBe('BLOCKED');
    expect(reasons(report)).toContain('INVALID_MAPPING');
    expect(report.stores[0].candidateOwnerId).toBeNull();
    expect(JSON.stringify(report)).not.toContain('synthetic-secret-must-not-echo');
  });

  test('rejects stale, duplicate and conflicting mapping records without silently picking one', () => {
    const members = [employee(), employee(E2, { createdAt: T2 })];
    expect(reasons(planWithMapping(members, mapping(E1, { sourceSnapshotHash: NEW_HASH })))).toContain('STALE_MAPPING');
    for (const [supplied, expected] of [
      [[mapping(), mapping()], 'DUPLICATE_MAPPING'],
      [[mapping(), mapping(E2)], 'CONFLICTING_MAPPING'],
    ]) {
      const report = planMigration({ ...input(members), mappings: supplied });
      expect(report.status).toBe('BLOCKED');
      expect(reasons(report)).toContain(expected);
      expect(report.stores[0].candidateOwnerId).toBeNull();
    }
    expect(reasons(planMigration({ ...input(members), snapshotHash: '' }))).toContain('INVALID_SNAPSHOT_HASH');
  });

  test('requires a same-store existing active admin and does not ignore mappings for unknown stores', () => {
    const members = [employee(), employee(OTHER, { storeId: S2 })];
    const twoStores = { ...input(members), stores: [{ id: S1, name: 'A' }, { id: S2, displayName: 'B' }] };
    const wrongStore = planMigration({ ...twoStores, mappings: [mapping(OTHER)] });
    expect(reasons(wrongStore)).toContain('MAPPING_OWNER_WRONG_STORE');
    expect(reasons(planWithMapping([employee()], mapping(E2)))).toContain('MAPPING_OWNER_NOT_FOUND');
    expect(reasons(planMigration({ ...input(), mappings: [mapping(E1, { storeId: S2 })] }))).toContain('MAPPING_STORE_NOT_FOUND');
    expect(reasons(planMigration({ ...input(), mappings: [null] }))).toContain('INVALID_MAPPING');
  });

  test('owner denies, unknown roles and bad overrides remain blockers even with a verified mapping', () => {
    const deniedOwner = planWithMapping([employee(E1, { permissionOverrides: { grants: ['order.create'], denies: ['order.create'] } })]);
    expect(reasons(deniedOwner)).toContain('OWNER_DENIES');
    expect(deniedOwner.stores[0].rightsAfter[0].valid).toBe(false);
    expect(reasons(planWithMapping([employee(), employee(E2, { role: 'owner' })]))).toContain('INVALID_ROLE');
    for (const bad of [[], {}, { grants: 'order.create', denies: [] }, { grants: [], denies: [7] }, { grants: [], denies: [], pin: 'hidden' }]) {
      expect(reasons(planWithMapping([employee(), employee(C, { role: 'cashier', permissionOverrides: bad })]))).toContain('INVALID_OVERRIDES');
    }
    const unknown = planWithMapping([employee(), employee(C, { permissionOverrides: { grants: ['report.view'], denies: [] } })]);
    expect(reasons(unknown)).toContain('UNKNOWN_OVERRIDE');
    expect(unknown.stores[0].normalizedOverrides.find((row) => row.employeeId === C).valid).toBe(false);
  });

  test.each([['employee', 'empty', ''], ['employee', 'whitespace', '   '], ['employee', '121-codepoints', '😀'.repeat(121)], ['store', 'empty', ''], ['store', '121-codepoints', '😀'.repeat(121)]])(
    'blocks invalid %s name (%s) without cutting or repairing it', (target, _boundary, name) => {
      const data = input([employee(E1, { name: target === 'employee' ? name : 'Lan' })]);
      if (target === 'store') data.stores[0].name = name;
      const saved = JSON.stringify(data);
      const report = planMigration({ ...data, mappings: [mapping()] });
      expect(report.status).toBe('BLOCKED');
      expect(reasons(report)).toContain('INVALID_NAME');
      expect(JSON.stringify(data)).toBe(saved);
    },
  );

  test('accepts 120 Unicode code points for both names, including 240 UTF-16 code units', () => {
    const data = { ...input([employee(E1, { name: ` ${'😀'.repeat(120)} ` })]), stores: [{ id: S1, displayName: '😀'.repeat(120) }] };
    expect(planMigration(data).status).toBe('READY');
    expect(planMigration({ ...data, stores: [{ id: S1, displayName: '😀'.repeat(121) }] }).status).toBe('BLOCKED');
    expect(planMigration({ ...data, stores: [{ id: S1, name: '', displayName: 'Valid' }] }).status).toBe('BLOCKED');
  });

  test('one blocked store blocks the full plan while retaining the other store READY proposal', () => {
    const report = planMigration({
      ...input([employee(), employee(OTHER, { storeId: S2, isActive: false })]),
      stores: [{ id: S1, name: 'A' }, { id: S2, name: 'B' }],
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.stores.map((store) => store.status)).toEqual(['READY', 'NEEDS_REVIEW']);
    expect(reasons(report, 1)).toContain('NO_ACTIVE_ADMIN');
    for (const store of report.stores) {
      for (const entry of store.blockers) {
        expect(MIGRATION_BLOCKER_REASONS).toContain(entry.reason);
        expect(Object.keys(entry)).toEqual(['reason', 'targetId', 'evidenceRefs']);
      }
    }
  });

  test('blocks invalid or duplicate identities, unknown employee scope and non-boolean activity', () => {
    expect(reasons(planMigration(input([employee(E1, { id: 'invalid-id' })])))).toContain('INVALID_EMPLOYEE_ID');
    expect(reasons(planMigration(input([employee(), employee()])))).toContain('DUPLICATE_EMPLOYEE');
    expect(reasons(planMigration({ ...input(), stores: [{ id: S1, name: 'A' }, { id: S1, name: 'A' }] }))).toContain('DUPLICATE_STORE');
    expect(reasons(planMigration({ ...input([]), stores: [{ id: 'invalid-store', name: 'A' }] }))).toContain('INVALID_STORE_ID');
    expect(reasons(planMigration(input([employee(), employee(E2, { storeId: S2 })])))).toContain('EMPLOYEE_STORE_NOT_FOUND');
    expect(reasons(planMigration(input([employee(E1, { isActive: 'true' })])))).toContain('INVALID_ACTIVE');
  });

  test('does not mutate inputs or serialize undeclared employee/mapping secrets', () => {
    const secret = 'synthetic-sensitive-field-not-in-report';
    const data = input([employee(E1, { passcode_hash: secret, token: secret, pin: secret, requestMac: secret })]);
    const saved = JSON.stringify(data);
    const freeze = (value: unknown) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
    freeze(data);
    const first = planMigration(data);
    expect(planMigration(data)).toEqual(first);
    expect(JSON.stringify(data)).toBe(saved);
    expect(JSON.stringify(first)).not.toContain(secret);
    expect(planMigration({ stores: [], employees: [], snapshotHash: HASH })).toEqual({ status: 'BLOCKED', stores: [] });
  });
});
