import { Button, TextField } from "@mui/material";
import { KeyRound, Lock, Save } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  EmployeeAdminView,
  PermissionCatalog,
  SelectablePermissionRole,
} from "@/domain/permissions";
import {
  defaultPermissionSelection,
  permissionSourceLabel,
  type PermissionEmployeeErrors,
  type PermissionEmployeeForm,
} from "@/features/admin/permissionEmployeeFlow";
const toggleClass =
  "relative h-5 w-9 shrink-0 appearance-none rounded-full bg-pos-line before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white checked:bg-pos-primary checked:before:translate-x-4 disabled:opacity-50";
export function EmployeeDetailPane(p: {
  selectedId: string | "new" | null;
  selectedRecord: EmployeeAdminView | null;
  actorId?: string;
  actorRole?: string;
  actorPermissions: readonly string[];
  catalog: PermissionCatalog;
  form: PermissionEmployeeForm;
  setForm: Dispatch<SetStateAction<PermissionEmployeeForm>>;
  errors: PermissionEmployeeErrors;
  setErrors: Dispatch<SetStateAction<PermissionEmployeeErrors>>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  saving: boolean;
  canManage: boolean;
  canEditPermissions: boolean;
  targetWithinCeiling: boolean;
  onSave(): void;
}) {
  const self = !!p.selectedRecord && p.selectedRecord.id === p.actorId,
    owner = p.selectedRecord?.role === "owner",
    unsupported = p.selectedRecord?.role === "kitchen";
  const displayedRole = owner || unsupported ? p.selectedRecord!.role : p.form.role;
  const roleOptions = p.catalog.roles.filter(role => owner || unsupported ? role.code === displayedRole : role.selectable);
  const lockFields =
      !p.canManage || unsupported || (owner && !self) || !p.targetWithinCeiling,
    lockSensitive = lockFields || self || owner,
    permissionLocked =
      !p.canEditPermissions ||
      self ||
      owner ||
      unsupported ||
      !p.targetWithinCeiling;
  const saveDisabled =
    p.saving || !p.targetWithinCeiling || unsupported || (owner && !self) ||
    (!p.canManage && !(p.canEditPermissions && p.form.permissionsTouched));
  const set = (patch: Partial<PermissionEmployeeForm>) =>
    p.setForm((current) => ({ ...current, ...patch }));
  if (!p.selectedId)
    return (
      <aside
        className="grid place-items-center"
        data-testid="employee-detail-pane"
      >
        <p>Chọn một nhân viên để xem chi tiết.</p>
      </aside>
    );
  return (
    <aside
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
      data-testid="employee-detail-pane"
    >
      <header className="flex min-h-16 items-center justify-between border-b border-pos-line px-4">
        <div>
          <strong>
            {p.selectedId === "new" ? "Thêm nhân viên" : p.selectedRecord?.name}
          </strong>
          <p className="m-0 text-xs text-pos-muted">
            {unsupported
              ? "Vai trò chưa được hỗ trợ"
              : owner
                ? "Chủ quán"
                : p.catalog.roles.find(role => role.code === displayedRole)?.labelVi}
          </p>
        </div>
        <Button
          variant="contained"
          startIcon={<Save size={15} />}
          data-testid="save-employee-button"
          disabled={saveDisabled}
          onClick={p.onSave}
        >
          {p.saving ? "Đang lưu..." : "Lưu nhân viên"}
        </Button>
      </header>
      <div className="min-h-0 overflow-auto p-4">
        <section className="grid gap-4 border-b border-pos-line pb-4">
          {!p.targetWithinCeiling && (
            <p className="m-0 rounded bg-amber-50 p-2 text-sm text-pos-warning">
              Không thể quản lý nhân viên này vì quyền hiện tại của họ vượt
              quyền của bạn.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Tên nhân viên"
              value={p.form.name}
              inputRef={p.nameInputRef}
              disabled={lockFields}
              error={!!p.errors.name}
              helperText={p.errors.name}
              inputProps={{ "data-testid": "employee-name-input" }}
              onChange={(e) => {
                set({ name: e.target.value });
                p.setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
            <TextField
              select
              SelectProps={{ native: true }}
              label="Vai trò"
              value={displayedRole}
              disabled={lockSensitive}
              inputProps={{ "data-testid": "employee-role-select" }}
              onChange={(e) => {
                const role = e.target.value as SelectablePermissionRole;
                set({
                  role,
                  permissions: defaultPermissionSelection(p.catalog, role),
                  permissionsTouched: false,
                });
              }}
            >
              {roleOptions.map(role => (
                <option key={role.code} value={role.code}>
                  {role.labelVi}
                </option>
              ))}
            </TextField>
          </div>
          {p.selectedId !== "new" && (
            <label className="flex justify-between">
              <span>
                <strong className="block text-sm">Cho phép đăng nhập</strong>
                <small className="text-pos-muted">
                  Tắt để tạm khoá tài khoản.
                </small>
              </span>
              <input
                type="checkbox"
                className={toggleClass}
                data-testid="employee-active-toggle"
                checked={p.form.isActive}
                disabled={lockSensitive}
                onChange={(e) => set({ isActive: e.target.checked })}
              />
            </label>
          )}
        </section>
        <section className="grid gap-3 border-b border-pos-line py-4">
          <div>
            <strong className="text-sm">Quyền chi tiết</strong>
            <p className="m-0 text-xs text-pos-muted">
              Nguồn quyền được hiển thị theo vai trò và tùy chỉnh.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {p.catalog.permissions.map((permission) => {
              const disabled =
                permissionLocked ||
                permission.baseline ||
                !p.actorPermissions.includes(permission.code) ||
                (p.actorRole !== "owner" && permission.ownerOnly);
              return (
                <label
                  key={permission.code}
                  className="flex gap-2 rounded border border-pos-line p-2"
                >
                  <input
                    type="checkbox"
                    data-testid={`permission-${permission.code}`}
                    checked={p.form.permissions[permission.code]}
                    disabled={disabled}
                    onChange={(e) =>
                      set({
                        permissions: {
                          ...p.form.permissions,
                          [permission.code]: e.target.checked,
                        },
                        permissionsTouched: true,
                      })
                    }
                  />
                  <span>
                    <strong className="block text-xs">
                      {permission.labelVi}
                    </strong>
                    <small className="text-pos-muted">
                      {p.selectedRecord && !p.form.permissionsTouched
                        ? permissionSourceLabel(
                            p.selectedRecord,
                            permission.code,
                          )
                        : permission.baseline
                          ? "Quyền nền bắt buộc"
                          : "Theo cấu hình đang chọn"}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
        <section className="grid gap-3 pt-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} />
            <strong className="text-sm">
              {self && owner ? "Đổi PIN của bạn" : "Đặt lại PIN"}
            </strong>
          </div>
          {self && owner && (
            <TextField
              label="PIN hiện tại"
              type="password"
              value={p.form.currentPin}
              error={!!p.errors.currentPin}
              helperText={p.errors.currentPin}
              inputProps={{
                "data-testid": "employee-current-pin-input",
                inputMode: "numeric",
              }}
              onChange={(e) => {
                set({ currentPin: e.target.value });
                p.setErrors((x) => ({ ...x, currentPin: undefined }));
              }}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="PIN mới"
              type="password"
              value={p.form.newPin}
              disabled={(owner && !self) || (!p.canManage && !self)}
              error={!!p.errors.pin}
              helperText={p.errors.pin}
              inputProps={{
                "data-testid": "employee-pin-input",
                inputMode: "numeric",
              }}
              onChange={(e) => {
                set({ newPin: e.target.value });
                p.setErrors((x) => ({ ...x, pin: undefined }));
              }}
            />
            <TextField
              label="Xác nhận PIN"
              type="password"
              value={p.form.confirmPin}
              disabled={(owner && !self) || (!p.canManage && !self)}
              error={!!p.errors.confirmPin}
              helperText={p.errors.confirmPin}
              inputProps={{
                "data-testid": "employee-confirm-pin-input",
                inputMode: "numeric",
              }}
              onChange={(e) => {
                set({ confirmPin: e.target.value });
                p.setErrors((x) => ({ ...x, confirmPin: undefined }));
              }}
            />
          </div>
          {!p.form.isActive && (
            <p className="m-0 flex gap-2 text-xs text-pos-muted">
              <Lock size={14} />
              PIN mới chỉ dùng được sau khi mở khóa tài khoản.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
