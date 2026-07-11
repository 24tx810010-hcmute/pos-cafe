
import type { IPaymentRepo } from "@/ports";
import type { PayOrderInput, PayOrderItemsInput, PayOrderItemsResult, PayOrderResult } from "@/domain";
import { requireData } from "./errors";
import { mapPayOrderItemsResult, mapPayOrderResult, type Row } from "./mappers";
import type { SupabaseAnyClient } from "./repoShared";

export class SupabasePaymentRepo implements IPaymentRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const { data, error } = await this.client.rpc("pay_order", {
      p_payment_id: input.paymentId || crypto.randomUUID(),
      p_order_id: input.orderId,
      p_employee_id: input.employeeId,
      p_method: input.method,
      p_expected_lock_version: input.expectedVersion,
      p_received_amount: input.receivedAmount,
    });
    return mapPayOrderResult(requireData<Row>(data as Row | null, error));
  }

  // RPC pay_order_items (migration 010): tách món được chọn ra đơn mới và thanh toán ngay.
  async payOrderItems(input: PayOrderItemsInput): Promise<PayOrderItemsResult> {
    const { data, error } = await this.client.rpc("pay_order_items", {
      p_payment_id: input.paymentId || crypto.randomUUID(),
      p_order_id: input.orderId,
      p_new_order_id: input.newOrderId,
      p_employee_id: input.employeeId,
      p_method: input.method,
      p_expected_lock_version: input.expectedVersion,
      p_received_amount: input.receivedAmount,
      p_items: input.items,
    });
    return mapPayOrderItemsResult(requireData<Row>(data as Row | null, error));
  }
}
