import type { IMenuRepo } from "@/ports";
import type { MenuCatalog, MenuChanges } from "@/domain";
import { clone, type MockState } from "./mockState";
import { removeByIds, updateById } from "./mockRepoShared";

export class MockMenuRepo implements IMenuRepo {
  constructor(private readonly state: MockState) {}

  async getMenu(): Promise<MenuCatalog> {
    return clone(this.state.menu);
  }

  async saveMenuChanges(changes: MenuChanges): Promise<void> {
    this.state.menu.categories.push(...changes.categories.created);
    this.state.menu.menuItems.push(
      ...changes.menuItems.created.map((item) => ({
        ...item,
        imageAssetKey: item.imageAssetKey ?? null,
      })),
    );
    this.state.menu.optionGroups.push(...changes.optionGroups.created);
    this.state.menu.optionValues.push(...changes.optionValues.created);
    this.state.menu.menuItemOptionGroups.push(...changes.menuItemOptionGroups.created);

    for (const category of changes.categories.updated) {
      this.state.menu.categories = updateById(this.state.menu.categories, category);
    }
    for (const item of changes.menuItems.updated) {
      this.state.menu.menuItems = updateById(this.state.menu.menuItems, item);
    }
    for (const group of changes.optionGroups.updated) {
      this.state.menu.optionGroups = updateById(this.state.menu.optionGroups, group);
    }
    for (const value of changes.optionValues.updated) {
      this.state.menu.optionValues = updateById(this.state.menu.optionValues, value);
    }
    for (const link of changes.menuItemOptionGroups.updated) {
      this.state.menu.menuItemOptionGroups = updateById(this.state.menu.menuItemOptionGroups, link);
    }

    this.state.menu.menuItemOptionGroups = removeByIds(this.state.menu.menuItemOptionGroups, changes.menuItemOptionGroups.deleted);
    this.state.menu.optionValues = removeByIds(this.state.menu.optionValues, changes.optionValues.deleted);
    this.state.menu.optionGroups = removeByIds(this.state.menu.optionGroups, changes.optionGroups.deleted);
    this.state.menu.menuItems = removeByIds(this.state.menu.menuItems, changes.menuItems.deleted);
    this.state.menu.categories = removeByIds(this.state.menu.categories, changes.categories.deleted);
  }
}
