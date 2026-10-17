import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStoreInput } from "@/domain";
import { AppError } from "@/core/appError";
import { usePorts, usePermissionPorts } from "@/features/shared/portsContext";
import {
  createStoreForSession,
  loadStoreSession,
  pairStoreForSession,
  retrySeedForSession,
  unpairStoreSession,
  verifyEmployeeForSession,
} from "./sessionFlow";
import { assertCompatibilityCurrent } from "@/features/shared/permissionSession";

export const sessionQueryKeys = {
  storeSession: ["session", "store"] as const,
  employees: ["employees"] as const,
};

export const useStoreSessionQuery = () => {
  const ports = usePorts();

  return useQuery({
    queryKey: sessionQueryKeys.storeSession,
    queryFn: () => loadStoreSession(ports),
  });
};

export const useActiveEmployeesQuery = () => {
  const ports = usePermissionPorts();
  const store = useStoreSessionQuery();

  return useQuery({
    queryKey: [...sessionQueryKeys.employees, "roster", store.data?.session?.storeId ?? null],
    queryFn: () => ports.authority.listRoster(),
    enabled: store.data?.status === "paired",
    staleTime: 0,
    refetchOnMount: "always",
  });
};

export const usePairStoreMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (storeKey: string) => pairStoreForSession(ports, storeKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.storeSession });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.employees });
    },
  });
};

export const useCreateStoreMutation = (onCreated?: (store: Awaited<ReturnType<typeof createStoreForSession>>["store"]) => void) => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (input: CreateStoreInput) => {
      return createStoreForSession(ports, input, onCreated);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.storeSession });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.employees });
    },
  });
};

export const useRetrySeedMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async () => {
      assertCompatibilityCurrent();
      const bootstrap = await loadStoreSession(ports);

      if (bootstrap.status === "unpaired") {
        throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
      }

      assertCompatibilityCurrent(); await retrySeedForSession(ports, bootstrap.session);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
};

export const useVerifyEmployeeMutation = () => {
  const ports = usePorts();

  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: ({ employeeId, pin }: { employeeId: string; pin: string }) =>
      verifyEmployeeForSession(ports, employeeId, pin),
  });
};

export const useUnpairStoreMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => unpairStoreSession(ports),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
