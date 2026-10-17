import { describe, expect, it, vi } from "vitest";
import { employeeCredential } from "./employeeCredential";
import { SupabasePermissionChangesRepo } from "./permissionChangesRepo";
import type { SupabaseAnyClient } from "./repoShared";

const token = "a".repeat(43), id = "72000000-0000-4000-8000-000000000001";
const empty = () => ({ created: [], updated: [], deleted: [] });
const menu = { categories: empty(), menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty() };
const floor = { areas: empty(), tables: empty(), decorItems: empty() };
type Response = { data: unknown; error: unknown };
function clientWith(responses: Promise<Response>[]) {
  const headers = vi.fn(), rpc = vi.fn((..._args: unknown[]) => { const response = responses.shift()!;
    return Object.assign(response, { setHeader(name: string, value: string) { headers(name, value); return response; } }); });
  const client = { rpc } as unknown as SupabaseAnyClient; employeeCredential(client).token = token; return { client, rpc, headers };
}
const ok = (data: unknown): Promise<Response> => Promise.resolve({ data: { ok: true, data }, error: null });

describe("T08 Supabase permission changes", () => {
  it("preserves the canonical request conflict code and approved clear-demo message", async () => {
    const { client } = clientWith([Promise.resolve({ data: { ok: false, error: {
      code: "ADMIN_REQUEST_REUSED", message: "untrusted server text", details: null,
    } }, error: null })]);
    await expect(new SupabasePermissionChangesRepo(client).clearDemoData({ requestId: id, confirmation: true }))
      .rejects.toMatchObject({ code: "ADMIN_REQUEST_REUSED", message: "Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới." });
  });
  it("uses only the authenticated token and exact RPC payload contracts", async () => {
    const settings = { storeId: id, displayName: "Quán", address: "A", currency: "VND", timezone: "Asia/Ho_Chi_Minh", billFooter: "Cảm ơn" };
    const { client, rpc, headers } = clientWith([ok(null), ok(null), ok(settings), Promise.resolve({ data: { ok: true, outcome: "applied", data: null }, error: null })]), repo = new SupabasePermissionChangesRepo(client);
    await repo.saveMenuChanges(menu); await repo.saveFloorPlan(floor); expect(await repo.updateSettings({ displayName: "Quán" })).toEqual(settings);
    await repo.clearDemoData({ requestId: id, confirmation: true });
    expect(rpc.mock.calls).toEqual([["apply_menu_changes", { p_changes: menu }], ["apply_floor_changes", { p_changes: floor }],
      ["update_store_settings", { p_input: { displayName: "Quán" } }], ["clear_demo_data", { p_request_id: id, p_confirmation: true }]]);
    expect(headers).toHaveBeenCalledTimes(4); expect(headers).toHaveBeenCalledWith("x-pos-employee-token", token);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("employeeId");
  });

  it("lets the server attribute every menu and floor deletion to the verified session", async () => {
    const claimedActor = "72000000-0000-4000-8000-000000000002";
    const claimed = { id, deletedByEmployeeId: claimedActor };
    const serverAttributed = { id, deletedByEmployeeId: null };
    const withClaimedDelete = () => ({ ...empty(), deleted: [claimed] });
    const withServerDelete = () => ({ ...empty(), deleted: [serverAttributed] });
    const menuChanges = {
      categories: withClaimedDelete(), menuItems: withClaimedDelete(), optionGroups: withClaimedDelete(),
      optionValues: withClaimedDelete(), menuItemOptionGroups: withClaimedDelete(),
    };
    const floorChanges = { areas: withClaimedDelete(), tables: withClaimedDelete(), decorItems: withClaimedDelete() };
    const { client, rpc } = clientWith([ok(null), ok(null)]);
    const repo = new SupabasePermissionChangesRepo(client);

    await repo.saveMenuChanges(menuChanges);
    await repo.saveFloorPlan(floorChanges);

    expect(rpc.mock.calls).toEqual([
      ["apply_menu_changes", { p_changes: {
        categories: withServerDelete(), menuItems: withServerDelete(), optionGroups: withServerDelete(),
        optionValues: withServerDelete(), menuItemOptionGroups: withServerDelete(),
      } }],
      ["apply_floor_changes", { p_changes: {
        areas: withServerDelete(), tables: withServerDelete(), decorItems: withServerDelete(),
      } }],
    ]);
    expect(menuChanges.menuItems.deleted).toEqual([claimed]);
    expect(floorChanges.tables.deleted).toEqual([claimed]);
  });

  it("rejects malformed projections/envelopes instead of leaking server fields", async () => {
    const badSettings = { storeId: id, displayName: "Quán", address: "A", currency: "VND", timezone: "UTC", billFooter: "", privateKey: "secret" };
    const first = clientWith([ok({})]); await expect(new SupabasePermissionChangesRepo(first.client).updateSettings({})).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
    const second = clientWith([ok(badSettings)]); await expect(new SupabasePermissionChangesRepo(second.client).updateSettings({})).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
    const third = clientWith([Promise.resolve({ data: { ok: true, data: null, extra: true }, error: null })]);
    await expect(new SupabasePermissionChangesRepo(third.client).clearDemoData({ requestId: id, confirmation: true })).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
  });

  it("fences a response from an obsolete employee credential generation", async () => {
    let resolve!: (value: Response) => void; const pending = new Promise<Response>(yes => { resolve = yes; });
    const { client } = clientWith([pending]), repo = new SupabasePermissionChangesRepo(client); const write = repo.saveMenuChanges(menu);
    employeeCredential(client).token = "b".repeat(43); employeeCredential(client).generation++; resolve({ data: { ok: true, data: null }, error: null });
    await expect(write).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  });

  it("maps structured denial and refuses a call without an employee token", async () => {
    const denied = Promise.resolve({ data: { ok: false, error: { code: "FORBIDDEN" } }, error: null }); const { client } = clientWith([denied]);
    await expect(new SupabasePermissionChangesRepo(client).clearDemoData({ requestId: id, confirmation: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    employeeCredential(client).token = null; await expect(new SupabasePermissionChangesRepo(client).clearDemoData({ requestId: id, confirmation: true })).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  });
});
