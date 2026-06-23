import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/features/shared/portsContext";
import {
  clearDemoDataForAdmin,
  createEmployeeForAdmin,
  resetPinForAdmin,
  saveFloorPlanForAdmin,
  saveMenuForAdmin,
  seedDemoDataForAdmin,
  updateEmployeeForAdmin,
  updateSettingsForAdmin,
  type AdminActor,
  type CreateEmployeeForAdminInput,
  type ResetPinForAdminInput,
  type SaveFloorPlanForAdminInput,
  type SaveMenuForAdminInput,
  type UpdateEmployeeForAdminInput,
  type UpdateSettingsForAdminInput,
} from "./adminFlow";
import {
  invalidateAfterClearDemoData,
  invalidateAfterEmployeeMutation,
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

export const useCreateEmployeeMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<CreateEmployeeForAdminInput, "actor">) =>
      createEmployeeForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterEmployeeMutation(queryClient);
    },
  });
};

export const useUpdateEmployeeMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpdateEmployeeForAdminInput, "actor">) =>
      updateEmployeeForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterEmployeeMutation(queryClient);
    },
  });
};

export const useResetPinMutation = (actor: AdminActor) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<ResetPinForAdminInput, "actor">) =>
      resetPinForAdmin(ports, { ...input, actor }),
    onSuccess: async () => {
      await invalidateAfterEmployeeMutation(queryClient);
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
    mutationFn: () => clearDemoDataForAdmin(ports, { actor }),
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
