import { describe, expect, it } from "vitest";
import { businessRangeFor, historyDisplayNo } from "./historyHelpers";

describe("historyHelpers", () => {
  it("builds rolling and normalized custom business date ranges", () => {
    expect(businessRangeFor("7days", "2026-06-21", "", "")).toEqual({
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
    });
    expect(businessRangeFor("custom", "2026-06-21", "2026-06-20", "2026-06-18")).toEqual({
      fromDate: "2026-06-18",
      toDate: "2026-06-20",
    });
  });

  it("numbers recent history from the filtered total across pages", () => {
    expect(historyDisplayNo(45, 1, 20, 0)).toBe(45);
    expect(historyDisplayNo(45, 1, 20, 19)).toBe(26);
    expect(historyDisplayNo(45, 2, 20, 0)).toBe(25);
    expect(historyDisplayNo(45, 2, 20, 19)).toBe(6);
  });
});
