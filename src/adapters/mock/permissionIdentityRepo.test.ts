import { beforeEach, expect, test, vi } from "vitest";
import { createMockPermissionState, mockPermissionSetPinChangeRequired } from "./permissionState";
import { MockPermissionIdentityRepo } from "./permissionIdentityRepo";
import { createMockPermissionPorts } from "./permissionRepos";
import { mockPermissionAuditRows, mockPermissionRequestReservations } from "./permissionAdminState";
let state = createMockPermissionState(), repo = new MockPermissionIdentityRepo(state);
beforeEach(() => { state = createMockPermissionState(); repo = new MockPermissionIdentityRepo(state); });
const request = () => ({ requestId: "60000000-0000-4000-8000-000000000004", expectedRevision: 0, currentPin: "384729", newPin: "927416" });
const owner = () => state.employees.find(e => e.role === "owner")!;
test("T04 mock issues minimal twelve hour authority and logout accepts expired session", async () => {
  const s = await repo.startSession(owner().id, "384729");
  expect(s.kind).toBe("normal");
  if (s.kind !== "normal") throw new Error("established fixture must issue a normal session");
  expect(s.authority.snapshot.permissions).toHaveLength(15);
  expect(Date.parse(s.expiresAt) - Date.parse(s.issuedAt)).toBe(43200000); expect("token" in s).toBe(false);
  const old = state.session!; state.now = () => old.expiresAt + 1;
  await repo.revokeSession(); await repo.revokeSession(); expect(old.revoked).toBe(true); expect(state.session).toBeNull();
});
test("T04 mock same PIN does not revoke while real change revokes every old session and replay preserves new", async () => {
  await repo.startSession(owner().id, "384729"); const a = state.session!;
  const noop = { ...request(), newPin: "384729" }; expect((await repo.changeOwnPin(noop)).outcome).toBe("noop"); expect(a.revoked).toBe(false);
  await repo.startSession(owner().id, "384729"); const b = state.session!;
  const change = { ...request(), requestId: "60000000-0000-4000-8000-000000000005" };
  expect((await repo.changeOwnPin(change)).outcome).toBe("applied"); expect(a.revoked && b.revoked).toBe(true);
  await expect(repo.startSession(owner().id, "384729")).rejects.toMatchObject({ code: "INVALID_PIN" });
  await repo.startSession(owner().id, "927416"); const fresh = state.session;
  expect((await repo.changeOwnPin(change)).outcome).toBe("replayed"); expect(state.session).toBe(fresh); expect(fresh?.revoked).toBe(false);
});
test("T04 mock denies wrong PIN and stale revision with no mutation", async () => {
  await repo.startSession(owner().id, "384729");
  await expect(repo.changeOwnPin({ ...request(), currentPin: "000000" })).rejects.toMatchObject({ code: "INVALID_PIN", message: "PIN hiện tại không đúng." });
  await expect(repo.changeOwnPin(request())).rejects.toMatchObject({ code: "ADMIN_REQUEST_REUSED" });
  await expect(repo.changeOwnPin({ ...request(), requestId: "60000000-0000-4000-8000-000000000006", expectedRevision: 1 })).rejects.toMatchObject({ code: "EMPLOYEE_VERSION_CONFLICT" });
  expect(owner().permissionRevision).toBe(0); expect(state.session?.revoked).toBe(false);
});
test("T04 mock refuses nonowner self PIN and inactive or reserved login", async () => {
  const cashier = state.employees.find(e => e.role === "cashier")!;
  await repo.startSession(cashier.id, "384729"); await expect(repo.changeOwnPin(request())).rejects.toMatchObject({ code: "FORBIDDEN" });
  cashier.isActive = false; await expect(repo.startSession(cashier.id, "384729")).rejects.toMatchObject({ code: "INVALID_PIN" });
  await expect(repo.startSession(state.employees.find(e => e.role === "kitchen")!.id, "384729")).rejects.toMatchObject({ code: "EMPLOYEE_ROLE_UNAVAILABLE" });
});
test("T04 mock authority sees role override changes without logging in again", async () => {
  const cashier = state.employees.find(e => e.role === "cashier")!;
  await repo.startSession(cashier.id, "384729"); const before = state.session;
  cashier.overrides = { grants: ["report.view"], denies: ["payment.take"] }; cashier.permissionRevision++;
  const authority = await createMockPermissionPorts(state).authority.getAuthority();
  expect(authority.snapshot.permissions).toContain("report.view"); expect(authority.snapshot.permissions).not.toContain("payment.take"); expect(state.session).toBe(before);
});

test("T05 shared audit records self PIN denial without secret and preserves atomic failure", async () => {
  await repo.startSession(owner().id, "384729");
  await expect(repo.changeOwnPin({ ...request(), currentPin: "000000" })).rejects.toMatchObject({ code: "INVALID_PIN" });
  const page = await createMockPermissionPorts(state).employeeAdmin.listAudit();
  expect(page.rows).toHaveLength(1);
  expect(page.rows[0]).toMatchObject({ kind: "self_pin", outcome: "denied", reason: "INVALID_PIN", credentialChanged: false });
  expect(JSON.stringify(page)).not.toMatch(/"384729"|"927416"|"000000"|passcode_hash|currentPin|newPin/);
  const rows = mockPermissionAuditRows(state), originalPush = rows.push;
  rows.push = () => { throw new Error("synthetic audit unavailable"); };
  const change = { ...request(), requestId: "60000000-0000-4000-8000-000000000008" };
  await expect(repo.changeOwnPin(change)).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
  expect(owner().permissionRevision).toBe(0);
  expect(state.session?.revoked).toBe(false);
  rows.push = originalPush;
  expect((await repo.changeOwnPin(change)).outcome).toBe("applied");
  expect(rows).toHaveLength(2);
});

test("established demo owner remains normal even when its fixture PIN is 123456", async () => {
  state = createMockPermissionState({ demoCredentials: true });
  repo = new MockPermissionIdentityRepo(state);
  const session = await repo.startSession(owner().id, "123456");
  expect(session).toMatchObject({ kind: "normal", pinChangeRequired: false });
  expect(state.session).toMatchObject({ purpose: "normal" });
});

test("required PIN session is minimal, proof-only, strict, audited, revoked on success, and needs a new login", async () => {
  const target = owner();
  mockPermissionSetPinChangeRequired(state, target.id, true);
  const restricted = await repo.startSession(target.id, "384729");
  expect(restricted).toMatchObject({
    kind: "required_pin_change",
    storeId: state.storeId,
    employeeId: target.id,
    employeeRevision: 0,
  });
  expect("authority" in restricted).toBe(false);
  expect(Date.parse(restricted.expiresAt) - Date.parse(restricted.issuedAt)).toBe(300_000);
  await expect(repo.checkRequiredPinSession()).resolves.toMatchObject({
    valid: true,
    purpose: "required_pin_change",
    employeeRevision: 0,
  });

  const denied = { requestId: "60000000-0000-4000-8000-000000000020", expectedRevision: 0, newPin: "384729" };
  await expect(repo.completeRequiredPinChange(denied)).rejects.toMatchObject({ code: "PIN_REUSE_NOT_ALLOWED" });
  await expect(repo.completeRequiredPinChange(denied)).rejects.toMatchObject({ code: "PIN_REUSE_NOT_ALLOWED" });
  await expect(repo.completeRequiredPinChange({ ...denied, newPin: "927416" })).rejects.toMatchObject({ code: "ADMIN_REQUEST_REUSED" });
  const deniedReservation = [...mockPermissionRequestReservations(state).values()].find(record => record.kind === "required_pin_change")!;
  expect(deniedReservation.canonicalPayload).toMatch(/^hmac-sha256:[A-Za-z0-9_-]+$/);
  expect(JSON.stringify(deniedReservation)).not.toMatch(/384729|927416|newPin|currentPin/i);
  await expect(repo.completeRequiredPinChange({ ...denied, requestId: "60000000-0000-4000-8000-000000000021", currentPin: "384729" } as never))
    .rejects.toMatchObject({ code: "INVALID_EMPLOYEE_REQUEST" });

  const applied = { requestId: "60000000-0000-4000-8000-000000000022", expectedRevision: 0, newPin: "927416" };
  await expect(repo.completeRequiredPinChange(applied)).resolves.toEqual({
    outcome: "applied",
    credentialChanged: true,
    pinChangeRequired: false,
    employeeRevision: 1,
  });
  expect(state.session).toBeNull();
  await expect(repo.completeRequiredPinChange(applied)).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  await expect(repo.startSession(target.id, "384729")).rejects.toMatchObject({ code: "INVALID_PIN" });
  await expect(repo.startSession(target.id, "927416")).resolves.toMatchObject({ kind: "normal", pinChangeRequired: false });
  const audit = mockPermissionAuditRows(state).filter(row => row.kind === "required_pin_change");
  expect(audit.map(row => [row.outcome, row.reason])).toEqual([
    ["denied", "PIN_REUSE_NOT_ALLOWED"],
    ["applied", null],
  ]);
  expect(JSON.stringify(audit)).not.toMatch(/384729|927416|newPin|currentPin|token/i);
});

test("required completion rechecks the restricted session after the asynchronous request MAC", async () => {
  const target = owner();
  mockPermissionSetPinChangeRequired(state, target.id, true);
  await repo.startSession(target.id, "384729");
  const originalSign = crypto.subtle.sign.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, "sign").mockImplementationOnce(async (algorithm, key, data) => {
    state.session = null;
    return originalSign(algorithm, key, data);
  });
  await expect(repo.completeRequiredPinChange({ requestId: "60000000-0000-4000-8000-000000000023", expectedRevision: 0, newPin: "927416" }))
    .rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  expect(target.permissionRevision).toBe(0);
  expect(mockPermissionAuditRows(state)).toHaveLength(0);
  expect(mockPermissionRequestReservations(state).size).toBe(0);
  await expect(repo.startSession(target.id, "384729")).resolves.toMatchObject({ kind: "required_pin_change" });
});

test("a live pin-change flag blocks an already-issued normal session", async () => {
  const target = owner();
  await repo.startSession(target.id, "384729");
  mockPermissionSetPinChangeRequired(state, target.id, true);
  await expect(repo.changeOwnPin(request())).rejects.toMatchObject({ code: "PIN_CHANGE_REQUIRED" });
  await expect(createMockPermissionPorts(state).authority.getAuthority()).rejects.toMatchObject({ code: "PIN_CHANGE_REQUIRED" });
});
