import { describe, expect, test } from 'vitest';
import {
  BRIDGE_ORACLE_CONTRACT,
  BRIDGE_OVERRIDE_STATES,
  LEGACY_PERMISSION_CODES,
  LEGACY_ROLES,
  createBridgeOracle,
} from '../../scripts/permission-bridge-oracle.mjs';

// Literal baseline controls. No production/candidate permission implementation
// is used to produce these expectations or to certify SQL parity at T01.
const codes = ['order.create', 'order.update', 'order.voidOpen', 'payment.take', 'order.voidPaid'];
const roles = ['admin', 'cashier', 'kitchen'];
const states = ['none', 'grant', 'deny', 'grant-and-deny'];
const adminModules = [
  'floor', 'order', 'payment', 'orderHistory', 'menuEditor', 'floorEditor',
  'employees', 'report', 'settings', 'clearDemo', 'kitchen',
];
const cashierModules = ['floor', 'order', 'payment', 'orderHistory'];
const oracle = createBridgeOracle();

function profile(role: string, isActive: boolean, overrides: Record<string, string> = {}) {
  const found = oracle.profiles.find((entry) => entry.role === role && entry.isActive === isActive
    && codes.every((code) => entry.overrideStates[code] === (overrides[code] ?? 'none')));
  if (!found) throw new Error('MISSING_LITERAL_BRIDGE_PROFILE');
  return found;
}

describe('TC-PERM-50/tool expected oracle only', () => {
  test('enumerates exactly 6144 distinct configurations over the five legacy codes', () => {
    expect(LEGACY_PERMISSION_CODES).toEqual(codes);
    expect(LEGACY_ROLES).toEqual(roles);
    expect(BRIDGE_OVERRIDE_STATES).toEqual(states);
    expect(oracle.profiles).toHaveLength(6144);
    expect(new Set(oracle.profiles.map((entry) => entry.id)).size).toBe(6144);
    expect(new Set(oracle.profiles.map((entry) => JSON.stringify([
      entry.role, entry.isActive, codes.map((code) => entry.overrideStates[code]),
    ]))).size).toBe(6144);

    for (const role of roles) {
      for (const isActive of [true, false]) {
        const group = oracle.profiles.filter((entry) => entry.role === role && entry.isActive === isActive);
        expect(group).toHaveLength(1024);
        for (const code of codes) {
          for (const state of states) {
            expect(group.filter((entry) => entry.overrideStates[code] === state)).toHaveLength(256);
          }
        }
        for (const entry of group) {
          expect(Object.keys(entry.overrideStates)).toEqual(codes);
          expect(Object.values(entry.overrideStates).every((state) => states.includes(state))).toBe(true);
          expect(entry.permissionOverrides.grants).toEqual(codes.filter((code) => ['grant', 'grant-and-deny'].includes(entry.overrideStates[code])));
          expect(entry.permissionOverrides.denies).toEqual(codes.filter((code) => ['deny', 'grant-and-deny'].includes(entry.overrideStates[code])));
        }
      }
    }
  });

  test('keeps the literal legacy defaults and module maps without activating the new catalog', () => {
    expect(profile('admin', true).expected).toEqual({
      configuredEffective: codes, activeGuard: true, actionPermissions: codes,
      accessibleModules: adminModules, roleEnabledInUi: true,
    });
    expect(profile('cashier', true).expected).toEqual({
      configuredEffective: ['order.create', 'order.update', 'order.voidOpen', 'payment.take'],
      activeGuard: true,
      actionPermissions: ['order.create', 'order.update', 'order.voidOpen', 'payment.take'],
      accessibleModules: cashierModules, roleEnabledInUi: true,
    });
    expect(profile('kitchen', true).expected).toEqual({
      configuredEffective: [], activeGuard: true, actionPermissions: [],
      accessibleModules: ['kitchen'], roleEnabledInUi: false,
    });
  });

  test('deny beats both default and grant while a cashier can gain voidPaid', () => {
    const mixed = profile('cashier', true, {
      'order.create': 'deny', 'order.update': 'grant-and-deny',
      'payment.take': 'grant', 'order.voidPaid': 'grant',
    });
    expect(mixed.expected.configuredEffective).toEqual(['order.voidOpen', 'payment.take', 'order.voidPaid']);
    expect(mixed.expected.actionPermissions).toEqual(['order.voidOpen', 'payment.take', 'order.voidPaid']);
    expect(mixed.expected.accessibleModules).toEqual(cashierModules);
    for (const role of roles) {
      const both = profile(role, true, Object.fromEntries(codes.map((code) => [code, 'grant-and-deny'])));
      expect(both.permissionOverrides.grants).toEqual(codes);
      expect(both.permissionOverrides.denies).toEqual(codes);
      expect(both.expected.configuredEffective).toEqual([]);
      expect(both.expected.actionPermissions).toEqual([]);
    }
  });

  test('retains configured rights when inactive and keeps UI role availability independent', () => {
    for (const active of oracle.profiles.filter((entry) => entry.isActive)) {
      const inactive = oracle.profiles.find((entry) => entry.id === active.id.replace('/active/', '/inactive/'));
      expect(inactive?.expected).toEqual({
        configuredEffective: active.expected.configuredEffective,
        activeGuard: false,
        actionPermissions: [],
        accessibleModules: [],
        roleEnabledInUi: active.expected.roleEnabledInUi,
      });
    }
    const granted = Object.fromEntries(codes.map((code) => [code, 'grant']));
    expect(profile('kitchen', true, granted).expected).toEqual({
      configuredEffective: codes, activeGuard: true, actionPermissions: codes,
      accessibleModules: ['kitchen'], roleEnabledInUi: false,
    });
    expect(profile('kitchen', false, granted).expected.configuredEffective).toEqual(codes);
    expect(profile('admin', true, Object.fromEntries(codes.map((code) => [code, 'deny']))).expected.accessibleModules).toEqual(adminModules);
  });

  test('matches independently counted truth-table totals across every configuration', () => {
    for (const role of roles) {
      const group = oracle.profiles.filter((entry) => entry.role === role);
      // Two of four states allow a default-on code, one allows a default-off
      // code. The other four codes have 256 combinations and active has 2 states.
      const configuredCounts = role === 'admin' ? [1024, 1024, 1024, 1024, 1024]
        : role === 'cashier' ? [1024, 1024, 1024, 1024, 512] : [512, 512, 512, 512, 512];
      for (const [index, code] of codes.entries()) {
        expect(group.filter((entry) => entry.expected.configuredEffective.includes(code))).toHaveLength(configuredCounts[index]);
        expect(group.filter((entry) => entry.expected.actionPermissions.includes(code))).toHaveLength(configuredCounts[index] / 2);
        for (const entry of group.filter((row) => row.permissionOverrides.denies.includes(code))) {
          expect(entry.expected.configuredEffective).not.toContain(code);
          expect(entry.expected.actionPermissions).not.toContain(code);
        }
      }
    }
  });

  test('returns reproducible isolated JSON data and never labels expected generation as candidate PASS', () => {
    expect(oracle.summary).toEqual({
      schemaVersion: 1, requirement: 'TC-PERM-50', stage: 'expected-only', candidateComparison: 'NOT_RUN',
      profileCount: 6144, combinationsPerRoleAndActivity: 1024,
      countsByRole: { admin: 2048, cashier: 2048, kitchen: 2048 },
      countsByActivity: { active: 3072, inactive: 3072 },
    });
    expect(BRIDGE_ORACLE_CONTRACT.candidateComparison).toBe('NOT_RUN');
    const fresh = createBridgeOracle();
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(oracle);
    fresh.profiles[0].expected.configuredEffective.length = 0;
    fresh.profiles[0].expected.accessibleModules.length = 0;
    fresh.profiles[0].permissionOverrides.grants.push('candidate.permission');
    expect(createBridgeOracle()).toEqual(oracle);
  });
});
