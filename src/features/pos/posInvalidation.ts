import type { QueryClient } from "@tanstack/react-query";
import { posQueryKeys } from "./posQueryKeys";

export const invalidateAfterOrderMutation = async (
  queryClient: QueryClient,
  orderId?: string | null,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot }),
    orderId ? queryClient.invalidateQueries({ queryKey: posQueryKeys.order(orderId) }) : Promise.resolve(),
  ]);
};

export const invalidateAfterCatalogMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: posQueryKeys.menu });
};

export const invalidateAfterFloorPlanMutation = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan });
};
