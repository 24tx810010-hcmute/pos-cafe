import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthRepo } from "./authRepo";
import type { SupabaseAnyClient } from "./repoShared";

const storeId = "30000000-0000-4000-8000-000000000001";
const input = { displayName: " Cà phê Mây ", address: " 12 Nguyễn Huệ ", seedDemo: true };

function fixture(patchBootstrap?: (data: Record<string, unknown>) => Record<string, unknown>) {
  const signUp = vi.fn(async (_credentials: { email: string; password: string }) => ({ data: { user: { id: storeId }, session: { user: { id: storeId } } }, error: null }));
  const signInWithPassword = vi.fn(async (_credentials: { email: string; password: string }) => ({ data: { user: { id: storeId }, session: { user: { id: storeId } } }, error: null }));
  const rpc = vi.fn(async (name: string, args?: Record<string, any>) => {
    if (name === "permission_get_contract") return { data: { permissionContractVersion: 2, writeProtocolVersion: 1 }, error: null };
    if (name === "permission_reserve_store_no") return { data: { ok: true, data: { storeNo: 2147483647 } }, error: null };
    if (name === "permission_bootstrap_store") {
      const request = args!.p_request as Record<string, unknown>;
      const data = { storeId, storeNo: request.storeNo, ownerId: request.ownerId,
        seedRequested: request.seedDemo, seedWorkflowId: "30000000-0000-4000-8000-000000000002" };
      return { data: { ok: true, outcome: "applied", data: patchBootstrap?.(data) ?? data }, error: null };
    }
    throw new Error("Unexpected RPC");
  });
  const client = { rpc, auth: { signUp, signInWithPassword, signOut: vi.fn(), getSession: vi.fn() } } as unknown as SupabaseAnyClient;
  return { repo: new SupabaseAuthRepo(client), rpc, signUp, signInWithPassword };
}

describe("TC-PIN-10/11 onboarding closeout oracles", () => {
  it.each([
    ["storeId", "30000000-0000-4000-8000-000000000003"],
    ["ownerId", "30000000-0000-4000-8000-000000000003"],
    ["storeNo", 2147483646],
    ["seedRequested", false],
  ] as const)("fails closed when bootstrap response changes %s", async (field, value) => {
    const f = fixture(data => ({ ...data, [field]: value }));
    await expect(f.repo.createStore(input)).rejects.toMatchObject({ code: "BOOTSTRAP_CONFLICT" });
    expect(f.signUp).toHaveBeenCalledOnce();
    expect(f.rpc.mock.calls.filter(([name]) => name === "permission_bootstrap_store")).toHaveLength(1);
  });

  it.each(["permission_reserve_store_no", "permission_bootstrap_store"])(
    "retries a failure before %s executes with the same canonical context", async failedRoute => {
      const f = fixture();
      const base = f.rpc.getMockImplementation()!;
      let failed = false;
      f.rpc.mockImplementation(async (name, args) => {
        if (name === failedRoute && !failed) { failed = true; throw new Error("transport before execute"); }
        return base(name, args);
      });
      await expect(f.repo.createStore(input)).rejects.toMatchObject({ code: "PERMISSION_UPDATE_UNAVAILABLE" });
      await expect(f.repo.createStore({ ...input, seedDemo: false })).rejects.toMatchObject({ code: "BOOTSTRAP_CONFLICT" });
      const created = await f.repo.createStore(input);
      expect(created.storeNo).toBe(2147483647);
      const calls = f.rpc.mock.calls.filter(([name]) => name === failedRoute);
      expect(calls).toHaveLength(2);
      expect(JSON.stringify(calls[0][1]) === JSON.stringify(calls[1][1])).toBe(true);
      expect(f.signUp).toHaveBeenCalledTimes(1);
    },
  );

  it("coalesces pending clicks and keeps one generated secret identity across signup fallback", async () => {
    const f = fixture();
    let release!: () => void;
    f.signUp.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      throw new Error("signup acknowledgement lost");
    });
    const first = f.repo.createStore(input);
    const second = f.repo.createStore({ displayName: "Cà phê Mây", address: "12 Nguyễn Huệ", seedDemo: true });
    expect(first).toBe(second);
    await vi.waitFor(() => expect(release).toBeDefined());
    release();
    await first;
    expect(f.signUp).toHaveBeenCalledOnce();
    expect(f.signInWithPassword).toHaveBeenCalledOnce();
    const signup = f.signUp.mock.calls[0][0];
    const fallback = f.signInWithPassword.mock.calls[0][0];
    expect(signup.email === fallback.email && signup.password === fallback.password).toBe(true);
    expect(f.rpc.mock.calls.filter(([name]) => name === "permission_reserve_store_no")).toHaveLength(1);
  });

  it("clears the completed Store Key and generated secret from the long-lived provider after ACK", async () => {
    const f = fixture();
    await f.repo.createStore(input);
    const provider = f.repo as unknown as { creation: { secret: string; result?: unknown } | null };
    const completed = provider.creation;
    expect(completed?.secret.length).toBeGreaterThan(0);
    expect(completed?.result).toBeDefined();
    f.repo.acknowledgeCreatedStore();
    expect(completed?.secret).toBe("");
    expect(completed?.result).toBeUndefined();
    expect(provider.creation).toBeNull();
  });

  it.each([
    ["name120", { displayName: "😀".repeat(120), address: "", seedDemo: false }, true],
    ["name121", { displayName: "😀".repeat(121), address: "", seedDemo: false }, false],
    ["address500", { displayName: "A", address: "😀".repeat(500), seedDemo: false }, true],
    ["address501", { displayName: "A", address: "😀".repeat(501), seedDemo: false }, false],
    ["seedString", { displayName: "A", address: "", seedDemo: "true" }, false],
  ] as const)("checks UI input boundary %s before network", async (_label, value, valid) => {
    const f = fixture();
    if (valid) {
      await f.repo.createStore(value as typeof input);
      expect(f.signUp).toHaveBeenCalledOnce();
    } else {
      await expect(f.repo.createStore(value as typeof input)).rejects.toMatchObject({ code: "INVALID_WRITE_REQUEST" });
      expect(f.rpc).not.toHaveBeenCalled();
      expect(f.signUp).not.toHaveBeenCalled();
    }
  });

  it("rejects malformed Store Keys before Auth or REST", async () => {
    const f = fixture();
    await expect(f.repo.pairStore("00000000001-X8F3QA")).rejects.toMatchObject({
      code: "AUTH_REQUIRED", message: "Store Key không đúng định dạng.",
    });
    expect(f.signInWithPassword).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
