import type {
  Category,
  MenuCatalog,
  MenuChanges,
  MenuItem,
  MenuItemOptionGroup,
  OptionGroup,
  OptionValue,
} from "@/domain";
import { mapById, tombstoneFor, trimDraftName } from "./draftUtils";
import type { DraftCategory, DraftGroup, DraftItem, DraftLink, DraftValue } from "./menuDraft";

export function buildMenuChangesFromDrafts(input: {
  base: MenuCatalog;
  categories: DraftCategory[];
  items: DraftItem[];
  groups: DraftGroup[];
  values: DraftValue[];
  links: DraftLink[];
  actorId: string | null | undefined;
}): MenuChanges {
  const changes: MenuChanges = {
    categories: { created: [], updated: [], deleted: [] },
    menuItems: { created: [], updated: [], deleted: [] },
    optionGroups: { created: [], updated: [], deleted: [] },
    optionValues: { created: [], updated: [], deleted: [] },
    menuItemOptionGroups: { created: [], updated: [], deleted: [] },
  };
  const baseCategories = mapById<Category>(input.base.categories);
  const baseItems = mapById<MenuItem>(input.base.menuItems);
  const baseGroups = mapById<OptionGroup>(input.base.optionGroups);
  const baseValues = mapById<OptionValue>(input.base.optionValues);
  const baseLinks = mapById<MenuItemOptionGroup>(input.base.menuItemOptionGroups);

  for (const category of input.categories) {
    const name = trimDraftName(category.name);
    const original = baseCategories.get(category.id);
    if (!original || category.isNew) {
      if (!category.deleted) {
        changes.categories.created.push({ id: category.id, name, sortOrder: category.sortOrder });
      }
      continue;
    }
    if (category.deleted) {
      changes.categories.deleted.push(tombstoneFor(category.id, input.actorId));
      continue;
    }

    const update: MenuChanges["categories"]["updated"][number] = { id: category.id };
    if (name !== original.name) update.name = name;
    if (category.sortOrder !== original.sortOrder) update.sortOrder = category.sortOrder;
    if (Object.keys(update).length > 1) changes.categories.updated.push(update);
  }

  for (const item of input.items) {
    const name = trimDraftName(item.name);
    const original = baseItems.get(item.id);
    if (!original || item.isNew) {
      if (!item.deleted) {
        changes.menuItems.created.push({
          id: item.id,
          categoryId: item.categoryId,
          name,
          price: item.price,
          imageAssetKey: item.imageAssetKey ?? null,
          sortOrder: item.sortOrder,
          isAvailable: item.isAvailable,
        });
      }
      continue;
    }
    if (item.deleted) {
      changes.menuItems.deleted.push(tombstoneFor(item.id, input.actorId));
      continue;
    }

    const update: MenuChanges["menuItems"]["updated"][number] = { id: item.id };
    if (item.categoryId !== original.categoryId) update.categoryId = item.categoryId;
    if (name !== original.name) update.name = name;
    if (item.price !== original.price) update.price = item.price;
    if (item.imageAssetKey !== original.imageAssetKey) update.imageAssetKey = item.imageAssetKey;
    if (item.sortOrder !== original.sortOrder) update.sortOrder = item.sortOrder;
    if (item.isAvailable !== original.isAvailable) update.isAvailable = item.isAvailable;
    if (Object.keys(update).length > 1) changes.menuItems.updated.push(update);
  }

  for (const group of input.groups) {
    const name = trimDraftName(group.name);
    const original = baseGroups.get(group.id);
    if (!original || group.isNew) {
      if (!group.deleted) {
        changes.optionGroups.created.push({
          id: group.id,
          name,
          selectType: group.selectType,
          isRequired: group.isRequired,
          sortOrder: group.sortOrder,
        });
      }
      continue;
    }
    if (group.deleted) {
      changes.optionGroups.deleted.push(tombstoneFor(group.id, input.actorId));
      continue;
    }

    const update: MenuChanges["optionGroups"]["updated"][number] = { id: group.id };
    if (name !== original.name) update.name = name;
    if (group.selectType !== original.selectType) update.selectType = group.selectType;
    if (group.isRequired !== original.isRequired) update.isRequired = group.isRequired;
    if (group.sortOrder !== original.sortOrder) update.sortOrder = group.sortOrder;
    if (Object.keys(update).length > 1) changes.optionGroups.updated.push(update);
  }

  for (const value of input.values) {
    const name = trimDraftName(value.name);
    const original = baseValues.get(value.id);
    if (!original || value.isNew) {
      if (!value.deleted) {
        changes.optionValues.created.push({
          id: value.id,
          optionGroupId: value.optionGroupId,
          name,
          priceDelta: value.priceDelta,
          sortOrder: value.sortOrder,
        });
      }
      continue;
    }
    if (value.deleted) {
      changes.optionValues.deleted.push(tombstoneFor(value.id, input.actorId));
      continue;
    }

    const update: MenuChanges["optionValues"]["updated"][number] = { id: value.id };
    if (value.optionGroupId !== original.optionGroupId) update.optionGroupId = value.optionGroupId;
    if (name !== original.name) update.name = name;
    if (value.priceDelta !== original.priceDelta) update.priceDelta = value.priceDelta;
    if (value.sortOrder !== original.sortOrder) update.sortOrder = value.sortOrder;
    if (Object.keys(update).length > 1) changes.optionValues.updated.push(update);
  }

  for (const link of input.links) {
    const original = baseLinks.get(link.id);
    if (!original || link.isNew) {
      if (!link.deleted) {
        changes.menuItemOptionGroups.created.push({
          id: link.id,
          menuItemId: link.menuItemId,
          optionGroupId: link.optionGroupId,
          sortOrder: link.sortOrder,
        });
      }
      continue;
    }
    if (link.deleted) {
      changes.menuItemOptionGroups.deleted.push(tombstoneFor(link.id, input.actorId));
      continue;
    }

    const update: MenuChanges["menuItemOptionGroups"]["updated"][number] = { id: link.id };
    if (link.menuItemId !== original.menuItemId) update.menuItemId = link.menuItemId;
    if (link.optionGroupId !== original.optionGroupId) update.optionGroupId = link.optionGroupId;
    if (link.sortOrder !== original.sortOrder) update.sortOrder = link.sortOrder;
    if (Object.keys(update).length > 1) changes.menuItemOptionGroups.updated.push(update);
  }

  return changes;
}
