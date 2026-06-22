
import type { IPaymentRepo } from "@/ports";
import type { PayOrderInput, PayOrderResult } from "@/domain";
import { requireData } from "./errors";
import { mapPayOrderResult, type Row } from "./mappers";
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
}
