import type { FloorPlanChanges, MenuChanges, StoreSettings, StoreSettingsUpdate } from "@/domain";

/** Authenticated non-financial writes. Actor identity is always derived from the employee token. */
export interface IPermissionChangesRepo {
  saveMenuChanges(changes: MenuChanges): Promise<void>;
  saveFloorPlan(changes: FloorPlanChanges): Promise<void>;
  updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings>;
  clearDemoData(input: ClearDemoDataRequest): Promise<void>;
}

export interface ClearDemoDataRequest { requestId: string; confirmation: true }
