import { describe, expect, it } from "vitest";
import { canAccessModule, requireModuleAccess } from "./guards";
import { AppError } from "./appError";
import type { Employee } from "@/domain";

const admin: Employee = { id: "admin", name: "Admin", role: "admin", isActive: true };
const cashier: Employee = { id: "cashier", name: "Cashier", role: "cashier", isActive: true };

describe("module guards", () => {
  it("allows admin to access editor and report modules", () => {
    expect(canAccessModule(admin, "menuEditor")).toBe(true);
    expect(canAccessModule(admin, "floorEditor")).toBe(true);
    expect(canAccessModule(admin, "report")).toBe(true);
  });

  it("keeps cashier limited to POS operation modules", () => {
    expect(canAccessModule(cashier, "floor")).toBe(true);
    expect(canAccessModule(cashier, "payment")).toBe(true);
    expect(canAccessModule(cashier, "menuEditor")).toBe(false);
  });

  it("throws AppError for forbidden access", () => {
    expect(() => requireModuleAccess(cashier, "settings")).toThrow(AppError);
  });
});
