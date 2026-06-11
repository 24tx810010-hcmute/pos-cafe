import { describe, expect, it } from "vitest";
import { deterministicUuid } from "./deterministicId";

describe("deterministicUuid", () => {
  it("returns stable UUIDv5-shaped ids from store id and seed key", async () => {
    const first = await deterministicUuid("11111111-1111-1111-1111-111111111111", "demo.category.coffee");
    const second = await deterministicUuid("11111111-1111-1111-1111-111111111111", "demo.category.coffee");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
