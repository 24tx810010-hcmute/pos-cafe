import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthRepo } from "./authRepo";
import type { SupabaseAnyClient } from "./repoShared";

const storeId = "30000000-0000-4000-8000-000000000001";
const workflowId = "30000000-0000-4000-8000-000000000002";
const input = { displayName: " Quán thử ", address: " 12 Nguyễn Huệ ", seedDemo: true };
const authenticated = () => ({ data: { user: { id: storeId }, session: { user: { id: storeId } } }, error: null });
function fixture() {
  const signUp = vi.fn().mockResolvedValue(authenticated());
  const signInWithPassword = vi.fn().mockResolvedValue(authenticated());
  const rpc = vi.fn(async (name: string, args?: Record<string, any>) => {
    if (name === "permission_get_contract") return { data: { permissionContractVersion: 2, writeProtocolVersion: 1 }, error: null };
    if (name === "permission_reserve_store_no") {
      expect(args).toEqual({ p_create_attempt_id: expect.stringMatching(/^[a-f0-9-]{36}$/) });
      return { data: { ok: true, data: { storeNo: 2147483647 } }, error: null };
    }
    if (name === "permission_bootstrap_store") return { data: { ok: true, outcome: "applied", data: {
      storeId, storeNo: args!.p_request.storeNo, ownerId: args!.p_request.ownerId,
      seedRequested: args!.p_request.seedDemo, seedWorkflowId: workflowId,
    } }, error: null };
    throw new Error("Unexpected RPC");
  });
  const client = { rpc, auth: { signUp, signInWithPassword } } as unknown as SupabaseAnyClient;
  return { rpc, signUp, signInWithPassword, repo: new SupabaseAuthRepo(client) };
}

describe("PIN onboarding same-context recovery", () => {
  it("coalesces concurrent creation, returns Key before seed, retains it until explicit ACK", async () => {
    const f = fixture(), first = f.repo.createStore(input), second = f.repo.createStore({ ...input });
    expect(first).toBe(second);
    const result = await first;
    expect(result).toMatchObject({ storeNo: 2147483647, adminPin: "123456", seedStatus: "pending", canRetrySeed: false });
    expect(result.storeKey).toMatch(/^2147483647-[A-Z0-9]{8}$/);
    const calls = f.rpc.mock.calls.length;
    expect(await f.repo.createStore(input)).toEqual(result); expect(f.rpc).toHaveBeenCalledTimes(calls);
    expect(f.signUp).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.map(c => c[0])).toEqual(["permission_get_contract", "permission_reserve_store_no", "permission_bootstrap_store"]);
    f.repo.acknowledgeCreatedStore();
    await f.repo.createStore({ ...input, displayName: "Quán mới" });
    expect(f.signUp).toHaveBeenCalledTimes(2);
  });

  it("lost reservation ACK retries the same UUID without creating an Auth user early", async () => {
    const f = fixture(), base = f.rpc.getMockImplementation()!; let lost = true;
    f.rpc.mockImplementation(async (name, args) => {
      if (name === "permission_reserve_store_no" && lost) { lost = false; throw new Error("response dropped"); }
      return base(name, args);
    });
    await expect(f.repo.createStore(input)).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
    expect(f.signUp).not.toHaveBeenCalled();
    await f.repo.createStore(input);
    const reservations = f.rpc.mock.calls.filter(c => c[0] === "permission_reserve_store_no");
    expect(reservations).toHaveLength(2); expect(reservations[0][1]).toEqual(reservations[1][1]);
  });

  it("lost signup ACK signs in with identical credentials and does not allocate twice", async () => {
    const f = fixture(); f.signUp.mockRejectedValueOnce(new Error("ACK dropped"));
    await f.repo.createStore(input);
    expect(f.signInWithPassword.mock.calls[0][0]).toEqual(f.signUp.mock.calls[0][0]);
    expect(f.signUp).toHaveBeenCalledTimes(1);
    expect(f.rpc.mock.calls.filter(c => c[0] === "permission_reserve_store_no")).toHaveLength(1);
  });

  it("lost bootstrap ACK keeps Auth identity and canonical payload on explicit retry", async () => {
    const f = fixture(), base = f.rpc.getMockImplementation()!; let lost = true;
    f.rpc.mockImplementation(async (name, args) => {
      if (name === "permission_bootstrap_store" && lost) { lost = false; throw new Error("ACK dropped"); }
      return base(name, args);
    });
    await expect(f.repo.createStore(input)).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
    await expect(f.repo.createStore({ ...input, seedDemo: false })).rejects.toMatchObject({ code: "BOOTSTRAP_CONFLICT" });
    await f.repo.createStore(input);
    const bootstraps = f.rpc.mock.calls.filter(c => c[0] === "permission_bootstrap_store");
    expect(bootstraps).toHaveLength(2); expect(bootstraps[0][1]).toEqual(bootstraps[1][1]);
    expect(bootstraps[0][1]?.p_request).toMatchObject({ displayName: "Quán thử", address: "12 Nguyễn Huệ", seedDemo: true });
    expect(f.signUp).toHaveBeenCalledTimes(1);
  });

  it.each(["", " ", "😀".repeat(121)])("rejects invalid store names before any network: case %#", async displayName => {
    const f = fixture();
    await expect(f.repo.createStore({ ...input, displayName })).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.signUp).not.toHaveBeenCalled();
  });
});
