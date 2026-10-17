import type { AuthoritySnapshot, PermissionAuthority, PermissionCatalog, PermissionCode, PermissionEmployee, PermissionNavigationModule } from "@/domain/permissions";
import { AppError } from "./appError";
import { requireCatalogRole, validatePermissionCatalog } from "./permissionCatalog";
import { configuredPermissions } from "./permissionOverrides";
import { permissionError } from "./permissionErrors";

/** The adapter supplies authenticated identity. This pure function is not authentication. */
export function createAuthoritySnapshot(catalog: PermissionCatalog, employee: PermissionEmployee, sessionValid: boolean): AuthoritySnapshot {
  validatePermissionCatalog(catalog);
  if (!sessionValid || !employee.isActive) throw new AppError("EMPLOYEE_SESSION_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
  if (!requireCatalogRole(catalog, employee.role).enabled) throw permissionError("EMPLOYEE_ROLE_UNAVAILABLE");
  if (!Number.isSafeInteger(employee.permissionRevision) || employee.permissionRevision < 0) throw permissionError("PERMISSION_REFRESH_UNAVAILABLE");
  return { storeId: employee.storeId, employeeId: employee.id, role: employee.role, active: true,
    employeeRevision: employee.permissionRevision, catalogRevision: catalog.revision,
    ...configuredPermissions(catalog, employee.role, employee.overrides) };
}

export function hasCatalogPermission(catalog: PermissionCatalog, authority: PermissionAuthority, code: PermissionCode): boolean {
  if (authority.status !== "verified") return false;
  const s = authority.snapshot;
  if (!s.active || s.catalogRevision !== catalog.revision || !catalog.roles.some(r => r.code === s.role && r.enabled)) return false;
  const p = catalog.permissions.find(p => p.code === code);
  return !!p && (!p.ownerOnly || s.role === "owner") && s.permissions.includes(code);
}

export function canAccessPermissionModule(catalog: PermissionCatalog, authority: PermissionAuthority, module: PermissionNavigationModule): boolean {
  // Catalog.module groups actions; a void-paid action never grants general history reading.
  if (module === "orderHistory" && !hasCatalogPermission(catalog, authority, "orderHistory.view")) return false;
  return catalog.permissions.some(p => p.module === module && hasCatalogPermission(catalog, authority, p.code));
}

export function canReadPaymentReceipt(catalog: PermissionCatalog, authority: PermissionAuthority): boolean {
  return hasCatalogPermission(catalog, authority, "payment.take") || hasCatalogPermission(catalog, authority, "orderHistory.view");
}

export const canReprintReceipt = (catalog: PermissionCatalog, authority: PermissionAuthority): boolean =>
  canReadPaymentReceipt(catalog, authority) && hasCatalogPermission(catalog, authority, "receipt.reprint");

export const canAccessWriteLookup = (catalog: PermissionCatalog, authority: PermissionAuthority): boolean =>
  (["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"] as const)
    .some(p => hasCatalogPermission(catalog, authority, p));
