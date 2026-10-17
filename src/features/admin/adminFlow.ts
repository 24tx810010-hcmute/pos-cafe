import { AppError } from "@/core/appError";
import type {
  Employee,
  EmployeeInput,
  EmployeeUpdate,
  FloorPlanChanges,
  MenuChanges,
  StoreSettings,
  StoreSettingsUpdate,
} from "@/domain";
import { emptyChangeset } from "@/domain";
import type { AppPorts, LegacyAppPorts } from "@/ports";
import { assertCompatibilityCurrent, requireCurrentPermission } from "@/features/shared/permissionSession";

export type AdminActor = (Pick<Employee, "id"> & Partial<Pick<Employee, "role">>) | null;

export type SaveMenuForAdminInput = {
  actor: AdminActor;
  changes: MenuChanges;
};

export type SaveFloorPlanForAdminInput = {
  actor: AdminActor;
  changes: FloorPlanChanges;
};

export type CreateEmployeeForAdminInput = {
  actor: AdminActor;
  employee: EmployeeInput;
};

export type UpdateEmployeeForAdminInput = {
  actor: AdminActor;
  employee: EmployeeUpdate;
};

export type ResetPinForAdminInput = {
  actor: AdminActor;
  employeeId: string;
  newPin: string;
};

export type UpdateSettingsForAdminInput = {
  actor: AdminActor;
  settings: StoreSettingsUpdate;
};

export type ClearDemoDataForAdminInput = {
  actor: AdminActor;
  requestId: string;
  confirmation: true;
};

export type SeedDemoDataForAdminInput = {
  actor: AdminActor;
};

export const requireAdminActor = (actor: AdminActor): Pick<Employee, "id" | "role"> => {
  if (!actor || actor.role !== "admin") {
    throw new AppError("FORBIDDEN", "Chỉ quản lý mới được thực hiện thao tác này.");
  }

  return { id: actor.id, role: actor.role };
};

export const createEmptyMenuChanges = (): MenuChanges => ({
  categories: emptyChangeset(),
  menuItems: emptyChangeset(),
  optionGroups: emptyChangeset(),
  optionValues: emptyChangeset(),
  menuItemOptionGroups: emptyChangeset(),
});

export const createEmptyFloorPlanChanges = (): FloorPlanChanges => ({
  areas: emptyChangeset(),
  tables: emptyChangeset(),
  decorItems: emptyChangeset(),
});

export const hasMenuChanges = (changes: MenuChanges): boolean =>
  (changes.imageChanges?.length ?? 0) > 0 ||
  changes.categories.created.length > 0 ||
  changes.categories.updated.length > 0 ||
  changes.categories.deleted.length > 0 ||
  changes.menuItems.created.length > 0 ||
  changes.menuItems.updated.length > 0 ||
  changes.menuItems.deleted.length > 0 ||
  changes.optionGroups.created.length > 0 ||
  changes.optionGroups.updated.length > 0 ||
  changes.optionGroups.deleted.length > 0 ||
  changes.optionValues.created.length > 0 ||
  changes.optionValues.updated.length > 0 ||
  changes.optionValues.deleted.length > 0 ||
  changes.menuItemOptionGroups.created.length > 0 ||
  changes.menuItemOptionGroups.updated.length > 0 ||
  changes.menuItemOptionGroups.deleted.length > 0;

export const hasFloorPlanChanges = (changes: FloorPlanChanges): boolean =>
  changes.areas.created.length > 0 ||
  changes.areas.updated.length > 0 ||
  changes.areas.deleted.length > 0 ||
  changes.tables.created.length > 0 ||
  changes.tables.updated.length > 0 ||
  changes.tables.deleted.length > 0 ||
  changes.decorItems.created.length > 0 ||
  changes.decorItems.updated.length > 0 ||
  changes.decorItems.deleted.length > 0;

export const saveMenuForAdmin = async (
  ports: AppPorts,
  input: SaveMenuForAdminInput,
): Promise<void> => {
  await requireCurrentPermission(ports, input.actor, "menu.manage");
  assertCompatibilityCurrent();
  await ports.permission!.changes.saveMenuChanges(input.changes);
};

export const saveFloorPlanForAdmin = async (
  ports: AppPorts,
  input: SaveFloorPlanForAdminInput,
): Promise<void> => {
  await requireCurrentPermission(ports, input.actor, "floor.manage");
  assertCompatibilityCurrent();
  await ports.permission!.changes.saveFloorPlan(input.changes);
};

export const createEmployeeForAdmin = async (
  ports: LegacyAppPorts,
  input: CreateEmployeeForAdminInput,
): Promise<Employee> => {
  requireAdminActor(input.actor);
  return ports.employee.createEmployee(input.employee);
};

export const updateEmployeeForAdmin = async (
  ports: LegacyAppPorts,
  input: UpdateEmployeeForAdminInput,
): Promise<Employee> => {
  requireAdminActor(input.actor);
  return ports.employee.updateEmployee(input.employee);
};

export const resetPinForAdmin = async (
  ports: LegacyAppPorts,
  input: ResetPinForAdminInput,
): Promise<void> => {
  requireAdminActor(input.actor);
  await ports.employee.resetPin(input.employeeId, input.newPin);
};

export const updateSettingsForAdmin = async (
  ports: AppPorts,
  input: UpdateSettingsForAdminInput,
): Promise<StoreSettings> => {
  await requireCurrentPermission(ports, input.actor, "settings.manage");
  assertCompatibilityCurrent();
  return ports.permission!.changes.updateSettings(input.settings);
};

export const clearDemoDataForAdmin = async (
  ports: AppPorts,
  input: ClearDemoDataForAdminInput,
): Promise<void> => {
  await requireCurrentPermission(ports, input.actor, "data.clearDemo");
  assertCompatibilityCurrent();
  await ports.permission!.changes.clearDemoData({ requestId: input.requestId, confirmation: input.confirmation });
};

export const seedDemoDataForAdmin = async (
  ports: AppPorts,
  input: SeedDemoDataForAdminInput,
): Promise<void> => {
  await requireCurrentPermission(ports, input.actor, "settings.manage");
  assertCompatibilityCurrent();
  const session = await ports.auth.getStoreSession();

  if (!session) {
    throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
  }

  assertCompatibilityCurrent();
  await ports.seed.seedDemo(session.storeId);
};
