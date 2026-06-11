import { AppError } from "./appError";
import type { Employee, EmployeeRole } from "@/domain";

export type AppModule =
  | "floor"
  | "order"
  | "payment"
  | "orderHistory"
  | "menuEditor"
  | "floorEditor"
  | "employees"
  | "report"
  | "settings"
  | "clearDemo";

const rolePermissions: Record<EmployeeRole, AppModule[]> = {
  admin: [
    "floor",
    "order",
    "payment",
    "orderHistory",
    "menuEditor",
    "floorEditor",
    "employees",
    "report",
    "settings",
    "clearDemo",
  ],
  cashier: ["floor", "order", "payment", "orderHistory"],
  kitchen: [],
};

export const canAccessModule = (employee: Employee | null, module: AppModule): boolean => {
  if (!employee || !employee.isActive) {
    return false;
  }

  return rolePermissions[employee.role].includes(module);
};

export const requireModuleAccess = (employee: Employee | null, module: AppModule): void => {
  if (!canAccessModule(employee, module)) {
    throw new AppError("FORBIDDEN", "Nhân viên không có quyền dùng chức năng này.");
  }
};
