import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStoreInput, Employee } from "@/domain";
import { AppError } from "@/core/appError";
import { usePorts } from "@/ports/portsContext";
import { useAppStore } from "@/app/useAppStore";
import {
  createStoreForSession,
  loadStoreSession,
  pairStoreForSession,
  retrySeedForSession,
  unpairStoreSession,
  verifyEmployeeForSession,
} from "./sessionFlow";

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

export const usePairStoreMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storeKey: string) => pairStoreForSession(ports, storeKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.storeSession });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKeys.employees });
    },
  });
};

export const useCreateStoreMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStoreInput) => createStoreForSession(ports, input),
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
    mutationFn: async () => {
      const bootstrap = await loadStoreSession(ports);

      if (bootstrap.status === "unpaired") {
        throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
      }

      await retrySeedForSession(ports, bootstrap.session);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
};

export const useVerifyEmployeeMutation = () => {
  const ports = usePorts();
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);

  return useMutation({
    mutationFn: ({ employeeId, pin }: { employeeId: string; pin: string }) =>
      verifyEmployeeForSession(ports, employeeId, pin),
    onSuccess: (employee: Employee) => {
      setCurrentEmployee(employee);
    },
  });
};

export const useUnpairStoreMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);

  return useMutation({
    mutationFn: () => unpairStoreSession(ports),
    onSuccess: () => {
      setCurrentEmployee(null);
      queryClient.clear();
    },
  });
};
