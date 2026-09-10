import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterOrderMutation } from "./posInvalidation";
import { posQueryKeys } from "@/features/shared/queryKeys";

describe("posInvalidation", () => {
  it("invalidates every server-state surface affected by an order mutation", async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      refetchQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;

    await invalidateAfterOrderMutation(queryClient, "7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.ordersRoot,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.floorPlan,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.reportsRoot,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.order("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c"),
    });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.openOrders,
      type: "active",
    });
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({
      queryKey: posQueryKeys.floorPlan,
      type: "active",
    });
  });
});
