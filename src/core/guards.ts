import { AppError } from "./appError";
import type { Employee, EmployeePermission, EmployeeRole } from "@/domain";

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
  | "clearDemo"
  | "kitchen";

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
    "kitchen",
  ],
  cashier: ["floor", "order", "payment", "orderHistory"],
  kitchen: ["kitchen"],
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

// Quyền theo hành động (permission), độc lập với quyền vào module ở trên:
// module = thấy gì trên nav; permission = được làm gì. Hai trục bổ trợ nhau.
const defaultRolePermissions: Record<EmployeeRole, EmployeePermission[]> = {
  admin: ["order.create", "order.update", "payment.take", "order.voidPaid"],
  cashier: ["order.create", "order.update", "payment.take"],
  kitchen: [],
};

// Quyền hiệu lực = (default_theo_role ∪ grants) − denies. denies luôn thắng.
export const hasPermission = (employee: Employee | null, permission: EmployeePermission): boolean => {
  if (!employee || !employee.isActive) {
    return false;
  }

  const overrides = employee.permissionOverrides;
  if (overrides?.denies.includes(permission)) {
    return false;
  }

  return defaultRolePermissions[employee.role].includes(permission) || !!overrides?.grants.includes(permission);
};

export const requirePermission = (employee: Employee | null, permission: EmployeePermission): void => {
  if (!hasPermission(employee, permission)) {
    throw new AppError("FORBIDDEN", "Nhân viên không có quyền thực hiện thao tác này.");
  }
};
