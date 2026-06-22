import { describe, expect, it } from "vitest";
import type { FloorPlan } from "@/domain";
import { buildFloorPlanChangesFromDrafts } from "./floorEditorDraft";

const baseFloorPlan: FloorPlan = {
  areas: [{ id: "area-1", name: "Main", sortOrder: 1 }],
  tables: [
    {
      id: "tbl-1",
      areaId: "area-1",
      name: "B01",
      posX: 100,
      posY: 120,
      width: 80,
      height: 80,
      shape: "round",
      rotation: 0,
      seats: 2,
      sortOrder: 1,
      status: "empty",
    },
  ],
  decorItems: [
    {
      id: "dec-1",
      areaId: "area-1",
      kind: "plant",
      label: "Plant",
      assetKey: "plant_default",
      posX: 40,
      posY: 40,
      width: 30,
      height: 30,
      rotation: 0,
      zIndex: 1,
      isLocked: false,
    },
  ],
};

describe("buildFloorPlanChangesFromDrafts", () => {
  it("updates table geometry and tombstones deleted decor", () => {
    const changes = buildFloorPlanChangesFromDrafts({
      base: baseFloorPlan,
      areas: [{ id: "area-1", name: "Main", sortOrder: 1 }],
      tables: [{ ...baseFloorPlan.tables[0], posX: 140, seats: 4 }],
      decor: [{ ...baseFloorPlan.decorItems[0], deleted: true }],
      actorId: "emp-1",
    });

    expect(changes.tables.updated).toEqual([{ id: "tbl-1", posX: 140, seats: 4 }]);
    expect(changes.decorItems.deleted).toEqual([{ id: "dec-1", deletedByEmployeeId: "emp-1" }]);
  });
});
