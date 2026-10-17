import type {
  FloorPlanChanges, MenuChanges, StoreSettingsUpdate,
} from "@/domain";
import { writeError } from "./writeErrors";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zeroUuid = "00000000-0000-0000-0000-000000000000";

function invalid(): never { throw writeError("INVALID_WRITE_REQUEST"); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key))) invalid();
  return row;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) invalid(); return value; }
function string(value: unknown): string { if (typeof value !== "string") invalid(); return value; }
function nullableString(value: unknown): string | null { if (value === null) return null; return string(value); }
function boolean(value: unknown): boolean { if (typeof value !== "boolean") invalid(); return value; }
function integer(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value)) invalid(); return value; }
function number(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value)) invalid(); return value; }
function uuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value) || value.toLowerCase() === zeroUuid) invalid();
  return value.toLowerCase();
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) invalid(); return value as T;
}
function optional<T>(row: Record<string, unknown>, key: string, parse: (value: unknown) => T): T | undefined {
  return row[key] === undefined ? undefined : parse(row[key]);
}
function exactChangeset<T, U>(value: unknown, create: (v: unknown) => T, update: (v: unknown) => U) {
  const row = object(value, ["created", "updated", "deleted"]);
  return {
    created: array(row.created).map(create), updated: array(row.updated).map(update),
    deleted: array(row.deleted).map(value => {
      const item = object(value, ["id", "deletedByEmployeeId"]);
      return { id: uuid(item.id), ...(item.deletedByEmployeeId === undefined ? {} : { deletedByEmployeeId: item.deletedByEmployeeId === null ? null : uuid(item.deletedByEmployeeId) }) };
    }),
  };
}

export function parsePermissionMenuChanges(value: unknown): MenuChanges {
  const root = object(value, ["categories", "menuItems", "optionGroups", "optionValues", "menuItemOptionGroups", "imageChanges"]);
  const category = (value: unknown, partial: boolean) => { const r = object(value, ["id", "name", "sortOrder"]); return {
    id: uuid(r.id), ...(partial && r.name === undefined ? {} : { name: string(r.name) }),
    ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }),
  }; };
  const menuItem = (value: unknown, partial: boolean) => { const r = object(value, ["id", "categoryId", "name", "price", "imageAssetKey", "sortOrder", "isAvailable"]); return {
    id: uuid(r.id), ...(partial && r.categoryId === undefined ? {} : { categoryId: uuid(r.categoryId) }),
    ...(partial && r.name === undefined ? {} : { name: string(r.name) }),
    ...(partial && r.price === undefined ? {} : { price: integer(r.price) }),
    ...(r.imageAssetKey === undefined ? {} : { imageAssetKey: nullableString(r.imageAssetKey) }),
    ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }),
    ...(partial && r.isAvailable === undefined ? {} : { isAvailable: boolean(r.isAvailable) }),
  }; };
  const group = (value: unknown, partial: boolean) => { const r = object(value, ["id", "name", "selectType", "isRequired", "sortOrder"]); return {
    id: uuid(r.id), ...(partial && r.name === undefined ? {} : { name: string(r.name) }),
    ...(partial && r.selectType === undefined ? {} : { selectType: oneOf(r.selectType, ["single", "multi"] as const) }),
    ...(partial && r.isRequired === undefined ? {} : { isRequired: boolean(r.isRequired) }),
    ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }),
  }; };
  const option = (value: unknown, partial: boolean) => { const r = object(value, ["id", "optionGroupId", "name", "priceDelta", "sortOrder"]); return {
    id: uuid(r.id), ...(partial && r.optionGroupId === undefined ? {} : { optionGroupId: uuid(r.optionGroupId) }),
    ...(partial && r.name === undefined ? {} : { name: string(r.name) }),
    ...(partial && r.priceDelta === undefined ? {} : { priceDelta: integer(r.priceDelta) }),
    ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }),
  }; };
  const link = (value: unknown, partial: boolean) => { const r = object(value, ["id", "menuItemId", "optionGroupId", "sortOrder"]); return {
    id: uuid(r.id), ...(partial && r.menuItemId === undefined ? {} : { menuItemId: uuid(r.menuItemId) }),
    ...(partial && r.optionGroupId === undefined ? {} : { optionGroupId: uuid(r.optionGroupId) }),
    ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }),
  }; };
  return {
    ...(root.imageChanges === undefined ? {} : { imageChanges: array(root.imageChanges).map(value => {
      const row = object(value, ["itemId", "uploadHandle"]);
      return { itemId: uuid(row.itemId), uploadHandle: row.uploadHandle === null ? null : uuid(row.uploadHandle) };
    }) }),
    categories: exactChangeset(root.categories, v => category(v, false), v => category(v, true)),
    menuItems: exactChangeset(root.menuItems, v => menuItem(v, false), v => menuItem(v, true)),
    optionGroups: exactChangeset(root.optionGroups, v => group(v, false), v => group(v, true)),
    optionValues: exactChangeset(root.optionValues, v => option(v, false), v => option(v, true)),
    menuItemOptionGroups: exactChangeset(root.menuItemOptionGroups, v => link(v, false), v => link(v, true)),
  } as MenuChanges;
}

export function parsePermissionFloorPlanChanges(value: unknown): FloorPlanChanges {
  const root = object(value, ["areas", "tables", "decorItems"]);
  const area = (value: unknown, partial: boolean) => { const r = object(value, ["id", "name", "sortOrder"]); return { id: uuid(r.id),
    ...(partial && r.name === undefined ? {} : { name: string(r.name) }), ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }) }; };
  const table = (value: unknown, partial: boolean) => { const r = object(value, ["id", "areaId", "name", "backgroundAssetKey", "posX", "posY", "width", "height", "shape", "rotation", "seats", "sortOrder"]); return { id: uuid(r.id),
    ...(partial && r.areaId === undefined ? {} : { areaId: uuid(r.areaId) }), ...(partial && r.name === undefined ? {} : { name: string(r.name) }),
    ...(partial && r.backgroundAssetKey === undefined ? {} : { backgroundAssetKey: nullableString(r.backgroundAssetKey) }),
    ...numericFields(r, partial, ["posX", "posY", "width", "height", "rotation"]),
    ...(partial && r.shape === undefined ? {} : { shape: oneOf(r.shape, ["round", "square", "rectangle"] as const) }),
    ...(partial && r.seats === undefined ? {} : { seats: integer(r.seats) }), ...(partial && r.sortOrder === undefined ? {} : { sortOrder: integer(r.sortOrder) }) }; };
  const decor = (value: unknown, partial: boolean) => { const r = object(value, ["id", "areaId", "kind", "label", "assetKey", "posX", "posY", "width", "height", "rotation", "zIndex", "isLocked"]); return { id: uuid(r.id),
    ...(partial && r.areaId === undefined ? {} : { areaId: uuid(r.areaId) }), ...(partial && r.kind === undefined ? {} : { kind: oneOf(r.kind, ["wall", "plant", "counter", "door", "decor", "image"] as const) }),
    ...(r.label === undefined ? {} : { label: nullableString(r.label) }), ...(partial && r.assetKey === undefined ? {} : { assetKey: string(r.assetKey) }),
    ...numericFields(r, partial, ["posX", "posY", "width", "height", "rotation"]),
    ...(partial && r.zIndex === undefined ? {} : { zIndex: integer(r.zIndex) }), ...(partial && r.isLocked === undefined ? {} : { isLocked: boolean(r.isLocked) }) }; };
  return { areas: exactChangeset(root.areas, v => area(v, false), v => area(v, true)), tables: exactChangeset(root.tables, v => table(v, false), v => table(v, true)), decorItems: exactChangeset(root.decorItems, v => decor(v, false), v => decor(v, true)) } as FloorPlanChanges;
}

function numericFields(row: Record<string, unknown>, partial: boolean, keys: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {}; for (const key of keys) { const value = optional(row, key, number); if (!partial && value === undefined) invalid(); if (value !== undefined) result[key] = value; } return result;
}

export function parsePermissionStoreSettingsUpdate(value: unknown): StoreSettingsUpdate {
  const row = object(value, ["displayName", "address", "billFooter", "timezone"]); const result: StoreSettingsUpdate = {};
  for (const key of ["displayName", "address", "billFooter"] as const) if (row[key] !== undefined) result[key] = string(row[key]);
  if (row.timezone !== undefined) { const timezone = string(row.timezone); try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0); } catch { invalid(); } result.timezone = timezone; }
  return result;
}
