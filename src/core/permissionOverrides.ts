import type { ConfiguredPermissionSnapshot, PermissionCatalog, PermissionCode, PermissionOverrides, PermissionRole, PermissionSource } from "@/domain/permissions";
import { requireCatalogRole, validatePermissionCatalog } from "./permissionCatalog";
import { permissionError } from "./permissionErrors";

export function normalizePermissionOverrides(catalog: PermissionCatalog, role: PermissionRole, input: unknown): PermissionOverrides {
  validatePermissionCatalog(catalog);
  requireCatalogRole(catalog, role);
  if (input === null) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw permissionError("INVALID_EMPLOYEE_REQUEST");
  const object = input as Record<string, unknown>;
  if (Object.keys(object).length !== 2 || !Object.prototype.hasOwnProperty.call(object, "grants") || !Object.prototype.hasOwnProperty.call(object, "denies"))
    throw permissionError("INVALID_EMPLOYEE_REQUEST");
  const read = (value: unknown): PermissionCode[] => {
    if (!Array.isArray(value) || value.length > 100) throw permissionError("INVALID_EMPLOYEE_REQUEST");
    // Array holes/undefined are invalid too; no sparse-array every() shortcut.
    for (const code of value) if (typeof code !== "string" || !catalog.permissions.some(p => p.code === code))
      throw permissionError("INVALID_EMPLOYEE_REQUEST");
    return [...new Set(value as PermissionCode[])].sort();
  };
  const grants = read(object.grants), denies = read(object.denies);
  if (catalog.permissions.some(p => p.baseline && denies.includes(p.code))) throw permissionError("PERMISSION_BASELINE_REQUIRED");
  if (role !== "owner" && catalog.permissions.some(p => p.ownerOnly && grants.includes(p.code))) throw permissionError("OWNER_ONLY_PERMISSION");
  const defaults = catalog.defaults.filter(d => d.roleCode === role).map(d => d.permissionCode);
  const result = {
    grants: grants.filter(p => !defaults.includes(p) && !denies.includes(p)),
    denies: denies.filter(p => defaults.includes(p)),
  };
  return result.grants.length || result.denies.length ? result : null;
}

/** Active/session checks are intentionally separate: inactive targets retain configured rights. */
export function configuredPermissions(catalog: PermissionCatalog, role: PermissionRole, input: PermissionOverrides): ConfiguredPermissionSnapshot {
  const overrides = normalizePermissionOverrides(catalog, role, input);
  const defaults = new Set(catalog.defaults.filter(d => d.roleCode === role).map(d => d.permissionCode));
  const sources = [...catalog.permissions].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0).map(p => {
    const origin: PermissionSource[] = [];
    if (defaults.has(p.code)) origin.push("default");
    if (overrides?.grants.includes(p.code)) origin.push("grant");
    if (overrides?.denies.includes(p.code)) origin.push("deny");
    if (p.baseline && defaults.has(p.code)) origin.push("baseline");
    return { permission: p.code, effective: (defaults.has(p.code) || !!overrides?.grants.includes(p.code)) && !overrides?.denies.includes(p.code), sources: origin };
  });
  return { permissions: sources.filter(s => s.effective).map(s => s.permission), sources };
}
