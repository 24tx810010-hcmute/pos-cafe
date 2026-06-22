import type { QueryClient } from "@tanstack/react-query";
import { posQueryKeys } from "@/features/shared/queryKeys";
import type { AppPorts, RealtimeInvalidationInput } from "@/ports";

export const createRealtimeInvalidationInput = (
  queryClient: QueryClient,
  storeId: string,
): RealtimeInvalidationInput => ({
  storeId,
  invalidateMenu: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.menu });
    void queryClient.refetchQueries({ queryKey: posQueryKeys.menu, type: "active" });
  },
  invalidateFloorPlan: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan });
    void queryClient.refetchQueries({ queryKey: posQueryKeys.floorPlan, type: "active" });
  },
  invalidateOpenOrders: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot });
    void queryClient.refetchQueries({ queryKey: posQueryKeys.ordersRoot, type: "active" });
  },
  invalidateReport: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot });
    void queryClient.refetchQueries({ queryKey: posQueryKeys.reportsRoot, type: "active" });
  },
});

export const startRealtimeInvalidation = (
  ports: AppPorts,
  queryClient: QueryClient,
  storeId: string,
): (() => void) => ports.realtime.startStoreInvalidation(createRealtimeInvalidationInput(queryClient, storeId));
