import type { PermissionCatalog, PermissionEmployee } from "@/domain/permissions";
import catalogData from "@/seed/permissionCatalog.json";
import { validatePermissionCatalog } from "@/core/permissionCatalog";
import { clone, createSeededMockState, type MockState } from "./mockState";

export const createMockPermissionCatalog = (): PermissionCatalog => {
  const catalog = clone(catalogData) as PermissionCatalog;
  validatePermissionCatalog(catalog);
  return catalog;
};

export type MockPermissionSession = {
  storeId: string;
  employeeId: string;
  expiresAt: number;
  revoked: boolean;
  /** Hand-written legacy fixtures omit these fields and are treated as normal sessions. */
  purpose?: "normal" | "required_pin_change";
  employeeRevision?: number;
};
export type MockPermissionSeedBinding = { seedKey: string; employeeId: string; pin: string };
export type MockPermissionState = {
  storeId: string; paired: boolean; catalog: PermissionCatalog; employees: PermissionEmployee[];
  session: MockPermissionSession | null; business: MockState; now: () => number;
  /** Initial credentials are test/runtime configuration, never projected through domain DTOs. */
  initialPins: Readonly<Record<string, string>>;
  /** Explicit permission identity owned by a demo seed key; never infer this from role or PIN. */
  seedEmployeeBindings: readonly MockPermissionSeedBinding[];
};

/** The database flag is deliberately private to the adapter, like a non-projected column. */
const pinChangeFlags = new WeakMap<MockPermissionState, Set<string>>();

function flags(state: MockPermissionState): Set<string> {
  let value = pinChangeFlags.get(state);
  if (!value) {
    value = new Set();
    pinChangeFlags.set(state, value);
  }
  return value;
}

export const mockPermissionPinChangeRequired = (state: MockPermissionState, employeeId: string): boolean =>
  flags(state).has(employeeId);

export const mockPermissionSetPinChangeRequired = (
  state: MockPermissionState,
  employeeId: string,
  required: boolean,
): void => {
  if (required) flags(state).add(employeeId);
  else flags(state).delete(employeeId);
};

export const mockPermissionResetPinChangeFlags = (
  state: MockPermissionState,
  requiredEmployeeIds: readonly string[] = [],
): void => {
  pinChangeFlags.set(state, new Set(requiredEmployeeIds));
};

/** Explicit synthetic identity, separate from legacy mock employee/PIN sessions. */
export const createMockPermissionState = (options: { demoCredentials?: boolean } = {}): MockPermissionState => {
  const storeId = "30000000-0000-4000-8000-000000000001";
  const catalog = createMockPermissionCatalog();
  const employees: PermissionEmployee[] = catalog.roles.map((role, i) => ({
    id: `30000000-0000-4000-8000-${String(i + 11).padStart(12, "0")}`, storeId,
    name: role.labelVi, role: role.code, isActive: true, permissionRevision: 0, overrides: null,
  }));
  employees.push({ id: "30000000-0000-4000-8000-000000000021", storeId, name: "Nhân viên chỉ xem",
    role: "waiter", isActive: true, permissionRevision: 0,
    overrides: { grants: ["orderHistory.view", "report.view"], denies: ["order.create", "order.update"] } });
  const business = createSeededMockState();
  business.settings.storeId = storeId;
  const initialPins = Object.fromEntries(employees.map(employee => [employee.id, "384729"]));
  if (options.demoCredentials) {
    const owner = employees.find(employee => employee.role === "owner");
    const cashier = employees.find(employee => employee.role === "cashier");
    if (owner) initialPins[owner.id] = "123456";
    if (cashier) initialPins[cashier.id] = "111111";
  }
  const cashier = employees.find(employee => employee.role === "cashier");
  const seedEmployeeBindings = cashier
    ? [{ seedKey: "demo.employee.demo-emp-cashier", employeeId: cashier.id, pin: "111111" }]
    : [];
  const state = { storeId, paired: true, catalog, employees, session: null, business, now: Date.now, initialPins, seedEmployeeBindings };
  // Established fixtures stay normal even when their documented demo PIN is 123456.
  mockPermissionResetPinChangeFlags(state);
  return state;
};

export const mockPermissionSeedEmployees = (state: MockPermissionState): Array<{
  seedKey: string;
  pin: string;
  employee: PermissionEmployee;
}> => state.seedEmployeeBindings.flatMap(binding => {
  const employee = state.employees.find(candidate => candidate.id === binding.employeeId && candidate.storeId === state.storeId);
  return employee ? [{ seedKey: binding.seedKey, pin: binding.pin, employee }] : [];
});
