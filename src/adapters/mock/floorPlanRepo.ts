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
    applyMockFloorPlanChanges(this.state, changes);
  }
}

export function applyMockFloorPlanChanges(state: MockState, changes: FloorPlanChanges): void {
  state.floorPlan.areas.push(...changes.areas.created);
  state.floorPlan.tables.push(
      ...changes.tables.created.map((table) => ({
        ...table,
        status: "empty" as const,
      })),
    );
  state.floorPlan.decorItems.push(
      ...changes.decorItems.created.map((decor) => ({
        ...decor,
        label: decor.label ?? null,
      })),
    );

  for (const area of changes.areas.updated) {
    state.floorPlan.areas = updateById(state.floorPlan.areas, area);
  }
  for (const table of changes.tables.updated) {
    const tableUpdate = stripUndefined(table);
    state.floorPlan.tables = state.floorPlan.tables.map((candidate) =>
      candidate.id === table.id ? { ...candidate, ...tableUpdate, status: candidate.status } : candidate,
    );
  }
  for (const decor of changes.decorItems.updated) {
    state.floorPlan.decorItems = updateById(state.floorPlan.decorItems, decor);
  }

  state.floorPlan.decorItems = removeByIds(state.floorPlan.decorItems, changes.decorItems.deleted);
  state.floorPlan.tables = removeByIds(state.floorPlan.tables, changes.tables.deleted);
  state.floorPlan.areas = removeByIds(state.floorPlan.areas, changes.areas.deleted);
}
