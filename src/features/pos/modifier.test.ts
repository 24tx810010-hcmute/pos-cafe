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
    const groups = getItemModifierGroups(mockMenuCatalog, "d50ff72b-d0bc-4832-8888-183c19f5a158");
    const ids = groups.map((g) => g.group.id);
    expect(ids).toContain("054f9798-4ba4-49f3-8e40-8ca109eeb95e");
    expect(ids).toContain("8048edd4-a555-4cea-874d-40beb45b21e3");
    const size = groups.find((g) => g.group.id === "054f9798-4ba4-49f3-8e40-8ca109eeb95e");
    expect(size?.values.map((v) => v.id)).toEqual(["a5f986a6-ea67-4dd3-866e-42a0be8a0497", "62ca9453-5d44-47f4-8f85-a943d526348d"]);
  });

  it("returns empty list for items without any linked group", () => {
    expect(getItemModifierGroups(mockMenuCatalog, "91bbd9ab-1397-4275-8e49-620b70f45b55")).toEqual([]);
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
        menuItemId: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc", // 39000
        quantity: 1,
        note: null,
        options: [{ id: "o1", optionValueId: "dbbecac5-7b06-42c8-8a53-44e08e8d61c3", quantity: 2 }], // +7000 each
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
        menuItemId: "f6dec6d1-792d-4ccd-8892-86c3f3f550fc",
        quantity: 1,
        note: null,
        options: [{ id: "o1", optionValueId: "dbbecac5-7b06-42c8-8a53-44e08e8d61c3", quantity: 2 }],
      },
    ]);
    expect(lines[0].optionText).toBe("Trân châu ×2");
    expect(lines[0].total).toBe(53000);
  });
});
