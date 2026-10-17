import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppError } from "@/core/appError";
import type {
  EmployeeAdminCreateRequest,
  EmployeeAdminUpdateRequest,
  EmployeePinResetRequest,
  OwnerPinChangeRequest,
} from "@/domain/permissions";
import {
  permissionQueryKey,
  permissionRead,
  assertCompatibilityCurrent,
  usePermissionSession,
} from "@/features/shared/permissionSession";
import { usePermissionPorts } from "@/features/shared/portsContext";

const unwrap = <T>(
  result: import("@/domain/permissions").EmployeeAdminEnvelope<T>,
): T => {
  if (!result.ok)
    throw new AppError(
      result.error.code,
      result.error.message,
      result.error.details ?? undefined,
    );
  return result.data;
};

export function usePermissionEmployees(enabled: boolean) {
  const ports = usePermissionPorts();
  return useQuery({
    queryKey: permissionQueryKey("employees"),
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () =>
      permissionRead(["employee.manage", "employee.permission.edit"], () =>
        ports.employeeAdmin.listEmployees(),
      ),
  });
}

export function usePermissionEmployeeMutations() {
  const ports = usePermissionPorts(),
    client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: permissionQueryKey("employees") });
  const create = useMutation({
    mutationFn: async (request: EmployeeAdminCreateRequest) => {
      assertCompatibilityCurrent(); return unwrap(await ports.employeeAdmin.createEmployee(request));
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async (request: EmployeeAdminUpdateRequest) => {
      assertCompatibilityCurrent(); return unwrap(await ports.employeeAdmin.updateEmployee(request));
    },
    onSuccess: refresh,
  });
  const resetPin = useMutation({
    mutationFn: async (request: EmployeePinResetRequest) => {
      assertCompatibilityCurrent(); return unwrap(await ports.employeeAdmin.resetPin(request));
    },
    onSuccess: refresh,
  });
  const changeOwnPin = useMutation({
    mutationFn: (request: OwnerPinChangeRequest) => {
      assertCompatibilityCurrent(); return ports.session.changeOwnPin(request);
    },
  });
  return { create, update, resetPin, changeOwnPin };
}

export const useCurrentPermissionBundle = () =>
  usePermissionSession((state) => state.bundle);
