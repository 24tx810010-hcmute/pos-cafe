import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/features/shared/portsContext";
import {
  clearDemoDataForAdmin,
  saveFloorPlanForAdmin,
  saveMenuForAdmin,
  seedDemoDataForAdmin,
  updateSettingsForAdmin,
  type AdminActor,
  type SaveFloorPlanForAdminInput,
  type SaveMenuForAdminInput,
  type UpdateSettingsForAdminInput,
} from "./adminFlow";
import {
  invalidateAfterClearDemoData,
  invalidateAfterFloorPlanMutation,
  invalidateAfterMenuMutation,
  invalidateAfterSettingsMutation,
} from "./adminInvalidation";

export const useSaveMenuMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<SaveMenuForAdminInput, "actor">) =>
      saveMenuForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterMenuMutation(queryClient);
    },
  });
};

export const useSaveFloorPlanMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<SaveFloorPlanForAdminInput, "actor">) =>
      saveFloorPlanForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterFloorPlanMutation(queryClient);
    },
  });
};

export const useUpdateSettingsMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpdateSettingsForAdminInput, "actor">) =>
      updateSettingsForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterSettingsMutation(queryClient);
    },
  });
};

export const useClearDemoDataMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { requestId: string; confirmation: true }) => clearDemoDataForAdmin(ports, { actor, ...input }),
    onSuccess: async () => {
      await invalidateAfterClearDemoData(queryClient);
    },
  });
};

export const useSeedDemoDataMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => seedDemoDataForAdmin(ports, { actor }),
    onSuccess: async () => {
      await invalidateAfterClearDemoData(queryClient);
    },
  });
};
