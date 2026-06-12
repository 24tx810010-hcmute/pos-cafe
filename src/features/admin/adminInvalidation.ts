import type { QueryClient } from "@tanstack/react-query";
import { posQueryKeys } from "@/features/pos/posQueryKeys";
import { adminQueryKeys } from "./adminQueryKeys";

export const invalidateAfterEmployeeMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.employees });
};

export const invalidateAfterSettingsMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings });
};

export const invalidateAfterMenuMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.menu });
};

export const invalidateAfterFloorPlanMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.floorPlan });
};

export const invalidateAfterClearDemoData = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.employees }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.menu }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.floorPlan }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot }),
  ]);
};
