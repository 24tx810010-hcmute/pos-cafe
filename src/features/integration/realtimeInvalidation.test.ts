import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockPorts } from "@/adapters/mock";
import { posQueryKeys } from "@/features/shared/queryKeys";
import {
  createRealtimeInvalidationInput,
  startRealtimeInvalidation,
} from "./realtimeInvalidation";

const createQueryClientDouble = (): QueryClient =>
  ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  }) as unknown as QueryClient;

describe("realtimeInvalidation", () => {
  it("builds focused invalidation handlers for realtime events", () => {
    const queryClient = createQueryClientDouble();
    const input = createRealtimeInvalidationInput(queryClient, "e572ea5f-9adf-493c-8d84-dca3cd86e1eb");

    input.invalidateMenu();
    input.invalidateFloorPlan();
    input.invalidateOpenOrders();
    input.invalidateReport();

    expect(input.storeId).toBe("e572ea5f-9adf-493c-8d84-dca3cd86e1eb");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.menu });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.floorPlan });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.ordersRoot });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.reportsRoot });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.menu, type: "active" });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.floorPlan, type: "active" });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.ordersRoot, type: "active" });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: posQueryKeys.reportsRoot, type: "active" });
  });

  it("starts realtime invalidation through the realtime port and returns cleanup", () => {
    const ports = createMockPorts();
    const queryClient = createQueryClientDouble();
    const cleanup = vi.fn();
    const startSpy = vi.spyOn(ports.realtime, "startStoreInvalidation").mockReturnValue(cleanup);

    const returnedCleanup = startRealtimeInvalidation(ports, queryClient, "e572ea5f-9adf-493c-8d84-dca3cd86e1eb");

    expect(startSpy).toHaveBeenCalledOnce();
    expect(startSpy.mock.calls[0][0].storeId).toBe("e572ea5f-9adf-493c-8d84-dca3cd86e1eb");
    expect(returnedCleanup).toBe(cleanup);
  });
});
