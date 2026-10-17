import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeAdminEnvelope, PermissionEmployee, PermissionRole } from "@/domain/permissions";
import { createMockPermissionState, type MockPermissionState } from "./permissionState";
import { MockPermissionIdentityRepo } from "./permissionIdentityRepo";
import { MockPermissionAdminRepo } from "./permissionAdminRepo";
import { mockPermissionAuditRows, mockPermissionRequestReservations } from "./permissionAdminState";
import { createMockPermissionPorts } from "./permissionRepos";

const uuid = (suffix: number) => `70000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

describe("PERM-T05 mock employee administration", () => {
  let state: MockPermissionState;
  let repo: MockPermissionAdminRepo;
  let identity: MockPermissionIdentityRepo;
  let clock: number;

  const employee = (role: PermissionRole) => state.employees.find(candidate => candidate.role === role)!;
  const login = (actor: PermissionEmployee) => {
    state.session = { storeId: state.storeId, employeeId: actor.id, expiresAt: clock + 60_000, revoked: false };
  };
  const expectError = (result: EmployeeAdminEnvelope<unknown>, code: string) => {
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  };

  beforeEach(() => {
    clock = Date.UTC(2026, 8, 16, 1);
    state = createMockPermissionState();
    state.now = () => clock;
    repo = new MockPermissionAdminRepo(state);
    identity = new MockPermissionIdentityRepo(state);
    login(employee("owner"));
  });

  it("composes the full employee admin contract in the permission foundation factory", () => {
    const employeeAdmin = createMockPermissionPorts(state).employeeAdmin;
    expect(employeeAdmin).toBeInstanceOf(MockPermissionAdminRepo);
    expect(typeof employeeAdmin.createEmployee).toBe("function");
    expect(typeof employeeAdmin.updateEmployee).toBe("function");
    expect(typeof employeeAdmin.resetPin).toBe("function");
    expect(typeof employeeAdmin.listAudit).toBe("function");
  });

  it("TC05 creates once, stores a sanitized null-before audit, and protects request identity", async () => {
    const request = {
      requestId: uuid(1), id: uuid(101), name: " Mai ", role: "cashier" as const,
      pin: "927416", expectedCatalogRevision: state.catalog.revision,
    };
    const applied = await repo.createEmployee(request);
    expect(applied).toMatchObject({ ok: true, outcome: "applied", data: { id: request.id, name: "Mai", role: "cashier", permissionRevision: 0, overrides: null } });
    expect(state.employees.filter(candidate => candidate.id === request.id)).toHaveLength(1);

    const replayed = await repo.createEmployee(request);
    expect(replayed).toMatchObject({ ok: true, outcome: "replayed", data: { id: request.id, name: "Mai" } });
    const audit = await repo.listAudit({ targetId: request.id });
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ kind: "create_employee", outcome: "applied", before: null, credentialChanged: false });
    expect(JSON.stringify({ applied, audit })).not.toMatch(/927416|pin|hash|token|mac/i);

    const reservation = [...mockPermissionRequestReservations(state).values()].find(record => record.kind === "create_employee")!;
    expect(reservation.canonicalPayload).toMatch(/^hmac-sha256:[A-Za-z0-9_-]+$/);
    expect(JSON.stringify(reservation)).not.toMatch(/927416|pin|hash|token/i);
    expectError(await repo.createEmployee({ ...request, pin: "246810" }), "ADMIN_REQUEST_REUSED");

    const reused = await repo.createEmployee({ ...request, name: "Khác" });
    expectError(reused, "ADMIN_REQUEST_REUSED");
    expect((await repo.listAudit({ targetId: request.id })).rows).toHaveLength(1);
  });

  it("TC05/TC14 allows only selectable roles and audits a same-store ID collision without changing it", async () => {
    const cashier = employee("cashier");
    const collision = await repo.createEmployee({ requestId: uuid(2), id: cashier.id, name: "Mới", role: "waiter", pin: "927416", expectedCatalogRevision: 0 });
    expectError(collision, "INVALID_EMPLOYEE_REQUEST");
    const collisionAudit = (await repo.listAudit({ targetId: cashier.id })).rows[0];
    expect(collisionAudit.before).toBeNull();
    expect(collisionAudit.actualAfter).toMatchObject({ id: cashier.id, name: cashier.name });

    const ownerRole = await repo.createEmployee({
      requestId: uuid(3), id: uuid(103), name: "Owner 2", role: "owner", pin: "927416", expectedCatalogRevision: 0,
    } as never);
    expectError(ownerRole, "OWNER_PROTECTED");
    const kitchenRole = await repo.createEmployee({
      requestId: uuid(4), id: uuid(104), name: "Bếp", role: "kitchen", pin: "927416", expectedCatalogRevision: 0,
    } as never);
    expectError(kitchenRole, "INVALID_EMPLOYEE_REQUEST");
    expect(state.employees.filter(candidate => candidate.role === "owner")).toHaveLength(1);
  });

  it("TC22 returns scoped not-found for a foreign target and writes no foreign audit snapshot", async () => {
    const foreign: PermissionEmployee = {
      ...employee("cashier"), id: uuid(199), storeId: uuid(999), name: "Ngoài cửa hàng",
    };
    state.employees.push(foreign);
    const update = await repo.updateEmployee({
      requestId: uuid(198), targetId: foreign.id, expectedRevision: 0, patch: { name: "Không được" },
    });
    expectError(update, "NOT_FOUND");
    const create = await repo.createEmployee({
      requestId: uuid(197), id: foreign.id, name: "Không được", role: "cashier", pin: "927416", expectedCatalogRevision: 0,
    });
    expectError(create, "NOT_FOUND");
    expect((await repo.listAudit()).rows).toHaveLength(0);
  });

  it("TC09/TC22 audits a verified invalid PIN once, but never audits malformed identity or unknown targets", async () => {
    const target = employee("cashier");
    const invalidPin = { requestId: uuid(196), targetId: target.id, expectedRevision: 0, newPin: "12345" };
    const first = await repo.resetPin(invalidPin);
    expectError(first, "INVALID_EMPLOYEE_REQUEST");
    if (!first.ok) expect(first.error.details?.fieldErrors?.pin).toBe("PIN phải gồm đúng 6 chữ số.");
    const replay = await repo.resetPin(invalidPin);
    expectError(replay, "INVALID_EMPLOYEE_REQUEST");
    expect((await repo.listAudit({ targetId: target.id })).rows).toHaveLength(1);
    expect(target.permissionRevision).toBe(0);

    const unknown = await repo.resetPin({ requestId: uuid(195), targetId: uuid(995), expectedRevision: 0, newPin: "12345" });
    expectError(unknown, "NOT_FOUND");
    const malformedIdentity = await repo.resetPin({ requestId: "bad", targetId: target.id, expectedRevision: 0, newPin: "12345" });
    expectError(malformedIdentity, "INVALID_EMPLOYEE_REQUEST");
    expect((await repo.listAudit()).rows).toHaveLength(1);
  });

  it("audits and terminally replays strict-shape denial after a valid same-store target is identified", async () => {
    const target = employee("cashier");
    const malformed = {
      requestId: uuid(194), targetId: target.id, expectedRevision: 0,
      patch: { name: "Không áp dụng" }, unexpected: true,
    } as never;
    expectError(await repo.updateEmployee(malformed), "INVALID_EMPLOYEE_REQUEST");
    expectError(await repo.updateEmployee(malformed), "INVALID_EMPLOYEE_REQUEST");
    const rows = (await repo.listAudit({ targetId: target.id })).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "denied", reason: "INVALID_EMPLOYEE_REQUEST", proposedAfter: null });
    expect(target.name).toBe("Thu ngân");
  });

  it("TC06/TC18 resets old overrides on a real role change, then applies explicit new overrides atomically", async () => {
    const target = employee("cashier");
    target.overrides = { grants: ["report.view"], denies: ["payment.take"] };
    await identity.startSession(target.id, "384729");
    const targetSession = state.session!;
    await identity.startSession(employee("owner").id, "384729");

    const changed = await repo.updateEmployee({
      requestId: uuid(5), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 0,
      patch: { role: "waiter", overrides: { grants: ["report.view"], denies: [] } },
    });
    expect(changed).toMatchObject({ ok: true, outcome: "applied", data: {
      role: "waiter", permissionRevision: 1, overrides: { grants: ["report.view"], denies: [] },
    } });
    expect(targetSession.revoked).toBe(false);

    const sameRole = await repo.updateEmployee({
      requestId: uuid(6), targetId: target.id, expectedRevision: 1, expectedCatalogRevision: 0, patch: { role: "waiter" },
    });
    expect(sameRole).toMatchObject({ ok: true, outcome: "noop", data: { permissionRevision: 1, overrides: { grants: ["report.view"], denies: [] } } });

    const roleOnly = await repo.updateEmployee({
      requestId: uuid(7), targetId: target.id, expectedRevision: 1, expectedCatalogRevision: 0, patch: { role: "cashier" },
    });
    expect(roleOnly).toMatchObject({ ok: true, outcome: "applied", data: { role: "cashier", permissionRevision: 2, overrides: null } });
  });

  it("TC18 enforces field permissions and never partially applies a mixed patch", async () => {
    const editor = employee("waiter");
    editor.overrides = { grants: ["employee.permission.edit", "order.voidOpen"], denies: [] };
    const target: PermissionEmployee = {
      id: uuid(105), storeId: state.storeId, name: "Target", role: "waiter", isActive: true, permissionRevision: 0, overrides: null,
    };
    state.employees.push(target);
    login(editor);

    const permissionOnly = await repo.updateEmployee({
      requestId: uuid(8), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 0,
      patch: { overrides: { grants: ["order.voidOpen"], denies: [] } },
    });
    expect(permissionOnly).toMatchObject({ ok: true, outcome: "applied", data: { name: "Target", permissionRevision: 1 } });

    const mixed = await repo.updateEmployee({
      requestId: uuid(9), targetId: target.id, expectedRevision: 1, expectedCatalogRevision: 0,
      patch: { name: "Không được lưu", overrides: null },
    });
    expectError(mixed, "FORBIDDEN");
    expect(target).toMatchObject({ name: "Target", permissionRevision: 1, overrides: { grants: ["order.voidOpen"], denies: [] } });
    login(employee("owner"));
    const deniedAudit = (await repo.listAudit({ targetId: target.id, outcome: "denied" })).rows[0];
    expect(deniedAudit.proposedAfter).toMatchObject({ name: "Không được lưu", permissionRevision: 1, overrides: null });
    expect(deniedAudit.actualAfter).toMatchObject({ name: "Target", permissionRevision: 1, overrides: { grants: ["order.voidOpen"], denies: [] } });
  });

  it("applies action authority before semantic field errors once request and target identity are valid", async () => {
    const editor = employee("waiter");
    editor.overrides = { grants: ["employee.permission.edit"], denies: [] };
    const target = employee("cashier");
    login(editor);
    const invalidPin = await repo.resetPin({ requestId: uuid(193), targetId: target.id, expectedRevision: 0, newPin: "12345" });
    expectError(invalidPin, "FORBIDDEN");
    const invalidMixed = await repo.updateEmployee({
      requestId: uuid(192), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 0,
      patch: { name: "   ", overrides: null },
    });
    expectError(invalidMixed, "FORBIDDEN");
    login(employee("owner"));
    const rows = await repo.listAudit({ targetId: target.id, outcome: "denied" });
    expect(rows.rows.map(row => row.reason)).toEqual(["FORBIDDEN", "FORBIDDEN"]);
    expect(rows.rows.every(row => row.proposedAfter === null)).toBe(true);
  });

  it("TC15-TC17 applies both configured ceilings even when the target is inactive", async () => {
    const manager = employee("manager");
    manager.overrides = { grants: [], denies: ["report.view", "order.voidPaid"] };
    const target = state.employees.find(candidate => candidate.name === "Nhân viên chỉ xem")!;
    target.isActive = false;
    login(manager);

    const reset = await repo.resetPin({ requestId: uuid(10), targetId: target.id, expectedRevision: 0, newPin: "927416" });
    expectError(reset, "PERMISSION_CEILING_EXCEEDED");
    if (!reset.ok) expect(reset.error.details?.missingPermissions).toEqual(["report.view"]);
    expect(target).toMatchObject({ isActive: false, permissionRevision: 0 });

    const create = await repo.createEmployee({
      requestId: uuid(11), id: uuid(106), name: "Quản lý mới", role: "manager", pin: "927416", expectedCatalogRevision: 0,
    });
    expectError(create, "PERMISSION_CEILING_EXCEEDED");
    if (!create.ok) expect(create.error.details?.missingPermissions).toContain("order.voidPaid");
    expect(state.employees.some(candidate => candidate.id === uuid(106))).toBe(false);

    login(employee("owner"));
    const denied = await repo.listAudit({ outcome: "denied" });
    expect(denied.rows).toHaveLength(2);
    expect(denied.rows.find(row => row.targetId === target.id)).toMatchObject({ actualAfter: { isActive: false }, credentialChanged: false });
  });

  it("TC14 protects owner and self while allowing owner to rename itself", async () => {
    const manager = employee("manager");
    manager.overrides = { grants: ["employee.permission.edit", "settings.manage"], denies: [] };
    login(manager);
    const selfRole = await repo.updateEmployee({ requestId: uuid(12), targetId: manager.id, expectedRevision: 0, expectedCatalogRevision: 0, patch: { role: "manager" } });
    expectError(selfRole, "SELF_PERMISSION_EDIT_FORBIDDEN");
    const selfDisable = await repo.updateEmployee({ requestId: uuid(13), targetId: manager.id, expectedRevision: 0, patch: { isActive: false } });
    expectError(selfDisable, "SELF_DISABLE_FORBIDDEN");
    const selfReset = await repo.resetPin({ requestId: uuid(14), targetId: manager.id, expectedRevision: 0, newPin: "927416" });
    expectError(selfReset, "FORBIDDEN");
    const ownerReset = await repo.resetPin({ requestId: uuid(15), targetId: employee("owner").id, expectedRevision: 0, newPin: "927416" });
    expectError(ownerReset, "OWNER_PROTECTED");

    const owner = employee("owner");
    login(owner);
    const ownerSelfReset = await repo.resetPin({ requestId: uuid(24), targetId: owner.id, expectedRevision: 0, newPin: "927416" });
    expectError(ownerSelfReset, "FORBIDDEN");
    const rename = await repo.updateEmployee({ requestId: uuid(16), targetId: owner.id, expectedRevision: 0, patch: { name: "Chủ mới" } });
    expect(rename).toMatchObject({ ok: true, outcome: "applied", data: { name: "Chủ mới", role: "owner", permissionRevision: 1 } });
    expect(state.employees.filter(candidate => candidate.role === "owner" && candidate.isActive)).toHaveLength(1);
  });

  it("TC08 deactivation revokes target sessions, unlock creates none, and active noops have no effects", async () => {
    const target = employee("cashier");
    const owner = employee("owner");
    await identity.startSession(target.id, "384729");
    const oldSession = state.session!;
    await identity.startSession(owner.id, "384729");

    const disabled = await repo.updateEmployee({
      requestId: uuid(25), targetId: target.id, expectedRevision: 0, patch: { isActive: false },
    });
    expect(disabled).toMatchObject({ ok: true, outcome: "applied", data: { isActive: false, permissionRevision: 1 } });
    expect(oldSession.revoked).toBe(true);
    const unlocked = await repo.updateEmployee({
      requestId: uuid(26), targetId: target.id, expectedRevision: 1, patch: { isActive: true },
    });
    expect(unlocked).toMatchObject({ ok: true, outcome: "applied", data: { isActive: true, permissionRevision: 2 } });
    expect(oldSession.revoked).toBe(true);
    const noop = await repo.updateEmployee({
      requestId: uuid(27), targetId: target.id, expectedRevision: 2, patch: { isActive: true },
    });
    expect(noop).toMatchObject({ ok: true, outcome: "noop", data: { isActive: true, permissionRevision: 2 } });
    expect((await repo.listAudit({ targetId: target.id })).rows.map(row => row.outcome).sort()).toEqual(["applied", "applied", "noop"]);
  });

  it("TC08/TC09 reset revokes all old target sessions, while noop and replay preserve fresh sessions", async () => {
    const target = employee("cashier");
    const owner = employee("owner");
    await identity.startSession(target.id, "384729");
    const first = state.session!;
    await identity.startSession(target.id, "384729");
    const second = state.session!;
    await identity.startSession(owner.id, "384729");
    const ownerSession = state.session!;
    const request = { requestId: uuid(17), targetId: target.id, expectedRevision: 0, newPin: "927416" };

    const changed = await repo.resetPin(request);
    expect(changed).toMatchObject({ ok: true, outcome: "applied", data: { permissionRevision: 1 } });
    expect(first.revoked && second.revoked).toBe(true);
    expect(ownerSession.revoked).toBe(false);
    await expect(identity.startSession(target.id, "384729")).rejects.toMatchObject({ code: "INVALID_PIN" });
    await identity.startSession(target.id, "927416");
    const fresh = state.session!;
    await identity.startSession(owner.id, "384729");

    expect(await repo.resetPin(request)).toMatchObject({ ok: true, outcome: "replayed", data: { permissionRevision: 1 } });
    expectError(await repo.resetPin({ ...request, newPin: "246810" }), "ADMIN_REQUEST_REUSED");
    const reservation = [...mockPermissionRequestReservations(state).values()].find(record => record.kind === "reset_pin")!;
    expect(reservation.canonicalPayload).toMatch(/^hmac-sha256:[A-Za-z0-9_-]+$/);
    expect(reservation.canonicalPayload).not.toMatch(/384729|927416|246810|newPin|token/i);
    expect(fresh.revoked).toBe(false);
    const noop = await repo.resetPin({ requestId: uuid(18), targetId: target.id, expectedRevision: 1, newPin: "927416" });
    expect(noop).toMatchObject({ ok: true, outcome: "noop", data: { permissionRevision: 1 } });
    expect(fresh.revoked).toBe(false);
    const audit = await repo.listAudit({ targetId: target.id });
    expect(audit.rows.map(row => row.outcome).sort()).toEqual(["applied", "noop"]);
    expect(JSON.stringify(audit)).not.toMatch(/384729|927416|secret|hash|token|mac/i);
  });

  it("rechecks the current admin session after the asynchronous request MAC", async () => {
    const request = {
      requestId: uuid(187), id: uuid(187), name: "Không tạo", role: "cashier" as const,
      pin: "927416", expectedCatalogRevision: state.catalog.revision,
    };
    const originalSign = crypto.subtle.sign.bind(crypto.subtle);
    vi.spyOn(crypto.subtle, "sign").mockImplementationOnce(async (algorithm, key, data) => {
      state.session = null;
      return originalSign(algorithm, key, data);
    });
    const result = await repo.createEmployee(request);
    expectError(result, "EMPLOYEE_SESSION_REQUIRED");
    expect(state.employees.some(candidate => candidate.id === request.id)).toBe(false);
    expect(mockPermissionAuditRows(state)).toHaveLength(0);
    expect(mockPermissionRequestReservations(state).size).toBe(0);
  });

  it("TC20 checks catalog staleness before override semantics and preserves same-role overrides", async () => {
    const target = employee("cashier");
    target.overrides = { grants: [], denies: ["payment.take"] };
    state.catalog.revision = 1;
    const stale = await repo.updateEmployee({
      requestId: uuid(19), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 0,
      patch: { overrides: { grants: ["unknown.permission"], denies: [] } },
    } as never);
    expectError(stale, "PERMISSION_CATALOG_STALE");
    expect(target.overrides).toEqual({ grants: [], denies: ["payment.take"] });
    const staleAudit = (await repo.listAudit({ targetId: target.id, outcome: "denied" })).rows.find(row => row.requestId === uuid(19));
    expect(staleAudit?.proposedAfter).toBeNull();

    const baseline = await repo.updateEmployee({
      requestId: uuid(20), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 1,
      patch: { overrides: { grants: [], denies: ["floor.view"] } },
    });
    expectError(baseline, "PERMISSION_BASELINE_REQUIRED");
    const sameRole = await repo.updateEmployee({
      requestId: uuid(21), targetId: target.id, expectedRevision: 0, expectedCatalogRevision: 1, patch: { role: "cashier" },
    });
    expect(sameRole).toMatchObject({ ok: true, outcome: "noop", data: { overrides: { grants: [], denies: ["payment.take"] }, permissionRevision: 0 } });
  });

  it("matches SQL precedence for invalid fields paired with owner/self and stale OCC", async () => {
    const target = employee("cashier");
    const invalidName = await repo.updateEmployee({
      requestId: uuid(189), targetId: target.id, expectedRevision: 99, patch: { name: "   " },
    });
    expectError(invalidName, "INVALID_EMPLOYEE_REQUEST");
    const owner = employee("owner");
    const invalidOwnerSelfPin = await repo.resetPin({
      requestId: uuid(188), targetId: owner.id, expectedRevision: 99, newPin: "12345",
    });
    expectError(invalidOwnerSelfPin, "INVALID_EMPLOYEE_REQUEST");
    const rows = await repo.listAudit({ outcome: "denied" });
    expect(rows.rows.find(row => row.requestId === uuid(189))).toMatchObject({ reason: "INVALID_EMPLOYEE_REQUEST", proposedAfter: null });
    expect(rows.rows.find(row => row.requestId === uuid(188))).toMatchObject({ reason: "INVALID_EMPLOYEE_REQUEST", proposedAfter: null });
  });

  it("TC21 leaves employee and request registry untouched when the shared audit sink fails", async () => {
    const target = employee("cashier");
    const request = { requestId: uuid(28), targetId: target.id, expectedRevision: 0, patch: { name: "Tên mới" } };
    const rows = mockPermissionAuditRows(state);
    const originalPush = rows.push;
    rows.push = (() => { throw new Error("audit unavailable"); }) as typeof rows.push;
    const failed = await repo.updateEmployee(request);
    expectError(failed, "PERMISSION_UPDATE_UNAVAILABLE");
    expect(target).toMatchObject({ name: "Thu ngân", permissionRevision: 0 });
    rows.push = originalPush;

    const retry = await repo.updateEmployee(request);
    expect(retry).toMatchObject({ ok: true, outcome: "applied", data: { name: "Tên mới", permissionRevision: 1 } });
    expect(rows.filter(row => row.requestId === request.requestId)).toHaveLength(1);
  });

  it("TC23 shares request reservations with self-PIN and rechecks current authority before replay", async () => {
    const owner = employee("owner");
    await identity.startSession(owner.id, "384729");
    const sharedRequestId = uuid(22);
    expect(await identity.changeOwnPin({ requestId: sharedRequestId, expectedRevision: 0, currentPin: "384729", newPin: "384729" }))
      .toMatchObject({ outcome: "noop" });
    const crossKind = await repo.updateEmployee({
      requestId: sharedRequestId, targetId: employee("cashier").id, expectedRevision: 0, patch: { name: "Không áp dụng" },
    });
    expectError(crossKind, "ADMIN_REQUEST_REUSED");

    const request = { requestId: uuid(23), targetId: employee("cashier").id, expectedRevision: 0, patch: { name: "Thu ngân mới" } };
    expect(await repo.updateEmployee(request)).toMatchObject({ ok: true, outcome: "applied" });
    owner.overrides = { grants: [], denies: ["employee.manage"] };
    const deniedReplay = await repo.updateEmployee(request);
    expectError(deniedReplay, "FORBIDDEN");
    const changedPayloadWithoutRights = await repo.updateEmployee({ ...request, patch: { name: "Nội dung khác" } });
    expectError(changedPayloadWithoutRights, "FORBIDDEN");
    expect((await repo.listAudit()).rows.filter(row => row.requestId === request.requestId)).toHaveLength(1);
  });

  it("TC24 paginates an opaque store/filter-bound audit cursor and grants audit read without a ceiling", async () => {
    const owner = employee("owner");
    for (const [index, name] of ["A", "B", "C"].entries()) {
      clock += 1_000;
      const result = await repo.updateEmployee({
        requestId: uuid(30 + index), targetId: owner.id, expectedRevision: index, patch: { name },
      });
      expect(result.ok).toBe(true);
    }
    const first = await repo.listAudit({ limit: 1 });
    expect(first.rows).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const rest = await repo.listAudit({ limit: 100, cursor: first.nextCursor! });
    expect(rest.rows).toHaveLength(2);
    expect(new Set([...first.rows, ...rest.rows].map(row => row.auditKey)).size).toBe(3);
    await expect(repo.listAudit({ limit: 0 })).rejects.toMatchObject({ code: "INVALID_EMPLOYEE_REQUEST" });
    await expect(repo.listAudit({ limit: 101 })).rejects.toMatchObject({ code: "INVALID_EMPLOYEE_REQUEST" });
    await expect(repo.listAudit({ cursor: first.nextCursor!, targetId: owner.id })).rejects.toMatchObject({ code: "INVALID_EMPLOYEE_REQUEST" });

    const editor = employee("manager");
    editor.overrides = { grants: ["employee.permission.edit"], denies: ["report.view"] };
    login(editor);
    const ownerRows = await repo.listAudit({ targetId: owner.id });
    expect(ownerRows.rows).toHaveLength(3);
    expect(JSON.stringify(ownerRows)).not.toMatch(/384729|927416|hash|token|mac/i);
    login(employee("waiter"));
    await expect(repo.listAudit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TC24 uses one code-unit ordering for tied timestamps and cursor continuation", async () => {
    const target = employee("cashier");
    for (const [index, name] of ["Một", "Hai", "Ba"].entries()) {
      const result = await repo.updateEmployee({
        requestId: uuid(40 + index), targetId: target.id, expectedRevision: index, patch: { name },
      });
      expect(result.ok).toBe(true);
    }
    const rows = mockPermissionAuditRows(state);
    rows[0].auditKey = "A";
    rows[1].auditKey = "a";
    rows[2].auditKey = "Z";

    const collected: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await repo.listAudit(cursor ? { limit: 1, cursor } : { limit: 1 });
      collected.push(page.rows[0].auditKey);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(collected).toEqual(["a", "Z", "A"]);
  });
});
