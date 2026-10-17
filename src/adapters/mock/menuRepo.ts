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
    applyMockMenuChanges(this.state, changes);
  }
}

export function applyMockMenuChanges(state: MockState, changes: MenuChanges): void {
  state.menu.categories.push(...changes.categories.created);
  state.menu.menuItems.push(
      ...changes.menuItems.created.map((item) => ({
        ...item,
        imageAssetKey: item.imageAssetKey ?? null,
      })),
    );
  state.menu.optionGroups.push(...changes.optionGroups.created);
  state.menu.optionValues.push(...changes.optionValues.created);
  state.menu.menuItemOptionGroups.push(...changes.menuItemOptionGroups.created);

  for (const category of changes.categories.updated) {
    state.menu.categories = updateById(state.menu.categories, category);
  }
  for (const item of changes.menuItems.updated) {
    state.menu.menuItems = updateById(state.menu.menuItems, item);
  }
  for (const group of changes.optionGroups.updated) {
    state.menu.optionGroups = updateById(state.menu.optionGroups, group);
  }
  for (const value of changes.optionValues.updated) {
    state.menu.optionValues = updateById(state.menu.optionValues, value);
  }
  for (const link of changes.menuItemOptionGroups.updated) {
    state.menu.menuItemOptionGroups = updateById(state.menu.menuItemOptionGroups, link);
  }

  state.menu.menuItemOptionGroups = removeByIds(state.menu.menuItemOptionGroups, changes.menuItemOptionGroups.deleted);
  state.menu.optionValues = removeByIds(state.menu.optionValues, changes.optionValues.deleted);
  state.menu.optionGroups = removeByIds(state.menu.optionGroups, changes.optionGroups.deleted);
  state.menu.menuItems = removeByIds(state.menu.menuItems, changes.menuItems.deleted);
  state.menu.categories = removeByIds(state.menu.categories, changes.categories.deleted);
}
