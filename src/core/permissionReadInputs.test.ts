import { describe, expect, it } from "vitest";
import { parsePermissionHistoryFilter, parsePermissionReportFilter, parsePermissionReportSummaryFilter, validatePermissionReadOrderId } from "./permissionReadInputs";

const id = "50000000-0000-4000-8000-000000000001";
const idUpper = "50000000-0000-4000-8000-0000000000AA";
const invalid = { code: "INVALID_WRITE_REQUEST", message: "Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra." };

const expectInvalid = (run: () => unknown) => expect(run).toThrow(expect.objectContaining(invalid));

describe("permission read inputs", () => {
  it("accepts an inclusive report summary date range without client pagination", () => {
    expect(parsePermissionReportSummaryFilter({ fromDate: "2024-02-29", toDate: "2024-02-29" })).toEqual({ fromDate: "2024-02-29", toDate: "2024-02-29" });
    expect(parsePermissionReportSummaryFilter({ fromDate: "0001-01-01", toDate: "9999-12-31" })).toEqual({ fromDate: "0001-01-01", toDate: "9999-12-31" });
  });
  it.each([
    ["missing", {}], ["null", null], ["invalid date", { fromDate: "2025-02-29", toDate: "2026-01-01" }],
    ["reversed", { fromDate: "2026-09-17", toDate: "2026-09-16" }],
    ["pagination", { fromDate: "2026-09-16", toDate: "2026-09-16", pageSize: 100 }],
    ["status", { fromDate: "2026-09-16", toDate: "2026-09-16", status: "void" }],
    ["actor", { fromDate: "2026-09-16", toDate: "2026-09-16", employeeId: id }],
  ])("rejects report summary range %s", (_label, value) => {
    expectInvalid(() => parsePermissionReportSummaryFilter(value));
  });
  it("parses the complete history filter, sanitizes search, canonicalizes UUIDs, and deduplicates tables", () => {
    expect(parsePermissionHistoryFilter({
      fromDate: "2024-02-29", toDate: "2026-09-17", page: Number.MAX_SAFE_INTEGER, pageSize: 100,
      status: "paid", orderType: "dine_in", search: "  #7%,(bàn) literal_.*  ",
      tableIds: [idUpper, idUpper.toLowerCase(), id],
    })).toEqual({
      fromDate: "2024-02-29", toDate: "2026-09-17", page: Number.MAX_SAFE_INTEGER, pageSize: 100,
      status: "paid", orderType: "dine_in", search: "#7bàn literal_.*", tableIds: [idUpper.toLowerCase(), id],
    });
  });

  it("accepts omitted optional fields, explicit undefined, empty search, and an empty table list", () => {
    expect(parsePermissionHistoryFilter({ page: 1, pageSize: 1 })).toEqual({ page: 1, pageSize: 1 });
    expect(parsePermissionHistoryFilter({ page: 1, pageSize: 10, fromDate: undefined, status: undefined, search: " %(), ", tableIds: [] }))
      .toEqual({ page: 1, pageSize: 10, search: "", tableIds: [] });
  });

  it.each([
    null, [], "history", 1,
    { page: 1, pageSize: 10, actorId: id },
    { page: 1, pageSize: 10, role: "owner" },
    { page: 1, pageSize: 10, permissions: ["report.view"] },
    { page: 1, pageSize: 10, unknown: undefined },
  ])("rejects non-object or forged/unknown history input %#", value => expectInvalid(() => parsePermissionHistoryFilter(value)));

  it.each([
    {}, { page: 1 }, { pageSize: 10 }, { page: 0, pageSize: 10 }, { page: -1, pageSize: 10 },
    { page: 1.5, pageSize: 10 }, { page: Number.MAX_SAFE_INTEGER + 1, pageSize: 10 },
    { page: 1, pageSize: 0 }, { page: 1, pageSize: 101 }, { page: 1, pageSize: 1.5 },
    { page: "1", pageSize: 10 }, { page: 1, pageSize: "10" },
  ])("rejects missing or out-of-range pagination %#", value => expectInvalid(() => parsePermissionHistoryFilter(value)));

  it.each([
    "0000-01-01", "1900-02-29", "2023-02-29", "2024-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00",
    "2026-1-01", "2026-01-1", "2026-01-01T00:00:00Z", "not-a-date", null,
  ])("rejects invalid Gregorian history dates %#", value => {
    expectInvalid(() => parsePermissionHistoryFilter({ page: 1, pageSize: 10, fromDate: value }));
    expectInvalid(() => parsePermissionHistoryFilter({ page: 1, pageSize: 10, toDate: value }));
  });

  it("rejects a reversed history date interval", () => {
    expectInvalid(() => parsePermissionHistoryFilter({ page: 1, pageSize: 10, fromDate: "2026-09-18", toDate: "2026-09-17" }));
  });

  it.each([
    { status: null }, { status: "open" }, { status: "PAID" },
    { orderType: null }, { orderType: "delivery" }, { orderType: "DINE_IN" },
    { search: null }, { search: 7 }, { tableIds: null }, { tableIds: id }, { tableIds: [id, 7] },
  ])("rejects explicit null, wrong enums, and malformed optional fields %#", patch => {
    expectInvalid(() => parsePermissionHistoryFilter({ page: 1, pageSize: 10, ...patch }));
  });

  it("preserves literal search characters that are not part of the production sanitizer", () => {
    const search = "#12 [A-Z] +? \\ ' \" ; -- _.*";
    expect(parsePermissionHistoryFilter({ page: 1, pageSize: 10, search }).search).toBe(search);
  });

  it("accepts only a strict report date object and validates leap days", () => {
    expect(parsePermissionReportFilter({ businessDate: "2024-02-29" })).toEqual({ businessDate: "2024-02-29" });
    expect(parsePermissionReportFilter({ businessDate: "2000-02-29" })).toEqual({ businessDate: "2000-02-29" });
    for (const value of [null, [], {}, { businessDate: undefined }, { businessDate: null }, { businessDate: "2023-02-29" },
      { businessDate: "2026-09-17", timezone: "Asia/Ho_Chi_Minh" }, { businessDate: "2026-09-17", actorId: id }]) {
      expectInvalid(() => parsePermissionReportFilter(value));
    }
  });

  it("canonicalizes nonzero UUIDs and rejects zero, malformed, or non-string order IDs", () => {
    expect(validatePermissionReadOrderId(idUpper)).toBe(idUpper.toLowerCase());
    for (const value of ["00000000-0000-0000-0000-000000000000", "50000000-0000-4000-8000-00000000001", "not-uuid", null, 1]) {
      expectInvalid(() => validatePermissionReadOrderId(value));
    }
  });
});
