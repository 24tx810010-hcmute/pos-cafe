import { describe, expect, it } from "vitest";
import { createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import { AppError } from "@/core/appError";
import type { Employee } from "@/domain";
import { submitOrderAndPrint, voidPaidOrder } from "./orderFlow";

// 3f6c6266-12b8-4f8b-8564-44d00d9210f8: đơn đã thanh toán, businessDate 2026-06-11, total 77000, lockVersion 2.
const PAID_ORDER_ID = "3f6c6266-12b8-4f8b-8564-44d00d9210f8";
const BUSINESS_DATE = "2026-06-11";

describe("voidPaidOrder flow", () => {
  it("voids a paid order without touching money-facing fields", async () => {
    const { business: state, ports, legacyPorts, actor: adminActor } = await createCandidateRuntimeFixture();
    const before = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    const result = await voidPaidOrder(ports, {
      actor: adminActor,
      order: before,
      reasonCode: "wrong_order",
      reasonNote: "",
    });

    expect(result.status).toBe("void");
    expect(result.lockVersion).toBe(before.lockVersion + 1);

    const after = await legacyPorts.order.getOrder(PAID_ORDER_ID);
    expect(after.status).toBe("void");
    expect(after.total).toBe(before.total);
    expect(after.orderNo).toBe(before.orderNo);
    expect(after.paidAt).toBe(before.paidAt);
    expect(after.payment).not.toBeNull();
    expect(after.voidedByEmployeeId).toBe(adminActor.id);
    expect(after.voidReasonCode).toBe("wrong_order");
  });

  it("blocks a cashier without the permission and leaves the order paid", async () => {
    const { ports, legacyPorts, actor: cashierActor } = await createCandidateRuntimeFixture({ role: "cashier" });
    const order = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    await expect(
      voidPaidOrder(ports, { actor: cashierActor, order, reasonCode: "duplicate", reasonNote: "" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const after = await legacyPorts.order.getOrder(PAID_ORDER_ID);
    expect(after.status).toBe("paid");
  });

  it("allows a cashier that has been granted order.voidPaid", async () => {
    const fixture = await createCandidateRuntimeFixture({ role: "cashier" });
    const { ports, legacyPorts, actor: empowered } = fixture;
    fixture.state.employees.find(employee => employee.id === empowered.id)!.overrides = { grants: ["order.voidPaid"], denies: [] };
    const order = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    const result = await voidPaidOrder(ports, {
      actor: empowered,
      order,
      reasonCode: "customer_request",
      reasonNote: "",
    });
    expect(result.status).toBe("void");
  });

  it("requires a note when reason is other, without calling the repo", async () => {
    const { ports, legacyPorts, actor: adminActor } = await createCandidateRuntimeFixture();
    const order = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    await expect(
      voidPaidOrder(ports, { actor: adminActor, order, reasonCode: "other", reasonNote: "   " }),
    ).rejects.toMatchObject({ code: "VOID_REASON_REQUIRED" });

    const after = await legacyPorts.order.getOrder(PAID_ORDER_ID);
    expect(after.status).toBe("paid");
  });

  it("rejects a stale lock version and a double void", async () => {
    const { ports, legacyPorts, actor: adminActor } = await createCandidateRuntimeFixture();
    const order = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    await expect(
      voidPaidOrder(ports, {
        actor: adminActor,
        order: { ...order, lockVersion: order.lockVersion - 1 },
        reasonCode: "wrong_order",
        reasonNote: "",
      }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });

    await voidPaidOrder(ports, { actor: adminActor, order, reasonCode: "wrong_order", reasonNote: "" });

    // Đơn đã void: dùng lại lockVersion cũ -> conflict.
    await expect(
      voidPaidOrder(ports, { actor: adminActor, order, reasonCode: "wrong_order", reasonNote: "" }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
  });

  it("removes the voided order from revenue and moves it into void stats", async () => {
    const { ports, legacyPorts, actor: adminActor } = await createCandidateRuntimeFixture();
    const order = await legacyPorts.order.getOrder(PAID_ORDER_ID);

    const reportBefore = await legacyPorts.report.getCoreReport({ businessDate: BUSINESS_DATE });
    expect(reportBefore.revenue).toBe(order.total);
    expect(reportBefore.paidOrders).toBe(1);
    expect(reportBefore.voidCount).toBe(0);

    await voidPaidOrder(ports, { actor: adminActor, order, reasonCode: "wrong_order", reasonNote: "" });

    const reportAfter = await legacyPorts.report.getCoreReport({ businessDate: BUSINESS_DATE });
    expect(reportAfter.revenue).toBe(0);
    expect(reportAfter.paidOrders).toBe(0);
    expect(reportAfter.voidCount).toBe(1);
    expect(reportAfter.voidAmount).toBe(order.total);

    const paidPage = await legacyPorts.order.listOrderHistory({
      fromDate: BUSINESS_DATE,
      toDate: BUSINESS_DATE,
      page: 1,
      pageSize: 20,
      status: "paid",
    });
    expect(paidPage.items.some((row) => row.id === PAID_ORDER_ID)).toBe(false);

    const voidPage = await legacyPorts.order.listOrderHistory({
      fromDate: BUSINESS_DATE,
      toDate: BUSINESS_DATE,
      page: 1,
      pageSize: 20,
      status: "void",
    });
    expect(voidPage.items.some((row) => row.id === PAID_ORDER_ID)).toBe(true);
  });

  it("does not count an open order voided before payment in void stats", async () => {
    const { ports, legacyPorts, actor: adminActor } = await createCandidateRuntimeFixture();
    // 7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c: đơn đang mở trên bàn (businessDate 2026-06-11). Hủy bằng submit rỗng.
    const open = await legacyPorts.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    await submitOrderAndPrint(ports, { context: { orderId: open.id, tableId: open.tableId, orderType: open.orderType },
      actor: adminActor, expectedVersion: open.lockVersion, items: [] });;

    const voided = await legacyPorts.order.getOrder("7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c");
    expect(voided.status).toBe("void");
    expect(voided.paidAt).toBeNull();

    const report = await legacyPorts.report.getCoreReport({ businessDate: BUSINESS_DATE });
    expect(report.voidCount).toBe(0);
    expect(report.voidAmount).toBe(0);
  });
});
