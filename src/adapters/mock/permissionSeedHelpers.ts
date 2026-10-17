import type { PermissionEmployee } from "@/domain/permissions";
import { demoCashier, demoCashierPin, demoFloorPlan, demoMenuCatalog } from "@/seed/demoSeedData";
import { AppError } from "@/core/appError";
import { clone } from "./mockState";
import { mockPermissionSetPin } from "./permissionIdentityRepo";
import type { MockPermissionState } from "./permissionState";

const collision = (): never => {
  throw new AppError("ENTITY_ID_CONFLICT", "Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán.");
};

function ensureNoIds<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): void {
  const ids = new Set(existing.map(row => row.id));
  if (incoming.some(row => ids.has(row.id))) collision();
}

/** Insert-only stage helpers. The workflow receipt, never an upsert, makes a committed stage idempotent. */
export function insertMockInitialSeedEmployee(state: MockPermissionState): void {
  const binding = state.seedEmployeeBindings[0];
  if (!binding || state.employees.some(employee => employee.id === binding.employeeId)
    || state.business.employees.some(employee => employee.id === demoCashier.id)) collision();
  const employee: PermissionEmployee = {
    id: binding.employeeId,
    storeId: state.storeId,
    name: demoCashier.name,
    role: "cashier",
    isActive: true,
    permissionRevision: 0,
    overrides: null,
  };
  state.employees.push(employee);
  state.business.employees.push(clone(demoCashier));
  state.business.pins[demoCashier.id] = demoCashierPin;
  mockPermissionSetPin(state, employee.id, binding.pin);
}

export function insertMockInitialSeedMenu(state: MockPermissionState): void {
  ensureNoIds(state.business.menu.categories, demoMenuCatalog.categories);
  ensureNoIds(state.business.menu.menuItems, demoMenuCatalog.menuItems);
  ensureNoIds(state.business.menu.optionGroups, demoMenuCatalog.optionGroups);
  ensureNoIds(state.business.menu.optionValues, demoMenuCatalog.optionValues);
  ensureNoIds(state.business.menu.menuItemOptionGroups, demoMenuCatalog.menuItemOptionGroups);
  state.business.menu.categories.push(...clone(demoMenuCatalog.categories));
  state.business.menu.menuItems.push(...clone(demoMenuCatalog.menuItems));
  state.business.menu.optionGroups.push(...clone(demoMenuCatalog.optionGroups));
  state.business.menu.optionValues.push(...clone(demoMenuCatalog.optionValues));
  state.business.menu.menuItemOptionGroups.push(...clone(demoMenuCatalog.menuItemOptionGroups));
}

export function insertMockInitialSeedFloor(state: MockPermissionState): void {
  ensureNoIds(state.business.floorPlan.areas, demoFloorPlan.areas);
  ensureNoIds(state.business.floorPlan.tables, demoFloorPlan.tables);
  ensureNoIds(state.business.floorPlan.decorItems, demoFloorPlan.decorItems);
  state.business.floorPlan.areas.push(...clone(demoFloorPlan.areas));
  state.business.floorPlan.tables.push(...clone(demoFloorPlan.tables));
  state.business.floorPlan.decorItems.push(...clone(demoFloorPlan.decorItems));
}
