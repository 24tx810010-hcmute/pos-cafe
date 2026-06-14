import { useQueries, useQuery } from "@tanstack/react-query";
import type { OrderHistoryFilter, ReportFilter } from "@/domain";
import { posQueryKeys } from "@/features/shared/queryKeys";
import { usePorts } from "@/ports/portsContext";

export const useMenuQuery = () => {
  const ports = usePorts();
  return useQuery({ queryKey: posQueryKeys.menu, queryFn: () => ports.menu.getMenu() });
};

export const useFloorPlanQuery = () => {
  const ports = usePorts();
  return useQuery({ queryKey: posQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
};

export const useOpenOrdersQuery = () => {
  const ports = usePorts();
  return useQuery({ queryKey: posQueryKeys.openOrders, queryFn: () => ports.order.listOpenOrders() });
};

export const useTakeawayOpenOrdersQuery = () => {
  const ports = usePorts();
  return useQuery({
    queryKey: posQueryKeys.takeawayOpenOrders,
    queryFn: () => ports.order.listTakeawayOpenOrders(),
  });
};

export const useOrderDetailQuery = (orderId: string | null) => {
  const ports = usePorts();
  return useQuery({
    queryKey: posQueryKeys.order(orderId),
    queryFn: () => ports.order.getOrder(orderId!),
    enabled: !!orderId,
  });
};

export const useOrderHistoryQuery = (filter: OrderHistoryFilter) => {
  const ports = usePorts();
  return useQuery({
    queryKey: posQueryKeys.orderHistory(filter.fromDate, filter.toDate, filter.page, filter.pageSize),
    queryFn: () => ports.order.listOrderHistory(filter),
  });
};

export const useCoreReportQuery = (filter: ReportFilter) => {
  const ports = usePorts();
  return useQuery({
    queryKey: posQueryKeys.report(filter.businessDate),
    queryFn: () => ports.report.getCoreReport(filter),
  });
};

export const useCoreReportsQuery = (filters: ReportFilter[]) => {
  const ports = usePorts();
  return useQueries({
    queries: filters.map((filter) => ({
      queryKey: posQueryKeys.report(filter.businessDate),
      queryFn: () => ports.report.getCoreReport(filter),
    })),
  });
};
