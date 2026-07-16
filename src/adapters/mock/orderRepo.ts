import type { IOrderRepo } from "@/ports";
import type {
  OrderDetail,
  OrderHistoryFilter,
  OrderSummary,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
  VoidOrderInput,
  VoidOrderResult,
} from "@/domain";
import { AppError } from "@/core/appError";
import { requirePermission } from "@/core/guards";
import { calculateSnapshotTotal, snapshotDraftItems } from "@/core/orderDraft";
import { clone, getTodayBusinessDate, type MockState } from "./mockState";
import { makeTicket, toSummary } from "./mockRepoShared";

export class MockOrderRepo implements IOrderRepo {
  constructor(private readonly state: MockState) {}

  async listOpenOrders(): Promise<OrderSummary[]> {
    return this.state.orders.filter((order) => order.status === "open").map(toSummary);
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const order = this.state.orders.find((candidate) => candidate.id === orderId);

    if (!order) {
      throw new AppError("NOT_FOUND", "Không tìm thấy đơn.");
    }

    return clone(order);
  }

  async submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult> {
    const activeItems = input.items.filter((item) => item.quantity > 0);
    const existingOrder = input.orderId
      ? this.state.orders.find((candidate) => candidate.id === input.orderId)
      : null;

    if (existingOrder) {
      if (existingOrder.status !== "open" || existingOrder.lockVersion !== input.expectedVersion) {
        throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
      }

      if (activeItems.length === 0) {
        existingOrder.status = "void";
        existingOrder.items = [];
        existingOrder.total = 0;
        existingOrder.lockVersion += 1;
        if (existingOrder.tableId) {
          this.setTableStatus(existingOrder.tableId, "empty");
        }

        return {
          orderId: existingOrder.id,
          status: "void",
          tableId: existingOrder.tableId,
          tableStatus: existingOrder.tableId ? "empty" : null,
          orderNo: existingOrder.orderNo,
          businessDate: existingOrder.businessDate,
          lockVersion: existingOrder.lockVersion,
          ticket: null,
        };
      }

      existingOrder.items = snapshotDraftItems(this.state.menu, activeItems);
      existingOrder.total = calculateSnapshotTotal(existingOrder.items);
      existingOrder.lockVersion += 1;
      const ticket = makeTicket(existingOrder, this.state.floorPlan);
      this.state.lastTicket = ticket;
      return {
        orderId: existingOrder.id,
        status: "open",
        tableId: existingOrder.tableId,
        tableStatus: existingOrder.tableId ? "occupied" : null,
        orderNo: existingOrder.orderNo,
        businessDate: existingOrder.businessDate,
        lockVersion: existingOrder.lockVersion,
        ticket,
      };
    }

    if (activeItems.length === 0) {
      return {
        orderId: null,
        status: "void",
        tableId: input.tableId,
        tableStatus: null,
        orderNo: 0,
        businessDate: getTodayBusinessDate(),
        lockVersion: 0,
        ticket: null,
      };
    }

    const order: OrderDetail = {
      id: input.orderId ?? crypto.randomUUID(),
      tableId: input.tableId,
      orderType: input.orderType,
      orderNo: this.state.nextOrderNo++,
      businessDate: getTodayBusinessDate(),
      status: "open",
      lockVersion: 0,
      paidAt: null,
      payment: null,
      voidedAt: null,
      voidedByEmployeeId: null,
      voidReasonCode: null,
      voidReasonNote: null,
      total: 0,
      items: snapshotDraftItems(this.state.menu, activeItems),
    };
    order.total = calculateSnapshotTotal(order.items);
    this.state.orders.push(order);

    if (order.tableId) {
      this.setTableStatus(order.tableId, "occupied");
    }

    const ticket = makeTicket(order, this.state.floorPlan);
    this.state.lastTicket = ticket;
    return {
      orderId: order.id,
      status: "open",
      tableId: order.tableId,
      tableStatus: order.tableId ? "occupied" : null,
      orderNo: order.orderNo,
      businessDate: order.businessDate,
      lockVersion: order.lockVersion,
      ticket,
    };
  }

  async listTakeawayOpenOrders(): Promise<OrderSummary[]> {
    return this.state.orders
      .filter((order) => order.status === "open" && order.orderType === "takeaway")
      .map(toSummary);
  }

  async listOrderHistory(filter: OrderHistoryFilter): Promise<import("@/domain").OrderSummaryPage> {
    const from = Math.max(0, (filter.page - 1) * filter.pageSize);
    const search = filter.search?.trim().toLowerCase() ?? "";
    const tableIds = new Set(filter.tableIds ?? []);
    const items = this.state.orders
      .filter((order) => order.status !== "open")
      .filter((order) => order.businessDate >= filter.fromDate && order.businessDate <= filter.toDate)
      .filter((order) => !filter.status || order.status === filter.status)
      .filter((order) => !filter.orderType || order.orderType === filter.orderType)
      .filter((order) => {
        if (!search) return true;
        const haystack = [order.orderNo, order.id, order.tableId ?? "", order.orderType, order.status]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search) || (!!order.tableId && tableIds.has(order.tableId));
      })
      .sort((left, right) => (
        right.businessDate.localeCompare(left.businessDate) || right.orderNo - left.orderNo
      ))
      .map(toSummary);
    return { items: items.slice(from, from + filter.pageSize), total: items.length };
  }

  async voidOrder(input: VoidOrderInput): Promise<VoidOrderResult> {
    const employee = this.state.employees.find((candidate) => candidate.id === input.employeeId) ?? null;
    requirePermission(employee, "order.voidPaid");

    if (input.reasonCode === "other" && !input.reasonNote?.trim()) {
      throw new AppError("VOID_REASON_REQUIRED", "Vui lòng nhập lý do hủy.");
    }

    const order = this.state.orders.find((candidate) => candidate.id === input.orderId);
    if (!order) {
      throw new AppError("NOT_FOUND", "Không tìm thấy đơn.");
    }

    if (order.status !== "paid" || order.lockVersion !== input.expectedVersion) {
      throw new AppError("ORDER_VERSION_CONFLICT", "Dữ liệu đã thay đổi, vui lòng tải lại.");
    }

    // Giữ nguyên total/order_no/paidAt/payment/bàn; chỉ đổi status + ghi metadata hủy.
    order.status = "void";
    order.voidedAt = new Date().toISOString();
    order.voidedByEmployeeId = input.employeeId;
    order.voidReasonCode = input.reasonCode;
    order.voidReasonNote = input.reasonNote?.trim() || null;
    order.lockVersion += 1;

    return {
      orderId: order.id,
      status: "void",
      lockVersion: order.lockVersion,
      voidedAt: order.voidedAt,
    };
  }

  private setTableStatus(tableId: string, status: "empty" | "occupied"): void {
    const table = this.state.floorPlan.tables.find((candidate) => candidate.id === tableId);
    if (table) {
      table.status = status;
    }
  }
}
