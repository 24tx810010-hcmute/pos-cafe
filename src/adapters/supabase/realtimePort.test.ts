import { describe, expect, it, vi } from "vitest";
import type { RealtimeInvalidationInput } from "@/ports";
import type { SupabaseAnyClient } from "./repoShared";
import { SupabaseRealtimePort } from "./realtimePort";

const makeInput = (): RealtimeInvalidationInput => ({
  storeId: "store-1",
  invalidateMenu: vi.fn(),
  invalidateFloorPlan: vi.fn(),
  invalidateOpenOrders: vi.fn(),
  invalidateReport: vi.fn(),
});

const makeFakeClient = () => {
  let onSignal: ((payload: { new?: unknown }) => void) | undefined;
  let onStatus: ((status: string) => void) | undefined;
  const channel = {
    on: vi.fn((_event: string, _config: object, handler: (payload: { new?: unknown }) => void) => {
      onSignal = handler;
      return channel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => { onStatus = callback; return channel; }),
  };
  const setAuth = vi.fn().mockResolvedValue(undefined);
  const client = {
    channel: vi.fn((_topic: string) => channel),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "fixture-token" } } }) },
    realtime: { setAuth },
  };
  const signal = (topic: string, patch: object = {}) => onSignal?.({ new: {
    store_id: "store-1", topic, revision: 1, event_id: "event-1", target_id: null, ...patch,
  } });
  return { client: client as unknown as SupabaseAnyClient, channel, setAuth,
    topics: () => client.channel.mock.calls.map(([topic]) => topic),
    signal, status: (value: string) => onStatus?.(value) };
};

describe("SupabaseRealtimePort", () => {
  it("joins only the published metadata table with store filter and resyncs on each subscription", async () => {
    const input = makeInput();
    const fake = makeFakeClient();
    const stop = new SupabaseRealtimePort(fake.client).startStoreInvalidation(input);
    await vi.waitFor(() => expect(fake.channel.subscribe).toHaveBeenCalledTimes(1));
    expect(fake.setAuth).toHaveBeenCalledWith("fixture-token");
    expect(fake.channel.on).toHaveBeenCalledTimes(1);
    expect(fake.channel.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "store_change_signals", filter: "store_id=eq.store-1",
    }, expect.any(Function));
    fake.status("SUBSCRIBED");
    fake.status("CHANNEL_ERROR");
    fake.status("SUBSCRIBED");
    for (const callback of [input.invalidateOpenOrders, input.invalidateFloorPlan, input.invalidateReport, input.invalidateMenu])
      expect(callback).toHaveBeenCalledTimes(2);
    stop();
    fake.status("SUBSCRIBED");
    fake.signal("orders");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(2);
    expect(fake.client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("maps committed order/menu/floor/report topics and rejects foreign or malformed metadata", async () => {
    const input = makeInput();
    const fake = makeFakeClient();
    new SupabaseRealtimePort(fake.client).startStoreInvalidation(input);
    await vi.waitFor(() => expect(fake.channel.subscribe).toHaveBeenCalledTimes(1));
    fake.signal("orders");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(1);
    expect(input.invalidateFloorPlan).toHaveBeenCalledTimes(1);
    expect(input.invalidateReport).toHaveBeenCalledTimes(1);
    fake.signal("menu");
    expect(input.invalidateMenu).toHaveBeenCalledTimes(1);
    fake.signal("floor");
    expect(input.invalidateFloorPlan).toHaveBeenCalledTimes(2);
    fake.signal("report");
    expect(input.invalidateReport).toHaveBeenCalledTimes(2);
    fake.signal("menu", { store_id: "store-2" });
    fake.signal("menu", { revision: Number.MAX_SAFE_INTEGER + 1 });
    fake.signal("menu", { event_id: null });
    fake.signal("unknown");
    expect(input.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a channel whose asynchronous removal is still pending", () => {
    const fake = makeFakeClient();
    const port = new SupabaseRealtimePort(fake.client);
    const stop = port.startStoreInvalidation(makeInput());
    stop();
    port.startStoreInvalidation(makeInput());
    expect(fake.topics()).toHaveLength(2);
    expect(fake.topics()[0]).not.toBe(fake.topics()[1]);
  });
});
