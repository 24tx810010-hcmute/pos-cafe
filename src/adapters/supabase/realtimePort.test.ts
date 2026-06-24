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
  const handlers: Record<string, () => void> = {};
  let subscribeCb: ((status: string) => void) | undefined;

  const channel = {
    on: vi.fn((_event: string, config: { table: string }, handler: () => void) => {
      handlers[config.table] = handler;
      return channel;
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      subscribeCb = cb;
      return channel;
    }),
  };

  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };

  return {
    client: client as unknown as SupabaseAnyClient,
    fireStatus: (status: string) => subscribeCb?.(status),
    fireTable: (table: string) => handlers[table]?.(),
  };
};

describe("SupabaseRealtimePort", () => {
  it("resyncs every store query each time the channel (re)subscribes — self-heal after reconnect", () => {
    const input = makeInput();
    const fake = makeFakeClient();
    new SupabaseRealtimePort(fake.client).startStoreInvalidation(input);

    expect(input.invalidateOpenOrders).not.toHaveBeenCalled();

    fake.fireStatus("SUBSCRIBED");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(1);
    expect(input.invalidateFloorPlan).toHaveBeenCalledTimes(1);
    expect(input.invalidateReport).toHaveBeenCalledTimes(1);
    expect(input.invalidateMenu).toHaveBeenCalledTimes(1);

    // Reconnect fires SUBSCRIBED again -> resync again.
    fake.fireStatus("SUBSCRIBED");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(2);

    // Non-subscribed statuses do not resync.
    fake.fireStatus("CHANNEL_ERROR");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(2);
  });

  it("invalidates open orders + floor + report on an orders change, menu on a menu change", () => {
    const input = makeInput();
    const fake = makeFakeClient();
    new SupabaseRealtimePort(fake.client).startStoreInvalidation(input);

    fake.fireTable("orders");
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(1);
    expect(input.invalidateFloorPlan).toHaveBeenCalledTimes(1);
    expect(input.invalidateReport).toHaveBeenCalledTimes(1);
    expect(input.invalidateMenu).not.toHaveBeenCalled();

    fake.fireTable("menu_items");
    expect(input.invalidateMenu).toHaveBeenCalledTimes(1);
    expect(input.invalidateOpenOrders).toHaveBeenCalledTimes(1);
  });
});
