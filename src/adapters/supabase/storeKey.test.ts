import { describe, expect, it } from "vitest";
import { formatStoreKey, parseStoreKey, storeEmailForNo } from "./storeKey";
import { AppError } from "@/core/appError";

describe("store key helpers", () => {
  it("parses and normalizes store keys", () => {
    expect(parseStoreKey("0007-x8f3qa")).toEqual({ storeNo: 7, secret: "X8F3QA" });
    expect(storeEmailForNo(7)).toBe("store7@store.pos.local");
    expect(formatStoreKey(7, "x8f3qa")).toBe("0007-X8F3QA");
  });

  it("rejects missing secret", () => {
    expect(() => parseStoreKey("0007")).toThrow(AppError);
  });
  it.each([1, 99999999, 100000000, 2147483647])("roundtrips the supported store number %s", storeNo => {
    expect(parseStoreKey(formatStoreKey(storeNo, "x8f3qa"))).toEqual({ storeNo, secret: "X8F3QA" });
  });
  it.each([0, -1, 1.5, 2147483648, Infinity, NaN])("rejects invalid formatter number %s", storeNo => {
    expect(() => formatStoreKey(storeNo, "X8F3QA")).toThrow(expect.objectContaining({ code: "AUTH_REQUIRED" }));
  });
  it.each(["0000-X8F3QA", "-1-X8F3QA", "1.5-X8F3QA", "2147483648-X8F3QA", "00000000001-X8F3QA", "１２-X8F3QA"])("rejects invalid key %s", key => {
    expect(() => parseStoreKey(key)).toThrow(expect.objectContaining({ code: "AUTH_REQUIRED" }));
  });
});
