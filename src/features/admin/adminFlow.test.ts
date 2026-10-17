import { describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
import { createCandidateRuntimeFixture } from "@/test/candidateRuntimeFixture";
import type { Employee } from "@/domain";
import {
  clearDemoDataForAdmin,
  createEmployeeForAdmin,
  createEmptyFloorPlanChanges,
  createEmptyMenuChanges,
  hasFloorPlanChanges,
  hasMenuChanges,
  requireAdminActor,
  resetPinForAdmin,
  saveFloorPlanForAdmin,
  saveMenuForAdmin,
  updateEmployeeForAdmin,
  updateSettingsForAdmin,
} from "./adminFlow";

const admin: Pick<Employee, "id" | "role"> = { id: "6b7bd350-7db2-4160-8471-cca2668c070d", role: "admin" };
const cashier: Pick<Employee, "id" | "role"> = { id: "22828322-623b-42e7-8a28-a2bdf367c364", role: "cashier" };

describe("adminFlow", () => {
  it("allows admin actors and rejects non-admin actors", () => {
    expect(requireAdminActor(admin)).toEqual(admin);
    expect(() => requireAdminActor(cashier)).toThrow("Chỉ quản lý");
    expect(() => requireAdminActor(null)).toThrow("Chỉ quản lý");
  });

  it("builds empty changesets and detects dirty menu/floor changes", () => {
    const menuChanges = createEmptyMenuChanges();
    const floorChanges = createEmptyFloorPlanChanges();

    expect(hasMenuChanges(menuChanges)).toBe(false);
    expect(hasFloorPlanChanges(floorChanges)).toBe(false);

    menuChanges.menuItems.updated.push({ id: "d50ff72b-d0bc-4832-8888-183c19f5a158", price: 47000 });
    floorChanges.tables.deleted.push({ id: "7b035353-73d6-44bc-8ec4-1ab9951f7a58", deletedByEmployeeId: "6b7bd350-7db2-4160-8471-cca2668c070d" });

    expect(hasMenuChanges(menuChanges)).toBe(true);
    expect(hasFloorPlanChanges(floorChanges)).toBe(true);
  });

  it("saves menu and floor plan changes through ports", async () => {
    const { ports, actor } = await createCandidateRuntimeFixture();
    const menuChanges = createEmptyMenuChanges();
    const floorChanges = createEmptyFloorPlanChanges();
    const menuSpy = vi.spyOn(ports.permission!.changes, "saveMenuChanges");
    const floorSpy = vi.spyOn(ports.permission!.changes, "saveFloorPlan");

    await saveMenuForAdmin(ports, { actor, changes: menuChanges });
    await saveFloorPlanForAdmin(ports, { actor, changes: floorChanges });

    expect(menuSpy).toHaveBeenCalledWith(menuChanges);
    expect(floorSpy).toHaveBeenCalledWith(floorChanges);
  });

  it("blocks menu and floor mutations for non-admin actors before calling ports", async () => {
    const { ports } = await createCandidateRuntimeFixture();
    const menuSpy = vi.spyOn(ports.permission!.changes, "saveMenuChanges");
    const floorSpy = vi.spyOn(ports.permission!.changes, "saveFloorPlan");

    await expect(
      saveMenuForAdmin(ports, { actor: cashier, changes: createEmptyMenuChanges() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveFloorPlanForAdmin(ports, { actor: cashier, changes: createEmptyFloorPlanChanges() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(menuSpy).not.toHaveBeenCalled();
    expect(floorSpy).not.toHaveBeenCalled();
  });

  it("creates, updates, and resets employees through employee port", async () => {
    const state = createSeededMockState();
    state.session = { storeId: state.settings.storeId, storeNo: 1 };
    const ports = createMockPorts(state);
    await ports.employee.startSession(admin.id, "123456");

    const created = await createEmployeeForAdmin(ports, {
      actor: admin,
      employee: { id: "emp-new", name: "Nhân viên mới", role: "cashier", pin: "333333" },
    });
    const updated = await updateEmployeeForAdmin(ports, {
      actor: admin,
      employee: { id: "emp-new", name: "Thu ngân mới" },
    });
    await resetPinForAdmin(ports, { actor: admin, employeeId: "emp-new", newPin: "444444" });

    expect(created).toMatchObject({ id: "emp-new", role: "cashier", isActive: true });
    expect(updated.name).toBe("Thu ngân mới");
    await expect(ports.employee.verifyPin("emp-new", "444444")).resolves.toMatchObject({
      id: "emp-new",
    });
  });

  it("updates settings and passes admin employee id to clear demo", async () => {
    const { ports, actor } = await createCandidateRuntimeFixture();
    const clearSpy = vi.spyOn(ports.permission!.changes, "clearDemoData").mockResolvedValue(undefined);

    const settings = await updateSettingsForAdmin(ports, {
      actor,
      settings: { displayName: "Cafe mới" },
    });
    await clearDemoDataForAdmin(ports, { actor, requestId: "73000000-0000-4000-8000-000000000001", confirmation: true });

    expect(settings.displayName).toBe("Cafe mới");
    expect(clearSpy).toHaveBeenCalledWith({ requestId: "73000000-0000-4000-8000-000000000001", confirmation: true });
  });

  it("keeps clear-demo blocked errors from settings port visible to UI", async () => {
    const { ports, actor } = await createCandidateRuntimeFixture();

    await expect(clearDemoDataForAdmin(ports, { actor, requestId: "73000000-0000-4000-8000-000000000002", confirmation: true })).rejects.toMatchObject({
      code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO",
    });
  });
});
