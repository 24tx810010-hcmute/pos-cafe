import { describe, expect, it } from "vitest";
import { mapById, nextSort, toInt, tombstoneFor, trimDraftName } from "./draftUtils";

describe("draftUtils", () => {
  it("parses numeric input from formatted text", () => {
    expect(toInt("12")).toBe(12);
    expect(toInt("29.000 đ")).toBe(29000);
    expect(toInt("abc")).toBe(0);
  });

  it("returns the next sort order", () => {
    expect(nextSort([])).toBe(1);
    expect(nextSort([1, 7, 3])).toBe(8);
  });

  it("indexes draft records by id", () => {
    const map = mapById([{ id: "a", value: 1 }, { id: "b", value: 2 }]);

    expect(map.get("b")).toEqual({ id: "b", value: 2 });
  });

  it("creates deletion tombstones with nullable actor id", () => {
    expect(tombstoneFor("row-1", "emp-1")).toEqual({ id: "row-1", deletedByEmployeeId: "emp-1" });
    expect(tombstoneFor("row-2", undefined)).toEqual({ id: "row-2", deletedByEmployeeId: null });
  });

  it("trims draft display names", () => {
    expect(trimDraftName("  Cà phê sữa  ")).toBe("Cà phê sữa");
  });
});
