// Independent expected data for TC-PERM-50. Do not import application guards,
// SQL helpers or the candidate catalog: they are the future comparison targets.
export const LEGACY_PERMISSION_CODES = Object.freeze([
  'order.create',
  'order.update',
  'order.voidOpen',
  'payment.take',
  'order.voidPaid',
]);

export const LEGACY_ROLES = Object.freeze(['admin', 'cashier', 'kitchen']);
export const BRIDGE_OVERRIDE_STATES = Object.freeze(['none', 'grant', 'deny', 'grant-and-deny']);

export const BRIDGE_ORACLE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  requirement: 'TC-PERM-50',
  stage: 'expected-only',
  candidateComparison: 'NOT_RUN',
  sources: Object.freeze([
    'src/core/guards.ts:26',
    'src/core/guards.ts:60',
    'supabase/migrations/012_action_permission_guardrails.sql:7',
    'supabase/migrations/014_write_identity_and_ledger.sql:179',
  ]),
  scope: 'Five legacy actions, active guard and legacy module access; no session/DB or candidate execution.',
  noOverrideRepresentation: 'none has neither grant nor deny; null/empty overrides have this same expected result.',
});

// Column order is LEGACY_PERMISSION_CODES. These literals preserve the old
// defaults, including cashier voidOpen and the absence of kitchen defaults.
const defaultBits = Object.freeze({ admin: '11111', cashier: '11110', kitchen: '00000' });
const configuredTruth = Object.freeze({
  // Columns: none, grant, deny, grant-and-deny. Deny wins over both sources.
  '0': Object.freeze([false, true, false, false]),
  '1': Object.freeze([true, true, false, false]),
});
const legacyModules = Object.freeze({
  admin: Object.freeze([
    'floor', 'order', 'payment', 'orderHistory', 'menuEditor', 'floorEditor',
    'employees', 'report', 'settings', 'clearDemo', 'kitchen',
  ]),
  cashier: Object.freeze(['floor', 'order', 'payment', 'orderHistory']),
  kitchen: Object.freeze(['kitchen']),
});

/**
 * Build all 3 roles × 2 active states × 4^5 override configurations.
 * Output is deterministic JSON data, with fresh arrays/objects on every call.
 * activeGuard models isActive only; actionPermissions are not proof of a valid
 * session or an allowed RPC. UI role availability is a separate legacy check.
 */
export function createBridgeOracle() {
  const profiles = [];
  const combinationsPerRoleAndActivity = BRIDGE_OVERRIDE_STATES.length ** LEGACY_PERMISSION_CODES.length;

  for (const role of LEGACY_ROLES) {
    for (const isActive of [true, false]) {
      for (let combination = 0; combination < combinationsPerRoleAndActivity; combination += 1) {
        let remaining = combination;
        const digits = [];
        const overrideStates = {};
        const grants = [];
        const denies = [];
        const configuredEffective = [];

        for (const [index, permission] of LEGACY_PERMISSION_CODES.entries()) {
          const digit = remaining % BRIDGE_OVERRIDE_STATES.length;
          remaining = Math.floor(remaining / BRIDGE_OVERRIDE_STATES.length);
          digits.push(digit);
          overrideStates[permission] = BRIDGE_OVERRIDE_STATES[digit];
          if (digit === 1 || digit === 3) grants.push(permission);
          if (digit === 2 || digit === 3) denies.push(permission);
          if (configuredTruth[defaultBits[role][index]][digit]) configuredEffective.push(permission);
        }

        profiles.push({
          id: `${role}/${isActive ? 'active' : 'inactive'}/${digits.join('')}`,
          role,
          isActive,
          overrideStates,
          permissionOverrides: { grants, denies },
          expected: {
            configuredEffective,
            activeGuard: isActive,
            actionPermissions: isActive ? [...configuredEffective] : [],
            accessibleModules: isActive ? [...legacyModules[role]] : [],
            roleEnabledInUi: role !== 'kitchen',
          },
        });
      }
    }
  }

  return {
    profiles,
    summary: {
      schemaVersion: BRIDGE_ORACLE_CONTRACT.schemaVersion,
      requirement: BRIDGE_ORACLE_CONTRACT.requirement,
      stage: BRIDGE_ORACLE_CONTRACT.stage,
      candidateComparison: BRIDGE_ORACLE_CONTRACT.candidateComparison,
      profileCount: profiles.length,
      combinationsPerRoleAndActivity,
      countsByRole: Object.fromEntries(LEGACY_ROLES.map((role) => [role, profiles.filter((profile) => profile.role === role).length])),
      countsByActivity: {
        active: profiles.filter((profile) => profile.isActive).length,
        inactive: profiles.filter((profile) => !profile.isActive).length,
      },
    },
  };
}
