import { describe, expect, it } from "vitest";
import type { MenuCatalog } from "@/domain";
import { buildMenuChangesFromDrafts } from "./menuEditorDraft";

const baseMenu: MenuCatalog = {
  categories: [{ id: "cat-1", name: "Coffee", sortOrder: 1 }],
  menuItems: [],
  optionGroups: [],
  optionValues: [],
  menuItemOptionGroups: [],
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
      links: [],
      actorId: "emp-1",
    });

    expect(changes.categories.created).toEqual([{ id: "cat-2", name: "Tea", sortOrder: 3 }]);
    expect(changes.categories.updated).toEqual([{ id: "cat-1", name: "Espresso", sortOrder: 2 }]);
    expect(changes.categories.deleted).toEqual([]);
  });

  it("includes menu item image asset changes in the changeset", () => {
    const menuWithItem: MenuCatalog = {
      ...baseMenu,
      menuItems: [
        {
          id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
          categoryId: "cat-1",
          name: "Latte",
          price: 45000,
          imageAssetKey: "menu-item-images/store-a/menu-items/d50ff72b-d0bc-4832-8888-183c19f5a158/old.webp",
          sortOrder: 1,
          isAvailable: true,
        },
      ],
    };

    const changes = buildMenuChangesFromDrafts({
      base: menuWithItem,
      categories: menuWithItem.categories,
      items: [
        {
          id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
          categoryId: "cat-1",
          name: "Latte",
          price: 45000,
          sortOrder: 1,
          isAvailable: true,
          imageAssetKey: "menu-item-images/store-a/menu-items/d50ff72b-d0bc-4832-8888-183c19f5a158/new.webp",
        } as any,
        {
          id: "mi-espresso",
          categoryId: "cat-1",
          name: "Espresso",
          price: 32000,
          sortOrder: 2,
          isAvailable: true,
          isNew: true,
          imageAssetKey: "menu-item-images/store-a/menu-items/mi-espresso/photo.webp",
        } as any,
      ],
      groups: [],
      values: [],
      links: [],
      actorId: "emp-1",
    });

    expect(changes.menuItems.created).toEqual([
      expect.objectContaining({
        id: "mi-espresso",
        imageAssetKey: "menu-item-images/store-a/menu-items/mi-espresso/photo.webp",
      }),
    ]);
    expect(changes.menuItems.updated).toEqual([
      {
        id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
        imageAssetKey: "menu-item-images/store-a/menu-items/d50ff72b-d0bc-4832-8888-183c19f5a158/new.webp",
      },
    ]);
  });

  it("includes category and sort order when a menu item moves category", () => {
    const menuWithItem: MenuCatalog = {
      ...baseMenu,
      categories: [
        { id: "cat-1", name: "Coffee", sortOrder: 1 },
        { id: "cat-2", name: "Tea", sortOrder: 2 },
      ],
      menuItems: [
        {
          id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
          categoryId: "cat-1",
          name: "Latte",
          price: 45000,
          imageAssetKey: null,
          sortOrder: 4,
          isAvailable: true,
        },
      ],
    };

    const changes = buildMenuChangesFromDrafts({
      base: menuWithItem,
      categories: menuWithItem.categories,
      items: [
        {
          id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
          categoryId: "cat-2",
          name: "Latte",
          price: 45000,
          imageAssetKey: null,
          sortOrder: 13,
          isAvailable: true,
        },
      ],
      groups: [],
      values: [],
      links: [],
      actorId: "emp-1",
    });

    expect(changes.menuItems.updated).toEqual([
      {
        id: "d50ff72b-d0bc-4832-8888-183c19f5a158",
        categoryId: "cat-2",
        sortOrder: 13,
      },
    ]);
  });
});
