import { writeError } from "./writeErrors";
import type { OrderHistoryFilter, ReportFilter } from "@/domain";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zeroUuid = "00000000-0000-0000-0000-000000000000";
const historyKeys = new Set(["fromDate", "toDate", "page", "pageSize", "status", "orderType", "search", "tableIds"]);

function invalid(): never { throw writeError("INVALID_WRITE_REQUEST"); }
const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
};
const safeInteger = (value: unknown, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid();
  return value;
};

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) invalid();
  return value;
}

export function validatePermissionReadOrderId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value) || value.toLowerCase() === zeroUuid) invalid();
  return value.toLowerCase();
}

export function parsePermissionHistoryFilter(value: unknown): OrderHistoryFilter {
  const input = object(value);
  if (Object.keys(input).some(key => !historyKeys.has(key))) invalid();
  const result: OrderHistoryFilter = {
    page: safeInteger(input.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: safeInteger(input.pageSize, 1, 100),
  };

  if (input.fromDate !== undefined) result.fromDate = date(input.fromDate);
  if (input.toDate !== undefined) result.toDate = date(input.toDate);
  if (result.fromDate !== undefined && result.toDate !== undefined && result.fromDate > result.toDate) invalid();

  if (input.status !== undefined) {
    if (input.status !== "paid" && input.status !== "void") invalid();
    result.status = input.status;
  }
  if (input.orderType !== undefined) {
    if (input.orderType !== "dine_in" && input.orderType !== "takeaway") invalid();
    result.orderType = input.orderType;
  }
  if (input.search !== undefined) {
    if (typeof input.search !== "string") invalid();
    result.search = input.search.replace(/[%,()]/g, "").trim();
  }
  if (input.tableIds !== undefined) {
    if (!Array.isArray(input.tableIds)) invalid();
    result.tableIds = [...new Set(input.tableIds.map(validatePermissionReadOrderId))];
  }
  return result;
}

export function parsePermissionReportFilter(value: unknown): ReportFilter {
  const input = object(value);
  if (Object.keys(input).length !== 1 || !("businessDate" in input)) invalid();
  return { businessDate: date(input.businessDate) };
}

export function parsePermissionReportSummaryFilter(value: unknown) {
  const input = object(value);
  if (Object.keys(input).length !== 2 || !("fromDate" in input) || !("toDate" in input)) invalid();
  const fromDate = date(input.fromDate), toDate = date(input.toDate);
  if (fromDate > toDate) invalid();
  return { fromDate, toDate };
}
