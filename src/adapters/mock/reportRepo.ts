import type { IReportRepo } from "@/ports";
import type { CoreReport, ReportFilter } from "@/domain";
import type { MockState } from "./mockState";

export class MockReportRepo implements IReportRepo {
  constructor(private readonly state: MockState) {}

  async getCoreReport(filter: ReportFilter): Promise<CoreReport> {
    const paidOrders = this.state.orders.filter((order) => order.status === "paid" && order.businessDate === filter.businessDate);
    // Đơn paid-rồi-hủy (paidAt not null): loại khỏi doanh thu, gom vào tổng hợp đơn hủy.
    const voidedPaidOrders = this.state.orders.filter(
      (order) => order.status === "void" && order.paidAt != null && order.businessDate === filter.businessDate,
    );
    const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const hourlyRevenue = new Map<string, number>();
    const topItems = new Map<string, number>();

    for (const order of paidOrders) {
      const paidAt = order.paidAt ? new Date(order.paidAt) : null;
      const label = paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.getHours().toString().padStart(2, "0") : "--";
      hourlyRevenue.set(label, (hourlyRevenue.get(label) ?? 0) + order.total);

      for (const item of order.items) {
        topItems.set(item.itemName, (topItems.get(item.itemName) ?? 0) + item.quantity);
      }
    }

    return {
      businessDate: filter.businessDate,
      revenue,
      paidOrders: paidOrders.length,
      averageTicket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      topItemName: [...topItems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-",
      hourlyRevenue: [...hourlyRevenue.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, revenue: value })),
      voidCount: voidedPaidOrders.length,
      voidAmount: voidedPaidOrders.reduce((sum, order) => sum + order.total, 0),
    };
  }
}
