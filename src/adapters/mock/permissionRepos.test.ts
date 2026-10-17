import { beforeEach, describe, expect, it } from "vitest";
import type { PermissionEmployee, PermissionRole } from "@/domain/permissions";
import { createMockPermissionPorts } from "./permissionRepos";
import { createMockPermissionState } from "./permissionState";
import { canAccessWriteLookup, canReprintReceipt } from "@/core/permissionAuthority";

describe("T03 mock authority/admin/read contract", () => {
  let state: ReturnType<typeof createMockPermissionState>, ports: ReturnType<typeof createMockPermissionPorts>;
  const login = (employee: PermissionEmployee) => { state.session = { employeeId: employee.id, storeId: state.storeId, expiresAt: state.now() + 1000, revoked: false }; return employee; };
  const asRole = (role: PermissionRole) => login(state.employees.find(e => e.role === role)!);
  beforeEach(() => { state = createMockPermissionState(); state.now = () => Date.UTC(2026, 8, 15); ports = createMockPermissionPorts(state); });
  it("TC01 returns data catalog and a matching sanitized snapshot without mutating legacy employees", async () => {
    const legacy = structuredClone(state.business.employees); asRole("owner");
    const bundle = await ports.authority.getAuthority();
    expect(bundle.snapshot.permissions).toHaveLength(15);
    expect(bundle.snapshot.catalogRevision).toBe(bundle.catalog.revision);
    expect(Object.keys(bundle.snapshot).sort()).toEqual(["storeId", "employeeId", "role", "active", "employeeRevision", "catalogRevision", "permissions", "sources"].sort());
    bundle.catalog.roles[0].labelVi = "changed"; bundle.snapshot.permissions.length = 0;
    expect((await ports.authority.getAuthority()).snapshot.permissions).toHaveLength(15);
    expect(state.catalog.roles[0].labelVi).toBe("Chủ quán"); expect(state.business.employees).toEqual(legacy);
  });
  it("TC03 revision poll returns only current revisions and time, refresh observes catalog changes", async () => {
    const employee = asRole("cashier"); employee.permissionRevision = 7;
    expect(await ports.authority.getRevision()).toEqual({ employeeRevision: 7, catalogRevision: 0, serverTime: "2026-09-15T00:00:00.000Z" });
    state.catalog.defaults = [...state.catalog.defaults.filter(d => !(d.roleCode === "cashier" && d.permissionCode === "payment.take")), { roleCode: "cashier", permissionCode: "report.view" }];
    state.catalog.revision++;
    const bundle = await ports.authority.getAuthority();
    expect(bundle.snapshot.catalogRevision).toBe(1);
    expect(bundle.snapshot.permissions).toContain("report.view"); expect(bundle.snapshot.permissions).not.toContain("payment.take");
  });
  it("TC01 roster before PIN has only id/name of enabled active employees in this store", async () => {
    state.employees[2].isActive = false;
    state.employees.push({ ...state.employees[0], id: "foreign", storeId: "foreign" });
    const roster = await ports.authority.listRoster();
    expect(roster).toHaveLength(4);
    expect(roster.every(e => Object.keys(e).sort().join() === "id,name")).toBe(true);
    expect(roster.some(e => e.id === state.employees[4].id || e.id === "foreign")).toBe(false);
  });
  for (const variant of ["no session", "revoked", "expired", "wrong store", "inactive", "missing employee", "kitchen"] as const) it(`rejects protected reads with ${variant}`, async () => {
    const employee = asRole(variant === "kitchen" ? "kitchen" : "cashier");
    if (variant === "no session") state.session = null;
    else if (variant === "revoked") state.session!.revoked = true;
    else if (variant === "expired") state.session!.expiresAt = state.now();
    else if (variant === "wrong store") state.session!.storeId = "other";
    else if (variant === "inactive") employee.isActive = false;
    else if (variant === "missing employee") state.session!.employeeId = "missing";
    const error = { code: variant === "kitchen" ? "EMPLOYEE_ROLE_UNAVAILABLE" : "EMPLOYEE_SESSION_REQUIRED" };
    for (const action of [() => ports.authority.getAuthority(), () => ports.authority.getRevision(), () => ports.read.getFloorOperational(), () => ports.employeeAdmin.listEmployees()])
      await expect(action()).rejects.toMatchObject(error);
  });
  it("requires a paired store even for roster", async () => {
    state.paired = false; await expect(ports.authority.listRoster()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });
  it("T05 delegated permission editor reads sanitized targets through the full candidate admin repo", async () => {
    const employee = asRole("waiter"); employee.overrides = { grants: ["employee.permission.edit"], denies: [] };
    state.employees[2].isActive = false;
    Object.assign(state.employees[0], { pinHash: "secret-hash", token: "secret-token" });
    const rows = await ports.employeeAdmin.listEmployees();
    expect(rows.find(e => e.role === "cashier")?.effective).toContain("payment.take");
    expect(rows.find(e => e.role === "cashier")?.isActive).toBe(false);
    const owner = await ports.employeeAdmin.getEmployee(state.employees[0].id);
    expect(Object.keys(owner).sort()).toEqual(["id", "name", "role", "isActive", "permissionRevision", "overrides", "effective", "sources"].sort());
    expect(JSON.stringify(rows)).not.toContain("secret");
    expect(typeof ports.employeeAdmin.updateEmployee).toBe("function");
    expect(typeof ports.employeeAdmin.listAudit).toBe("function");
    state.employees.push({ ...state.employees[0], storeId: "foreign", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await expect(ports.employeeAdmin.getEmployee("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).rejects.toMatchObject({ code: "NOT_FOUND" });
    employee.overrides = null;
    await expect(ports.employeeAdmin.getEmployee(state.employees[0].id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("TC03 read-only waiter reads history/report/floor but cannot access operational details or K", async () => {
    const employee = login(state.employees.find(e => e.name === "Nhân viên chỉ xem")!);
    const paid = state.business.orders.find(o => o.status === "paid")!;
    expect((await ports.read.listOrderHistory({ page: 1, pageSize: 20 })).items.every(o => o.status !== "open")).toBe(true);
    expect((await ports.read.getOrderHistoryDetail(paid.id)).status).toBe("paid");
    expect((await ports.read.getSalesReport({ businessDate: paid.businessDate })).revenue).toBeGreaterThan(0);
    const floor = await ports.read.getFloorOperational();
    expect(floor.openOrders.length).toBeGreaterThan(0);
    expect(floor.openOrders.every(o => Object.keys(o).sort().join() === "createdAt,id,orderNo,orderType,tableId,total")).toBe(true);
    for (const action of [() => ports.read.getPosMenu(), () => ports.read.getOpenOrderDetail(state.business.orders[0].id), () => ports.read.getPaidOrderForVoid(paid.id), () => ports.read.getMenuAdmin(), () => ports.read.getFloorAdmin(), () => ports.read.getSettingsAdmin()])
      await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
    employee.overrides!.grants.push("receipt.reprint");
    const { catalog, snapshot } = await ports.authority.getAuthority();
    expect(canReprintReceipt(catalog, { status: "verified", snapshot })).toBe(true);
    expect(canAccessWriteLookup(catalog, { status: "verified", snapshot })).toBe(false);
  });
  it("TC03 action-specific reads reject closed/open transitions and do not grant general history", async () => {
    const employee = asRole("waiter"); employee.overrides = { grants: ["order.voidPaid"], denies: [] };
    const open = state.business.orders.find(o => o.status === "open")!, paid = state.business.orders.find(o => o.status === "paid")!;
    const view = await ports.read.getOpenOrderDetail(open.id);
    expect(view.items.length).toBeGreaterThan(0); expect(view).not.toHaveProperty("payment");
    const target = await ports.read.getPaidOrderForVoid(paid.id);
    expect(Object.keys(target).sort()).toEqual(["id", "lockVersion", "orderNo", "status", "total"]);
    await expect(ports.read.getOpenOrderDetail(paid.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ports.read.getPaidOrderForVoid(open.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ports.read.getOrderHistoryDetail(paid.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    open.status = "paid";
    await expect(ports.read.getOpenOrderDetail(open.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("TC03 grants only the requested editor and applies current revocation on each read", async () => {
    const employee = asRole("cashier"); employee.overrides = { grants: ["menu.manage"], denies: [] };
    expect((await ports.read.getMenuAdmin()).menuItems.length).toBeGreaterThan(0);
    await expect(ports.read.getSettingsAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ports.employeeAdmin.listEmployees()).rejects.toMatchObject({ code: "FORBIDDEN" });
    employee.overrides = null; employee.permissionRevision++;
    await expect(ports.read.getMenuAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("TC03 owner can read admin projections; display excludes settings/credentials", async () => {
    asRole("owner");
    expect(await ports.read.getFloorAdmin()).toEqual(state.business.floorPlan);
    expect(await ports.read.getSettingsAdmin()).toEqual(state.business.settings);
    Object.assign(state.business.settings, { recoveryContact: "private", storeKey: "secret" });
    expect(await ports.read.getStoreDisplay()).toEqual({ displayName: state.business.settings.displayName, address: state.business.settings.address, billFooter: state.business.settings.billFooter, currency: state.business.settings.currency, timezone: state.business.settings.timezone });
    expect(await ports.read.getSettingsAdmin()).not.toHaveProperty("storeKey");
    const menu = await ports.read.getPosMenu(); expect(menu.menuItems.every(i => i.isAvailable)).toBe(true);
  });
});
