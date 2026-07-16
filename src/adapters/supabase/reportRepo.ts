
import type { IReportRepo } from "@/ports";
import type { CoreReport, ReportFilter } from "@/domain";
import { throwIfError } from "./errors";
import { emptyCoreReport, type Row } from "./mappers";
import type { SupabaseAnyClient } from "./repoShared";

export class SupabaseReportRepo implements IReportRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getCoreReport(filter: ReportFilter): Promise<CoreReport> {
    // Đơn paid-rồi-hủy (paid_at not null): loại khỏi doanh thu, gom vào tổng hợp đơn hủy.
    const { data: voidRows, error: voidError } = await this.client
      .from("orders")
      .select("total")
      .eq("status", "void")
      .not("paid_at", "is", null)
      .eq("business_date", filter.businessDate);
    throwIfError(voidError);
    const voidOrders = (voidRows ?? []) as Row[];
    const voidCount = voidOrders.length;
    const voidAmount = voidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

    const { data: orderRows, error } = await this.client
      .from("orders")
      .select("id,total,business_date,paid_at,created_at")
      .eq("status", "paid")
      .eq("business_date", filter.businessDate);
    throwIfError(error);

    const orders = (orderRows ?? []) as Row[];

    if (orders.length === 0) {
      return { ...emptyCoreReport(filter.businessDate), voidCount, voidAmount };
    }

    const orderIds = orders.map((order) => String(order.id));
    const revenue = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const hourlyRevenue = new Map<string, number>();

    for (const order of orders) {
      const paidAt = order.paid_at ?? order.created_at;
      const date = paidAt ? new Date(String(paidAt)) : null;
      const label = date && !Number.isNaN(date.getTime()) ? date.getHours().toString().padStart(2, "0") : "--";
      hourlyRevenue.set(label, (hourlyRevenue.get(label) ?? 0) + Number(order.total ?? 0));
    }

    const { data: itemRows, error: itemError } = await this.client
      .from("order_items")
      .select("order_id,item_name,quantity,status")
      .in("order_id", orderIds)
      .neq("status", "removed");
    throwIfError(itemError);

    const topItems = new Map<string, number>();
    for (const item of (itemRows ?? []) as Row[]) {
      const name = String(item.item_name ?? "-");
      topItems.set(name, (topItems.get(name) ?? 0) + Number(item.quantity ?? 0));
    }

    const topItemName =
      [...topItems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    return {
      businessDate: filter.businessDate,
      revenue,
      paidOrders: orders.length,
      averageTicket: Math.round(revenue / orders.length),
      topItemName,
      hourlyRevenue: [...hourlyRevenue.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, revenue: value })),
      voidCount,
      voidAmount,
    };
  }
}
