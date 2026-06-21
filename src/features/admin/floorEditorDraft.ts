import type { DecorKind, FloorArea, FloorDecorItem, FloorPlan, FloorPlanChanges, FloorTable, TableShape, TableStatus } from "@/domain";
import { mapById, tombstoneFor, trimDraftName } from "./draftUtils";

export interface DraftArea {
  id: string;
  name: string;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
export interface DraftTable {
  id: string;
  areaId: string;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  rotation: number;
  seats: number;
  sortOrder: number;
  status: TableStatus;
  deleted?: boolean;
  isNew?: boolean;
}
export interface DraftDecor {
  id: string;
  areaId: string;
  kind: DecorKind;
  label: string | null;
  assetKey: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isLocked: boolean;
  deleted?: boolean;
  isNew?: boolean;
}

export type FloorTool = "select" | "pan";
export type FloorSelection = { type: "table" | "decor"; id: string } | null;

export const DECOR_LABEL: Record<DecorKind, string> = {
  wall: "Tường",
  plant: "Cây",
  counter: "Quầy",
  door: "Cửa",
  decor: "Trang trí",
  image: "Ảnh",
};
export const DECOR_LIBRARY: DecorKind[] = ["plant", "wall", "counter", "door", "decor"];
export const SHAPE_LABEL: Record<TableShape, string> = { round: "Tròn", square: "Vuông", rectangle: "Chữ nhật" };

export const tableDefaultSize = (shape: TableShape) =>
  shape === "rectangle" ? { width: 150, height: 90 } : { width: 110, height: 110 };
export const decorDefaultSize = (kind: DecorKind) => {
  switch (kind) {
    case "wall": return { width: 300, height: 36 };
    case "counter": return { width: 210, height: 72 };
    case "door": return { width: 52, height: 190 };
    case "plant": return { width: 120, height: 60 };
    default: return { width: 110, height: 110 };
  }
};

export function buildFloorPlanChangesFromDrafts(input: {
  base: FloorPlan;
  areas: DraftArea[];
  tables: DraftTable[];
  decor: DraftDecor[];
  actorId: string | null | undefined;
}): FloorPlanChanges {
  const changes: FloorPlanChanges = {
    areas: { created: [], updated: [], deleted: [] },
    tables: { created: [], updated: [], deleted: [] },
    decorItems: { created: [], updated: [], deleted: [] },
  };
  const baseAreas = mapById<FloorArea>(input.base.areas);
  const baseTables = mapById<FloorTable>(input.base.tables);
  const baseDecor = mapById<FloorDecorItem>(input.base.decorItems);

  for (const area of input.areas) {
    const name = trimDraftName(area.name);
    const original = baseAreas.get(area.id);
    if (!original || area.isNew) {
      if (!area.deleted) {
        changes.areas.created.push({ id: area.id, name, sortOrder: area.sortOrder });
      }
      continue;
    }
    if (area.deleted) {
      changes.areas.deleted.push(tombstoneFor(area.id, input.actorId));
      continue;
    }

    const update: FloorPlanChanges["areas"]["updated"][number] = { id: area.id };
    if (name !== original.name) update.name = name;
    if (area.sortOrder !== original.sortOrder) update.sortOrder = area.sortOrder;
    if (Object.keys(update).length > 1) changes.areas.updated.push(update);
  }

  for (const table of input.tables) {
    const name = trimDraftName(table.name);
    const original = baseTables.get(table.id);
    if (!original || table.isNew) {
      if (!table.deleted) {
        changes.tables.created.push({
          id: table.id,
          areaId: table.areaId,
          name,
          posX: table.posX,
          posY: table.posY,
          width: table.width,
          height: table.height,
          shape: table.shape,
          rotation: table.rotation,
          seats: table.seats,
          sortOrder: table.sortOrder,
        });
      }
      continue;
    }
    if (table.deleted) {
      changes.tables.deleted.push(tombstoneFor(table.id, input.actorId));
      continue;
    }

    const update: FloorPlanChanges["tables"]["updated"][number] = { id: table.id };
    if (table.areaId !== original.areaId) update.areaId = table.areaId;
    if (name !== original.name) update.name = name;
    if (table.posX !== original.posX) update.posX = table.posX;
    if (table.posY !== original.posY) update.posY = table.posY;
    if (table.width !== original.width) update.width = table.width;
    if (table.height !== original.height) update.height = table.height;
    if (table.shape !== original.shape) update.shape = table.shape;
    if (table.rotation !== original.rotation) update.rotation = table.rotation;
    if (table.seats !== original.seats) update.seats = table.seats;
    if (table.sortOrder !== original.sortOrder) update.sortOrder = table.sortOrder;
    if (Object.keys(update).length > 1) changes.tables.updated.push(update);
  }

  for (const item of input.decor) {
    const label = item.label === null ? null : trimDraftName(item.label);
    const original = baseDecor.get(item.id);
    if (!original || item.isNew) {
      if (!item.deleted) {
        changes.decorItems.created.push({
          id: item.id,
          areaId: item.areaId,
          kind: item.kind,
          label,
          assetKey: item.assetKey,
          posX: item.posX,
          posY: item.posY,
          width: item.width,
          height: item.height,
          rotation: item.rotation,
          zIndex: item.zIndex,
          isLocked: item.isLocked,
        });
      }
      continue;
    }
    if (item.deleted) {
      changes.decorItems.deleted.push(tombstoneFor(item.id, input.actorId));
      continue;
    }

    const update: FloorPlanChanges["decorItems"]["updated"][number] = { id: item.id };
    if (item.areaId !== original.areaId) update.areaId = item.areaId;
    if (item.kind !== original.kind) update.kind = item.kind;
    if (label !== original.label) update.label = label;
    if (item.assetKey !== original.assetKey) update.assetKey = item.assetKey;
    if (item.posX !== original.posX) update.posX = item.posX;
    if (item.posY !== original.posY) update.posY = item.posY;
    if (item.width !== original.width) update.width = item.width;
    if (item.height !== original.height) update.height = item.height;
    if (item.rotation !== original.rotation) update.rotation = item.rotation;
    if (item.zIndex !== original.zIndex) update.zIndex = item.zIndex;
    if (item.isLocked !== original.isLocked) update.isLocked = item.isLocked;
    if (Object.keys(update).length > 1) changes.decorItems.updated.push(update);
  }

  return changes;
}
