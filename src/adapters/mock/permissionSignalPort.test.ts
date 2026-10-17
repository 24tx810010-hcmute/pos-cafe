import { describe, expect, it, vi } from "vitest";
import { MockPermissionSignalPort } from "./permissionSignalPort";

describe("MockPermissionSignalPort", () => {
  it("routes store signals by tenant, broadcasts catalog/reconnect, and unsubscribes", () => {
    const port = new MockPermissionSignalPort();
    const s1 = { storeId: "s1", onStoreSignal: vi.fn(), onCatalogSignal: vi.fn(), onReconnect: vi.fn() };
    const s2 = { storeId: "s2", onStoreSignal: vi.fn(), onCatalogSignal: vi.fn(), onReconnect: vi.fn() };
    const stop1 = port.subscribe(s1); port.subscribe(s2);
    port.emitStore({ storeId: "s1", topic: "permission", revision: 2, eventId: "e", targetId: "employee" });
    port.emitCatalog({ revision: 12, eventId: "catalog" }); port.reconnect();
    expect(s1.onStoreSignal).toHaveBeenCalledTimes(1); expect(s2.onStoreSignal).not.toHaveBeenCalled();
    expect(s1.onCatalogSignal).toHaveBeenCalledTimes(1); expect(s2.onCatalogSignal).toHaveBeenCalledTimes(1);
    expect(s1.onReconnect).toHaveBeenCalledTimes(1); expect(s2.onReconnect).toHaveBeenCalledTimes(1);
    stop1(); port.emitCatalog({ revision: 13, eventId: "catalog-2" });
    expect(s1.onCatalogSignal).toHaveBeenCalledTimes(1); expect(s2.onCatalogSignal).toHaveBeenCalledTimes(2);
  });
});

