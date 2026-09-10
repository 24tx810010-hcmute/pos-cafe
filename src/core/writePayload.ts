import type { EmployeePermission, WritePayloadV1 } from "@/domain";
import { writeError } from "./writeErrors";

export const MAX_MONEY = 2147483647;
export const MAX_PAYLOAD_BYTES = 262144;
export const isWriteUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
const invalid = (): never => { throw writeError("INVALID_WRITE_REQUEST"); };
export const checkedMoney = (value: number): number => Number.isSafeInteger(value) && value >= 0 && value <= MAX_MONEY ? value : invalid();
const integer = (v: unknown, lo: number, hi: number): boolean => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Obj : invalid();
const keys = (o: Obj, required: string[], optional: string[] = []): void => {
  if (required.some(k => !Object.prototype.hasOwnProperty.call(o, k)) || Object.keys(o).some(k => !required.includes(k) && !optional.includes(k))) invalid();
};
const array = (v: unknown, lo: number, hi: number): unknown[] => Array.isArray(v) && v.length >= lo && v.length <= hi ? v : invalid();
const note = (o: Obj, key: string): void => {
  if (!Object.prototype.hasOwnProperty.call(o, key)) return;
  const v = o[key];
  // PostgreSQL text cannot represent NUL or lone UTF-16 surrogates.
  if (v !== null && (typeof v !== "string" || [...v].length > 500 || /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))) invalid();
};
const newLines = (v: unknown, min: number): void => {
  const lineIds = new Set<string>();
  const optionIds = new Set<string>();
  for (const entry of array(v, min, 200)) {
    const line = obj(entry);
    keys(line, ["id", "menuItemId", "quantity", "quotedBasePrice", "options"], ["note"]);
    if (!isWriteUuid(line.id) || !isWriteUuid(line.menuItemId) || !integer(line.quantity, 1, 999) || !integer(line.quotedBasePrice, 0, MAX_MONEY)) invalid();
    uniqueId(line.id as string, lineIds);
    note(line, "note");
    for (const entryOption of array(line.options, 0, 20)) {
      const option = obj(entryOption);
      keys(option, ["id", "optionValueId", "quantity", "quotedPriceDelta"]);
      if (!isWriteUuid(option.id) || !isWriteUuid(option.optionValueId) || !integer(option.quantity, 1, 99) || !integer(option.quotedPriceDelta, 0, MAX_MONEY)) invalid();
      uniqueId(option.id as string, optionIds);
    }
  }
};
const uniqueId = (id: string, used: Set<string>): void => {
  const canonical = id.toLowerCase();
  if (used.has(canonical)) invalid();
  used.add(canonical);
};

// Restricted v1 values have bounded integers, so this matches JSONB text byte size:
// PostgreSQL adds one space after a colon and comma, outside string literals.
export const jsonbText = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(", ")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}: ${jsonbText((value as Obj)[key])}`).join(", ")}}`;
  return JSON.stringify(value);
};
export const sameWritePayload = (a: WritePayloadV1, b: WritePayloadV1): boolean => jsonbText(a) === jsonbText(b);
export function validateWritePayload(value: unknown): asserts value is WritePayloadV1 {
  const p = obj(value);
  const common = ["schemaVersion", "kind", "orderId", "expectedVersion"];
  if (p.schemaVersion !== 1 || !isWriteUuid(p.orderId)) invalid();
  if (p.kind === "submit_order_changes") {
    if (p.action === "create") {
      keys(p, [...common, "action", "orderType", "tableId", "newLines"]);
      if (p.expectedVersion !== null || !(p.orderType === "takeaway" && p.tableId === null || p.orderType === "dine_in" && isWriteUuid(p.tableId))) invalid();
      newLines(p.newLines, 1);
    } else if (p.action === "update") {
      keys(p, [...common, "action", "retainedLines", "newLines"]);
      for (const entry of array(p.retainedLines, 1, 200)) {
        const line = obj(entry);
        keys(line, ["sourceItemId", "quantity"], ["note"]);
        if (!isWriteUuid(line.sourceItemId) || !integer(line.quantity, 0, 999)) invalid();
        note(line, "note");
      }
      newLines(p.newLines, 0);
    } else if (p.action === "void_open") keys(p, [...common, "action"]);
    else invalid();
  } else if (p.kind === "pay_order" || p.kind === "pay_order_items") {
    keys(p, [...common, "paymentId", "method", "receivedAmount", ...(p.kind === "pay_order_items" ? ["newOrderId", "lines"] : [])]);
    if (!isWriteUuid(p.paymentId) || p.method !== "cash" || !integer(p.receivedAmount, 0, MAX_MONEY)) invalid();
    if (p.kind === "pay_order_items") {
      if (!isWriteUuid(p.newOrderId) || p.newOrderId === p.orderId) invalid();
      const splitIds = new Set<string>();
      for (const entry of array(p.lines, 1, 200)) {
        const line = obj(entry);
        keys(line, ["orderItemId", "quantity", "splitItemId"]);
        if (!isWriteUuid(line.orderItemId) || !isWriteUuid(line.splitItemId) || !integer(line.quantity, 1, 999)) invalid();
        uniqueId(line.splitItemId as string, splitIds);
      }
    }
  } else if (p.kind === "void_order") {
    keys(p, [...common, "reason"], ["reasonNote"]);
    if (!["wrong_order", "customer_request", "out_of_stock", "duplicate", "other"].includes(p.reason as string)) invalid();
    note(p, "reasonNote");
  } else invalid();
  if (!(p.kind === "submit_order_changes" && p.action === "create") && !integer(p.expectedVersion, 0, MAX_MONEY)) invalid();
  if (new TextEncoder().encode(jsonbText(p)).byteLength > MAX_PAYLOAD_BYTES) invalid();
}
export const writePermission = (p: WritePayloadV1): EmployeePermission => p.kind === "submit_order_changes" ? ({ create: "order.create", update: "order.update", void_open: "order.voidOpen" } as const)[p.action] : p.kind === "void_order" ? "order.voidPaid" : "payment.take";
