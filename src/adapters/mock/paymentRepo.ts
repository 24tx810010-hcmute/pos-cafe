import type { IPaymentRepo } from "@/ports";
import type { PayOrderInput, PayOrderResult, PrintReceipt } from "@/domain";
import { AppError } from "@/core/appError";
import type { MockState } from "./mockState";
import { makeTicket } from "./mockRepoShared";

export class MockPaymentRepo implements IPaymentRepo {
  constructor(private readonly state: MockState) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const order = this.state.orders.find((candidate) => candidate.id === input.orderId);

    if (!order || order.status !== "open" || order.lockVersion !== input.expectedVersion) {
      throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
    }

    if (input.receivedAmount < order.total) {
      throw new AppError("PAYMENT_AMOUNT_TOO_LOW", "Tiền khách đưa nhỏ hơn tổng tiền.");
    }

    order.status = "paid";
    order.lockVersion += 1;
    order.paidAt = new Date().toISOString();
    order.payment = {
      id: input.paymentId,
      employeeId: input.employeeId,
      method: input.method,
      amount: order.total,
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - order.total,
      paidAt: order.paidAt,
    };
    if (order.tableId) {
      const table = this.state.floorPlan.tables.find((candidate) => candidate.id === order.tableId);
      if (table) {
        table.status = "empty";
      }
    }

    const receipt: PrintReceipt = {
      ...makeTicket(order, this.state.floorPlan),
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - order.total,
      paidAt: order.paidAt,
    };
    this.state.lastReceipt = receipt;

    return {
      orderId: order.id,
      paymentId: input.paymentId,
      status: "paid",
      total: order.total,
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - order.total,
      lockVersion: order.lockVersion,
      receipt,
    };
  }
}
