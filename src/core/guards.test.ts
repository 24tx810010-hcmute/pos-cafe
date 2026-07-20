import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  defaultRolePermissions,
  hasPermission,
  requireModuleAccess,
  requirePermission,
} from "./guards";
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

describe("action permissions", () => {
  it("uses the production default matrix for all enforced permissions", () => {
    expect(defaultRolePermissions).toEqual({
      admin: ["order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid"],
      cashier: ["order.create", "order.update", "order.voidOpen", "payment.take"],
      kitchen: [],
    });

    expect(hasPermission(admin, "order.voidOpen")).toBe(true);
    expect(hasPermission(cashier, "order.voidOpen")).toBe(true);
    expect(hasPermission(cashier, "order.voidPaid")).toBe(false);
  });

  it("grants a cashier order.voidPaid via overrides (same role, different rights)", () => {
    const empowered: Employee = {
      ...cashier,
      permissionOverrides: { grants: ["order.voidPaid"], denies: [] },
    };
    expect(hasPermission(empowered, "order.voidPaid")).toBe(true);
  });

  it("lets denies win over a role default", () => {
    const restricted: Employee = {
      ...admin,
      permissionOverrides: { grants: [], denies: ["order.voidPaid"] },
    };
    expect(hasPermission(restricted, "order.voidPaid")).toBe(false);
  });

  it("denies inactive employees and null", () => {
    expect(hasPermission({ ...admin, isActive: false }, "order.voidPaid")).toBe(false);
    expect(hasPermission(null, "order.voidPaid")).toBe(false);
  });

  it("requirePermission throws FORBIDDEN when lacking the permission", () => {
    expect(() => requirePermission(cashier, "order.voidPaid")).toThrow(AppError);
    try {
      requirePermission(cashier, "order.voidPaid");
    } catch (error) {
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });
});
