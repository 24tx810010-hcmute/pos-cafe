import { describe, expect, it } from "vitest";
import { mockMenuCatalog } from "@/adapters/mock/mockData";
import {
  calculateSnapshotTotal,
  isGroupSelectionValid,
  snapshotDraftItems,
  validateModifierSelection,
} from "@/core/orderDraft";
import { buildCartLines, getItemModifierGroups } from "./orderFlow";

describe("getItemModifierGroups", () => {
  it("returns shared groups linked to the item, with their values", () => {
    const groups = getItemModifierGroups(mockMenuCatalog, "mi-latte");
    const ids = groups.map((g) => g.group.id);
    expect(ids).toContain("og-coffee-size");
    expect(ids).toContain("og-latte-shot");
    const size = groups.find((g) => g.group.id === "og-coffee-size");
    expect(size?.values.map((v) => v.id)).toEqual(["ov-size-m", "ov-size-l"]);
  });

  it("returns empty list for items without any linked group", () => {
    expect(getItemModifierGroups(mockMenuCatalog, "mi-croissant")).toEqual([]);
  });
});

describe("validateModifierSelection", () => {
  const single = { id: "g1", selectType: "single" as const, isRequired: true };
  const multi = { id: "g2", selectType: "multi" as const, isRequired: false };

  it("requires a pick for required groups", () => {
    expect(isGroupSelectionValid(single, [])).toBe(false);
    expect(isGroupSelectionValid(single, [{ optionGroupId: "g1", optionValueId: "v1", quantity: 1 }])).toBe(true);
  });

  it("rejects more than one pick in a single-select group", () => {
    expect(
      isGroupSelectionValid(single, [
        { optionGroupId: "g1", optionValueId: "v1", quantity: 1 },
        { optionGroupId: "g1", optionValueId: "v2", quantity: 1 },
      ]),
    ).toBe(false);
  });

  it("allows multiple picks in a multi-select group and empty when optional", () => {
    expect(isGroupSelectionValid(multi, [])).toBe(true);
    expect(
      validateModifierSelection(
        [single, multi],
        [
          { optionGroupId: "g1", optionValueId: "v1", quantity: 1 },
          { optionGroupId: "g2", optionValueId: "v3", quantity: 2 },
        ],
      ),
    ).toBe(true);
  });
});

describe("pricing with modifier quantity", () => {
  it("multiplies option price delta by its quantity in snapshot total", () => {
    const items = snapshotDraftItems(mockMenuCatalog, [
      {
        id: "draft-1",
        menuItemId: "mi-tra-sua-truyen-thong", // 39000
        quantity: 1,
        note: null,
        options: [{ id: "o1", optionValueId: "ov-tran-chau", quantity: 2 }], // +7000 each
      },
    ]);
    // 39000 + 7000*2 = 53000
    expect(calculateSnapshotTotal(items)).toBe(53000);
    expect(items[0].options[0].quantity).toBe(2);
  });

  it("shows ×N in cart line option text when quantity > 1", () => {
    const lines = buildCartLines(mockMenuCatalog, [
      {
        id: "draft-1",
        menuItemId: "mi-tra-sua-truyen-thong",
        quantity: 1,
        note: null,
        options: [{ id: "o1", optionValueId: "ov-tran-chau", quantity: 2 }],
      },
    ]);
    expect(lines[0].optionText).toBe("Trân châu ×2");
    expect(lines[0].total).toBe(53000);
  });
});
