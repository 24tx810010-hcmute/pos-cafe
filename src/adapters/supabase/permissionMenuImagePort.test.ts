import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/core/appError";
import type { SupabaseAnyClient } from "./repoShared";
import { employeeCredential } from "./employeeCredential";
import { SupabasePermissionMenuImagePort } from "./permissionMenuImagePort";

const id = "d50ff72b-d0bc-4832-8888-183c19f5a158";
const handle = "90000000-0000-4000-8000-000000000045";
const fake = () => {
  const invoke = vi.fn(); const client = { functions: { invoke } } as unknown as SupabaseAnyClient;
  employeeCredential(client).token = "employee-token";
  return { client, invoke, port: new SupabasePermissionMenuImagePort(client, "http://127.0.0.1:54321/") };
};

describe("SupabasePermissionMenuImagePort", () => {
  it("keeps persisted legacy images readable without allowing arbitrary URL references", () => {
    const x = fake();
    const path = `${id}/menu-items/${id}/${handle}.webp`;
    const expected = `http://127.0.0.1:54321/storage/v1/object/public/menu-item-images/${path}`;
    expect(x.port.getImageUrl(`menu-item-images/${path}`)).toBe(expected);
    expect(x.port.getImageUrl(path)).toBe(expected);
    for (const invalid of [`https://evil.test/${path}`, `menu-item-images/../${path}`, `${path}/extra`, path.replace(".webp", ".svg"), "malformed", null]) {
      expect(x.port.getImageUrl(invalid)).toBeNull();
    }
    expect(x.invoke).not.toHaveBeenCalled();
  });
  it("stages through the authenticated gateway and returns only a handle", async () => {
    const x = fake(); x.invoke.mockResolvedValue({ data: { ok: true, data: { uploadHandle: handle } }, error: null });
    const file = new File([new Uint8Array([1, 2])], "item.png", { type: "image/png" });
    await expect(x.port.stageMenuItemImage({ itemId: id, file })).resolves.toEqual({ uploadHandle: handle });
    const [name, options] = x.invoke.mock.calls[0];
    expect(name).toBe("menu-image-gateway"); expect(options.headers).toEqual({ "x-pos-employee-token": "employee-token" });
    expect(options.body.get("itemId")).toBe(id); expect(options.body.get("file")).toBe(file);
  });

  it("rejects unsupported and oversized files before any gateway call", async () => {
    const x = fake();
    await expect(x.port.stageMenuItemImage({ itemId: id, file: new File(["gif"], "x.gif", { type: "image/gif" }) })).rejects.toMatchObject({ message: "Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP." });
    await expect(x.port.stageMenuItemImage({ itemId: id, file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }) })).rejects.toMatchObject({ message: "Ảnh món tối đa 5MB." });
    expect(x.invoke).not.toHaveBeenCalled();
  });

  it("reads/discards staging with employee credential and uses token-free stable public URLs", async () => {
    const x = fake(); const blob = new Blob(["image"], { type: "image/webp" });
    x.invoke.mockResolvedValueOnce({ data: blob, error: null }).mockResolvedValueOnce({ data: { ok: true, data: null }, error: null });
    await expect(x.port.readStagedMenuItemImage(handle)).resolves.toBe(blob);
    await expect(x.port.discardStagedMenuItemImage(handle)).resolves.toBeUndefined();
    expect(x.port.getImageUrl(handle)).toBe(`http://127.0.0.1:54321/functions/v1/menu-image-public/${handle}`);
    expect(x.port.getImageUrl(handle)).not.toContain("employee-token");
    expect(x.invoke.mock.calls.map(call => [call[0], call[1].method])).toEqual([
      [`menu-image-gateway/staging/${handle}`, "GET"], [`menu-image-gateway/staging/${handle}`, "DELETE"],
    ]);
  });

  it("rejects missing credentials and late responses from an old employee generation", async () => {
    const x = fake(); employeeCredential(x.client).token = null;
    await expect(x.port.readStagedMenuItemImage(handle)).rejects.toBeInstanceOf(AppError);
    employeeCredential(x.client).token = "old";
    let resolve!: (value: unknown) => void; x.invoke.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = x.port.discardStagedMenuItemImage(handle); employeeCredential(x.client).generation++;
    resolve({ data: { ok: true, data: null }, error: null });
    await expect(pending).rejects.toMatchObject({ code: "EMPLOYEE_SESSION_REQUIRED" });
  });
});
