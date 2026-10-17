import { createHash } from 'node:crypto';
import { createBridgeOracle, LEGACY_PERMISSION_CODES, LEGACY_ROLES } from './permission-bridge-oracle.mjs';

export const MIGRATION_BLOCKER_REASONS = Object.freeze([
  'INVALID_SNAPSHOT_HASH', 'INVALID_STORE_ID', 'DUPLICATE_STORE', 'INVALID_EMPLOYEE_ID',
  'DUPLICATE_EMPLOYEE', 'EMPLOYEE_STORE_NOT_FOUND', 'INVALID_NAME', 'INVALID_ROLE', 'INVALID_ACTIVE',
  'INVALID_OVERRIDES', 'UNKNOWN_OVERRIDE', 'OWNER_DENIES', 'UNVERIFIED_PRIMARY', 'INACTIVE_PRIMARY',
  'NO_ACTIVE_ADMIN', 'MISSING_CREATED_AT', 'INVALID_CREATED_AT', 'TIED_EARLIEST_ADMIN',
  'INVALID_MAPPING', 'MAPPING_STORE_NOT_FOUND', 'STALE_MAPPING', 'DUPLICATE_MAPPING',
  'CONFLICTING_MAPPING', 'MAPPING_OWNER_NOT_FOUND', 'MAPPING_OWNER_WRONG_STORE',
  'MAPPING_OWNER_INACTIVE', 'MAPPING_OWNER_NOT_ADMIN',
]);

export const MIGRATION_PLAN_CONTRACT = Object.freeze({
  schemaVersion: 1,
  stage: 'synthetic-preflight-only',
  snapshotHash: 'SHA-256 lowercase hex; supplied by the snapshot producer, never inferred from IDs.',
  references: 'Nonempty synthetic:* references only; validation does not verify a human identity.',
  rightsBasis: 'Configured UI/action capabilities mapped to the 15 planned codes, not employee-enforced legacy DB SELECT permissions.',
  operationalBasis: 'Legacy isActive guard; candidate also requires an enabled role. Session validity and actual RPC execution are not proved.',
  moduleBasis: 'Legacy module names remain separate; kitchen is not converted to a nonexistent kitchen.view permission.',
  receiptBasis: 'Legacy receipt.reprint capability maps from payment.take: ReceiptPreview.tsx:339 and 016_activate_write_protocol.sql:171.',
});

const codes = Object.freeze([
  'floor.view', 'order.create', 'order.update', 'order.voidOpen', 'payment.take', 'orderHistory.view',
  'order.voidPaid', 'menu.manage', 'floor.manage', 'employee.manage', 'employee.permission.edit',
  'report.view', 'settings.manage', 'data.clearDemo', 'receipt.reprint',
].sort());
const defaults = Object.freeze({
  owner: codes,
  manager: Object.freeze(codes.filter((code) => !['employee.permission.edit', 'settings.manage', 'data.clearDemo'].includes(code))),
  cashier: Object.freeze(['floor.view', 'order.create', 'order.update', 'order.voidOpen', 'payment.take', 'orderHistory.view', 'receipt.reprint'].sort()),
  kitchen: Object.freeze([]),
});
const moduleCodes = Object.freeze({
  floor: ['floor.view'], orderHistory: ['orderHistory.view'], menuEditor: ['menu.manage'],
  floorEditor: ['floor.manage'], employees: ['employee.manage', 'employee.permission.edit'],
  report: ['report.view'], settings: ['settings.manage'], clearDemo: ['data.clearDemo'],
});
const legacy = new Map(createBridgeOracle().profiles.map((profile) => [profile.id, profile]));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern = /^[0-9a-f]{64}$/;
const uuid = (value) => typeof value === 'string' && uuidPattern.test(value)
  && value !== '00000000-0000-0000-0000-000000000000' ? value.toLowerCase() : null;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sorted = (values) => [...new Set(values)].sort();
const reference = (value) => typeof value === 'string' && /^synthetic:[a-z0-9:/._-]{1,200}$/i.test(value);
const releaseReference = (value) => typeof value === 'string' && /^release:[a-z0-9:/._-]{1,200}$/i.test(value);
const validName = (value) => typeof value === 'string' && [...value.trim()].length >= 1 && [...value.trim()].length <= 120;
const blocker = (reason, targetId = null, evidenceRefs = []) => ({ reason, targetId: uuid(targetId), evidenceRefs: [...evidenceRefs] });

// Same discovery algorithm as deterministicId.ts with authRepo.ts's seed key.
// A matching UUID is deliberately never treated as bootstrap provenance.
export function discoverLegacyPrimaryId(storeId) {
  const id = uuid(storeId);
  if (!id) throw new Error('INVALID_STORE_ID');
  const bytes = createHash('sha256').update(`${id}:admin.primary`, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeOverrides(value) {
  if (value === null || value === undefined) return { overrides: null, reason: null };
  if (!record(value) || Object.keys(value).some((key) => !['grants', 'denies'].includes(key))
    || !Array.isArray(value.grants) || !Array.isArray(value.denies)
    || value.grants.length > 100 || value.denies.length > 100
    || [...value.grants, ...value.denies].some((code) => typeof code !== 'string')) {
    return { overrides: null, reason: 'INVALID_OVERRIDES' };
  }
  if ([...value.grants, ...value.denies].some((code) => !LEGACY_PERMISSION_CODES.includes(code))) {
    return { overrides: null, reason: 'UNKNOWN_OVERRIDE' };
  }
  const denies = sorted(value.denies);
  // Keep every valid legacy deny, even if it currently blocks only a grant.
  const grants = sorted(value.grants.filter((code) => !denies.includes(code)));
  return { overrides: grants.length || denies.length ? { grants, denies } : null, reason: null };
}

function timestamp(value) {
  if (value === null || value === undefined) return { reason: 'MISSING_CREATED_AT' };
  if (typeof value !== 'string') return { reason: 'INVALID_CREATED_AT' };
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return { reason: 'INVALID_CREATED_AT' };
  const calendar = new Date(`${match[1]}Z`);
  const instant = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== match[1]
    || !Number.isFinite(instant)) return { reason: 'INVALID_CREATED_AT' };
  return { micros: BigInt(instant) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0')) };
}

function beforeRights(employee, overrides, valid) {
  if (!valid) return { employeeId: employee.id, valid: false, codes: [], operationalCodes: [], legacyActionCodes: [], legacyModules: [] };
  const digits = LEGACY_PERMISSION_CODES.map((code) => overrides?.denies.includes(code) ? 2 : overrides?.grants.includes(code) ? 1 : 0).join('');
  const expected = legacy.get(`${employee.role}/active/${digits}`).expected;
  const mapped = sorted([
    ...expected.configuredEffective,
    ...expected.accessibleModules.flatMap((module) => moduleCodes[module] ?? []),
    ...(expected.configuredEffective.includes('payment.take') ? ['receipt.reprint'] : []),
  ]);
  return {
    employeeId: employee.id, valid: true, codes: mapped,
    operationalCodes: employee.isActive === true ? [...mapped] : [],
    legacyActionCodes: [...expected.configuredEffective],
    legacyModules: [...expected.accessibleModules],
    operationalLegacyModules: employee.isActive === true ? [...expected.accessibleModules] : [],
    roleEnabledInUi: expected.roleEnabledInUi,
  };
}

function afterRights(employee, role, overrides, valid) {
  if (!role || !valid) return { employeeId: employee.id, valid: false, codes: [], operationalCodes: [] };
  const configured = sorted([...defaults[role], ...(overrides?.grants ?? [])])
    .filter((code) => !overrides?.denies.includes(code));
  return {
    employeeId: employee.id, valid: role !== 'owner' || !overrides?.denies.length,
    codes: configured, operationalCodes: employee.isActive === true && role !== 'kitchen' ? [...configured] : [],
    roleEnabled: role !== 'kitchen',
  };
}

export function validMappingEvidence(mapping, evidenceProfile = 'synthetic') {
  if (!['synthetic', 'release'].includes(evidenceProfile)) return false;
  const validReference = evidenceProfile === 'release' ? releaseReference : reference;
  return record(mapping) && mapping.schemaVersion === 1 && uuid(mapping.storeId) && uuid(mapping.ownerId)
    && Object.keys(mapping).every((key) => ['schemaVersion', 'storeId', 'ownerId', 'verifiedByRef', 'evidenceRefs', 'sourceSnapshotHash'].includes(key))
    && validReference(mapping.verifiedByRef) && Array.isArray(mapping.evidenceRefs) && mapping.evidenceRefs.length > 0
    && mapping.evidenceRefs.every(validReference) && typeof mapping.sourceSnapshotHash === 'string' && hashPattern.test(mapping.sourceSnapshotHash);
}

/** Pure planning. Defaults to synthetic evidence; release callers must opt in.
 * This validates supplied records, never human proof or permission to activate.
 * Unknown/unowned records block every requested store rather than being ignored.
 * A blocked store may still show a proposal; nothing here mutates or activates it.
 */
export function planMigration({ stores, employees, mappings = [], snapshotHash, evidenceProfile = 'synthetic' }) {
  if (!['synthetic', 'release'].includes(evidenceProfile)) throw new Error('INVALID_EVIDENCE_PROFILE');
  if (!Array.isArray(stores) || !Array.isArray(employees) || !Array.isArray(mappings)) throw new Error('INVALID_MIGRATION_INPUT');
  const globalBlockers = [];
  if (typeof snapshotHash !== 'string' || !hashPattern.test(snapshotHash)) globalBlockers.push(blocker('INVALID_SNAPSHOT_HASH'));
  const storeIds = stores.map((store) => uuid(store?.id));
  const rows = employees.map((employee) => ({
    id: uuid(employee?.id), storeId: uuid(employee?.storeId), name: employee?.name,
    role: employee?.role, isActive: employee?.isActive, createdAt: employee?.createdAt,
    permissionOverrides: employee?.permissionOverrides,
  }));
  for (const row of rows) {
    if (!row.storeId || !storeIds.includes(row.storeId)) globalBlockers.push(blocker('EMPLOYEE_STORE_NOT_FOUND', row.id));
  }
  for (const mapping of mappings) {
    if (!uuid(mapping?.storeId)) globalBlockers.push(blocker('INVALID_MAPPING'));
    else if (!storeIds.includes(uuid(mapping.storeId))) globalBlockers.push(blocker('MAPPING_STORE_NOT_FOUND', mapping.storeId));
  }

  const reports = stores.map((store) => {
    const storeId = uuid(store?.id);
    const blockers = globalBlockers.map((entry) => ({ ...entry, evidenceRefs: [...entry.evidenceRefs] }));
    const evidenceRefs = storeId && hashPattern.test(snapshotHash ?? '') ? [`${evidenceProfile}:snapshot:${snapshotHash}:store:${storeId}`] : [];
    const add = (reason, targetId = storeId, refs = evidenceRefs) => blockers.push(blocker(reason, targetId, refs));
    if (!storeId) add('INVALID_STORE_ID', null);
    else if (storeIds.filter((id) => id === storeId).length > 1) add('DUPLICATE_STORE');
    const suppliedNames = [store?.name, store?.displayName].filter((value) => value !== undefined);
    if (!suppliedNames.length || suppliedNames.some((name) => !validName(name))) add('INVALID_NAME');
    const members = rows.filter((row) => row.storeId === storeId && storeId !== null).sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
    const normalized = new Map();
    for (const employee of members) {
      if (!employee.id) add('INVALID_EMPLOYEE_ID', null);
      else if (rows.filter((row) => row.id === employee.id).length > 1) add('DUPLICATE_EMPLOYEE', employee.id);
      if (!validName(employee.name)) add('INVALID_NAME', employee.id);
      if (!LEGACY_ROLES.includes(employee.role)) add('INVALID_ROLE', employee.id);
      if (typeof employee.isActive !== 'boolean') add('INVALID_ACTIVE', employee.id);
      const result = normalizeOverrides(employee.permissionOverrides);
      normalized.set(employee, result);
      if (result.reason) add(result.reason, employee.id);
    }

    const discoveredPrimaryId = storeId ? discoverLegacyPrimaryId(storeId) : null;
    let candidateOwnerId = null;
    let provenance = { source: 'unresolved', evidenceRefs: [...evidenceRefs] };
    let inputMappingHash = null;
    const suppliedMappings = mappings.filter((mapping) => storeId && uuid(mapping?.storeId) === storeId);
    if (suppliedMappings.length > 0) {
      if (suppliedMappings.length > 1) {
        add(new Set(suppliedMappings.map((mapping) => uuid(mapping?.ownerId))).size > 1 ? 'CONFLICTING_MAPPING' : 'DUPLICATE_MAPPING');
      }
      for (const mapping of suppliedMappings) {
        if (!validMappingEvidence(mapping, evidenceProfile)) { add('INVALID_MAPPING'); continue; }
        const refs = [...mapping.evidenceRefs];
        if (mapping.sourceSnapshotHash !== snapshotHash) { add('STALE_MAPPING', mapping.ownerId, refs); continue; }
        const owner = rows.find((employee) => employee.id === uuid(mapping.ownerId));
        if (!owner) { add('MAPPING_OWNER_NOT_FOUND', mapping.ownerId, refs); continue; }
        if (owner.storeId !== storeId) { add('MAPPING_OWNER_WRONG_STORE', owner.id, refs); continue; }
        if (owner.isActive !== true) { add('MAPPING_OWNER_INACTIVE', owner.id, refs); continue; }
        if (owner.role !== 'admin') { add('MAPPING_OWNER_NOT_ADMIN', owner.id, refs); continue; }
        if (suppliedMappings.length === 1) {
          candidateOwnerId = owner.id;
          provenance = { source: 'supplied-mapping', verifiedByRef: mapping.verifiedByRef, evidenceRefs: refs, sourceSnapshotHash: mapping.sourceSnapshotHash };
          inputMappingHash = createHash('sha256').update(JSON.stringify({
            schemaVersion: 1, storeId, ownerId: owner.id, verifiedByRef: mapping.verifiedByRef,
            evidenceRefs: refs, sourceSnapshotHash: mapping.sourceSnapshotHash,
          })).digest('hex');
        }
      }
    } else {
      const primary = members.find((employee) => employee.id === discoveredPrimaryId);
      if (primary && primary.isActive !== true) {
        provenance = { source: 'deterministic-primary-discovery', evidenceRefs: [...evidenceRefs] };
        add('INACTIVE_PRIMARY', primary.id);
      } else if (primary?.role === 'admin') {
        provenance = { source: 'deterministic-primary-discovery', evidenceRefs: [...evidenceRefs] };
        candidateOwnerId = primary.id;
        add('UNVERIFIED_PRIMARY', primary.id);
      } else {
        const candidates = members.filter((employee) => employee.role === 'admin' && employee.isActive === true);
        const times = candidates.map((employee) => ({ employee, ...timestamp(employee.createdAt) }));
        if (!candidates.length) add('NO_ACTIVE_ADMIN');
        for (const item of times) if (item.reason) add(item.reason, item.employee.id);
        if (times.length && times.every((item) => !item.reason)) {
          const minimum = times.reduce((earliest, item) => item.micros < earliest ? item.micros : earliest, times[0].micros);
          const earliest = times.filter((item) => item.micros === minimum);
          if (earliest.length !== 1) for (const item of earliest) add('TIED_EARLIEST_ADMIN', item.employee.id);
          else {
            candidateOwnerId = earliest[0].employee.id;
            provenance = { source: 'earliest-active-admin', evidenceRefs: [...evidenceRefs] };
          }
        }
      }
    }

    const employeeRoleMapping = [];
    const normalizedOverrides = [];
    const rightsBefore = [];
    const rightsAfter = [];
    const diff = [];
    for (const employee of members) {
      const normal = normalized.get(employee);
      const oldRole = LEGACY_ROLES.includes(employee.role) ? employee.role : null;
      const newRole = oldRole === 'admin' ? (candidateOwnerId ? (employee.id === candidateOwnerId ? 'owner' : 'manager') : null) : oldRole;
      const valid = !!employee.id && !!oldRole && typeof employee.isActive === 'boolean' && !normal.reason;
      if (newRole === 'owner' && normal.overrides?.denies.length) add('OWNER_DENIES', employee.id, provenance.evidenceRefs);
      const targetGrants = normal.overrides?.grants.filter((code) => !newRole || !defaults[newRole].includes(code)) ?? [];
      const targetDenies = [...(normal.overrides?.denies ?? [])];
      const targetOverrides = targetGrants.length || targetDenies.length ? { grants: targetGrants, denies: targetDenies } : null;
      employeeRoleMapping.push({ employeeId: employee.id, oldRole, newRole, isActive: typeof employee.isActive === 'boolean' ? employee.isActive : null });
      normalizedOverrides.push({ employeeId: employee.id, valid: !normal.reason, overrides: targetOverrides });
      const before = beforeRights(employee, normal.overrides, valid);
      const after = afterRights(employee, newRole, targetOverrides, valid);
      rightsBefore.push(before);
      rightsAfter.push(after);
      diff.push({
        employeeId: employee.id, valid: before.valid && after.valid,
        added: before.valid && after.valid ? after.codes.filter((code) => !before.codes.includes(code)) : [],
        removed: before.valid && after.valid ? before.codes.filter((code) => !after.codes.includes(code)) : [],
        operationalAdded: before.valid && after.valid ? after.operationalCodes.filter((code) => !before.operationalCodes.includes(code)) : [],
        operationalRemoved: before.valid && after.valid ? before.operationalCodes.filter((code) => !after.operationalCodes.includes(code)) : [],
      });
    }
    return {
      storeId, status: blockers.length ? 'NEEDS_REVIEW' : 'READY', discoveredPrimaryId, candidateOwnerId,
      provenance, inputMappingHash, employeeRoleMapping, normalizedOverrides, rightsBefore, rightsAfter, diff, blockers,
    };
  });
  return { status: reports.length && reports.every((report) => report.status === 'READY') ? 'READY' : 'BLOCKED', stores: reports };
}
