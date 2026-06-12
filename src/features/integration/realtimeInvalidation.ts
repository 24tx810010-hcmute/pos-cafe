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
  },
  invalidateFloorPlan: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.floorPlan });
  },
  invalidateOpenOrders: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot });
  },
  invalidateReport: () => {
    void queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot });
  },
});

export const startRealtimeInvalidation = (
  ports: AppPorts,
  queryClient: QueryClient,
  storeId: string,
): (() => void) => ports.realtime.startStoreInvalidation(createRealtimeInvalidationInput(queryClient, storeId));
