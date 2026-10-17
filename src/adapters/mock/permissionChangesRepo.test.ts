import { beforeEach, describe, expect, it } from "vitest";
import type { PermissionEmployee, PermissionRole } from "@/domain/permissions";
import { createMockPermissionState } from "./permissionState";
import { MockPermissionChangesRepo } from "./permissionChangesRepo";
import { demoSeedIds } from "@/seed/demoSeedData";
import { MockPermissionIdentityRepo, mockPermissionSetPin } from "./permissionIdentityRepo";
import { MockPermissionAdminRepo } from "./permissionAdminRepo";
import { mockPermissionAuditRows, mockPermissionRequestReservations, withMockPermissionClearLock } from "./permissionAdminState";

const id = (n: number) => `71000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const empty = () => ({ created: [], updated: [], deleted: [] });
const clearRequest = (n = 99) => ({ requestId: id(n), confirmation: true as const });

describe("T08 mock permission changes", () => {
  let state: ReturnType<typeof createMockPermissionState>, repo: MockPermissionChangesRepo;
  const login = (role: PermissionRole): PermissionEmployee => { const employee = state.employees.find(e => e.role === role)!;
    state.session = { storeId: state.storeId, employeeId: employee.id, expiresAt: state.now() + 10_000, revoked: false }; return employee; };
  beforeEach(() => { state = createMockPermissionState(); state.now = () => Date.UTC(2026, 8, 17); repo = new MockPermissionChangesRepo(state); });

  it("checks current permission on every write and commits only the authorized transaction", async () => {
    const cashier = login("cashier"), before = structuredClone(state.business.menu);
    const changes = { categories: { ...empty(), created: [{ id: id(1), name: "Mới", sortOrder: 1 }] }, menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty() };
    await expect(repo.saveMenuChanges(changes)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(state.business.menu).toEqual(before);
    cashier.overrides = { grants: ["menu.manage"], denies: [] }; cashier.permissionRevision++;
    await repo.saveMenuChanges(changes); expect(state.business.menu.categories).toContainEqual({ id: id(1), name: "Mới", sortOrder: 1 });
    cashier.overrides = null; cashier.permissionRevision++;
    await expect(repo.saveMenuChanges({ ...changes, categories: { ...empty(), created: [{ id: id(2), name: "Không", sortOrder: 2 }] } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.business.menu.categories.some(row => row.id === id(2))).toBe(false);
  });

  it("allows delegated settings with unchanged timezone but owner-only timezone change rolls back the whole request", async () => {
    const manager = login("manager"); manager.overrides = { grants: ["settings.manage"], denies: [] };
    const timezone = state.business.settings.timezone;
    await repo.updateSettings({ displayName: "Tên mới", timezone }); expect(state.business.settings.displayName).toBe("Tên mới");
    const before = structuredClone(state.business.settings);
    await expect(repo.updateSettings({ displayName: "Không được ghi", timezone: "America/New_York" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.business.settings).toEqual(before);
    login("owner"); const result = await repo.updateSettings({ displayName: "Owner", timezone: "America/New_York" });
    expect(result).toEqual(state.business.settings); expect(result).not.toBe(state.business.settings);
  });

  it("keeps clear-demo semantics, owner-only authority, and permission identity state", async () => {
    const owner = login("owner"), employees = structuredClone(state.employees), catalog = structuredClone(state.catalog);
    state.business.orders = state.business.orders.filter(order => order.status !== "open"); await repo.clearDemoData(clearRequest());
    expect(state.business.menu.categories.some(row => demoSeedIds.categories.includes(row.id))).toBe(false);
    expect(state.employees.find(employee => employee.role === "owner")).toEqual(employees.find(employee => employee.role === "owner"));
    expect(state.employees.find(employee => employee.role === "cashier")).toMatchObject({ isActive: false, permissionRevision: 1 });
    expect(state.catalog).toEqual(catalog); expect(state.session?.employeeId).toBe(owner.id);
    login("manager"); await expect(repo.clearDemoData(clearRequest(98))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects clear atomically while an open order exists", async () => {
    login("owner"); const before = structuredClone(state.business); expect(before.orders.some(order => order.status === "open")).toBe(true);
    await expect(repo.clearDemoData(clearRequest())).rejects.toMatchObject({ code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO" }); expect(state.business).toEqual(before);
  });

  it("uses explicit seed bindings instead of role or PIN heuristics, audits each identity, and revokes its sessions", async () => {
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    const unrelatedCashier = { ...cashier, id: id(7), name: "Thu ngân tự tạo", permissionRevision: 4 };
    state.employees.push(unrelatedCashier);
    mockPermissionSetPin(state, unrelatedCashier.id, "111111");
    const identity = new MockPermissionIdentityRepo(state);
    const cashierSession = await identity.startSession(cashier.id, "384729");
    const cashierSessionState = state.session!;
    const owner = login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const request = clearRequest(10);

    await repo.clearDemoData(request);

    expect(cashier).toMatchObject({ isActive: false, permissionRevision: 1 });
    expect(unrelatedCashier).toMatchObject({ isActive: true, permissionRevision: 4 });
    expect(state.session?.employeeId).toBe(owner.id);
    expect(cashierSession.kind).toBe("normal");
    if (cashierSession.kind !== "normal") throw new Error("established fixture must issue a normal session");
    expect(cashierSession.authority.snapshot.employeeId).toBe(cashier.id);
    expect(cashierSessionState.revoked).toBe(true);
    const audit = mockPermissionAuditRows(state).find(row => row.requestId === request.requestId && row.targetId === cashier.id);
    expect(audit).toMatchObject({ kind: "clear_demo_data", outcome: "applied", actorKey: owner.id, credentialChanged: false });
    expect(audit?.before).toMatchObject({ isActive: true, permissionRevision: 0 });
    expect(audit?.proposedAfter).toMatchObject({ isActive: false, permissionRevision: 1 });
  });

  it("replays exactly once in the shared admin namespace and rechecks current permission", async () => {
    const owner = login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const request = clearRequest(11);
    const beforeAuditCount = mockPermissionAuditRows(state).length;
    await repo.clearDemoData(request);
    await repo.clearDemoData(request);
    expect(mockPermissionAuditRows(state)).toHaveLength(beforeAuditCount + 1);
    await expect(repo.clearDemoData({ ...request, confirmation: false } as never)).rejects.toMatchObject({ code: "ADMIN_REQUEST_REUSED" });

    owner.overrides = { grants: [], denies: ["data.clearDemo"] };
    owner.permissionRevision++;
    await expect(repo.clearDemoData(request)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const admin = new MockPermissionAdminRepo(state);
    const conflictRequest = clearRequest(12);
    const create = await admin.createEmployee({
      requestId: conflictRequest.requestId,
      id: id(13), name: "Nhân viên mới", role: "cashier", pin: "123456",
      expectedCatalogRevision: state.catalog.revision,
    });
    expect(create.ok).toBe(true);
    owner.overrides = null;
    owner.permissionRevision++;
    await expect(repo.clearDemoData(conflictRequest)).rejects.toMatchObject({ code: "ADMIN_REQUEST_REUSED" });
  });

  it("audits a verified non-owner denial once for each concrete demo identity", async () => {
    const manager = login("manager");
    const request = clearRequest(13);
    const targets = state.seedEmployeeBindings.map(binding => binding.employeeId);

    await expect(repo.clearDemoData(request)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repo.clearDemoData(request)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const rows = mockPermissionAuditRows(state).filter(row => row.requestId === request.requestId);
    expect(rows).toHaveLength(targets.length);
    expect(rows.map(row => row.targetId).sort()).toEqual([...targets].sort());
    expect(rows.every(row => row.actorKey === manager.id && row.outcome === "denied" && row.reason === "FORBIDDEN")).toBe(true);
  });

  it("does not commit an awaited clear after the employee session changes", async () => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const blocker = withMockPermissionClearLock(state, async () => { await gate; });
    await Promise.resolve();
    const pending = repo.clearDemoData(clearRequest(16));
    login("manager");
    release();

    await blocker;
    await expect(pending).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
    expect(cashier).toMatchObject({ isActive: true, permissionRevision: 0 });
    expect(mockPermissionAuditRows(state).some(row => row.requestId === clearRequest(16).requestId)).toBe(false);
  });

  it.each([0, 1, 2, 3, 6, 12])("clear/admin share one request winner at microtask offset %i", async offset => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const request = clearRequest(23);
    const pendingClear = repo.clearDemoData(request).then(() => ({ ok: true, code: null }), error => ({ ok: false, code: error.code }));
    for (let n = 0; n < offset; n++) await Promise.resolve();

    const create = await new MockPermissionAdminRepo(state).createEmployee({
      requestId: request.requestId,
      id: id(24),
      name: "Không được tạo",
      role: "cashier",
      pin: "123456",
      expectedCatalogRevision: state.catalog.revision,
    });

    const cleared = await pendingClear;
    expect(Number(cleared.ok) + Number(create.ok)).toBe(1);
    if (create.ok) expect(cleared.code).toBe("ADMIN_REQUEST_REUSED");
    else expect(create.error.code).toBe("ADMIN_REQUEST_REUSED");
    expect(state.employees.some(employee => employee.id === id(24))).toBe(create.ok);
    expect(mockPermissionRequestReservations(state).get(`${state.storeId}:${state.employees[0].id}:${request.requestId}`))
      .toMatchObject({ kind: create.ok ? "create_employee" : "clear_demo_data" });
    expect(new Set(mockPermissionAuditRows(state).filter(row => row.requestId === request.requestId).map(row => row.kind)))
      .toEqual(new Set([create.ok ? "create_employee" : "clear_demo_data"]));
  });

  it.each([0, 1, 2, 3, 6, 12])("clear/menu preserve custom and remove seed at microtask offset %i", async offset => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const custom = { id: id(25), name: "Danh mục tự tạo", sortOrder: 25 };
    const changes = {
      categories: { ...empty(), created: [custom] },
      menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty(),
    };

    const pendingClear = repo.clearDemoData(clearRequest(25));
    for (let n = 0; n < offset; n++) await Promise.resolve();
    await Promise.all([pendingClear, repo.saveMenuChanges(changes)]);

    expect(state.business.menu.categories).toContainEqual(custom);
    expect(state.business.menu.categories.some(row => demoSeedIds.categories.includes(row.id))).toBe(false);
  });

  it("binds a menu save to the session that was authorized when the call began", async () => {
    login("owner");
    const custom = { id: id(26), name: "Đã xác thực", sortOrder: 26 };
    const pending = repo.saveMenuChanges({
      categories: { ...empty(), created: [custom] },
      menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty(),
    });
    login("waiter");

    await pending;
    expect(state.business.menu.categories).toContainEqual(custom);
  });

  it.each([0, 1, 2, 3, 6, 12])("clear/floor preserve custom and remove seed at microtask offset %i", async offset => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const custom = { id: id(27), name: "Khu tự tạo", sortOrder: 27 };
    const changes = {
      areas: { ...empty(), created: [custom] },
      tables: empty(), decorItems: empty(),
    };

    const pendingClear = repo.clearDemoData(clearRequest(27));
    for (let n = 0; n < offset; n++) await Promise.resolve();
    await Promise.all([pendingClear, repo.saveFloorPlan(changes)]);

    expect(state.business.floorPlan.areas).toContainEqual(custom);
    expect(state.business.floorPlan.areas.some(row => demoSeedIds.areas.includes(row.id))).toBe(false);
  });

  it("concurrent settings patches preserve both independently updated fields", async () => {
    login("owner");
    await Promise.all([repo.updateSettings({ displayName: "Tên mới" }), repo.updateSettings({ billFooter: "Hẹn gặp lại" })]);
    expect(state.business.settings).toMatchObject({ displayName: "Tên mới", billFooter: "Hẹn gặp lại" });
  });

  it("serializes concurrent clears across repo instances and coalesces the same request", async () => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    const otherRepo = new MockPermissionChangesRepo(state);
    const same = clearRequest(17);

    await Promise.all([repo.clearDemoData(same), otherRepo.clearDemoData(same)]);

    expect(cashier).toMatchObject({ isActive: false, permissionRevision: 1 });
    expect(mockPermissionAuditRows(state).filter(row => row.requestId === same.requestId)).toHaveLength(1);

    const first = clearRequest(18), second = clearRequest(19);
    await Promise.all([repo.clearDemoData(first), otherRepo.clearDemoData(second)]);
    expect(cashier).toMatchObject({ isActive: false, permissionRevision: 1 });
    expect(mockPermissionAuditRows(state).filter(row => row.requestId === first.requestId || row.requestId === second.requestId)).toHaveLength(0);
  });

  it("stores one terminal denial for concurrent retries of the same request", async () => {
    login("owner");
    const request = clearRequest(20);
    const otherRepo = new MockPermissionChangesRepo(state);
    const results = await Promise.allSettled([repo.clearDemoData(request), otherRepo.clearDemoData(request)]);

    expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
    for (const result of results) {
      expect(result.status === "rejected" ? result.reason : null).toMatchObject({ code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO" });
    }
    expect(mockPermissionAuditRows(state).filter(row => row.requestId === request.requestId)).toHaveLength(1);
  });

  it("serializes a concurrent canonical conflict in the shared namespace", async () => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const request = clearRequest(22);
    const conflicting = { requestId: request.requestId, confirmation: false } as unknown as Parameters<MockPermissionChangesRepo["clearDemoData"]>[0];
    const otherRepo = new MockPermissionChangesRepo(state);

    const results = await Promise.allSettled([repo.clearDemoData(request), otherRepo.clearDemoData(conflicting)]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status === "rejected" ? results[1].reason : null).toMatchObject({ code: "ADMIN_REQUEST_REUSED" });
    expect(mockPermissionAuditRows(state).filter(row => row.requestId === request.requestId)).toHaveLength(1);
  });

  it("audits a verified open-order denial without mutating demo identity", async () => {
    login("owner");
    const cashier = state.employees.find(employee => employee.role === "cashier")!;
    const before = structuredClone(cashier);
    const request = clearRequest(14);
    await expect(repo.clearDemoData(request)).rejects.toMatchObject({ code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO" });
    expect(cashier).toEqual(before);
    expect(mockPermissionAuditRows(state).find(row => row.requestId === request.requestId && row.targetId === cashier.id)).toMatchObject({
      kind: "clear_demo_data", outcome: "denied", reason: "OPEN_ORDERS_BLOCK_CLEAR_DEMO",
    });
  });

  it("rolls back the clear when audit persistence fails", async () => {
    login("owner");
    state.business.orders = state.business.orders.filter(order => order.status !== "open");
    const beforeBusiness = structuredClone(state.business), beforeEmployees = structuredClone(state.employees);
    const audits = mockPermissionAuditRows(state), originalPush = audits.push;
    audits.push = (() => { throw new Error("audit unavailable"); }) as typeof audits.push;
    const request = clearRequest(15);
    await expect(repo.clearDemoData(request)).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
    audits.push = originalPush;
    expect(state.business).toEqual(beforeBusiness);
    expect(state.employees).toEqual(beforeEmployees);
    expect(mockPermissionRequestReservations(state).has(`${state.storeId}:${state.employees[0].id}:${request.requestId}`)).toBe(false);
  });
});
