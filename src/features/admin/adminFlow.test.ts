import { describe, expect, it, vi } from "vitest";
import { createMockPorts, createSeededMockState } from "@/adapters/mock";
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

const admin: Pick<Employee, "id" | "role"> = { id: "emp-admin", role: "admin" };
const cashier: Pick<Employee, "id" | "role"> = { id: "emp-cashier-1", role: "cashier" };

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

    menuChanges.menuItems.updated.push({ id: "mi-latte", price: 47000 });
    floorChanges.tables.deleted.push({ id: "tbl-b01", deletedByEmployeeId: "emp-admin" });

    expect(hasMenuChanges(menuChanges)).toBe(true);
    expect(hasFloorPlanChanges(floorChanges)).toBe(true);
  });

  it("saves menu and floor plan changes through ports", async () => {
    const ports = createMockPorts();
    const menuChanges = createEmptyMenuChanges();
    const floorChanges = createEmptyFloorPlanChanges();
    const menuSpy = vi.spyOn(ports.menu, "saveMenuChanges");
    const floorSpy = vi.spyOn(ports.floorPlan, "saveFloorPlan");

    await saveMenuForAdmin(ports, { actor: admin, changes: menuChanges });
    await saveFloorPlanForAdmin(ports, { actor: admin, changes: floorChanges });

    expect(menuSpy).toHaveBeenCalledWith(menuChanges);
    expect(floorSpy).toHaveBeenCalledWith(floorChanges);
  });

  it("blocks menu and floor mutations for non-admin actors before calling ports", async () => {
    const ports = createMockPorts();
    const menuSpy = vi.spyOn(ports.menu, "saveMenuChanges");
    const floorSpy = vi.spyOn(ports.floorPlan, "saveFloorPlan");

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
    const ports = createMockPorts();

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
    const ports = createMockPorts();
    const clearSpy = vi.spyOn(ports.settings, "clearDemoData").mockResolvedValue(undefined);

    const settings = await updateSettingsForAdmin(ports, {
      actor: admin,
      settings: { displayName: "Cafe mới" },
    });
    await clearDemoDataForAdmin(ports, { actor: admin });

    expect(settings.displayName).toBe("Cafe mới");
    expect(clearSpy).toHaveBeenCalledWith("emp-admin");
  });

  it("keeps clear-demo blocked errors from settings port visible to UI", async () => {
    const ports = createMockPorts(createSeededMockState());

    await expect(clearDemoDataForAdmin(ports, { actor: admin })).rejects.toMatchObject({
      code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO",
    });
  });
});
