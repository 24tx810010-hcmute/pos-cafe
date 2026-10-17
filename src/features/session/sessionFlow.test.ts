import { describe, expect, it, vi } from "vitest";
import type { AppPorts } from "@/ports";
import { createAppPorts } from "@/app/runtimePorts";
import { createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import {
  createStoreForSession,
  loadStoreSession,
  pairStoreForSession,
  retrySeedForSession,
  verifyEmployeeForSession,
} from "./sessionFlow";

describe("sessionFlow", () => {
  it("loads unpaired session by default from auth repo", async () => {
    const ports = createAppPorts({ mode: "mock" }); await ports.auth.unpairStore();

    await expect(loadStoreSession(ports)).resolves.toEqual({
      status: "unpaired",
      session: null,
    });
  });

  it("pairs store and returns a StoreSession without raw store key", async () => {
    const ports = createAppPorts({ mode: "mock" }); await ports.auth.unpairStore();
    const session = await pairStoreForSession(ports, "0007-X8F3QA");

    expect(session).toEqual({ storeId: "30000000-0000-4000-8000-000000000001", storeNo: 7 });
    expect(session).not.toHaveProperty("storeKey");
  });

  it("creates store and keeps Store Key only in create result", async () => {
    const ports = createAppPorts({ mode: "mock" }); await ports.auth.unpairStore();
    const result = await createStoreForSession(ports, { displayName: "Demo", seedDemo: false });

    expect(result.store.storeKey).toBe("0001-X8F3QA");
    expect(result.session).toEqual({ storeId: "30000000-0000-4000-8000-000000000001", storeNo: 1 });
    expect(result.session).not.toHaveProperty("storeKey");
  });

  it("delegates seed retry and PIN verification through ports", async () => {
    const { ports, owner } = await createCandidateRuntimeFixture({ demoCredentials: true });
    const retrySpy = vi.spyOn(ports.seed, "retrySeedDemo");

    await retrySeedForSession(ports, { storeId: "e572ea5f-9adf-493c-8d84-dca3cd86e1eb", storeNo: 1 });
    const employee = await verifyEmployeeForSession(ports, owner.id, "123456");

    expect(retrySpy).toHaveBeenCalledWith("e572ea5f-9adf-493c-8d84-dca3cd86e1eb");
    expect(employee.kind).toBe("normal");
    if (employee.kind !== "normal") throw new Error("Expected established fixture to return a normal session");
    expect(employee.authority.snapshot.role).toBe("owner");
  });

  it("fails if pairStore does not produce a session", async () => {
    const ports = createAppPorts({ mode: "mock" }) as AppPorts;
    vi.spyOn(ports.auth, "getStoreSession").mockResolvedValue(null);

    await expect(pairStoreForSession(ports, "0007-X8F3QA")).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });
});
