import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockPorts } from "@/adapters/mock";
import { posQueryKeys } from "@/features/pos/posQueryKeys";
import {
  createRealtimeInvalidationInput,
  startRealtimeInvalidation,
} from "./realtimeInvalidation";

const createQueryClientDouble = (): QueryClient =>
  ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }) as unknown as QueryClient;

describe("realtimeInvalidation", () => {
  it("builds focused invalidation handlers for realtime events", () => {
    const queryClient = createQueryClientDouble();
    const input = createRealtimeInvalidationInput(queryClient, "store-demo-001");

    input.invalidateMenu();
    input.invalidateFloorPlan();
    input.invalidateOpenOrders();
    input.invalidateReport();

    expect(input.storeId).toBe("store-demo-001");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.menu });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.floorPlan });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.ordersRoot });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.reportsRoot });
  });

  it("starts realtime invalidation through the realtime port and returns cleanup", () => {
    const ports = createMockPorts();
    const queryClient = createQueryClientDouble();
    const cleanup = vi.fn();
    const startSpy = vi.spyOn(ports.realtime, "startStoreInvalidation").mockReturnValue(cleanup);

    const returnedCleanup = startRealtimeInvalidation(ports, queryClient, "store-demo-001");

    expect(startSpy).toHaveBeenCalledOnce();
    expect(startSpy.mock.calls[0][0].storeId).toBe("store-demo-001");
    expect(returnedCleanup).toBe(cleanup);
  });
});
