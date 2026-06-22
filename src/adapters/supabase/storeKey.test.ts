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
});
