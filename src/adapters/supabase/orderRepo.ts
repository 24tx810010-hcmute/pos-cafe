
import type { IOrderRepo } from "@/ports";
import type {
  OrderDetail,
  OrderHistoryFilter,
  OrderSummary,
  OrderSummaryPage,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
} from "@/domain";
import { requireData, throwIfError } from "./errors";
import { mapOrderDetail, mapOrderSummary, mapSubmitOrderChangesResult, type Row } from "./mappers";
import type { SupabaseAnyClient } from "./repoShared";

const orderFields =
  "id,table_id,order_type,order_no,business_date,status,total,lock_version,paid_at";
const orderItemFields = "id,menu_item_id,item_name,quantity,unit_price,note,status,sort_order";
const orderItemOptionFields = "id,order_item_id,option_value_id,option_name,price_delta";

export class SupabaseOrderRepo implements IOrderRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async listOpenOrders(): Promise<OrderSummary[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("status", "open")
      .order("order_no");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapOrderSummary);
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const { data: orderRow, error: orderError } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("id", orderId)
      .single();
    const order = requireData<Row>(orderRow as Row | null, orderError, "NOT_FOUND");
    const { data: itemRows, error: itemError } = await this.client
      .from("order_items")
      .select(orderItemFields)
      .eq("order_id", orderId)
      .neq("status", "removed")
      .order("sort_order");
    throwIfError(itemError);

    const items = (itemRows ?? []) as Row[];
    const itemIds = items.map((item) => String(item.id));
    let optionRows: Row[] = [];

    if (itemIds.length > 0) {
      const { data: options, error: optionError } = await this.client
        .from("order_item_options")
        .select(orderItemOptionFields)
        .in("order_item_id", itemIds)
        .order("created_at");
      throwIfError(optionError);
      optionRows = (options ?? []) as Row[];
    }

    return mapOrderDetail(order, items, optionRows);
  }

  async submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult> {
    const activeItemCount = input.items.filter((item) => item.quantity > 0).length;
    const orderId = input.orderId ?? (activeItemCount > 0 ? crypto.randomUUID() : null);
    const { data, error } = await this.client.rpc("submit_order_changes", {
      p_order_id: orderId,
      p_table_id: input.tableId,
      p_order_type: input.orderType,
      p_employee_id: input.employeeId,
      p_expected_lock_version: input.expectedVersion,
      p_items: input.items,
    });
    return mapSubmitOrderChangesResult(requireData<Row>(data as Row | null, error));
  }

  async listTakeawayOpenOrders(): Promise<OrderSummary[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("status", "open")
      .eq("order_type", "takeaway")
      .order("order_no");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapOrderSummary);
  }

  async listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage> {
    const from = Math.max(0, (filter.page - 1) * filter.pageSize);
    const to = from + filter.pageSize - 1;
    const { data, error, count } = await this.client
      .from("orders")
      .select(orderFields, { count: "exact" })
      .gte("business_date", filter.fromDate)
      .lte("business_date", filter.toDate)
      .order("business_date", { ascending: false })
      .order("order_no", { ascending: false })
      .range(from, to);
    throwIfError(error);

    return {
      items: ((data ?? []) as Row[]).map(mapOrderSummary),
      total: count ?? 0,
    };
  }
}
