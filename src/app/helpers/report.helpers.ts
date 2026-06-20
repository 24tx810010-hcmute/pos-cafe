import type { CoreReport, OrderSummary } from "@/domain";
import { formatBusinessDate, shortBusinessDate, tableLabelForOrder } from "./history.helpers";

export type ReportRange = "today" | "7days" | "month" | "custom";
export type ReportSection = "overview" | "hourly" | "top" | "orders";

export interface RpHour { label: string; revenue: number; orders: number; }
export interface RpTopItem { name: string; qty: number; revenue: number; }
export interface RpOrder { id: string; orderNo: number; time: string; table: string; total: number; method: string; }
export interface RpDataset {
  revenue: number;
  paidOrders: number;
  avgTicket: number;
  topItemName: string;
  voidCount: number;
  hourly: RpHour[];
  topItems: RpTopItem[];
  orders: RpOrder[];
}

export function buildReportDatasetFromReports(
  reports: CoreReport[],
  reportDates: string[],
  orders: OrderSummary[],
  tables: Map<string, string>,
): RpDataset {
  const revenue = reports.reduce((sum, report) => sum + report.revenue, 0);
  const paidOrders = reports.reduce((sum, report) => sum + report.paidOrders, 0);
  const topCounts = new Map<string, { qty: number; revenue: number }>();

  for (const report of reports) {
    if (report.topItemName && report.topItemName !== "-") {
      const current = topCounts.get(report.topItemName) ?? { qty: 0, revenue: 0 };
      topCounts.set(report.topItemName, {
        qty: current.qty + 1,
        revenue: current.revenue + report.revenue,
      });
    }
  }

  const topItems: RpTopItem[] = [...topCounts.entries()]
    .map(([name, value]) => ({ name, qty: value.qty, revenue: value.revenue }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);

  const singleDay = reportDates.length === 1;
  const hourly: RpHour[] = singleDay
    ? (reports[0]?.hourlyRevenue ?? []).map((bucket) => ({
        label: bucket.label === "--" ? "--" : `${bucket.label}h`,
        revenue: bucket.revenue,
        orders: 0,
      }))
    : reports.map((report) => ({
        label: shortBusinessDate(report.businessDate),
        revenue: report.revenue,
        orders: report.paidOrders,
      }));

  return {
    revenue,
    paidOrders,
    avgTicket: paidOrders ? Math.round(revenue / paidOrders) : 0,
    topItemName: topItems[0]?.name ?? "-",
    voidCount: orders.filter((order) => order.status === "void").length,
    hourly,
    topItems,
    orders: orders
      .filter((order) => order.status === "paid")
      .slice(0, 20)
      .map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        time: formatBusinessDate(order.businessDate),
        table: tableLabelForOrder(order, tables),
        total: order.total,
        method: "paid",
      })),
  };
}
