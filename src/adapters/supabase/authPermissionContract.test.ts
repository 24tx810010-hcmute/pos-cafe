import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthRepo } from "./authRepo";
import { SupabaseWriteOperationRepo } from "./writeOperationRepo";
import type { ISeedRepo } from "@/ports";
import type { SupabaseAnyClient } from "./repoShared";

describe("candidate compatibility gate", () => {
  it("blocks incompatible paired backend before roster/store reads and before new Auth allocation", async () => {
    for (const contract of [null, { permissionContractVersion: 0, writeProtocolVersion: 1 }, { permissionContractVersion: 1, writeProtocolVersion: 1 }, { permissionContractVersion: 2, writeProtocolVersion: 2 }]) {
      const rpc = vi.fn().mockResolvedValue({ data: contract, error: null });
      const signUp = vi.fn();
      const client = { rpc, auth: { signUp, getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "store" } } }, error: null }) } } as unknown as SupabaseAnyClient;
      const auth = new SupabaseAuthRepo(client, {} as ISeedRepo);
      await expect(auth.getStoreSession()).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED", message: "Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục." });
      await expect(auth.createStore({ displayName: "New store", seedDemo: false })).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED", message: "Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục." });
      expect(rpc.mock.calls.map(call => call[0])).toEqual(["permission_get_contract", "permission_get_contract"]);
      expect(signUp).not.toHaveBeenCalled();
    }
  });
  it("allows minimal paired session on the compatible candidate without direct table reads", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "permission_get_contract"
      ? { permissionContractVersion: 2, writeProtocolVersion: 1 }
      : { ok: true, data: { storeId: "store", storeNo: 7 } }, error: null }));
    const client = { rpc, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "store" } } }, error: null }) } } as unknown as SupabaseAnyClient;
    await expect(new SupabaseAuthRepo(client, {} as ISeedRepo).getStoreSession()).resolves.toEqual({ storeId: "store", storeNo: 7 });
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["permission_get_contract", "permission_get_store_session"]);
  });
  it("candidate writes require the permission version while phase27 transport stays explicitly isolated", async () => {
    const base = { writeProtocolVersion: 1, maxPayloadBytes: 262144, pendingTtlSeconds: 86400 };
    const rpc = vi.fn().mockResolvedValue({ data: base, error: null }); const client = { rpc } as unknown as SupabaseAnyClient;
    await expect(new SupabaseWriteOperationRepo(client, true).capabilities()).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
    await expect(new SupabaseWriteOperationRepo(client).capabilities()).resolves.toEqual(base);
    rpc.mockResolvedValue({ data: { ...base, permissionContractVersion: 2 }, error: null });
    await expect(new SupabaseWriteOperationRepo(client, true).capabilities()).resolves.toMatchObject({ permissionContractVersion: 2 });
  });
});
