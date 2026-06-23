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

  it("includes menu item image asset changes in the changeset", () => {
    const menuWithItem: MenuCatalog = {
      ...baseMenu,
      menuItems: [
        {
          id: "mi-latte",
          categoryId: "cat-1",
          name: "Latte",
          price: 45000,
          imageAssetKey: "menu-item-images/store-a/menu-items/mi-latte/old.webp",
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
          id: "mi-latte",
          categoryId: "cat-1",
          name: "Latte",
          price: 45000,
          sortOrder: 1,
          isAvailable: true,
          imageAssetKey: "menu-item-images/store-a/menu-items/mi-latte/new.webp",
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
        id: "mi-latte",
        imageAssetKey: "menu-item-images/store-a/menu-items/mi-latte/new.webp",
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
          id: "mi-latte",
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
          id: "mi-latte",
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
      actorId: "emp-1",
    });

    expect(changes.menuItems.updated).toEqual([
      {
        id: "mi-latte",
        categoryId: "cat-2",
        sortOrder: 13,
      },
    ]);
  });
});
