import { describe, expect, it } from "vitest";
import type { Employee } from "@/domain";
import {
  EMPTY_EMPLOYEE_FORM,
  defaultPermissionsForRole,
  effectivePermissions,
  getEmployeeFormErrors,
  isEmployeeFormDirty,
  isLastActiveAdmin,
  permissionsToOverrides,
} from "./employeeDrawerFlow";

const cashier: Employee = {
  id: "emp-1",
  name: "An",
  role: "cashier",
  isActive: true,
};

describe("employeeDrawerFlow", () => {
  it("validates required name and new employee PIN confirmation", () => {
    expect(getEmployeeFormErrors({ ...EMPTY_EMPLOYEE_FORM, newPin: "1234", confirmPin: "9999" }, true)).toEqual({
      name: "Tên nhân viên không được để trống.",
      pin: "Xác nhận PIN không khớp.",
    });
  });

  it("detects dirty create and edit forms", () => {
    expect(isEmployeeFormDirty({ ...EMPTY_EMPLOYEE_FORM, name: "An" }, "new", null)).toBe(true);
    expect(
      isEmployeeFormDirty(
        { ...EMPTY_EMPLOYEE_FORM, name: "An", role: "cashier", isActive: true },
        "emp-1",
        cashier,
      ),
    ).toBe(false);
    expect(
      isEmployeeFormDirty(
        { ...EMPTY_EMPLOYEE_FORM, name: "An", role: "admin", isActive: true },
        "emp-1",
        cashier,
      ),
    ).toBe(true);
    expect(
      isEmployeeFormDirty(
        {
          ...EMPTY_EMPLOYEE_FORM,
          name: "An",
          permissions: defaultPermissionsForRole("cashier").filter((code) => code !== "payment.take"),
        },
        "emp-1",
        cashier,
      ),
    ).toBe(true);
  });

  it("converts effective permissions to minimal role overrides", () => {
    const defaults = defaultPermissionsForRole("cashier");
    expect(permissionsToOverrides("cashier", defaults)).toBeNull();

    expect(permissionsToOverrides("cashier", [...defaults, "order.voidPaid"])).toEqual({
      grants: ["order.voidPaid"],
      denies: [],
    });
    expect(
      permissionsToOverrides(
        "cashier",
        defaults.filter((code) => code !== "payment.take"),
      ),
    ).toEqual({ grants: [], denies: ["payment.take"] });
  });

  it("round-trips stored overrides through effective checkbox permissions", () => {
    const employee: Employee = {
      ...cashier,
      permissionOverrides: {
        grants: ["order.voidPaid"],
        denies: ["payment.take"],
      },
    };

    const effective = effectivePermissions(employee);
    expect(effective).toEqual(["order.create", "order.update", "order.voidOpen", "order.voidPaid"]);
    expect(permissionsToOverrides(employee.role, effective)).toEqual(employee.permissionOverrides);
  });

  it("protects the final active admin account", () => {
    expect(isLastActiveAdmin({ role: "admin", isActive: true }, 1)).toBe(true);
    expect(isLastActiveAdmin({ role: "admin", isActive: true }, 2)).toBe(false);
    expect(isLastActiveAdmin({ role: "cashier", isActive: true }, 1)).toBe(false);
  });
});
