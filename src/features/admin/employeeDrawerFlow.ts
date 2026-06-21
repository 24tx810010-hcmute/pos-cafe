import type { EmployeeRole } from "@/domain";

export interface EmployeeDrawerForm {
  name: string;
  role: EmployeeRole;
  isActive: boolean;
  newPin: string;
  confirmPin: string;
}

export type EmployeeRecordSnapshot = {
  name: string;
  role: EmployeeRole;
  isActive: boolean;
};

export type EmployeeFormErrors = {
  name?: string;
  pin?: string;
};

export const EMPTY_EMPLOYEE_FORM: EmployeeDrawerForm = {
  name: "",
  role: "cashier",
  isActive: true,
  newPin: "",
  confirmPin: "",
};

export const isEmployeeFormDirty = (
  form: EmployeeDrawerForm,
  selectedId: string | "new" | null,
  selectedRecord: EmployeeRecordSnapshot | null,
): boolean => {
  if (selectedId === "new") {
    return form.name.trim() !== "" || form.newPin !== "" || form.confirmPin !== "";
  }

  if (!selectedRecord) {
    return false;
  }

  return (
    form.name !== selectedRecord.name ||
    form.role !== selectedRecord.role ||
    form.isActive !== selectedRecord.isActive ||
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
