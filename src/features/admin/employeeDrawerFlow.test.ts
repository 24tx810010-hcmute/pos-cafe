import { describe, expect, it } from "vitest";
import { EMPTY_EMPLOYEE_FORM, getEmployeeFormErrors, isEmployeeFormDirty, isLastActiveAdmin } from "./employeeDrawerFlow";

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
        { name: "An", role: "cashier", isActive: true },
      ),
    ).toBe(false);
    expect(
      isEmployeeFormDirty(
        { ...EMPTY_EMPLOYEE_FORM, name: "An", role: "admin", isActive: true },
        "emp-1",
        { name: "An", role: "cashier", isActive: true },
      ),
    ).toBe(true);
  });

  it("protects the final active admin account", () => {
    expect(isLastActiveAdmin({ role: "admin", isActive: true }, 1)).toBe(true);
    expect(isLastActiveAdmin({ role: "admin", isActive: true }, 2)).toBe(false);
    expect(isLastActiveAdmin({ role: "cashier", isActive: true }, 1)).toBe(false);
  });
});
