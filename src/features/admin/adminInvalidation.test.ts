import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  invalidateAfterClearDemoData,
  invalidateAfterEmployeeMutation,
  invalidateAfterFloorPlanMutation,
  invalidateAfterMenuMutation,
  invalidateAfterSettingsMutation,
} from "./adminInvalidation";
import { adminQueryKeys } from "./adminQueryKeys";

const createQueryClientDouble = (): QueryClient =>
  ({
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  }) as unknown as QueryClient;

describe("adminInvalidation", () => {
  it("invalidates focused admin query surfaces after single-surface mutations", async () => {
    const queryClient = createQueryClientDouble();

    await invalidateAfterEmployeeMutation(queryClient);
    await invalidateAfterSettingsMutation(queryClient);
    await invalidateAfterMenuMutation(queryClient);
    await invalidateAfterFloorPlanMutation(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.employees });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.settings });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.menu });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.floorPlan });
  });

  it("invalidates every admin and POS surface affected by clearing demo data", async () => {
    const queryClient = createQueryClientDouble();

    await invalidateAfterClearDemoData(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.employees });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.settings });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.menu });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: adminQueryKeys.floorPlan });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["orders"] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["report"] });
  });
});
