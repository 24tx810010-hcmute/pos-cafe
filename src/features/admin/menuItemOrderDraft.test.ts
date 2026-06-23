import { describe, expect, it } from "vitest";
import type { DraftItem } from "./menuDraft";
import { swapMenuItemSortOrderInCategory } from "./menuItemOrderDraft";

const item = (id: string, categoryId: string, sortOrder: number, patch: Partial<DraftItem> = {}): DraftItem => ({
  id,
  categoryId,
  name: id,
  price: 1000,
  imageAssetKey: null,
  sortOrder,
  isAvailable: true,
  ...patch,
});

const idsBySort = (items: DraftItem[], categoryId: string) =>
  items
    .filter((candidate) => candidate.categoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((candidate) => candidate.id);

describe("swapMenuItemSortOrderInCategory", () => {
  const baseItems = [
    item("a1", "cat-a", 10),
    item("a2", "cat-a", 20),
    item("a3", "cat-a", 30),
    item("a4", "cat-a", 40),
    item("b1", "cat-b", 5),
  ];

  it("swaps two item positions inside the category", () => {
    expect(idsBySort(swapMenuItemSortOrderInCategory(baseItems, "cat-a", "a1", "a3"), "cat-a")).toEqual([
      "a3",
      "a2",
      "a1",
      "a4",
    ]);
  });

  it("keeps the list unchanged when clicking the selected item", () => {
    expect(swapMenuItemSortOrderInCategory(baseItems, "cat-a", "a2", "a2")).toBe(baseItems);
  });

  it("preserves other categories and the category sort order values", () => {
    const reordered = swapMenuItemSortOrderInCategory(baseItems, "cat-a", "a1", "a3");

    expect(reordered.find((candidate) => candidate.id === "b1")).toEqual(item("b1", "cat-b", 5));
    expect(reordered.filter((candidate) => candidate.categoryId === "cat-a").map((candidate) => candidate.sortOrder).sort((a, b) => a - b)).toEqual([
      10,
      20,
      30,
      40,
    ]);
    expect(baseItems.find((candidate) => candidate.id === "a3")?.sortOrder).toBe(30);
  });

  it("does not swap with deleted or unstable new items", () => {
    const itemsWithBlockedTargets = [
      ...baseItems,
      item("a-deleted", "cat-a", 50, { deleted: true }),
      item("a-empty-new", "cat-a", 60, { isNew: true, name: "" }),
    ];

    expect(swapMenuItemSortOrderInCategory(itemsWithBlockedTargets, "cat-a", "a1", "a-deleted")).toBe(itemsWithBlockedTargets);
    expect(swapMenuItemSortOrderInCategory(itemsWithBlockedTargets, "cat-a", "a1", "a-empty-new")).toBe(itemsWithBlockedTargets);
  });
});
