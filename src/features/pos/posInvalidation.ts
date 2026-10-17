import type { QueryClient } from "@tanstack/react-query";
import { posQueryKeys } from "@/features/shared/queryKeys";
import { invalidatePermissionPurposes } from "@/features/shared/permissionSession";

export const invalidateAfterOrderMutation = async (
  queryClient: QueryClient,
  orderId?: string | null,
): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["floor", "open-order", "history", "history-detail", "report", "report-orders"]);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot }),
    orderId ? queryClient.invalidateQueries({ queryKey: posQueryKeys.order(orderId) }) : Promise.resolve(),
  ]);

  await Promise.all([
    queryClient.refetchQueries({ queryKey: posQueryKeys.openOrders, type: "active" }),
    queryClient.refetchQueries({ queryKey: posQueryKeys.floorPlan, type: "active" }),
  ]);
};

export const invalidateAfterCatalogMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["pos-menu", "menu-admin"]);
  await queryClient.invalidateQueries({ queryKey: posQueryKeys.menu });
};

export const invalidateAfterFloorPlanMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["floor", "floor-admin"]);
  await queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan });
};
