import type { Employee, OrderStatus, OrderType, VoidReasonCode } from "./models";

export type NewOption = { id: string; optionValueId: string; quantity: number; quotedPriceDelta: number };
export type NewLine = { id: string; menuItemId: string; quantity: number; note?: string | null; quotedBasePrice: number; options: NewOption[] };
export type RetainedLine = { sourceItemId: string; quantity: number; note?: string | null };
export type SubmitWritePayload = { schemaVersion: 1; kind: "submit_order_changes"; orderId: string } & (
  | { action: "create"; expectedVersion: null; orderType: OrderType; tableId: string | null; newLines: NewLine[] }
  | { action: "update"; expectedVersion: number; retainedLines: RetainedLine[]; newLines: NewLine[] }
  | { action: "void_open"; expectedVersion: number }
);
export type PaymentWritePayload = { schemaVersion: 1; kind: "pay_order"; orderId: string; paymentId: string; expectedVersion: number; method: "cash"; receivedAmount: number };
export type SplitWritePayload = Omit<PaymentWritePayload, "kind"> & { kind: "pay_order_items"; newOrderId: string; lines: { orderItemId: string; quantity: number; splitItemId: string }[] };
export type VoidWritePayload = { schemaVersion: 1; kind: "void_order"; orderId: string; expectedVersion: number; reason: VoidReasonCode; reasonNote?: string | null };
export type WritePayloadV1 = SubmitWritePayload | PaymentWritePayload | SplitWritePayload | VoidWritePayload;
export type WriteKind = WritePayloadV1["kind"];
export type WriteStatus = "pending" | "applied" | "rejected" | "cancelled" | "expired";
export type WriteErrorCode =
  | "AUTH_REQUIRED" | "EMPLOYEE_SESSION_REQUIRED" | "INVALID_PIN" | "FORBIDDEN"
  | "INVALID_WRITE_REQUEST" | "IDEMPOTENCY_KEY_REUSED" | "OPERATION_NOT_FOUND"
  | "OPERATION_EXPIRED" | "OPERATION_CANCELLED" | "ORDER_VERSION_CONFLICT"
  | "TABLE_OCCUPIED" | "NOT_FOUND" | "TABLE_NOT_FOUND" | "ENTITY_ID_CONFLICT"
  | "MENU_ITEM_UNAVAILABLE" | "OPTION_VALUE_UNAVAILABLE" | "INVALID_ORDER_ITEMS"
  | "PAYMENT_AMOUNT_TOO_LOW" | "VOID_REASON_REQUIRED" | "PRICE_CHANGED"
  | "WRITE_RESULT_UNKNOWN" | "WRITE_TEMPORARILY_UNAVAILABLE" | "WRITE_PROTOCOL_UNSUPPORTED" | "RECEIPT_UNAVAILABLE";
export type BusinessError = { code: WriteErrorCode; message: string; details: Record<string, unknown> | null };
export type PriceChangedDetails = { lines: { lineId: string; base: { quoted: number; current: number }; options: { optionValueId: string; quoted: number; current: number }[] }[]; proposedNewLinesTotal: number };
export type OptionSnapshot = { id: string; optionValueId: string; name: string; priceDelta: number; quantity: number };
export type ItemSnapshot = { id: string; menuItemId: string; name: string; quantity: number; baseUnitPrice: number; note: string | null; options: OptionSnapshot[]; unitTotal: number; lineTotal: number; status: "active" };
export type OrderSnapshot = {
  id: string; storeId: string; orderNo: number; businessDate: string; orderType: OrderType; tableId: string | null;
  status: OrderStatus; lockVersion: number; subtotal: number; total: number; createdAt: string; updatedAt: string;
  paidAt: string | null; createdByEmployeeId: string | null; lastModifiedByEmployeeId: string | null;
  items: ItemSnapshot[]; voidedAt: string | null; voidedByEmployeeId: string | null; voidReasonCode: VoidReasonCode | null; voidReasonNote: string | null;
};
export type PaymentSnapshot = { id: string; orderId: string; employeeId: string; method: "cash"; amount: number; receivedAmount: number; changeAmount: number; createdAt: string };
export type ReceiptLine = { orderItemId: string; menuItemId: string; name: string; quantity: number; baseUnitPrice: number; options: Omit<OptionSnapshot, "id">[]; unitTotal: number; lineTotal: number; note: string | null };
export type ReceiptSnapshot = { schemaVersion: 1; orderId: string; paymentId: string; orderNo: number; businessDate: string; storeName: string; address: string; footer: string; tableName: string | null; paidAt: string; employeeName: string; lines: ReceiptLine[]; total: number; receivedAmount: number; changeAmount: number };
export type BusinessResult =
  | { kind: "submit_order_changes"; action: "create" | "update" | "void_open"; order: OrderSnapshot }
  | { kind: "pay_order"; order: OrderSnapshot; payment: PaymentSnapshot; receipt: ReceiptSnapshot }
  | { kind: "pay_order_items"; sourceOrder: OrderSnapshot; paidOrder: OrderSnapshot; payment: PaymentSnapshot; receipt: ReceiptSnapshot }
  | { kind: "void_order"; order: OrderSnapshot };
export type OperationView = {
  operationId: string; schemaVersion: 1; kind: WriteKind; action: "create" | "update" | "void_open" | null;
  status: WriteStatus; payload: WritePayloadV1; registeredAt: string; expiresAt: string; initiatedByEmployeeId: string;
  decidedAt: string | null; executedByEmployeeId: string | null; cancelledByEmployeeId: string | null;
  result: BusinessResult | null; error: BusinessError | null; replayCount: string;
};
export type WriteOperationFilter = { orderId?: string; kinds?: WriteKind[]; statuses?: WriteStatus[]; registeredFrom?: string; registeredTo?: string; cursor?: string; limit?: number };
export type WriteOperationPage = { items: OperationView[]; nextCursor: string | null; serverTime: string };
export type WriteCapabilities = { writeProtocolVersion: 1; maxPayloadBytes: 262144; pendingTtlSeconds: 86400 };
export type EmployeeSession = { employee: Employee; token: string; expiresAt: string };
