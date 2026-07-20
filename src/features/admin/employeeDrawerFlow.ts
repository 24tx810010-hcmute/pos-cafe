import { defaultRolePermissions, hasPermission } from "@/core/guards";
import type {
  Employee,
  EmployeePermission,
  EmployeePermissionOverrides,
  EmployeeRole,
} from "@/domain";

export const PERMISSION_OPTIONS: ReadonlyArray<{
  code: EmployeePermission;
  label: string;
  description: string;
}> = [
  { code: "order.create", label: "Tạo đơn", description: "Tạo đơn mới tại quầy hoặc bàn." },
  { code: "order.update", label: "Cập nhật đơn", description: "Thêm, bớt hoặc sửa món trong đơn đang mở." },
  { code: "order.voidOpen", label: "Hủy đơn đang mở", description: "Hủy đơn chưa thanh toán bằng cách xóa hết món." },
  { code: "payment.take", label: "Thanh toán đơn", description: "Nhận và xác nhận thanh toán cho đơn." },
  { code: "order.voidPaid", label: "Hủy đơn đã thanh toán", description: "Hủy giao dịch đã thanh toán và ghi nhận lý do." },
];

export const defaultPermissionsForRole = (role: EmployeeRole): EmployeePermission[] => [
  ...defaultRolePermissions[role],
];

export const effectivePermissions = (employee: Employee): EmployeePermission[] =>
  PERMISSION_OPTIONS.filter(({ code }) => hasPermission(employee, code)).map(({ code }) => code);

export const permissionsToOverrides = (
  role: EmployeeRole,
  effective: EmployeePermission[],
): EmployeePermissionOverrides | null => {
  const checked = new Set(effective);
  const defaults = new Set(defaultRolePermissions[role]);
  const grants = PERMISSION_OPTIONS.map(({ code }) => code).filter(
    (code) => checked.has(code) && !defaults.has(code),
  );
  const denies = PERMISSION_OPTIONS.map(({ code }) => code).filter(
    (code) => defaults.has(code) && !checked.has(code),
  );

  return grants.length === 0 && denies.length === 0 ? null : { grants, denies };
};

export interface EmployeeDrawerForm {
  name: string;
  role: EmployeeRole;
  isActive: boolean;
  permissions: EmployeePermission[];
  newPin: string;
  confirmPin: string;
}

export type EmployeeRecordSnapshot = Employee;

export type EmployeeFormErrors = {
  name?: string;
  pin?: string;
};

export const EMPTY_EMPLOYEE_FORM: EmployeeDrawerForm = {
  name: "",
  role: "cashier",
  isActive: true,
  permissions: defaultPermissionsForRole("cashier"),
  newPin: "",
  confirmPin: "",
};

export const isEmployeeFormDirty = (
  form: EmployeeDrawerForm,
  selectedId: string | "new" | null,
  selectedRecord: EmployeeRecordSnapshot | null,
): boolean => {
  if (selectedId === "new") {
    return (
      form.name.trim() !== "" ||
      form.role !== EMPTY_EMPLOYEE_FORM.role ||
      form.isActive !== EMPTY_EMPLOYEE_FORM.isActive ||
      form.newPin !== "" ||
      form.confirmPin !== ""
    );
  }

  if (!selectedRecord) {
    return false;
  }

  return (
    form.name !== selectedRecord.name ||
    form.role !== selectedRecord.role ||
    form.isActive !== selectedRecord.isActive ||
    form.permissions.join("|") !== effectivePermissions(selectedRecord).join("|") ||
    form.newPin !== "" ||
    form.confirmPin !== ""
  );
};

export const getEmployeeFormErrors = (form: EmployeeDrawerForm, isNew: boolean): EmployeeFormErrors => {
  const next: EmployeeFormErrors = {};

  if (!form.name.trim()) {
    next.name = "Tên nhân viên không được để trống.";
  }

  const pinTouched = isNew || form.newPin !== "" || form.confirmPin !== "";
  if (pinTouched) {
    if (!/^\d{4,6}$/.test(form.newPin)) {
      next.pin = "PIN phải gồm 4–6 chữ số.";
    } else if (form.newPin !== form.confirmPin) {
      next.pin = "Xác nhận PIN không khớp.";
    }
  }

  return next;
};

export const isLastActiveAdmin = (
  employee: Pick<EmployeeRecordSnapshot, "role" | "isActive">,
  activeAdminCount: number,
): boolean => employee.role === "admin" && employee.isActive && activeAdminCount <= 1;
