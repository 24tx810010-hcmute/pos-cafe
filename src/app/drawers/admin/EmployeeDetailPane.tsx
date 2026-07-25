import { Button, TextField } from "@mui/material";
import { KeyRound, Lock, RotateCcw, Save } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Employee, EmployeeRole } from "@/domain";
import {
  PERMISSION_OPTIONS,
  defaultPermissionsForRole,
  type EmployeeDrawerForm,
} from "@/features/admin/employeeDrawerFlow";

interface EmployeeDetailPaneProps {
  selectedId: string | "new" | null;
  selectedRecord: Employee | null;
  currentEmployeeId: string | undefined;
  form: EmployeeDrawerForm;
  setForm: Dispatch<SetStateAction<EmployeeDrawerForm>>;
  errors: { name?: string; pin?: string };
  setErrors: Dispatch<SetStateAction<{ name?: string; pin?: string }>>;
  roleOptions: Array<{ role: EmployeeRole; label: string }>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  isLastActiveAdmin: (employee: Pick<Employee, "role" | "isActive">) => boolean;
  onSave: () => void;
}

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const permissionSwitchClass =
  "relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-pos-line transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-pos-primary checked:before:translate-x-4 disabled:cursor-not-allowed disabled:opacity-50";

export function EmployeeDetailPane({
  selectedId,
  selectedRecord,
  currentEmployeeId,
  form,
  setForm,
  errors,
  setErrors,
  roleOptions,
  nameInputRef,
  isSaving,
  isLastActiveAdmin,
  onSave,
}: EmployeeDetailPaneProps) {
  const lockSelf = selectedRecord != null && currentEmployeeId === selectedRecord.id;
  const lockLastAdmin = selectedRecord != null && isLastActiveAdmin(selectedRecord);
  const lockDisabled = lockSelf || lockLastAdmin;
  const title = selectedId === "new" ? "Thêm nhân viên" : selectedRecord?.name ?? "Chi tiết nhân viên";
  const roleLabel =
    roleOptions.find((option) => option.role === form.role)?.label ?? form.role;
  const initials = selectedId === "new" ? "+" : employeeInitials(form.name || selectedRecord?.name || "");

  return (
    <aside
      className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-pos-surface"
      data-testid="employee-detail-pane"
    >
      <header
        className="flex min-h-16 items-center justify-between gap-3 border-b border-pos-line bg-pos-surface px-4 py-3"
        data-testid="employee-detail-header"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pos-primary text-sm font-black text-white">
            {initials}
          </span>
          <div className="grid min-w-0 gap-0.5">
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-black">
              {title}
            </strong>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-pos-muted">
              {selectedId === "new"
                ? "Tạo hồ sơ và PIN đăng nhập"
                : roleLabel}
            </span>
          </div>
        </div>
        {selectedId && (
          <div className="flex shrink-0 items-center gap-2">
            {!form.isActive && selectedId !== "new" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pos-surface2 px-2.5 py-1 text-xs font-bold text-pos-muted">
                <Lock size={13} />
                Tạm khoá
              </span>
            )}
            <Button
              variant="contained"
              startIcon={<Save size={15} />}
              data-testid="save-employee-button"
              disabled={isSaving}
              onClick={onSave}
            >
              {isSaving ? "Đang lưu..." : "Lưu nhân viên"}
            </Button>
          </div>
        )}
      </header>

      <div className="min-h-0 overflow-auto bg-pos-surface">
        {!selectedId ? (
          <div className="grid min-h-full place-items-center p-6 text-center">
            <div className="grid max-w-sm gap-2">
              <strong>Chọn một nhân viên</strong>
              <p className="m-0 text-sm text-pos-muted">
                Chọn nhân viên ở danh sách bên trái hoặc bấm “Thêm nhân viên”.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-full min-w-0 bg-pos-surface">
            <section className="grid gap-4 border-b border-pos-line bg-pos-surface p-4">
              <div className="grid gap-1">
                <strong className="text-sm font-black">Thông tin đăng nhập</strong>
                <span className="text-xs text-pos-muted">
                  Tên, vai trò và trạng thái đăng nhập trên thiết bị POS.
                </span>
              </div>

              <div className="grid grid-cols-2 items-start gap-3">
                <TextField
                  label="Tên nhân viên"
                  value={form.name}
                  inputRef={nameInputRef}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  error={!!errors.name}
                  helperText={errors.name}
                  size="small"
                  fullWidth
                  inputProps={{ "data-testid": "employee-name-input" }}
                />

                <TextField
                  select
                  label="Vai trò"
                  value={form.role}
                  onChange={(event) => {
                    const role = event.target.value as EmployeeRole;
                    setForm((current) => ({
                      ...current,
                      role,
                      permissions: defaultPermissionsForRole(role),
                    }));
                  }}
                  size="small"
                  fullWidth
                  SelectProps={{ native: true }}
                  inputProps={{ "data-testid": "employee-role-select" }}
                >
                  {roleOptions.map(({ role, label }) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </TextField>
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-dashed border-pos-line pt-3">
                <div className="grid gap-0.5">
                  <strong className="text-[13px]">Cho phép đăng nhập</strong>
                  <span className="text-[11.5px] text-pos-muted">
                    Tắt để tạm khoá tài khoản mà không xoá dữ liệu nhân viên.
                  </span>
                  {lockDisabled && (
                    <span className="text-[11.5px] text-pos-warning">
                      {lockSelf
                        ? "Không thể tạm khoá tài khoản đang đăng nhập."
                        : "Cần giữ ít nhất một quản lý đang hoạt động."}
                    </span>
                  )}
                </div>
                <input
                  type="checkbox"
                  className={permissionSwitchClass}
                  data-testid="employee-active-toggle"
                  aria-label="Cho phép nhân viên đăng nhập"
                  checked={form.isActive}
                  disabled={isSaving || lockDisabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
              </div>
            </section>

            {selectedRecord && (
              <section className="grid gap-4 border-b border-pos-line bg-pos-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <strong className="text-sm font-black">Quyền thao tác</strong>
                    <span className="text-xs text-pos-muted">
                      Mặc định theo vai trò; bật hoặc tắt riêng cho nhân viên này.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] border border-pos-line bg-pos-surface px-2.5 text-xs font-bold text-pos-muted transition-colors hover:border-pos-primary hover:text-pos-primary"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        permissions: defaultPermissionsForRole(current.role),
                      }))
                    }
                  >
                    <RotateCcw size={14} />
                    Mặc định vai trò
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-6">
                  {PERMISSION_OPTIONS.map(({ code, label, description }) => (
                    <label
                      key={code}
                      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-pos-line py-3"
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-[13px] font-bold text-pos-ink">{label}</span>
                        <span className="text-[11.5px] text-pos-muted">{description}</span>
                      </span>
                      <input
                        type="checkbox"
                        className={permissionSwitchClass}
                        data-testid={`employee-permission-${code}`}
                        checked={form.permissions.includes(code)}
                        disabled={isSaving}
                        onChange={(event) => {
                          const next = new Set(form.permissions);
                          if (event.target.checked) next.add(code);
                          else next.delete(code);
                          setForm((current) => ({
                            ...current,
                            permissions: PERMISSION_OPTIONS.filter((option) =>
                              next.has(option.code),
                            ).map((option) => option.code),
                          }));
                        }}
                      />
                    </label>
                  ))}
                </div>

                {currentEmployeeId === selectedRecord.id && (
                  <p
                    className="m-0 rounded-[7px] bg-pos-primarySoft px-3 py-2.5 text-[11.5px] text-pos-primary"
                    data-testid="employee-self-permission-warning"
                  >
                    Bạn đang sửa quyền của chính mình. Quyền trên thiết bị này được cập nhật
                    sau khi đăng nhập lại.
                  </p>
                )}
              </section>
            )}

            <section className="grid gap-4 bg-pos-surface p-4">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-pos-primary" />
                <div className="grid gap-0.5">
                  <strong className="text-sm font-black">
                    {selectedId === "new" ? "Đặt PIN" : "Đặt lại PIN"}
                  </strong>
                  <span className="text-xs text-pos-muted">
                    PIN gồm 4–6 chữ số và không hiển thị lại sau khi lưu.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="PIN mới"
                  value={form.newPin}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      newPin: event.target.value.replace(/\D/g, "").slice(0, 6),
                    }));
                    setErrors((current) => ({ ...current, pin: undefined }));
                  }}
                  size="small"
                  fullWidth
                  inputProps={{
                    inputMode: "numeric",
                    type: "password",
                    "data-testid": "employee-pin-input",
                  }}
                />
                <TextField
                  label="Xác nhận PIN"
                  value={form.confirmPin}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      confirmPin: event.target.value.replace(/\D/g, "").slice(0, 6),
                    }));
                    setErrors((current) => ({ ...current, pin: undefined }));
                  }}
                  error={!!errors.pin}
                  helperText={
                    errors.pin ||
                    (selectedId === "new"
                      ? "PIN 4–6 chữ số."
                      : "Để trống nếu không đổi PIN.")
                  }
                  size="small"
                  fullWidth
                  inputProps={{
                    inputMode: "numeric",
                    type: "password",
                    "data-testid": "employee-confirm-pin-input",
                  }}
                />
              </div>
            </section>
          </div>
        )}
      </div>

    </aside>
  );
}
