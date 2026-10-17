import { describe, expect, it } from "vitest";
import { createAppPorts } from "./runtimePorts";

describe("production runtime ports", () => {
  it("always exposes the complete candidate permission bundle in mock mode", async () => {
    const ports = createAppPorts({ mode: "mock" });
    expect(Object.keys(ports).sort()).toEqual(["auth", "permission", "print", "seed", "write"]);
    expect(ports.permission).toMatchObject({
      authority: expect.any(Object), employeeAdmin: expect.any(Object), read: expect.any(Object),
      session: expect.any(Object), changes: expect.any(Object), signals: expect.any(Object),
      menuImages: expect.any(Object), print: expect.any(Object),
    });
    await ports.auth.pairStore("0001-X8F3QA");
    const roster = await ports.permission!.authority.listRoster();
    const owner = roster[0];
    const cashier = roster[2];
    await expect(ports.permission!.session.startSession(owner.id, "123456")).resolves.toBeTruthy();
    await ports.permission!.session.revokeSession();
    await expect(ports.permission!.session.startSession(cashier.id, "111111")).resolves.toBeTruthy();
  });
});
