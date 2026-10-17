import type { EmployeeAdminCreateRequest, EmployeeAdminUpdateRequest, EmployeePermissionPatch, PermissionCatalog, PermissionCode, PermissionEmployee, PermissionFieldErrors, SelectablePermissionRole } from "@/domain/permissions";
import { requireCatalogRole, validatePermissionCatalog } from "./permissionCatalog";
import { permissionError } from "./permissionErrors";
import { normalizePermissionOverrides } from "./permissionOverrides";

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
function invalid(fieldErrors?: PermissionFieldErrors): never { throw permissionError("INVALID_EMPLOYEE_REQUEST", fieldErrors ? { fieldErrors } : undefined); }
const object = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) return invalid();
  return result;
};
export function permissionRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
}
export function permissionUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || value === "00000000-0000-0000-0000-000000000000") return invalid();
  return value.toLowerCase();
}
export function permissionEmployeeName(value: unknown): string {
  if (typeof value !== "string") return invalid();
  const name = value.trim();
  if (!name.length) return invalid({ name: "Tên nhân viên không được để trống." });
  if ([...name].length > 120) return invalid({ name: "Tên nhân viên tối đa 120 ký tự." });
  return name;
}
export function permissionPin(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9]{6}$/.test(value)) return invalid({ pin: "PIN phải gồm đúng 6 chữ số." });
  return value;
}
export function validatePermissionPinConfirmation(pin: unknown, confirmPin: unknown): void {
  permissionPin(pin);
  if (pin !== confirmPin) invalid({ confirmPin: "Xác nhận PIN không khớp." });
}
export function selectablePermissionRole(catalog: PermissionCatalog, value: unknown): SelectablePermissionRole {
  const role = requireCatalogRole(catalog, value);
  if (!role.enabled || !role.selectable) return invalid();
  return role.code as SelectablePermissionRole;
}
function catalogRevision(catalog: PermissionCatalog, value: unknown): number {
  const revision = permissionRevision(value);
  if (revision !== catalog.revision) throw permissionError("PERMISSION_CATALOG_STALE");
  return revision;
}

export function parseEmployeeAdminCreate(catalog: PermissionCatalog, value: unknown): EmployeeAdminCreateRequest {
  validatePermissionCatalog(catalog);
  const data = object(value, ["requestId", "id", "name", "role", "pin", "expectedCatalogRevision", "overrides"]);
  const result: EmployeeAdminCreateRequest = {
    requestId: permissionUuid(data.requestId), id: permissionUuid(data.id), name: permissionEmployeeName(data.name),
    role: selectablePermissionRole(catalog, data.role), pin: permissionPin(data.pin),
    expectedCatalogRevision: catalogRevision(catalog, data.expectedCatalogRevision),
  };
  if (own(data, "overrides")) result.overrides = normalizePermissionOverrides(catalog, result.role, data.overrides);
  return result;
}

/** Shape and field validators only; server field authority/ceiling/OCC/audit follow in T05. */
export function parseEmployeeAdminUpdate(catalog: PermissionCatalog, currentRole: PermissionEmployee["role"], value: unknown): EmployeeAdminUpdateRequest {
  validatePermissionCatalog(catalog);
  requireCatalogRole(catalog, currentRole);
  const data = object(value, ["requestId", "targetId", "expectedRevision", "expectedCatalogRevision", "patch"]);
  const rawPatch = object(data.patch, ["name", "role", "isActive", "overrides"]);
  const result: EmployeeAdminUpdateRequest = { requestId: permissionUuid(data.requestId), targetId: permissionUuid(data.targetId), expectedRevision: permissionRevision(data.expectedRevision), patch: {} };
  if (own(rawPatch, "role") || own(rawPatch, "overrides") || own(data, "expectedCatalogRevision"))
    result.expectedCatalogRevision = catalogRevision(catalog, data.expectedCatalogRevision);
  const patch: EmployeePermissionPatch = result.patch;
  if (own(rawPatch, "name")) patch.name = permissionEmployeeName(rawPatch.name);
  if (own(rawPatch, "role")) patch.role = selectablePermissionRole(catalog, rawPatch.role);
  if (own(rawPatch, "isActive")) {
    if (typeof rawPatch.isActive !== "boolean") invalid();
    patch.isActive = rawPatch.isActive as boolean;
  }
  if (own(rawPatch, "overrides")) patch.overrides = normalizePermissionOverrides(catalog, patch.role ?? currentRole, rawPatch.overrides);
  return result;
}

/** Pure role-change preview, not a mutation endpoint or a replacement for server authorization. */
export function previewPermissionRoleChange(catalog: PermissionCatalog, employee: PermissionEmployee, role: unknown): PermissionEmployee {
  const nextRole = selectablePermissionRole(catalog, role);
  return { ...employee, role: nextRole, overrides: nextRole === employee.role
    ? (employee.overrides ? { grants: [...employee.overrides.grants], denies: [...employee.overrides.denies] } : null) : null };
}

export function requiredEmployeePatchPermissions(patch: EmployeePermissionPatch): PermissionCode[] {
  const permissions: PermissionCode[] = [];
  if (["name", "role", "isActive"].some(field => own(patch, field))) permissions.push("employee.manage");
  if (own(patch, "overrides")) permissions.push("employee.permission.edit");
  return permissions;
}
