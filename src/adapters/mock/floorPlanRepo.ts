import type { IFloorPlanRepo } from "@/ports";
import type { FloorPlan, FloorPlanChanges } from "@/domain";
import { clone, type MockState } from "./mockState";
import { removeByIds, stripUndefined, updateById } from "./mockRepoShared";

export class MockFloorPlanRepo implements IFloorPlanRepo {
  constructor(private readonly state: MockState) {}

  async getFloorPlan(): Promise<FloorPlan> {
    return clone(this.state.floorPlan);
  }

  async saveFloorPlan(changes: FloorPlanChanges): Promise<void> {
    this.state.floorPlan.areas.push(...changes.areas.created);
    this.state.floorPlan.tables.push(
      ...changes.tables.created.map((table) => ({
        ...table,
        status: "empty" as const,
      })),
    );
    this.state.floorPlan.decorItems.push(
      ...changes.decorItems.created.map((decor) => ({
        ...decor,
        label: decor.label ?? null,
      })),
    );

    for (const area of changes.areas.updated) {
      this.state.floorPlan.areas = updateById(this.state.floorPlan.areas, area);
    }
    for (const table of changes.tables.updated) {
      const tableUpdate = stripUndefined(table);
      this.state.floorPlan.tables = this.state.floorPlan.tables.map((candidate) =>
        candidate.id === table.id ? { ...candidate, ...tableUpdate, status: candidate.status } : candidate,
      );
    }
    for (const decor of changes.decorItems.updated) {
      this.state.floorPlan.decorItems = updateById(this.state.floorPlan.decorItems, decor);
    }

    this.state.floorPlan.decorItems = removeByIds(this.state.floorPlan.decorItems, changes.decorItems.deleted);
    this.state.floorPlan.tables = removeByIds(this.state.floorPlan.tables, changes.tables.deleted);
    this.state.floorPlan.areas = removeByIds(this.state.floorPlan.areas, changes.areas.deleted);
  }
}
