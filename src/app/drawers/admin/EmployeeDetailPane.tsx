import clsx from "clsx";
import { Button, TextField } from "@mui/material";
import { Save } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Employee, EmployeeRole } from "@/domain";
import {
  PERMISSION_OPTIONS,
  defaultPermissionsForRole,
  type EmployeeDrawerForm,
} from "@/features/admin/employeeDrawerFlow";

type EmployeeRecord = Employee & {
  lastUnlock: string | null;
};

interface EmployeeDetailPaneProps {
  selectedId: string | "new" | null;
  selectedRecord: EmployeeRecord | null;
  currentEmployeeId: string | undefined;
  form: EmployeeDrawerForm;
  setForm: Dispatch<SetStateAction<EmployeeDrawerForm>>;
  errors: { name?: string; pin?: string };
  setErrors: Dispatch<SetStateAction<{ name?: string; pin?: string }>>;
  roleOptions: Array<{ role: EmployeeRole; label: string }>;
  nameInputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  isLastActiveAdmin: (employee: Pick<EmployeeRecord, "role" | "isActive">) => boolean;
  onSave: () => void;
}

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
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">{selectedId === "new" ? "Thêm nhân viên" : "Chi tiết"}</div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
        {!selectedId ? (
          <p className="text-pos-muted p-2">
            Chọn nhân viên để xem / sửa, hoặc bấm “Thêm nhân viên”.
          </p>
        ) : (
          <div className="grid gap-3.5">
            <TextField
              label="Tên nhân viên"
              value={form.name}
              inputRef={nameInputRef}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                setErrors((er) => ({ ...er, name: undefined }));
              }}
              error={!!errors.name}
              helperText={errors.name}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "employee-name-input" }}
            />

            <div className="grid gap-1.5">
              <span className="text-xs font-extrabold text-pos-muted">Vai trò</span>
              <div className="flex flex-wrap gap-1.5">
                {roleOptions.map(({ role, label }) => (
                  <button
                    key={role}
                    className={clsx(
                      "min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line",
                      form.role === role
                        ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                        : "border-pos-line bg-pos-surface text-pos-ink",
                    )}
                    data-testid={`employee-role-${role}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        role,
                        permissions: defaultPermissionsForRole(role),
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const lockSelf = selectedRecord != null && currentEmployeeId === selectedRecord.id;
              const lockLastAdmin = selectedRecord != null && isLastActiveAdmin(selectedRecord);
              const lockDisabled = lockSelf || lockLastAdmin;
              return (
                <div className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-pos-muted">Trạng thái</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className={clsx(
                        "min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line",
                        form.isActive
                          ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                          : "border-pos-line bg-pos-surface text-pos-ink",
                      )}
                      data-testid="employee-active-button"
                      onClick={() => setForm((f) => ({ ...f, isActive: true }))}
                    >
                      Đang hoạt động
                    </button>
                    <button
                      className={clsx(
                        "min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line",
                        !form.isActive
                          ? "border-[#fecaca] bg-[#fef2f2] text-pos-danger"
                          : "border-pos-line bg-pos-surface text-pos-ink",
                      )}
                      data-testid="employee-inactive-button"
                      disabled={lockDisabled}
                      title={lockDisabled ? "Không thể tạm khoá tài khoản này" : undefined}
                      onClick={() => setForm((f) => ({ ...f, isActive: false }))}
                    >
                      Tạm khoá
                    </button>
                  </div>
                  {lockDisabled && (
                    <span className="text-[11.5px] text-pos-muted">
                      {lockSelf
                        ? "Không thể tạm khoá tài khoản đang đăng nhập."
                        : "Cần giữ ít nhất một quản lý đang hoạt động."}
                    </span>
                  )}
                </div>
              );
            })()}

            {selectedRecord && (
              <fieldset className="grid gap-2.5 border-t border-dashed border-pos-line pt-3">
                <legend className="mb-1 text-xs font-extrabold text-pos-muted">Quyền thao tác</legend>
                <p className="m-0 text-[11.5px] text-pos-muted">
                  Mặc định theo vai trò; tick/bỏ để cấp/thu hồi riêng cho nhân viên này.
                </p>
                {PERMISSION_OPTIONS.map(({ code, label, description }) => (
                  <label
                    key={code}
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 rounded-[7px] border border-pos-line px-2.5 py-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-pos-primary"
                      data-testid={`employee-permission-${code}`}
                      checked={form.permissions.includes(code)}
                      disabled={isSaving}
                      onChange={(event) => {
                        const next = new Set(form.permissions);
                        if (event.target.checked) next.add(code);
                        else next.delete(code);
                        setForm((current) => ({
                          ...current,
                          permissions: PERMISSION_OPTIONS.filter((option) => next.has(option.code)).map(
                            (option) => option.code,
                          ),
                        }));
                      }}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-[13px] font-bold text-pos-ink">{label}</span>
                      <span className="text-[11.5px] text-pos-muted">{description}</span>
                    </span>
                  </label>
                ))}
                {currentEmployeeId === selectedRecord.id && (
                  <p className="m-0 rounded-[7px] bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-800" data-testid="employee-self-permission-warning">
                    Bạn đang sửa quyền của chính mình. Quyền trên thiết bị này được cập nhật sau khi đăng nhập lại.
                  </p>
                )}
              </fieldset>
            )}

            <div className="grid gap-2.5 border-t border-dashed border-pos-line pt-3">
              <div className="text-xs font-extrabold text-pos-muted">{selectedId === "new" ? "Đặt PIN" : "Đặt lại PIN"}</div>
              <TextField
                label="PIN mới"
                value={form.newPin}
                onChange={(e) => {
                  setForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, "").slice(0, 6) }));
                  setErrors((er) => ({ ...er, pin: undefined }));
                }}
                size="small"
                fullWidth
                inputProps={{ inputMode: "numeric", "data-testid": "employee-pin-input" }}
              />
              <TextField
                label="Xác nhận PIN"
                value={form.confirmPin}
                onChange={(e) => {
                  setForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 6) }));
                  setErrors((er) => ({ ...er, pin: undefined }));
                }}
                error={!!errors.pin}
                helperText={errors.pin || (selectedId === "new" ? "PIN 4–6 chữ số." : "Để trống nếu không đổi PIN.")}
                size="small"
                fullWidth
                inputProps={{ inputMode: "numeric", "data-testid": "employee-confirm-pin-input" }}
              />
            </div>
          </div>
        )}
      </div>
      {selectedId && (
        <div className="sticky bottom-0 z-[2] grid gap-2 border-t border-pos-line bg-white p-2.5">
          <Button
            variant="contained"
            fullWidth
            startIcon={<Save size={15} />}
            data-testid="save-employee-button"
            disabled={isSaving}
            onClick={onSave}
          >
            {isSaving ? "Đang lưu..." : "Lưu nhân viên"}
          </Button>
        </div>
      )}
    </aside>
  );
}
