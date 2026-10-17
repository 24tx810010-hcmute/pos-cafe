import { describe, expect, it, vi } from "vitest";
import type { SupabaseAnyClient } from "./repoShared";
import { SupabasePermissionSignalPort } from "./permissionSignalPort";

const fakeClient = () => {
  const handlers: Array<{ table: string; callback: (payload: { new?: unknown }) => void }> = [];
  const statuses: Array<(value: string) => void> = [];
  const channel = (_topic: string) => {
    const created = {
      on: vi.fn((_kind: string, config: { table: string }, callback: (payload: { new?: unknown }) => void) => {
        handlers.push({ table: config.table, callback }); return created;
      }),
      subscribe: vi.fn((callback: (value: string) => void) => { statuses.push(callback); return created; }),
    };
    return created;
  };
  const client = { channel: vi.fn(channel), removeChannel: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "store-jwt" } } })) }, realtime: { setAuth: vi.fn(async () => undefined) } };
  return {
    client: client as unknown as SupabaseAnyClient,
    emit: (table: string, row: unknown) => handlers.find(item => item.table === table)?.callback({ new: row }),
    status: (value: string, index = 0) => statuses[index]?.(value), removeChannel: client.removeChannel,
    topics: () => client.channel.mock.calls.map(([topic]) => topic),
    subscribeCount: () => statuses.length,
  };
};

describe("SupabasePermissionSignalPort", () => {
  it("decodes only minimal same-store store and catalog signals", async () => {
    const fake = fakeClient();
    const onStoreSignal = vi.fn(); const onCatalogSignal = vi.fn();
    new SupabasePermissionSignalPort(fake.client).subscribe({ storeId: "store-1", onStoreSignal, onCatalogSignal });
    await vi.waitFor(() => expect(fake.subscribeCount()).toBe(2));
    fake.emit("store_change_signals", { store_id: "store-1", topic: "orders", revision: 3, event_id: "event-3", target_id: null, total: 90000 });
    fake.emit("permission_catalog_signals", { singleton: true, revision: "12", event_id: "event-12", secret: "ignored" });
    expect(onStoreSignal).toHaveBeenCalledWith({ storeId: "store-1", topic: "orders", revision: 3, eventId: "event-3" });
    expect(onCatalogSignal).toHaveBeenCalledWith({ revision: 12, eventId: "event-12" });
  });

  it("rejects malformed, foreign-store, unsafe revision and unknown-topic payloads", async () => {
    const fake = fakeClient(); const onStoreSignal = vi.fn(); const onCatalogSignal = vi.fn();
    new SupabasePermissionSignalPort(fake.client).subscribe({ storeId: "store-1", onStoreSignal, onCatalogSignal });
    await vi.waitFor(() => expect(fake.subscribeCount()).toBe(2));
    fake.emit("store_change_signals", { store_id: "store-2", topic: "orders", revision: 1, event_id: "x" });
    fake.emit("store_change_signals", { store_id: "store-1", topic: "audit", revision: 1, event_id: "x" });
    fake.emit("store_change_signals", { store_id: "store-1", topic: "orders", revision: Number.MAX_SAFE_INTEGER + 1, event_id: "x" });
    fake.emit("permission_catalog_signals", { revision: "9007199254740992", event_id: "x" });
    expect(onStoreSignal).not.toHaveBeenCalled(); expect(onCatalogSignal).not.toHaveBeenCalled();
  });

  it("requests authority verification only after reconnect and cleans up once", async () => {
    const fake = fakeClient(); const onReconnect = vi.fn();
    const stop = new SupabasePermissionSignalPort(fake.client).subscribe({
      storeId: "store-1", onStoreSignal: vi.fn(), onCatalogSignal: vi.fn(), onReconnect,
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    fake.status("SUBSCRIBED"); expect(onReconnect).not.toHaveBeenCalled();
    fake.status("SUBSCRIBED", 1); expect(onReconnect).not.toHaveBeenCalled();
    fake.status("CHANNEL_ERROR"); fake.status("SUBSCRIBED"); expect(onReconnect).toHaveBeenCalledTimes(1);
    stop(); stop(); expect(fake.removeChannel).toHaveBeenCalledTimes(2);
    fake.status("SUBSCRIBED"); expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("does not join the transient StrictMode mount and uses fresh topics on remount", async () => {
    const fake = fakeClient();
    const port = new SupabasePermissionSignalPort(fake.client);
    const input = { storeId: "store-1", onStoreSignal: vi.fn(), onCatalogSignal: vi.fn() };
    const stop = port.subscribe(input);
    stop();
    port.subscribe(input);
    await vi.waitFor(() => expect(fake.subscribeCount()).toBe(2));
    const topics = fake.topics();
    expect(topics).toHaveLength(2);
    expect(new Set(topics).size).toBe(2);
  });
});
