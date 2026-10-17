import { describe, expect, it, vi } from "vitest";
import type { PermissionCode, PermissionRole, PermissionNavigationModule } from "@/domain/permissions";
import { createMockPermissionCatalog, createMockPermissionState } from "@/adapters/mock/permissionState";
import { validatePermissionCatalog, selectablePermissionRoles } from "./permissionCatalog";
import { configuredPermissions } from "./permissionOverrides";
import { canAccessPermissionModule, canAccessWriteLookup, canReadPaymentReceipt, canReprintReceipt, createAuthoritySnapshot, hasCatalogPermission } from "./permissionAuthority";

const expected: Record<PermissionRole, PermissionCode[]> = {
  owner: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage", "employee.permission.edit", "report.view", "settings.manage", "data.clearDemo", "receipt.reprint"],
  manager: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage", "report.view", "receipt.reprint"],
  cashier: ["floor.view", "order.create", "order.update", "order.voidOpen", "payment.take", "orderHistory.view", "receipt.reprint"],
  waiter: ["floor.view", "order.create", "order.update"], kitchen: [],
};
describe("TC-PERM-01/core candidate catalog", () => {
  for (const role of Object.keys(expected) as PermissionRole[]) {
    it(`checks all 15 default cells for ${role}`, () => {
      const catalog = createMockPermissionCatalog();
      const actual = configuredPermissions(catalog, role, null).permissions;
      expect(actual).toEqual([...expected[role]].sort());
      for (const code of expected.owner) expect(actual.includes(code)).toBe(expected[role].includes(code));
    });
  }
  it("has five roles, four enabled and three selectable without removed or future codes", () => {
    const catalog = createMockPermissionCatalog();
    expect(catalog.roles.map(r => r.code).sort()).toEqual(["cashier", "kitchen", "manager", "owner", "waiter"]);
    expect(catalog.roles.filter(r => r.enabled)).toHaveLength(4);
    expect(selectablePermissionRoles(catalog).map(r => r.code)).toEqual(["manager", "cashier", "waiter"]);
    expect(catalog.permissions.map(p => p.code).sort()).toEqual([...expected.owner].sort());
  });
  it("uses modified catalog defaults with no second role map", () => {
    const catalog = createMockPermissionCatalog();
    catalog.defaults = [...catalog.defaults.filter(d => !(d.roleCode === "cashier" && d.permissionCode === "payment.take")), { roleCode: "cashier", permissionCode: "report.view" }];
    catalog.revision++;
    expect(configuredPermissions(catalog, "cashier", null).permissions).toEqual([...expected.cashier.filter(p => p !== "payment.take"), "report.view"].sort());
  });
  const invalidCatalogs = {
    "duplicate permission": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.permissions = [...c.permissions.slice(1), c.permissions[1]]; },
    "unknown permission": (c: ReturnType<typeof createMockPermissionCatalog>) => { (c.permissions[0] as { code: string }).code = "data.wipe"; },
    "unknown role": (c: ReturnType<typeof createMockPermissionCatalog>) => { (c.roles[4] as { code: string }).code = "accountant"; },
    "missing owner default": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.defaults = c.defaults.filter(d => !(d.roleCode === "owner" && d.permissionCode === "report.view")); },
    "missing floor baseline": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.defaults = c.defaults.filter(d => !(d.roleCode === "cashier" && d.permissionCode === "floor.view")); },
    "owner-only default on manager": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.defaults = [...c.defaults, { roleCode: "manager", permissionCode: "data.clearDemo" }]; },
    "duplicate default": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.defaults = [...c.defaults, c.defaults[0]]; },
    "enabled kitchen": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.roles[4].enabled = true; },
    "kitchen default": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.defaults = [...c.defaults, { roleCode: "kitchen", permissionCode: "floor.view" }]; },
    "invalid revision": (c: ReturnType<typeof createMockPermissionCatalog>) => { c.revision = -1; },
    "unsupported contract": (c: ReturnType<typeof createMockPermissionCatalog>) => { (c as { contractVersion: number }).contractVersion = 2; },
  };
  for (const [name, change] of Object.entries(invalidCatalogs)) it(`rejects ${name}`, () => {
    const catalog = createMockPermissionCatalog(); change(catalog);
    expect(() => validatePermissionCatalog(catalog)).toThrow(expect.objectContaining({ code: "PERMISSION_REFRESH_UNAVAILABLE" }));
  });
});

describe("TC-PERM-03/core navigation and authority", () => {
  const setup = () => {
    const state = createMockPermissionState();
    const employee = state.employees.find(e => e.name === "Nhân viên chỉ xem")!;
    return { catalog: state.catalog, employee };
  };
  it("read-only waiter has floor/history/report without action, lookup or reprint", () => {
    const { catalog, employee } = setup();
    const authority = { status: "verified" as const, snapshot: createAuthoritySnapshot(catalog, employee, true) };
    expect(authority.snapshot.permissions).toEqual(["floor.view", "orderHistory.view", "report.view"]);
    const modules: PermissionNavigationModule[] = ["floor", "order", "payment", "orderHistory", "report", "employees", "menuEditor", "floorEditor", "settings", "clearDemo"];
    expect(modules.filter(m => canAccessPermissionModule(catalog, authority, m))).toEqual(["floor", "orderHistory", "report"]);
    expect(canAccessWriteLookup(catalog, authority)).toBe(false);
    expect(canReadPaymentReceipt(catalog, authority)).toBe(true);
    expect(canReprintReceipt(catalog, authority)).toBe(false);
  });
  it("reprint is independent of payment/lookup and still requires receipt read", () => {
    const { catalog, employee } = setup();
    employee.overrides!.grants.push("receipt.reprint");
    let authority = { status: "verified" as const, snapshot: createAuthoritySnapshot(catalog, employee, true) };
    expect(canReprintReceipt(catalog, authority)).toBe(true);
    expect(canAccessWriteLookup(catalog, authority)).toBe(false);
    expect(hasCatalogPermission(catalog, authority, "payment.take")).toBe(false);
    employee.overrides!.grants = ["receipt.reprint"];
    authority = { status: "verified", snapshot: createAuthoritySnapshot(catalog, employee, true) };
    expect(hasCatalogPermission(catalog, authority, "receipt.reprint")).toBe(true);
    expect(canReprintReceipt(catalog, authority)).toBe(false);
    expect(canAccessPermissionModule(catalog, authority, "orderHistory")).toBe(false);
  });
  it("paid void grants lookup and not general history or receipt read", () => {
    const { catalog, employee } = setup(); employee.overrides!.grants = ["order.voidPaid"];
    const authority = { status: "verified" as const, snapshot: createAuthoritySnapshot(catalog, employee, true) };
    expect(canAccessWriteLookup(catalog, authority)).toBe(true);
    expect(canAccessPermissionModule(catalog, authority, "orderHistory")).toBe(false);
    expect(canReadPaymentReceipt(catalog, authority)).toBe(false);
  });
  it("cashier can retain only floor and gains menu without employee/settings", () => {
    const state = createMockPermissionState(), employee = state.employees.find(e => e.role === "cashier")!;
    employee.overrides = { grants: [], denies: expected.cashier.filter(p => p !== "floor.view") };
    let snapshot = createAuthoritySnapshot(state.catalog, employee, true);
    expect(snapshot.permissions).toEqual(["floor.view"]);
    employee.overrides.grants.push("menu.manage"); snapshot = createAuthoritySnapshot(state.catalog, employee, true);
    const authority = { status: "verified" as const, snapshot };
    expect(canAccessPermissionModule(state.catalog, authority, "menuEditor")).toBe(true);
    for (const module of ["employees", "settings", "payment", "order"] as const)
      expect(canAccessPermissionModule(state.catalog, authority, module)).toBe(false);
  });
  for (const status of ["unverified", "loading", "unavailable"] as const) it(`fails closed while ${status}`, () => {
    const { catalog } = setup();
    expect(hasCatalogPermission(catalog, { status }, "floor.view")).toBe(false);
  });
  it("rejects stale catalog and performs no network request in repeated guards", () => {
    const { catalog, employee } = setup(); const snapshot = createAuthoritySnapshot(catalog, employee, true);
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network"));
    try {
      for (let i = 0; i < 100; i++) expect(hasCatalogPermission(catalog, { status: "verified", snapshot }, "floor.view")).toBe(true);
      catalog.revision++; expect(hasCatalogPermission(catalog, { status: "verified", snapshot }, "floor.view")).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("separates inactive configured permissions from session execution", () => {
    const { catalog, employee } = setup(); employee.isActive = false;
    expect(configuredPermissions(catalog, employee.role, employee.overrides).permissions).toEqual(["floor.view", "orderHistory.view", "report.view"]);
    expect(() => createAuthoritySnapshot(catalog, employee, true)).toThrow(expect.objectContaining({ code: "EMPLOYEE_SESSION_REQUIRED" }));
    employee.isActive = true;
    expect(() => createAuthoritySnapshot(catalog, employee, false)).toThrow(expect.objectContaining({ code: "EMPLOYEE_SESSION_REQUIRED" }));
    employee.role = "kitchen"; employee.overrides = null;
    expect(() => createAuthoritySnapshot(catalog, employee, true)).toThrow(expect.objectContaining({ code: "EMPLOYEE_ROLE_UNAVAILABLE" }));
  });
});
