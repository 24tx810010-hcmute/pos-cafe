import { describe, expect, it } from "vitest";
import { createMockPermissionRuntime } from "./permissionRuntime";
import { createMockPermissionState } from "./permissionState";

const empty = () => ({ created: [], updated: [], deleted: [] });

describe("mock permission image transaction", () => {
  it("stages a new draft item and publishes only with its matching atomic create", async () => {
    const state = createMockPermissionState(); const runtime = createMockPermissionRuntime(state);
    await runtime.session.startSession(state.employees.find(employee => employee.role === "owner")!.id, "384729");
    const itemId = crypto.randomUUID();
    const staged = await runtime.menuImages.stageMenuItemImage({ itemId, file: new File(["image"], "item.png", { type: "image/png" }) });
    const changes = { categories: empty(), menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty(), imageChanges: [{ itemId, uploadHandle: staged.uploadHandle }] };
    // Neither a dangling target nor a different item can consume the handle.
    await expect(runtime.changes.saveMenuChanges(changes)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(runtime.changes.saveMenuChanges({ ...changes, imageChanges: [{ itemId: state.business.menu.menuItems[0].id, uploadHandle: staged.uploadHandle }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toBeNull();
    await runtime.changes.saveMenuChanges({ ...changes, menuItems: { ...empty(), created: [{ id: itemId, categoryId: state.business.menu.categories[0].id, name: "Món mới có ảnh", price: 25000, sortOrder: 0, isAvailable: true }] } });
    expect(state.business.menu.menuItems.find(item => item.id === itemId)?.imageAssetKey).toBe(staged.uploadHandle);
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toMatch(/^(blob:|data:)/);
    const replacement = await runtime.menuImages.stageMenuItemImage({ itemId, file: new File(["next"], "next.png", { type: "image/png" }) });
    await expect(runtime.changes.saveMenuChanges({ ...changes, menuItems: { ...empty(), deleted: [{ id: itemId }] }, imageChanges: [{ itemId, uploadHandle: replacement.uploadHandle }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.business.menu.menuItems.some(item => item.id === itemId)).toBe(true);
    await runtime.changes.saveMenuChanges({ ...changes, menuItems: { ...empty(), deleted: [{ id: itemId }] }, imageChanges: [] });
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toBeNull();
    await expect(runtime.changes.saveMenuChanges({ ...changes, imageChanges: [{ itemId, uploadHandle: replacement.uploadHandle }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(runtime.menuImages.getImageUrl(replacement.uploadHandle)).toBeNull();
  });
  it("keeps staging private until the matching menu transaction publishes it", async () => {
    const state = createMockPermissionState(); const runtime = createMockPermissionRuntime(state);
    const owner = state.employees.find(employee => employee.role === "owner")!;
    await runtime.session.startSession(owner.id, "384729");
    const item = state.business.menu.menuItems[0];
    const staged = await runtime.menuImages.stageMenuItemImage({ itemId: item.id, file: new File(["image"], "item.png", { type: "image/png" }) });
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toBeNull();
    await runtime.changes.saveMenuChanges({ categories: empty(), menuItems: empty(), optionGroups: empty(), optionValues: empty(), menuItemOptionGroups: empty(), imageChanges: [{ itemId: item.id, uploadHandle: staged.uploadHandle }] });
    expect(state.business.menu.menuItems.find(candidate => candidate.id === item.id)?.imageAssetKey).toBe(staged.uploadHandle);
    expect(runtime.menuImages.getImageUrl(staged.uploadHandle)).toMatch(/^(blob:|data:)/);
    await expect(runtime.menuImages.readStagedMenuItemImage(staged.uploadHandle)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
