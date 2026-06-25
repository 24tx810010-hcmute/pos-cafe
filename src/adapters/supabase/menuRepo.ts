
import type { IMenuRepo } from "@/ports";
import type { MenuCatalog, MenuChanges } from "@/domain";
import { throwIfError } from "./errors";
import { mapMenuCatalog, type Row } from "./mappers";
import { insertRows, requireStoreId, tombstoneRow, updateRow, type SupabaseAnyClient } from "./repoShared";

export class SupabaseMenuRepo implements IMenuRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getMenu(): Promise<MenuCatalog> {
    const [categories, menuItems, optionGroups, optionValues, menuItemOptionGroups] = await Promise.all([
      this.client.from("categories").select("id,name,sort_order").is("deleted_at", null).order("sort_order"),
      this.client
        .from("menu_items")
        .select("id,category_id,name,price,image_asset_key,sort_order,is_available")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("option_groups")
        .select("id,name,select_type,is_required,sort_order")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("option_values")
        .select("id,option_group_id,name,price_delta,sort_order")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("menu_item_option_groups")
        .select("id,menu_item_id,option_group_id,sort_order")
        .is("deleted_at", null)
        .order("sort_order"),
    ]);

    throwIfError(categories.error);
    throwIfError(menuItems.error);
    throwIfError(optionGroups.error);
    throwIfError(optionValues.error);
    throwIfError(menuItemOptionGroups.error);

    return mapMenuCatalog(
      (categories.data ?? []) as Row[],
      (menuItems.data ?? []) as Row[],
      (optionGroups.data ?? []) as Row[],
      (optionValues.data ?? []) as Row[],
      (menuItemOptionGroups.data ?? []) as Row[],
    );
  }

  async saveMenuChanges(changes: MenuChanges): Promise<void> {
    const storeId = await requireStoreId(this.client);

    await insertRows(
      this.client,
      "categories",
      changes.categories.created.map((category) => ({
        id: category.id,
        store_id: storeId,
        name: category.name,
        sort_order: category.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "menu_items",
      changes.menuItems.created.map((item) => ({
        id: item.id,
        store_id: storeId,
        category_id: item.categoryId,
        name: item.name,
        price: item.price,
        image_asset_key: item.imageAssetKey ?? null,
        sort_order: item.sortOrder,
        is_available: item.isAvailable,
      })),
    );
    await insertRows(
      this.client,
      "option_groups",
      changes.optionGroups.created.map((group) => ({
        id: group.id,
        store_id: storeId,
        name: group.name,
        select_type: group.selectType,
        is_required: group.isRequired,
        sort_order: group.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "option_values",
      changes.optionValues.created.map((value) => ({
        id: value.id,
        store_id: storeId,
        option_group_id: value.optionGroupId,
        name: value.name,
        price_delta: value.priceDelta,
        sort_order: value.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "menu_item_option_groups",
      changes.menuItemOptionGroups.created.map((link) => ({
        id: link.id,
        store_id: storeId,
        menu_item_id: link.menuItemId,
        option_group_id: link.optionGroupId,
        sort_order: link.sortOrder,
      })),
    );

    for (const category of changes.categories.updated) {
      await updateRow(this.client, "categories", category.id, {
        name: category.name,
        sort_order: category.sortOrder,
      });
    }
    for (const item of changes.menuItems.updated) {
      await updateRow(this.client, "menu_items", item.id, {
        category_id: item.categoryId,
        name: item.name,
        price: item.price,
        image_asset_key: item.imageAssetKey,
        sort_order: item.sortOrder,
        is_available: item.isAvailable,
      });
    }
    for (const group of changes.optionGroups.updated) {
      await updateRow(this.client, "option_groups", group.id, {
        name: group.name,
        select_type: group.selectType,
        is_required: group.isRequired,
        sort_order: group.sortOrder,
      });
    }
    for (const value of changes.optionValues.updated) {
      await updateRow(this.client, "option_values", value.id, {
        option_group_id: value.optionGroupId,
        name: value.name,
        price_delta: value.priceDelta,
        sort_order: value.sortOrder,
      });
    }
    for (const link of changes.menuItemOptionGroups.updated) {
      await updateRow(this.client, "menu_item_option_groups", link.id, {
        menu_item_id: link.menuItemId,
        option_group_id: link.optionGroupId,
        sort_order: link.sortOrder,
      });
    }

    for (const link of changes.menuItemOptionGroups.deleted) {
      await tombstoneRow(this.client, "menu_item_option_groups", link.id, link.deletedByEmployeeId);
    }
    for (const value of changes.optionValues.deleted) {
      await tombstoneRow(this.client, "option_values", value.id, value.deletedByEmployeeId);
    }
    for (const group of changes.optionGroups.deleted) {
      await tombstoneRow(this.client, "option_groups", group.id, group.deletedByEmployeeId);
    }
    for (const item of changes.menuItems.deleted) {
      await tombstoneRow(this.client, "menu_items", item.id, item.deletedByEmployeeId);
    }
    for (const category of changes.categories.deleted) {
      await tombstoneRow(this.client, "categories", category.id, category.deletedByEmployeeId);
    }
  }
}
