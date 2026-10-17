import { describe, expect, it, vi } from "vitest";
import type {
  EmployeeAdminCreateRequest,
  EmployeeAdminUpdateRequest,
  EmployeeAdminView,
  EmployeePinResetRequest,
} from "@/domain/permissions";
import { employeeCredential } from "./employeeCredential";
import { SupabasePermissionAdminRepo } from "./permissionAdminRepo";
import type { SupabaseAnyClient } from "./repoShared";

const actorToken = "a".repeat(43);
const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const targetId = "50000000-0000-4000-8000-000000000001";
const requestId = "50000000-0000-4000-8000-000000000002";
const storeId = "50000000-0000-4000-8000-000000000003";
const view: EmployeeAdminView = {
  id: targetId,
  name: "Mai",
  role: "cashier",
  isActive: true,
  permissionRevision: 2,
  overrides: { grants: ["report.view"], denies: [] },
  effective: ["floor.view", "report.view"],
  sources: [
    { permission: "floor.view", effective: true, sources: ["baseline", "default"] },
    { permission: "report.view", effective: true, sources: ["grant"] },
  ],
};
const createRequest: EmployeeAdminCreateRequest = {
  requestId, id: targetId, name: " Mai ", role: "cashier", pin: "927416",
  expectedCatalogRevision: 4, overrides: { grants: ["report.view"], denies: [] },
};
const updateRequest: EmployeeAdminUpdateRequest = {
  requestId, targetId, expectedRevision: 2, expectedCatalogRevision: 4,
  patch: { role: "waiter", overrides: { grants: ["report.view"], denies: ["order.create"] } },
};
const pinRequest: EmployeePinResetRequest = { requestId, targetId, expectedRevision: 2, newPin: "384729" };

type Deferred = {
  promise: Promise<{ data: unknown; error: unknown }>;
  resolve(value: { data: unknown; error: unknown }): void;
  reject(value: unknown): void;
};
function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<{ data: unknown; error: unknown }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function clientWith(responses: Array<Promise<{ data: unknown; error: unknown }>>) {
  const headers = vi.fn();
  const rpc = vi.fn((..._args: unknown[]) => {
    const response = responses.shift();
    if (!response) throw new Error("missing test response");
    return Object.assign(response, {
      setHeader(name: string, value: string) { headers(name, value); return response; },
    });
  });
  const client = { rpc } as unknown as SupabaseAnyClient;
  employeeCredential(client).token = actorToken;
  return { client, rpc, headers };
}

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const success = { ok: true, outcome: "applied", data: view };

describe("SupabasePermissionAdminRepo", () => {
  it("preserves accepted Unicode names and legacy names without applying write bounds on reads", async () => {
    const names = ["Mai\nAnh", "\u{1F338}".repeat(120), "x".repeat(121)];
    const { client } = clientWith([ok({ ok: true, data: names.map(name => ({ ...view, name })) })]);
    expect((await new SupabasePermissionAdminRepo(client).listEmployees()).map(e => e.name)).toEqual(names);
  });
  it("routes every admin RPC with the current credential and leaves typed requests untouched", async () => {
    const audit = {
      rows: [{
        auditKey: "audit-1", storeId, actorType: "employee", actorKey: targetId, requestId, targetId,
        occurredAt: "2026-09-16T01:02:03.000Z", kind: "employee.update", outcome: "applied", reason: null,
        details: null, actorEffective: ["employee.manage"], catalogRevision: 4,
        before: null, proposedAfter: null, actualAfter: { ...view, sources: undefined }, credentialChanged: false,
        pinHash: "must-not-leak", mac: "must-not-leak",
      }],
      nextCursor: "cursor-1",
    };
    const { client, rpc, headers } = clientWith([
      ok({ ok: true, data: [{ ...view, pinHash: "hidden-pin-hash", token: actorToken, mac: "hidden-mac" }] }),
      ok({ ok: true, data: { ...view, pin: "927416" } }), ok(success), ok(success), ok(success),
      ok({ ok: true, data: audit }), ok({ ok: true, data: { rows: [], nextCursor: null } }),
    ]);
    const repo = new SupabasePermissionAdminRepo(client);
    const filter = { targetId, outcome: "applied" } as const;

    const employees = await repo.listEmployees();
    const employee = await repo.getEmployee(targetId);
    await repo.createEmployee(createRequest);
    await repo.updateEmployee(updateRequest);
    await repo.resetPin(pinRequest);
    const page = await repo.listAudit(filter);
    await repo.listAudit();

    expect(rpc.mock.calls).toEqual([
      ["permission_admin_list"],
      ["permission_admin_get", { p_target_id: targetId }],
      ["permission_admin_create", { p_request: createRequest }],
      ["permission_admin_update", { p_request: updateRequest }],
      ["permission_admin_reset_pin", { p_request: pinRequest }],
      ["permission_admin_audit", { p_filter: filter }],
      ["permission_admin_audit", { p_filter: {} }],
    ]);
    expect((rpc.mock.calls[2][1] as { p_request: unknown }).p_request).toBe(createRequest);
    expect((rpc.mock.calls[3][1] as { p_request: unknown }).p_request).toBe(updateRequest);
    expect(headers).toHaveBeenCalledTimes(7);
    expect(headers.mock.calls.every(([name, token]) => name === "x-pos-employee-token" && token === actorToken)).toBe(true);
    expect(JSON.stringify({ employees, employee })).not.toMatch(/pinHash|hidden-pin-hash|927416|token|hidden-mac|mac/);
    expect(JSON.stringify(page)).not.toMatch(/pinHash|mac|must-not-leak/);
  });

  it("returns a sanitized business-denial envelope and preserves validated field and ceiling details", async () => {
    const message = "Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: Xem báo cáo, Quản lý thiết lập.";
    const { client } = clientWith([ok({
      ok: false,
      error: {
        code: "PERMISSION_CEILING_EXCEEDED",
        message,
        details: {
          fieldErrors: { pin: "PIN phải gồm đúng 6 chữ số.", pinHash: "secret" },
          missingPermissions: ["settings.manage", "report.view"],
          rawPin: "927416",
          employeeToken: actorToken,
        },
        sql: "private stack",
      },
      request: createRequest,
      mac: "secret-mac",
    })]);
    const result = await new SupabasePermissionAdminRepo(client).createEmployee(createRequest);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PERMISSION_CEILING_EXCEEDED",
        message,
        details: {
          fieldErrors: { pin: "PIN phải gồm đúng 6 chữ số." },
          missingPermissions: ["report.view", "settings.manage"],
        },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/927416|employeeToken|secret|sql|mac|pinHash/);
  });

  it("maps read denials to AppError with only whitelisted details and exact Vietnamese text", async () => {
    const { client } = clientWith([ok({
      ok: false,
      error: { code: "FORBIDDEN", message: "raw server text", details: { missingPermissions: ["employee.manage"], token: actorToken } },
    })]);
    const error = await new SupabasePermissionAdminRepo(client).listEmployees().catch(value => value);

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Bạn không có quyền thực hiện thao tác này.",
      cause: { missingPermissions: ["employee.manage"] },
    });
    expect(JSON.stringify(error)).not.toContain(actorToken);
  });

  it("never retains raw transport errors, requests, PINs, tokens, or MACs in UI AppError", async () => {
    const raw = {
      code: "XX000",
      message: `database failed PIN=${pinRequest.newPin} token=${actorToken}`,
      details: "mac=private-mac",
      request: pinRequest,
    };
    const { client } = clientWith([Promise.resolve({ data: null, error: raw })]);
    const error = await new SupabasePermissionAdminRepo(client).resetPin(pinRequest).catch(value => value);

    expect(error).toMatchObject({
      code: "PERMISSION_UPDATE_UNAVAILABLE",
      message: "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.",
    });
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toMatch(/384729|private-mac|request|token/);
  });

  it("rejects a stale successful response before exposing data from the previous employee session", async () => {
    const pending = deferred();
    const { client } = clientWith([pending.promise]);
    const result = new SupabasePermissionAdminRepo(client).listEmployees();
    employeeCredential(client).generation += 1;
    employeeCredential(client).token = "b".repeat(43);
    pending.resolve({ data: { ok: true, data: [{ ...view, name: "Old session" }] }, error: null });

    await expect(result).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage });
  });

  it("rejects a stale failed response as a session error instead of surfacing the previous request error", async () => {
    const pending = deferred();
    const { client } = clientWith([pending.promise]);
    const result = new SupabasePermissionAdminRepo(client).getEmployee(targetId);
    employeeCredential(client).generation += 1;
    employeeCredential(client).token = "c".repeat(43);
    pending.reject({ code: "FORBIDDEN", message: "old employee was forbidden", token: actorToken });

    const error = await result.catch(value => value);
    expect(error).toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED", message: sessionMessage });
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain(actorToken);
  });
});
