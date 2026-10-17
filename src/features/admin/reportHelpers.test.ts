import { describe, expect, it } from "vitest";
import type { CoreReport } from "@/domain";
import type { ReportOrderSummary } from "@/ports/permissions";
import { buildReportDatasetFromReports } from "./reportHelpers";

describe("buildReportDatasetFromReports", () => {
  it("combines report totals and paid order rows", () => {
    const reports: CoreReport[] = [
      {
        businessDate: "2026-06-20",
        revenue: 100_000,
        paidOrders: 2,
        averageTicket: 50_000,
        topItemName: "Latte",
        hourlyRevenue: [{ label: "09", revenue: 100_000 }],
        voidCount: 1,
        voidAmount: 20_000,
      },
      {
        businessDate: "2026-06-21",
        revenue: 50_000,
        paidOrders: 1,
        averageTicket: 50_000,
        topItemName: "Latte",
        hourlyRevenue: [{ label: "10", revenue: 50_000 }],
        voidCount: 2,
        voidAmount: 30_000,
      },
    ];
    const orders: ReportOrderSummary[] = [
      {
        id: "ord-1",
        orderNo: 1,
        status: "paid",
        total: 100_000,
        orderType: "dine_in",
        businessDate: "2026-06-21",
        tableName: "B01",
      },
    ];

    const dataset = buildReportDatasetFromReports(
      reports,
      ["2026-06-20", "2026-06-21"],
      orders,
    );

    expect(dataset.revenue).toBe(150_000);
    expect(dataset.paidOrders).toBe(3);
    expect(dataset.avgTicket).toBe(50_000);
    expect(dataset.topItemName).toBe("Latte");
    expect(dataset.voidCount).toBe(3);
    expect(dataset.voidAmount).toBe(50_000);
    expect(dataset.orders).toEqual([
      { id: "ord-1", orderNo: 1, time: "21/06/2026", table: "B01", total: 100_000, method: "paid" },
    ]);
  });

  it("consumes the bounded report projection directly without floor or history fields", () => {
    const orders: ReportOrderSummary[] = Array.from({ length: 21 }, (_, index) => ({
      id: `ord-${index}`, orderNo: index + 1, status: "paid", total: 10_000,
      orderType: index === 0 ? "takeaway" : "dine_in", businessDate: "2026-06-21",
      tableName: index === 1 ? null : `B${index}`,
    }));
    const dataset = buildReportDatasetFromReports([], ["2026-06-21"], orders);
    expect(dataset.orders).toHaveLength(20);
    expect(dataset.orders[0].table).toBe("Mang đi");
    expect(dataset.orders[1].table).toBe("Tại bàn");
  });
});
