import type {
  EmployeeAdminView,
  PermissionCatalog,
  PermissionCode,
  PermissionOverrides,
  SelectablePermissionRole,
} from "@/domain/permissions";

export type PermissionEmployeeForm = {
  name: string;
  role: SelectablePermissionRole;
  isActive: boolean;
  permissions: Record<PermissionCode, boolean>;
  permissionsTouched: boolean;
  newPin: string;
  confirmPin: string;
  currentPin: string;
};
export type PermissionEmployeeErrors = Partial<
  Record<"name" | "pin" | "confirmPin" | "currentPin", string>
>;
export const selectableRoles: SelectablePermissionRole[] = [
  "manager",
  "cashier",
  "waiter",
];

export const createRequestId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `00000000-0000-4000-8000-${`${Date.now()}`.padStart(12, "0").slice(-12)}`;

export function defaultPermissionSelection(
  catalog: PermissionCatalog,
  role: SelectablePermissionRole,
): Record<PermissionCode, boolean> {
  const defaults = new Set(
    catalog.defaults
      .filter((item) => item.roleCode === role)
      .map((item) => item.permissionCode),
  );
  return Object.fromEntries(
    catalog.permissions.map((permission) => [
      permission.code,
      defaults.has(permission.code),
    ]),
  ) as Record<PermissionCode, boolean>;
}

export function formForEmployee(
  catalog: PermissionCatalog,
  employee: EmployeeAdminView,
): PermissionEmployeeForm {
  const effective = new Set(employee.effective);
  const fallbackRole: SelectablePermissionRole = selectableRoles.includes(
    employee.role as SelectablePermissionRole,
  )
    ? (employee.role as SelectablePermissionRole)
    : "cashier";
  return {
    name: employee.name,
    role: fallbackRole,
    isActive: employee.isActive,
    permissions: Object.fromEntries(
      catalog.permissions.map((permission) => [
        permission.code,
        effective.has(permission.code),
      ]),
    ) as Record<PermissionCode, boolean>,
    permissionsTouched: false,
    newPin: "",
    confirmPin: "",
    currentPin: "",
  };
}

export function emptyEmployeeForm(
  catalog: PermissionCatalog,
): PermissionEmployeeForm {
  return {
    name: "",
    role: "cashier",
    isActive: true,
    permissions: defaultPermissionSelection(catalog, "cashier"),
    permissionsTouched: false,
    newPin: "",
    confirmPin: "",
    currentPin: "",
  };
}

export function overridesFromSelection(
  catalog: PermissionCatalog,
  role: SelectablePermissionRole,
  selection: Record<PermissionCode, boolean>,
): PermissionOverrides {
  const defaults = new Set(
    catalog.defaults
      .filter((item) => item.roleCode === role)
      .map((item) => item.permissionCode),
  );
  const grants: PermissionCode[] = [],
    denies: PermissionCode[] = [];
  for (const permission of catalog.permissions) {
    const enabled = selection[permission.code];
    if (enabled && !defaults.has(permission.code)) grants.push(permission.code);
    if (!enabled && defaults.has(permission.code) && !permission.baseline)
      denies.push(permission.code);
  }
  return grants.length || denies.length
    ? { grants: grants.sort(), denies: denies.sort() }
    : null;
}

export function validateEmployeeForm(
  form: PermissionEmployeeForm,
  create: boolean,
  ownerSelf = false,
): PermissionEmployeeErrors {
  const errors: PermissionEmployeeErrors = {};
  const nameLength = [...form.name.trim()].length;
  if (!nameLength) errors.name = "Tên nhân viên không được để trống.";
  else if (nameLength > 120) errors.name = "Tên nhân viên tối đa 120 ký tự.";
  if ((create || form.newPin) && !/^\d{6}$/.test(form.newPin))
    errors.pin = "PIN phải gồm đúng 6 chữ số.";
  if ((create || form.newPin) && form.confirmPin !== form.newPin)
    errors.confirmPin = "Xác nhận PIN không khớp.";
  if (ownerSelf && form.newPin && !/^\d{6}$/.test(form.currentPin))
    errors.currentPin = "PIN hiện tại phải gồm đúng 6 chữ số.";
  return errors;
}

export function actorCoversTarget(
  actorPermissions: readonly PermissionCode[],
  target: EmployeeAdminView,
): boolean {
  const actor = new Set(actorPermissions);
  return target.effective.every((permission) => actor.has(permission));
}

export function permissionSourceLabel(
  employee: EmployeeAdminView,
  code: PermissionCode,
): string {
  const sources =
    employee.sources.find((item) => item.permission === code)?.sources ?? [];
  if (sources.includes("deny")) return "Đã chặn riêng";
  if (sources.includes("grant")) return "Được cấp riêng";
  if (sources.includes("baseline")) return "Quyền nền bắt buộc";
  if (sources.includes("default")) return "Theo vai trò";
  return "Không được cấp";
}
