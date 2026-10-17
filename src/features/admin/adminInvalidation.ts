import type { QueryClient } from "@tanstack/react-query";
import { posQueryKeys } from "@/features/shared/queryKeys";
import { adminQueryKeys } from "./adminQueryKeys";
import { invalidatePermissionPurposes } from "@/features/shared/permissionSession";

export const invalidateAfterEmployeeMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["employees"]);
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.employees });
};

export const invalidateAfterSettingsMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["settings", "display", "report"]);
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings });
};

export const invalidateAfterMenuMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["menu-admin", "pos-menu"]);
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.menu });
};

export const invalidateAfterFloorPlanMutation = async (queryClient: QueryClient): Promise<void> => {
  await invalidatePermissionPurposes(queryClient, ["floor-admin", "floor"]);
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.floorPlan });
};

export const invalidateAfterClearDemoData = async (queryClient: QueryClient): Promise<void> => {
  // Editors initialise a draft from their first result. An inactive stale cache
  // must not seed a new draft while its replacement is still being fetched.
  await queryClient.cancelQueries({ queryKey: ["permission"], type: "inactive" });
  queryClient.removeQueries({ queryKey: ["permission"], type: "inactive" });
  await queryClient.invalidateQueries({ queryKey: ["permission"] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.employees }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.menu }),
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.floorPlan }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.ordersRoot }),
    queryClient.invalidateQueries({ queryKey: posQueryKeys.reportsRoot }),
  ]);
};
