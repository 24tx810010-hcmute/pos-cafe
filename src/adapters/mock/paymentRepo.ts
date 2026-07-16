import type { IPaymentRepo } from "@/ports";
import type {
  OrderDetail,
  OrderItemSnapshot,
  PayOrderInput,
  PayOrderItemsInput,
  PayOrderItemsResult,
  PayOrderResult,
  PrintReceipt,
  PrintTicket,
} from "@/domain";
import { AppError } from "@/core/appError";
import { calculateSnapshotTotal } from "@/core/orderDraft";
import type { MockState } from "./mockState";
import { makeTicket } from "./mockRepoShared";

const itemUnitTotal = (item: OrderItemSnapshot): number =>
  item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta * option.quantity, 0);

export class MockPaymentRepo implements IPaymentRepo {
  constructor(private readonly state: MockState) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const order = this.requireOpenOrder(input.orderId, input.expectedVersion);

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
    this.freeTable(order.tableId);

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

  /**
   * Instant pay: tách các món được chọn ra một ĐƠN MỚI độc lập và thanh toán ngay.
   * Quy tắc đánh số: bill trả trước mang số nhỏ hơn — đơn tách KẾ THỪA orderNo của
   * đơn gốc, đơn gốc (phần còn lại trên bàn) nhận orderNo mới.
   */
  async payOrderItems(input: PayOrderItemsInput): Promise<PayOrderItemsResult> {
    const source = this.requireOpenOrder(input.orderId, input.expectedVersion);

    if (input.items.length === 0) {
      throw new AppError("INVALID_ORDER_ITEMS", "Chưa chọn món để thanh toán.");
    }

    // Validate toàn bộ trước, không ghi dở dang (mô phỏng transaction của RPC).
    const seen = new Set<string>();
    for (const line of input.items) {
      if (seen.has(line.orderItemId)) {
        throw new AppError("INVALID_ORDER_ITEMS", "Món bị trùng trong danh sách thanh toán.");
      }
      seen.add(line.orderItemId);

      const item = source.items.find((candidate) => candidate.id === line.orderItemId);
      if (!item) {
        throw new AppError("INVALID_ORDER_ITEMS", "Món không còn trong đơn.");
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > item.quantity) {
        throw new AppError("INVALID_ORDER_ITEMS", "Số lượng thanh toán không hợp lệ.");
      }
    }

    const coversEverything = source.items.every(
      (item) => (input.items.find((line) => line.orderItemId === item.id)?.quantity ?? 0) === item.quantity,
    );
    if (coversEverything) {
      throw new AppError("INVALID_ORDER_ITEMS", "Chọn toàn bộ món thì thanh toán cả đơn (payOrder).");
    }

    const amount = input.items.reduce((sum, line) => {
      const item = source.items.find((candidate) => candidate.id === line.orderItemId)!;
      return sum + itemUnitTotal(item) * line.quantity;
    }, 0);

    if (input.receivedAmount < amount) {
      throw new AppError("PAYMENT_AMOUNT_TOO_LOW", "Tiền khách đưa nhỏ hơn tổng tiền.");
    }

    // Tách món: move nguyên dòng, hoặc tách dòng khi trả một phần số lượng.
    const movedItems: OrderItemSnapshot[] = [];
    for (const line of input.items) {
      const item = source.items.find((candidate) => candidate.id === line.orderItemId)!;
      if (line.quantity === item.quantity) {
        source.items = source.items.filter((candidate) => candidate.id !== item.id);
        movedItems.push(item);
      } else {
        item.quantity -= line.quantity;
        movedItems.push({
          ...item,
          id: line.splitItemId,
          quantity: line.quantity,
          options: item.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
        });
      }
    }

    const paidAt = new Date().toISOString();
    const splitOrder: OrderDetail = {
      id: input.newOrderId,
      tableId: source.tableId,
      orderType: source.orderType,
      // Bill trả trước giữ số của đơn gốc; đơn gốc nhận số mới.
      orderNo: source.orderNo,
      businessDate: source.businessDate,
      status: "paid",
      lockVersion: 0,
      paidAt,
      voidedAt: null,
      voidedByEmployeeId: null,
      voidReasonCode: null,
      voidReasonNote: null,
      total: amount,
      items: movedItems,
      payment: {
        id: input.paymentId,
        employeeId: input.employeeId,
        method: input.method,
        amount,
        receivedAmount: input.receivedAmount,
        changeAmount: input.receivedAmount - amount,
        paidAt,
      },
    };
    this.state.orders.push(splitOrder);

    source.orderNo = this.state.nextOrderNo++;
    source.total = calculateSnapshotTotal(source.items);
    source.lockVersion += 1;

    const receipt: PrintReceipt = {
      ...this.makeSplitTicket(splitOrder),
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - amount,
      paidAt,
    };
    this.state.lastReceipt = receipt;

    return {
      orderId: splitOrder.id,
      orderNo: splitOrder.orderNo,
      paymentId: input.paymentId,
      status: "paid",
      total: amount,
      receivedAmount: input.receivedAmount,
      changeAmount: input.receivedAmount - amount,
      receipt,
      sourceOrderId: source.id,
      sourceOrderNo: source.orderNo,
      sourceTotal: source.total,
      sourceLockVersion: source.lockVersion,
    };
  }

  private requireOpenOrder(orderId: string, expectedVersion: number): OrderDetail {
    const order = this.state.orders.find((candidate) => candidate.id === orderId);

    if (!order || order.status !== "open" || order.lockVersion !== expectedVersion) {
      throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
    }

    return order;
  }

  private freeTable(tableId: string | null): void {
    if (!tableId) return;
    const table = this.state.floorPlan.tables.find((candidate) => candidate.id === tableId);
    if (table) {
      table.status = "empty";
    }
  }

  private makeSplitTicket(order: OrderDetail): PrintTicket {
    return makeTicket(order, this.state.floorPlan);
  }
}
