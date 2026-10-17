import { QueryClient, QueryObserver } from "@tanstack/react-query";
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
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    removeQueries: vi.fn(),
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

  it("removes inactive editor snapshots and refreshes active data after clear or seed", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const menu = ["permission", "store", "owner", 1, "menu-admin"];
    const floor = ["permission", "store", "owner", 1, "floor"];
    client.setQueryData(menu, { categories: ["deleted-demo"] });
    client.setQueryData(floor, { tables: ["deleted-demo"] });
    const observer = new QueryObserver(client, { queryKey: floor, queryFn: async () => ({ tables: ["custom"] }) });
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await invalidateAfterClearDemoData(client);
      expect(client.getQueryData(menu)).toBeUndefined();
      expect(client.getQueryData(floor)).toEqual({ tables: ["custom"] });
    } finally { unsubscribe(); client.clear(); }
  });
});
