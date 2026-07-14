import { describe, expect, it } from "vitest";
import type { CoreReport, OrderSummary } from "@/domain";
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
      },
      {
        businessDate: "2026-06-21",
        revenue: 50_000,
        paidOrders: 1,
        averageTicket: 50_000,
        topItemName: "Latte",
        hourlyRevenue: [{ label: "10", revenue: 50_000 }],
      },
    ];
    const orders: OrderSummary[] = [
      {
        id: "ord-1",
        orderNo: 1,
        status: "paid",
        total: 100_000,
        lockVersion: 1,
        tableId: "tbl-1",
        orderType: "dine_in",
        businessDate: "2026-06-21",
      },
    ];

    const dataset = buildReportDatasetFromReports(
      reports,
      ["2026-06-20", "2026-06-21"],
      orders,
      new Map([["tbl-1", "B01"]]),
    );

    expect(dataset.revenue).toBe(150_000);
    expect(dataset.paidOrders).toBe(3);
    expect(dataset.avgTicket).toBe(50_000);
    expect(dataset.topItemName).toBe("Latte");
    expect(dataset.orders).toEqual([
      { id: "ord-1", orderNo: 1, time: "21/06/2026", table: "B01", total: 100_000, method: "paid" },
    ]);
  });
});
