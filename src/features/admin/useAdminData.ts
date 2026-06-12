import { useQuery } from "@tanstack/react-query";
import type { ReportFilter } from "@/domain";
import { usePorts } from "@/ports/portsContext";
import { adminQueryKeys } from "./adminQueryKeys";

export const useAdminEmployeesQuery = () => {
  const ports = usePorts();
  return useQuery({
    queryKey: adminQueryKeys.employees,
    queryFn: () => ports.employee.listActiveEmployees(),
  });
};

export const useStoreSettingsQuery = () => {
  const ports = usePorts();
  return useQuery({
    queryKey: adminQueryKeys.settings,
    queryFn: () => ports.settings.getSettings(),
  });
};

export const useAdminMenuQuery = () => {
  const ports = usePorts();
  return useQuery({
    queryKey: adminQueryKeys.menu,
    queryFn: () => ports.menu.getMenu(),
  });
};

export const useAdminFloorPlanQuery = () => {
  const ports = usePorts();
  return useQuery({
    queryKey: adminQueryKeys.floorPlan,
    queryFn: () => ports.floorPlan.getFloorPlan(),
  });
};

export const useAdminReportQuery = (filter: ReportFilter) => {
  const ports = usePorts();
  return useQuery({
    queryKey: adminQueryKeys.report(filter.businessDate),
    queryFn: () => ports.report.getCoreReport(filter),
  });
};
