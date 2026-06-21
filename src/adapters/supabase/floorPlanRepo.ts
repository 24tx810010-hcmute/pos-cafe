
import type { IFloorPlanRepo } from "@/ports";
import type { FloorPlan, FloorPlanChanges } from "@/domain";
import { throwIfError } from "./errors";
import { mapFloorPlan, type Row } from "./mappers";
import { insertRows, requireStoreId, tombstoneRow, updateRow, type SupabaseAnyClient } from "./repoShared";

export class SupabaseFloorPlanRepo implements IFloorPlanRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getFloorPlan(): Promise<FloorPlan> {
    const [areas, tables, decorItems] = await Promise.all([
      this.client.from("floor_areas").select("id,name,sort_order").is("deleted_at", null).order("sort_order"),
      this.client
        .from("tables")
        .select("id,area_id,name,pos_x,pos_y,width,height,shape,rotation,seats,sort_order,status")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("floor_decor_items")
        .select("id,area_id,kind,label,asset_key,pos_x,pos_y,width,height,rotation,z_index,is_locked")
        .is("deleted_at", null)
        .order("z_index"),
    ]);

    throwIfError(areas.error);
    throwIfError(tables.error);
    throwIfError(decorItems.error);

    return mapFloorPlan((areas.data ?? []) as Row[], (tables.data ?? []) as Row[], (decorItems.data ?? []) as Row[]);
  }

  async saveFloorPlan(changes: FloorPlanChanges): Promise<void> {
    const storeId = await requireStoreId(this.client);

    await insertRows(
      this.client,
      "floor_areas",
      changes.areas.created.map((area) => ({
        id: area.id,
        store_id: storeId,
        name: area.name,
        sort_order: area.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "tables",
      changes.tables.created.map((table) => ({
        id: table.id,
        store_id: storeId,
        area_id: table.areaId,
        name: table.name,
        pos_x: table.posX,
        pos_y: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
        seats: table.seats,
        sort_order: table.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "floor_decor_items",
      changes.decorItems.created.map((decor) => ({
        id: decor.id,
        store_id: storeId,
        area_id: decor.areaId,
        kind: decor.kind,
        label: decor.label ?? null,
        asset_key: decor.assetKey,
        pos_x: decor.posX,
        pos_y: decor.posY,
        width: decor.width,
        height: decor.height,
        rotation: decor.rotation,
        z_index: decor.zIndex,
        is_locked: decor.isLocked,
      })),
    );

    for (const area of changes.areas.updated) {
      await updateRow(this.client, "floor_areas", area.id, {
        name: area.name,
        sort_order: area.sortOrder,
      });
    }
    for (const table of changes.tables.updated) {
      await updateRow(this.client, "tables", table.id, {
        area_id: table.areaId,
        name: table.name,
        pos_x: table.posX,
        pos_y: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
        seats: table.seats,
        sort_order: table.sortOrder,
      });
    }
    for (const decor of changes.decorItems.updated) {
      await updateRow(this.client, "floor_decor_items", decor.id, {
        area_id: decor.areaId,
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
      });
    }

    for (const decor of changes.decorItems.deleted) {
      await tombstoneRow(this.client, "floor_decor_items", decor.id, decor.deletedByEmployeeId);
    }
    for (const table of changes.tables.deleted) {
      await tombstoneRow(this.client, "tables", table.id, table.deletedByEmployeeId);
    }
    for (const area of changes.areas.deleted) {
      await tombstoneRow(this.client, "floor_areas", area.id, area.deletedByEmployeeId);
    }
  }
}
