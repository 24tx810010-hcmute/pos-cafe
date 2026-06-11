import { describe, expect, it } from "vitest";
import { createMockPorts } from "./mockRepos";

describe("mock repositories", () => {
  it("submits open order changes with expected lock version and rejects stale version", async () => {
    const ports = createMockPorts();
    const order = await ports.order.getOrder("ord-b02");
    const draft = order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note,
      options: item.options.map((option) => ({ id: option.id, optionValueId: option.optionValueId })),
    }));

    const result = await ports.order.submitOrderChanges({
      orderId: order.id,
      tableId: order.tableId,
      orderType: order.orderType,
      employeeId: "emp-admin",
      expectedVersion: order.lockVersion,
      items: draft,
    });

    expect(result.lockVersion).toBe(order.lockVersion + 1);

    await expect(
      ports.order.submitOrderChanges({
        orderId: order.id,
        tableId: order.tableId,
        orderType: order.orderType,
        employeeId: "emp-admin",
        expectedVersion: order.lockVersion,
        items: draft,
      }),
    ).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
  });

  it("blocks payment when received amount is lower than order total", async () => {
    const ports = createMockPorts();
    const order = await ports.order.getOrder("ord-b02");

    await expect(
      ports.payment.payOrder({
        paymentId: "payment-1",
        orderId: order.id,
        employeeId: "emp-admin",
        method: "cash",
        expectedVersion: order.lockVersion,
        receivedAmount: order.total - 1,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_TOO_LOW" });
  });

  it("voids an open order when all lines are removed through submitOrderChanges", async () => {
    const ports = createMockPorts();
    const order = await ports.order.getOrder("ord-b02");

    const result = await ports.order.submitOrderChanges({
      orderId: order.id,
      tableId: order.tableId,
      orderType: order.orderType,
      employeeId: "emp-admin",
      expectedVersion: order.lockVersion,
      items: [],
    });

    expect(result.status).toBe("void");
    expect(result.tableStatus).toBe("empty");
  });
});
