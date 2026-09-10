import { describe, expect, it, vi } from "vitest";
import type { AppPorts } from "@/ports";
import { createMockPorts } from "@/adapters/mock";
import {
  createStoreForSession,
  loadStoreSession,
  pairStoreForSession,
  retrySeedForSession,
  verifyEmployeeForSession,
} from "./sessionFlow";

describe("sessionFlow", () => {
  it("loads unpaired session by default from auth repo", async () => {
    const ports = createMockPorts();

    await expect(loadStoreSession(ports)).resolves.toEqual({
      status: "unpaired",
      session: null,
    });
  });

  it("pairs store and returns a StoreSession without raw store key", async () => {
    const ports = createMockPorts();
    const session = await pairStoreForSession(ports, "0007-X8F3QA");

    expect(session).toEqual({ storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 7 });
    expect(session).not.toHaveProperty("storeKey");
  });

  it("creates store and keeps Store Key only in create result", async () => {
    const ports = createMockPorts();
    const result = await createStoreForSession(ports, { displayName: "Demo" });

    expect(result.store.storeKey).toBe("0001-X8F3QA");
    expect(result.session).toEqual({ storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 });
    expect(result.session).not.toHaveProperty("storeKey");
  });

  it("delegates seed retry and PIN verification through ports", async () => {
    const ports = createMockPorts();
    await ports.auth.pairStore("0001-X8F3QA");
    await ports.employee.startSession("6b7bd350-7db2-4160-8471-cca2668c070d", "123456");
    const retrySpy = vi.spyOn(ports.seed, "retrySeedDemo");

    await retrySeedForSession(ports, { storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 });
    const employee = await verifyEmployeeForSession(ports, "6b7bd350-7db2-4160-8471-cca2668c070d", "123456");

    expect(retrySpy).toHaveBeenCalledWith("e572ea5f-9adf-493c-8d84-dca3cd86e1eb");
    expect(employee.role).toBe("admin");
  });

  it("fails if pairStore does not produce a session", async () => {
    const ports = createMockPorts() as AppPorts;
    vi.spyOn(ports.auth, "getStoreSession").mockResolvedValue(null);

    await expect(pairStoreForSession(ports, "0007-X8F3QA")).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });
});
