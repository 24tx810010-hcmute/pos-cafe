import { describe, expect, it } from "vitest";
import type { MenuCatalog } from "@/domain";
import { buildMenuChangesFromDrafts } from "./menuEditorDraft";

const baseMenu: MenuCatalog = {
  categories: [{ id: "cat-1", name: "Coffee", sortOrder: 1 }],
  menuItems: [],
  optionGroups: [],
  optionValues: [],
};

describe("buildMenuChangesFromDrafts", () => {
  it("creates new categories and trims changed names", () => {
    const changes = buildMenuChangesFromDrafts({
      base: baseMenu,
      categories: [
        { id: "cat-1", name: " Espresso ", sortOrder: 2 },
        { id: "cat-2", name: "Tea", sortOrder: 3, isNew: true },
      ],
      items: [],
      groups: [],
      values: [],
      actorId: "emp-1",
    });

    expect(changes.categories.created).toEqual([{ id: "cat-2", name: "Tea", sortOrder: 3 }]);
    expect(changes.categories.updated).toEqual([{ id: "cat-1", name: "Espresso", sortOrder: 2 }]);
    expect(changes.categories.deleted).toEqual([]);
  });
});
