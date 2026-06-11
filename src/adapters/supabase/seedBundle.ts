import type { SupabaseClient } from "@supabase/supabase-js";
import type { FloorDecorItem, FloorTable, MenuItem, OptionGroup, OptionValue } from "@/domain";
import { AppError } from "@/core/appError";
import { mockFloorPlan, mockMenuCatalog } from "@/adapters/mock/mockData";
import { deterministicUuid } from "./deterministicId";
import { mapSupabaseError, requireData, throwIfError } from "./errors";

type SupabaseAnyClient = SupabaseClient;
type Row = Record<string, unknown>;

const seedKey = (kind: string, sourceId: string): string => `demo.${kind}.${sourceId}`;

const hashPin = async (client: SupabaseAnyClient, pin: string): Promise<string> => {
  const { data, error } = await client.rpc("hash_employee_pin", { p_pin: pin });
  return requireData<string>(data as string | null, error);
};

const upsertRows = async (client: SupabaseAnyClient, table: string, rows: Row[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  throwIfError(error);
};

const buildIdMap = async (storeId: string, kind: string, sourceIds: string[]): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    sourceIds.map(async (sourceId) => [sourceId, await deterministicUuid(storeId, seedKey(kind, sourceId))] as const),
  );
  return Object.fromEntries(entries);
};

const menuItemRows = (
  storeId: string,
  menuItems: MenuItem[],
  itemIds: Record<string, string>,
  categoryIds: Record<string, string>,
): Row[] =>
  menuItems.map((item) => ({
    id: itemIds[item.id],
    store_id: storeId,
    category_id: categoryIds[item.categoryId],
    name: item.name,
    price: item.price,
    image_asset_key: item.imageAssetKey,
    sort_order: item.sortOrder,
    is_available: item.isAvailable,
    seed_key: seedKey("menu_item", item.id),
  }));

const optionGroupRows = (
  storeId: string,
  groups: OptionGroup[],
  groupIds: Record<string, string>,
  itemIds: Record<string, string>,
): Row[] =>
  groups.map((group) => ({
    id: groupIds[group.id],
    store_id: storeId,
    menu_item_id: itemIds[group.menuItemId],
    name: group.name,
    select_type: group.selectType,
    is_required: group.isRequired,
    min_select: group.minSelect,
    max_select: group.maxSelect,
    sort_order: group.sortOrder,
    seed_key: seedKey("option_group", group.id),
  }));

const optionValueRows = (
  storeId: string,
  values: OptionValue[],
  valueIds: Record<string, string>,
  groupIds: Record<string, string>,
): Row[] =>
  values.map((value) => ({
    id: valueIds[value.id],
    store_id: storeId,
    option_group_id: groupIds[value.optionGroupId],
    name: value.name,
    price_delta: value.priceDelta,
    sort_order: value.sortOrder,
    seed_key: seedKey("option_value", value.id),
  }));

const tableRows = (
  storeId: string,
  tables: FloorTable[],
  tableIds: Record<string, string>,
  areaIds: Record<string, string>,
): Row[] =>
  tables.map((table) => ({
    id: tableIds[table.id],
    store_id: storeId,
    area_id: areaIds[table.areaId],
    name: table.name,
    pos_x: table.posX,
    pos_y: table.posY,
    width: table.width,
    height: table.height,
    shape: table.shape,
    rotation: table.rotation,
    seats: table.seats,
    sort_order: table.sortOrder,
    status: "empty",
    seed_key: seedKey("table", table.id),
  }));

const decorRows = (
  storeId: string,
  decorItems: FloorDecorItem[],
  decorIds: Record<string, string>,
  areaIds: Record<string, string>,
): Row[] =>
  decorItems.map((decor) => ({
    id: decorIds[decor.id],
    store_id: storeId,
    area_id: areaIds[decor.areaId],
    kind: decor.kind,
    label: decor.label,
    asset_key: decor.assetKey,
    pos_x: decor.posX,
    pos_y: decor.posY,
    width: decor.width,
    height: decor.height,
    rotation: decor.rotation,
    z_index: decor.zIndex,
    is_locked: decor.isLocked,
    seed_key: seedKey("decor", decor.id),
  }));

export const seedDemoData = async (client: SupabaseAnyClient, storeId: string): Promise<void> => {
  try {
    const categoryIds = await buildIdMap(storeId, "category", mockMenuCatalog.categories.map((category) => category.id));
    const itemIds = await buildIdMap(storeId, "menu_item", mockMenuCatalog.menuItems.map((item) => item.id));
    const groupIds = await buildIdMap(storeId, "option_group", mockMenuCatalog.optionGroups.map((group) => group.id));
    const valueIds = await buildIdMap(storeId, "option_value", mockMenuCatalog.optionValues.map((value) => value.id));
    const areaIds = await buildIdMap(storeId, "area", mockFloorPlan.areas.map((area) => area.id));
    const tableIds = await buildIdMap(storeId, "table", mockFloorPlan.tables.map((table) => table.id));
    const decorIds = await buildIdMap(storeId, "decor", mockFloorPlan.decorItems.map((decor) => decor.id));
    const cashierId = await deterministicUuid(storeId, seedKey("employee", "cashier"));
    const cashierHash = await hashPin(client, "111111");

    await upsertRows(client, "employees", [
      {
        id: cashierId,
        store_id: storeId,
        name: "Thu ngân demo",
        role: "cashier",
        passcode_hash: cashierHash,
        is_active: true,
        seed_key: seedKey("employee", "cashier"),
      },
    ]);

    await upsertRows(
      client,
      "categories",
      mockMenuCatalog.categories.map((category) => ({
        id: categoryIds[category.id],
        store_id: storeId,
        name: category.name,
        sort_order: category.sortOrder,
        seed_key: seedKey("category", category.id),
      })),
    );

    await upsertRows(client, "menu_items", menuItemRows(storeId, mockMenuCatalog.menuItems, itemIds, categoryIds));
    await upsertRows(client, "option_groups", optionGroupRows(storeId, mockMenuCatalog.optionGroups, groupIds, itemIds));
    await upsertRows(client, "option_values", optionValueRows(storeId, mockMenuCatalog.optionValues, valueIds, groupIds));
    await upsertRows(
      client,
      "floor_areas",
      mockFloorPlan.areas.map((area) => ({
        id: areaIds[area.id],
        store_id: storeId,
        name: area.name,
        sort_order: area.sortOrder,
        seed_key: seedKey("area", area.id),
      })),
    );
    await upsertRows(client, "tables", tableRows(storeId, mockFloorPlan.tables, tableIds, areaIds));
    await upsertRows(client, "floor_decor_items", decorRows(storeId, mockFloorPlan.decorItems, decorIds, areaIds));

    const { error } = await client.from("stores").update({ seed_status: "seeded" }).eq("id", storeId);
    throwIfError(error);
  } catch (error) {
    const { error: updateError } = await client.from("stores").update({ seed_status: "failed" }).eq("id", storeId);
    if (updateError) {
      throw mapSupabaseError(updateError);
    }

    throw error instanceof AppError ? error : mapSupabaseError(error);
  }
};

export const markBlankSeeded = async (client: SupabaseAnyClient, storeId: string): Promise<void> => {
  const { error } = await client.from("stores").update({ seed_status: "seeded" }).eq("id", storeId);
  throwIfError(error);
};
