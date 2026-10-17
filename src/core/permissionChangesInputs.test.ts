import { describe, expect, it } from "vitest";
import { parsePermissionFloorPlanChanges, parsePermissionMenuChanges, parsePermissionStoreSettingsUpdate } from "./permissionChangesInputs";

const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const changeset = { created: [], updated: [], deleted: [] };

describe("T08 permission change input contracts", () => {
  it("accepts exact current domain shapes without inventing UI bounds", () => {
    const menu = { categories: { ...changeset, created: [{ id: id(1), name: "", sortOrder: -1 }] }, menuItems: changeset,
      optionGroups: changeset, optionValues: changeset, menuItemOptionGroups: changeset };
    expect(parsePermissionMenuChanges(menu)).toEqual(menu);
    const floor = { areas: changeset, tables: { ...changeset, created: [{ id: id(2), areaId: id(1), name: "Bàn", backgroundAssetKey: null,
      posX: -0.5, posY: 2, width: 0, height: 80, shape: "square", rotation: 360.5, seats: 0, sortOrder: -2 }] }, decorItems: changeset };
    expect(parsePermissionFloorPlanChanges(floor)).toEqual(floor);
    expect(parsePermissionStoreSettingsUpdate({ displayName: "", timezone: "Asia/Ho_Chi_Minh" })).toEqual({ displayName: "", timezone: "Asia/Ho_Chi_Minh" });
  });

  it.each([
    () => parsePermissionMenuChanges({ categories: changeset, menuItems: changeset, optionGroups: changeset, optionValues: changeset, menuItemOptionGroups: changeset, actorId: id(9) }),
    () => parsePermissionMenuChanges({ categories: { ...changeset, updated: [{ id: id(1), secret: true }] }, menuItems: changeset, optionGroups: changeset, optionValues: changeset, menuItemOptionGroups: changeset }),
    () => parsePermissionFloorPlanChanges({ areas: changeset, tables: { ...changeset, created: [{ id: id(2) }] }, decorItems: changeset }),
    () => parsePermissionStoreSettingsUpdate({ timezone: "Not/A_Timezone" }),
    () => parsePermissionStoreSettingsUpdate({ displayName: "Quán", employeeId: id(9) }),
  ])("rejects unknown, missing, or mistyped request data: case %#", (action) => {
    expect(action).toThrow(expect.objectContaining({ code: "INVALID_WRITE_REQUEST" }));
  });
});
