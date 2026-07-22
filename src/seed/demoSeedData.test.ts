import { describe, expect, it } from "vitest";
import type { FloorPlan } from "@/domain";
import { mockFloorPlan } from "@/adapters/mock/mockData";
import { applyDemoSeed, removeDemoSeed } from "@/adapters/mock/demoSeedHelpers";
import { createMockState } from "@/adapters/mock/mockState";
import { getFloorDecorAsset } from "@/app/floorDecorAssets";
import { demoFloorPlan, demoSeedIds } from "./demoSeedData";

const expectDecorDoesNotCoverTables = (plan: FloorPlan) => {
  for (const decor of plan.decorItems) {
    for (const table of plan.tables.filter((item) => item.areaId === decor.areaId)) {
      const overlapsX = Math.abs(decor.posX - table.posX) * 2 < decor.width + table.width;
      const overlapsY = Math.abs(decor.posY - table.posY) * 2 < decor.height + table.height;
      expect(overlapsX && overlapsY, `${decor.id} should not cover ${table.id}`).toBe(false);
    }
  }
};

describe("demo floor decor", () => {
  it("seeds a varied built-in decor set that clear-demo can identify", () => {
    expect(demoFloorPlan.decorItems).toHaveLength(7);
    expect(demoSeedIds.decorItems).toEqual(demoFloorPlan.decorItems.map((item) => item.id));
    expect(new Set(demoFloorPlan.decorItems.map((item) => item.assetKey))).toHaveLength(7);
    expect(demoFloorPlan.decorItems.every((item) => getFloorDecorAsset(item.assetKey))).toBe(true);
    expect(new Set(demoFloorPlan.decorItems.map((item) => getFloorDecorAsset(item.assetKey)?.group ?? "wall"))).toEqual(
      new Set(["wall", "tree", "seat", "fixtures", "other"]),
    );
    expectDecorDoesNotCoverTables(demoFloorPlan);
  });

  it("keeps the initial mock floor varied across both areas", () => {
    expect(mockFloorPlan.decorItems).toHaveLength(13);
    expect(new Set(mockFloorPlan.decorItems.map((item) => item.areaId))).toEqual(new Set(["area-ground", "area-first"]));
    expect(new Set(mockFloorPlan.decorItems.map((item) => item.assetKey)).size).toBeGreaterThanOrEqual(10);
    expect(mockFloorPlan.decorItems.every((item) => getFloorDecorAsset(item.assetKey))).toBe(true);
    expectDecorDoesNotCoverTables(mockFloorPlan);
  });

  it("applies and clears every seeded decor item without removing custom decor", () => {
    const state = createMockState();
    applyDemoSeed(state);
    expect(state.floorPlan.decorItems).toEqual(demoFloorPlan.decorItems);

    state.floorPlan.decorItems.push({
      ...demoFloorPlan.decorItems[0],
      id: "custom-decor",
      label: "Trang trí riêng",
    });
    removeDemoSeed(state);

    expect(state.floorPlan.decorItems).toEqual([
      expect.objectContaining({ id: "custom-decor", label: "Trang trí riêng" }),
    ]);
  });
});
