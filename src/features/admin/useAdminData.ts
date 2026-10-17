import type { ReportFilter } from "@/domain";
import { usePermissionPorts } from "@/features/shared/portsContext";
import { usePurposeQuery } from "@/features/pos/usePosData";

export const useAdminEmployeesQuery = (enabled = true) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("employees", ["employee.manage", "employee.permission.edit"], [], () => ports.employeeAdmin.listEmployees(), enabled);
};
export const useStoreSettingsQuery = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("settings", ["settings.manage"], [], () => ports.read.getSettingsAdmin());
};
export const useAdminMenuQuery = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("menu-admin", ["menu.manage"], [], () => ports.read.getMenuAdmin());
};
export const useAdminFloorPlanQuery = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("floor-admin", ["floor.manage"], [], () => ports.read.getFloorAdmin());
};
export const useAdminReportQuery = (filter: ReportFilter) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("report", ["report.view"], [filter], () => ports.read.getSalesReport(filter));
};
