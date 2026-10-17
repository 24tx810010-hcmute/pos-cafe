import type { PermissionCatalog, PermissionCode, PermissionRole } from "@/domain/permissions";
import { permissionError } from "./permissionErrors";

/** Catalog shape/invariants only. Role defaults always come from the supplied data. */
export function validatePermissionCatalog(catalog: PermissionCatalog): void {
  const invalid = () => { throw permissionError("PERMISSION_REFRESH_UNAVAILABLE"); };
  if (!catalog || catalog.contractVersion !== 1 || !Number.isSafeInteger(catalog.revision) || catalog.revision < 0
    || !Array.isArray(catalog.roles) || !Array.isArray(catalog.permissions) || !Array.isArray(catalog.defaults)) invalid();
  const roles = new Set(catalog.roles.map(r => r?.code));
  const codes = new Set(catalog.permissions.map(p => p?.code));
  if (roles.size !== 5 || catalog.roles.length !== 5 || codes.size !== 15 || catalog.permissions.length !== 15
    || !["owner", "manager", "cashier", "waiter", "kitchen"].every(r => roles.has(r as PermissionRole))) invalid();
  // These are the contract's code vocabulary, never a role-to-rights map.
  const expected: PermissionCode[] = ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take",
    "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage", "employee.permission.edit",
    "report.view", "settings.manage", "data.clearDemo", "receipt.reprint"];
  if (!expected.every(p => codes.has(p))) invalid();
  const modules = ["floor", "order", "payment", "orderHistory", "menuEditor", "floorEditor", "employees", "report", "settings", "clearDemo", "receipt"];
  for (const role of catalog.roles) {
    if (typeof role.labelVi !== "string" || !role.labelVi.trim() || role.enabled !== (role.code !== "kitchen")
      || role.selectable !== (role.code !== "owner" && role.code !== "kitchen")) invalid();
  }
  for (const p of catalog.permissions) {
    if (typeof p.labelVi !== "string" || !p.labelVi.trim() || !modules.includes(p.module)
      || p.baseline !== (p.code === "floor.view") || p.ownerOnly !== (p.code === "data.clearDemo")) invalid();
  }
  const pairs = new Set<string>();
  for (const d of catalog.defaults) {
    if (!d || !roles.has(d.roleCode) || !codes.has(d.permissionCode) || d.roleCode === "kitchen"
      || (catalog.permissions.find(p => p.code === d.permissionCode)!.ownerOnly && d.roleCode !== "owner")) invalid();
    const key = d.roleCode + ":" + d.permissionCode;
    if (pairs.has(key)) invalid();
    pairs.add(key);
  }
  if (expected.some(code => !pairs.has("owner:" + code))
    || catalog.roles.some(r => r.enabled && !pairs.has(r.code + ":floor.view"))) invalid();
}

export function requireCatalogRole(catalog: PermissionCatalog, code: unknown) {
  const role = catalog.roles.find(r => r.code === code);
  if (!role) throw permissionError("INVALID_EMPLOYEE_REQUEST");
  return role;
}

export const selectablePermissionRoles = (catalog: PermissionCatalog) => {
  validatePermissionCatalog(catalog);
  return catalog.roles.filter(r => r.enabled && r.selectable).map(r => ({ ...r }));
};
