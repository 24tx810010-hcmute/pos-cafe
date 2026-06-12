import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterOrderMutation } from "./posInvalidation";
import { posQueryKeys } from "@/features/shared/queryKeys";

describe("posInvalidation", () => {
  it("invalidates every server-state surface affected by an order mutation", async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;

    await invalidateAfterOrderMutation(queryClient, "ord-b02");

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
      queryKey: posQueryKeys.order("ord-b02"),
    });
  });
});
