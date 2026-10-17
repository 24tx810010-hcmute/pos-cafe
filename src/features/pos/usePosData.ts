import { useQueries, useQuery } from "@tanstack/react-query";
import type { OrderHistoryFilter, ReportFilter } from "@/domain";
import type { PermissionCode } from "@/domain/permissions";
import type { ReportSummaryFilter } from "@/ports/permissions";
import { usePermissionPorts } from "@/features/shared/portsContext";
import { permissionQueryKey, permissionRead, sessionHasPermission, usePermissionSession } from "@/features/shared/permissionSession";

export function usePurposeQuery<T>(purpose: string, codes: readonly PermissionCode[], args: unknown[], read: () => Promise<T>, enabled = true, live = false) {
  const session = usePermissionSession();
  return useQuery({
    queryKey: permissionQueryKey(purpose, ...args), queryFn: () => permissionRead(codes, read),
    enabled: enabled && session.status === "verified" && !!session.bundle && (codes.length === 0 || codes.some(code => sessionHasPermission(code, session))),
    refetchInterval: live ? 5_000 : false, refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
}
const useOperationalFloor = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("floor", ["floor.view"], [], () => ports.read.getFloorOperational(), true, true);
};
export const useMenuQuery = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("pos-menu", ["order.create", "order.update"], [], () => ports.read.getPosMenu());
};
export const useFloorPlanQuery = () => { const query = useOperationalFloor(); return { ...query, data: query.data?.floorPlan }; };
export const useOpenOrdersQuery = () => { const query = useOperationalFloor(); return { ...query, data: query.data?.openOrders }; };
export const useTakeawayOpenOrdersQuery = () => {
  const query = useOperationalFloor(); return { ...query, data: query.data?.openOrders.filter(order => order.orderType === "takeaway") };
};
export const useOrderDetailQuery = (orderId: string | null) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("open-order", ["order.update", "order.voidOpen", "payment.take"], [orderId], () => ports.read.getOpenOrderDetail(orderId!), !!orderId, true);
};
export const useOrderHistoryDetailQuery = (orderId: string | null) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("history-detail", ["orderHistory.view"], [orderId], () => ports.read.getOrderHistoryDetail(orderId!), !!orderId);
};
export const useOrderHistoryQuery = (filter: OrderHistoryFilter) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("history", ["orderHistory.view"], [filter], () => ports.read.listOrderHistory(filter));
};
export const useCoreReportQuery = (filter: ReportFilter) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("report", ["report.view"], [filter], () => ports.read.getSalesReport(filter));
};
export const useCoreReportsQuery = (filters: ReportFilter[]) => {
  const ports = usePermissionPorts(), session = usePermissionSession();
  return useQueries({ queries: filters.map(filter => ({
    queryKey: permissionQueryKey("report", filter), queryFn: () => permissionRead(["report.view"], () => ports.read.getSalesReport(filter)),
    enabled: sessionHasPermission("report.view", session), refetchOnWindowFocus: false, refetchOnReconnect: false,
  })) });
};
export const useReportOrdersQuery = (filter: ReportSummaryFilter) => {
  const ports = usePermissionPorts();
  return usePurposeQuery("report-orders", ["report.view"], [filter], () => ports.read.listReportOrders(filter));
};
export const useStoreDisplayQuery = () => {
  const ports = usePermissionPorts();
  return usePurposeQuery("display", [], [], () => ports.read.getStoreDisplay());
};
