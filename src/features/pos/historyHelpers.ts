import type { FloorPlan, OrderSummary } from "@/domain";

export type HistoryDateRange = "today" | "7days" | "month" | "custom";
export type HistoryStatusFilter = "all" | "paid" | "void";
export type HistoryOrderTypeFilter = "all" | "dine_in" | "takeaway";

export const PAY_METHOD_LABEL: Record<string, string> = { cash: "Tiền mặt", qr: "QR / VietQR", bank_transfer: "Chuyển khoản" };

export const DEFAULT_TIMEZONE = "Asia/Saigon";

export type BusinessDateRange = {
  fromDate: string;
  toDate: string;
};

export type HistoryOrderRow = {
  id: string;
  orderNo: number;
  createdAt: string;
  tableLabel: string;
  orderType: OrderSummary["orderType"];
  total: number;
  status: OrderSummary["status"];
  employeeName: string | null;
  payMethod: string | null;
};

export const businessDateInTimezone = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to UTC fallback if the runtime does not support this timezone.
  }
  return date.toISOString().slice(0, 10);
};

export const shiftBusinessDate = (businessDate: string, days: number): string => {
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const normalizeBusinessRange = (fromDate: string, toDate: string): BusinessDateRange =>
  fromDate <= toDate ? { fromDate, toDate } : { fromDate: toDate, toDate: fromDate };

export const businessRangeFor = (
  range: HistoryDateRange,
  today: string,
  customFrom: string,
  customTo: string,
): BusinessDateRange => {
  if (range === "7days") return { fromDate: shiftBusinessDate(today, -6), toDate: today };
  if (range === "month") return { fromDate: `${today.slice(0, 8)}01`, toDate: today };
  if (range === "custom") return normalizeBusinessRange(customFrom || today, customTo || customFrom || today);
  return { fromDate: today, toDate: today };
};

export const enumerateBusinessDates = ({ fromDate, toDate }: BusinessDateRange): string[] => {
  const dates: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate && dates.length < 31) {
    dates.push(cursor);
    cursor = shiftBusinessDate(cursor, 1);
  }
  return dates;
};

export const formatBusinessDate = (businessDate: string): string => {
  const [year, month, day] = businessDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : businessDate;
};

export const shortBusinessDate = (businessDate: string): string => {
  const [, month, day] = businessDate.split("-");
  return month && day ? `${day}/${month}` : businessDate;
};

export const tableNameMap = (floorPlan: FloorPlan | undefined): Map<string, string> =>
  new Map((floorPlan?.tables ?? []).map((table) => [table.id, table.name]));

export const tableLabelForOrder = (order: Pick<OrderSummary, "orderType" | "tableId">, tables: Map<string, string>): string => {
  if (order.orderType === "takeaway") return "Mang đi";
  if (!order.tableId) return "Tại bàn";
  return tables.get(order.tableId) ?? order.tableId;
};

export const historyRowFromOrder = (order: OrderSummary, tables: Map<string, string>): HistoryOrderRow => ({
  id: order.id,
  orderNo: order.orderNo,
  createdAt: formatBusinessDate(order.businessDate),
  tableLabel: tableLabelForOrder(order, tables),
  orderType: order.orderType,
  total: order.total,
  status: order.status,
  employeeName: null,
  payMethod: null,
});
