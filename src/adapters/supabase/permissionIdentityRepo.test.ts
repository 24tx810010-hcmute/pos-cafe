import { expect, test, vi } from "vitest";
import { SupabasePermissionIdentityRepo } from "./permissionIdentityRepo";
import { employeeCredential } from "./employeeCredential";
import type { SupabaseAnyClient } from "./repoShared";
import { createMockPermissionState } from "../mock/permissionState";
import { createAuthoritySnapshot } from "@/core/permissionAuthority";
const state = createMockPermissionState(), e = state.employees.find(e => e.role === "owner")!;
const bundle = { catalog: state.catalog, snapshot: createAuthoritySnapshot(state.catalog, e, true) };
const issued = "2026-09-16T00:00:00.000Z", expires = "2026-09-16T12:00:00.000Z";
const response = (token = "a".repeat(43)) => ({ data: { ok: true, kind: "normal", pinChangeRequired: false, token, issuedAt: issued, expiresAt: expires, authority: bundle }, error: null });
const request = { requestId: "60000000-0000-4000-8000-000000000004", expectedRevision: 0, currentPin: "384729", newPin: "927416" };
function clientWith(queue: Promise<any>[]) {
  const header = vi.fn();
  const rpc = vi.fn(() => { const p = queue.shift()!; return Object.assign(p, { setHeader: (name: string, token: string) => { header(name, token); return p; } }); });
  return { client: { rpc } as unknown as SupabaseAnyClient, rpc, header };
}
function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; }
test("T04 adapter discards an earlier login response after a newer login", async () => {
  const old = deferred(), fresh = deferred(), { client } = clientWith([old.promise, fresh.promise]);
  const repo = new SupabasePermissionIdentityRepo(client), first = repo.startSession(e.id, "384729"), second = repo.startSession(e.id, "384729");
  fresh.resolve(response("b".repeat(43))); await second; old.resolve(response());
  await expect(first).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" }); expect(employeeCredential(client).token === "b".repeat(43)).toBe(true);
});
test("T04 adapter clears immediately on logout and old ACK does not clear a new login", async () => {
  const logout = deferred(), { client, header } = clientWith([logout.promise, Promise.resolve(response("b".repeat(43)))]);
  employeeCredential(client).token = "a".repeat(43); const repo = new SupabasePermissionIdentityRepo(client), pending = repo.revokeSession();
  expect(employeeCredential(client).token).toBeNull(); expect(header.mock.calls[0][0]).toBe("x-pos-employee-token");
  await repo.startSession(e.id, "384729"); logout.resolve({ data: { ok: true }, error: null }); await pending;
  expect(employeeCredential(client).token === "b".repeat(43)).toBe(true);
});
test("T04 adapter stale self PIN response cannot clear a newer login", async () => {
  const old = deferred(), { client } = clientWith([old.promise, Promise.resolve(response("b".repeat(43)))]);
  employeeCredential(client).token = "a".repeat(43); const repo = new SupabasePermissionIdentityRepo(client), pending = repo.changeOwnPin(request);
  await repo.startSession(e.id, "927416"); old.resolve({ data: { ok: true, outcome: "applied", data: { credentialChanged: true, employeeRevision: 1 } }, error: null });
  await expect(pending).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" }); expect(employeeCredential(client).token === "b".repeat(43)).toBe(true);
});
test("T04 adapter discards stale authority and keeps noop or replay sessions", async () => {
  const stale = deferred(), { client } = clientWith([stale.promise, Promise.resolve(response()), Promise.resolve({ data: { ok: true, outcome: "noop", data: { credentialChanged: false, employeeRevision: 0 } }, error: null }),
    Promise.resolve({ data: { ok: true, outcome: "replayed", data: { credentialChanged: true, employeeRevision: 1 } }, error: null })]);
  employeeCredential(client).token = "a".repeat(43); const repo = new SupabasePermissionIdentityRepo(client), authority = repo.getAuthority();
  await repo.startSession(e.id, "384729"); stale.resolve({ data: { ok: true, data: bundle }, error: null }); await expect(authority).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  const generation = employeeCredential(client).generation; await repo.changeOwnPin(request); await repo.changeOwnPin(request); expect(employeeCredential(client).generation).toBe(generation);
});
test("T04 adapter maps wrong current PIN without attaching raw response secrets", async () => {
  const { client } = clientWith([Promise.resolve({ data: { ok: false, error: { code: "INVALID_PIN", debug: "secret" } }, error: null })]);
  employeeCredential(client).token = "a".repeat(43); const repo = new SupabasePermissionIdentityRepo(client);
  await expect(repo.changeOwnPin(request)).rejects.toMatchObject({ code: "INVALID_PIN", message: "PIN hiện tại không đúng." });
  expect(employeeCredential(client).token !== null).toBe(true);
});

const requiredResponse = () => ({ data: {
  ok: true, kind: "required_pin_change", token: "r".repeat(43), storeId: e.storeId, employeeId: e.id,
  name: e.name, employeeRevision: 0, issuedAt: issued, expiresAt: "2026-09-16T00:05:00.000Z",
}, error: null });
const complete = { requestId: request.requestId, expectedRevision: 0, newPin: "927416" };

test("PIN restricted login carries no credential or authority to the application", async () => {
  const { client } = clientWith([Promise.resolve(requiredResponse())]);
  const session = await new SupabasePermissionIdentityRepo(client).startSession(e.id, "123456");
  expect(session).toEqual({ kind: "required_pin_change", storeId: e.storeId, employeeId: e.id, name: e.name,
    employeeRevision: 0, issuedAt: issued, expiresAt: "2026-09-16T00:05:00.000Z" });
  expect(employeeCredential(client).token).toBe("r".repeat(43));
});

test.each([
  { authority: bundle }, { role: "owner" }, { permissions: ["floor.view"] },
  { employeeId: "30000000-0000-4000-8000-000000000099" }, { expiresAt: expires }, { kind: "future" },
])("PIN restricted login rejects malformed or authority-bearing responses %j", async patch => {
  const value = requiredResponse(); Object.assign(value.data, patch);
  const { client } = clientWith([Promise.resolve(value)]);
  await expect(new SupabasePermissionIdentityRepo(client).startSession(e.id, "123456")).rejects.toBeTruthy();
  expect(employeeCredential(client).token).toBeNull();
});

test("PIN proof cannot silently renew the restricted token", async () => {
  const { client } = clientWith([Promise.resolve(requiredResponse()), Promise.resolve({ data: { ok: true, data: {
    valid: true, purpose: "required_pin_change", employeeRevision: 0, expiresAt: "2026-09-16T00:05:01.000Z",
  } }, error: null })]);
  const repo = new SupabasePermissionIdentityRepo(client); await repo.startSession(e.id, "123456");
  await expect(repo.checkRequiredPinSession()).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
});

test("PIN complete clears the credential and never returns normal authority", async () => {
  const { client, rpc } = clientWith([Promise.resolve(requiredResponse()), Promise.resolve({ data: { ok: true, outcome: "applied", data: {
    credentialChanged: true, pinChangeRequired: false, employeeRevision: 1,
  } }, error: null })]);
  const repo = new SupabasePermissionIdentityRepo(client); await repo.startSession(e.id, "123456");
  expect(await repo.completeRequiredPinChange(complete)).toEqual({ outcome: "applied", credentialChanged: true, pinChangeRequired: false, employeeRevision: 1 });
  expect(employeeCredential(client).token).toBeNull();
  await expect(repo.completeRequiredPinChange(complete)).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  expect(rpc).toHaveBeenCalledTimes(2);
});

test("PIN network loss destroys the old credential without replay and sanitizes the error", async () => {
  const { client, rpc } = clientWith([Promise.resolve(requiredResponse())]);
  const repo = new SupabasePermissionIdentityRepo(client); await repo.startSession(e.id, "123456");
  rpc.mockImplementationOnce(() => ({ setHeader: () => Promise.reject(new Error("raw transport secret")) }) as never);
  const error = await repo.completeRequiredPinChange(complete).catch(value => value);
  expect(error).toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE", cause: undefined });
  expect(error.message).not.toContain("secret"); expect(employeeCredential(client).token).toBeNull();
});

test("PIN late completion cannot clear a newer login credential", async () => {
  const late = deferred(), { client } = clientWith([Promise.resolve(requiredResponse()), late.promise, Promise.resolve(response("n".repeat(43)))]);
  const repo = new SupabasePermissionIdentityRepo(client); await repo.startSession(e.id, "123456");
  const operation = repo.completeRequiredPinChange(complete);
  await repo.startSession(e.id, "927416");
  late.resolve({ data: { ok: true, outcome: "applied", data: { credentialChanged: true, pinChangeRequired: false, employeeRevision: 1 } }, error: null });
  await expect(operation).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  expect(employeeCredential(client).token).toBe("n".repeat(43));
});

test("PIN semantic denial keeps the restricted credential for corrected input", async () => {
  const { client } = clientWith([Promise.resolve(requiredResponse()), Promise.resolve({ data: { ok: false, error: { code: "PIN_REUSE_NOT_ALLOWED" } }, error: null })]);
  const repo = new SupabasePermissionIdentityRepo(client); await repo.startSession(e.id, "123456");
  await expect(repo.completeRequiredPinChange({ ...complete, newPin: "123456" })).rejects.toMatchObject({ code: "PIN_REUSE_NOT_ALLOWED" });
  expect(employeeCredential(client).token).toBe("r".repeat(43));
});
