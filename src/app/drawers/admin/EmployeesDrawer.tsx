import clsx from "clsx";
import { ShieldAlert, UserPlus } from "lucide-react";
import { Button } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Employee, EmployeeRole } from "@/domain";
import { canAccessModule } from "@/core/guards";
import {
  useAdminEmployeesQuery,
  useCreateEmployeeMutation,
  useResetPinMutation,
  useUpdateEmployeeMutation,
} from "@/features/admin";
import {
  EMPTY_EMPLOYEE_FORM,
  getEmployeeFormErrors,
  isEmployeeFormDirty,
  isLastActiveAdmin,
  type EmployeeDrawerForm,
  type EmployeeFormErrors,
} from "@/features/admin/employeeDrawerFlow";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { EmployeeDetailPane } from "./EmployeeDetailPane";
import { EmployeeListPane } from "./EmployeeListPane";

type EmpFilter = "all" | EmployeeRole | "inactive";

type EmployeeRecord = Employee & {
  lastUnlock: string | null;
};

const EMP_ROLE_LABEL: Record<EmployeeRole, string> = { admin: "Quản lý", cashier: "Thu ngân", kitchen: "Bếp" };
const EMP_ROLE_ORDER: EmployeeRole[] = ["admin", "cashier", "kitchen"];

let clientIdSeq = 0;
const createClientId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const suffix = `${Date.now()}${clientIdSeq++}`.padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
};
const createEmployeeId = createClientId;

const toEmployeeRecord = (employee: Employee): EmployeeRecord => ({
  ...employee,
  lastUnlock: null,
});

function EmployeesDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "employees");

  const employeesQuery = useAdminEmployeesQuery(allowed);
  const createEmployeeMutation = useCreateEmployeeMutation(currentEmployee);
  const updateEmployeeMutation = useUpdateEmployeeMutation(currentEmployee);
  const resetPinMutation = useResetPinMutation(currentEmployee);
  const [filter, setFilter] = useState<EmpFilter>("all");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<EmployeeDrawerForm>(EMPTY_EMPLOYEE_FORM);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [discardTarget, setDiscardTarget] = useState<{ target: string | "new" | null } | null>(null);
  const [pinResetTarget, setPinResetTarget] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const employees = useMemo(
    () => (employeesQuery.data ?? []).map(toEmployeeRecord),
    [employeesQuery.data],
  );
  const isSaving =
    createEmployeeMutation.isPending ||
    updateEmployeeMutation.isPending ||
    resetPinMutation.isPending;

  const selectedRecord =
    typeof selectedId === "string" && selectedId !== "new"
      ? employees.find((e) => e.id === selectedId) ?? null
      : null;

  const isDirty = isEmployeeFormDirty(form, selectedId, selectedRecord);

  const applySelect = (target: string | "new" | null) => {
    setErrors({});
    setSelectedId(target);
    if (target === "new") {
      setForm(EMPTY_EMPLOYEE_FORM);
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } else if (target) {
      const rec = employees.find((e) => e.id === target);
      if (rec) setForm({ name: rec.name, role: rec.role, isActive: rec.isActive, newPin: "", confirmPin: "" });
    } else {
      setForm(EMPTY_EMPLOYEE_FORM);
    }
  };

  const requestSelect = (target: string | "new" | null) => {
    if (target === selectedId) return;
    if (isDirty) {
      setDiscardTarget({ target });
      return;
    }
    applySelect(target);
  };

  const filtered = employees.filter((e) => {
    if (filter === "all") return true;
    if (filter === "inactive") return !e.isActive;
    return e.role === filter && e.isActive;
  });

  const countFor = (f: EmpFilter) =>
    f === "all"
      ? employees.length
      : f === "inactive"
      ? employees.filter((e) => !e.isActive).length
      : employees.filter((e) => e.role === f && e.isActive).length;

  const filterChips: Array<{ key: EmpFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "admin", label: "Quản lý" },
    { key: "cashier", label: "Thu ngân" },
    { key: "kitchen", label: "Bếp" },
    { key: "inactive", label: "Tạm khoá" },
  ];
  const employeeStatusText = employeesQuery.isLoading
    ? "Đang tải nhân viên"
    : employeesQuery.isError
    ? "Lỗi tải nhân viên"
    : `${employees.length} nhân viên · online`;
  const pinResetEmployee = pinResetTarget ? employees.find((e) => e.id === pinResetTarget) : null;
  const activeAdminCount = employees.filter((e) => e.role === "admin" && e.isActive).length;
  const isFinalActiveAdmin = (employee: Pick<EmployeeRecord, "role" | "isActive">) =>
    isLastActiveAdmin(employee, activeAdminCount);

  const toggleActive = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    if (isSaving) return;
    if (isDirty) {
      toast.error("Lưu hoặc bỏ thay đổi hiện tại trước khi đổi trạng thái.");
      return;
    }
    const nextActive = !target.isActive;
    if (!nextActive && currentEmployee?.id === id) {
      toast.error("Không thể tạm khoá tài khoản đang đăng nhập.");
      return;
    }
    if (!nextActive && isFinalActiveAdmin(target)) {
      toast.error("Cần giữ ít nhất một quản lý đang hoạt động.");
      return;
    }

    updateEmployeeMutation.mutate(
      { employee: { id, isActive: nextActive } },
      {
        onSuccess: (updated) => {
          if (selectedId === id) setForm((f) => ({ ...f, isActive: updated.isActive }));
          toast.success(nextActive ? "Đã mở khoá nhân viên" : "Đã tạm khoá nhân viên");
        },
        onError: (error) => toast.error(toToastError(error)),
      },
    );
  };

  const validate = (): boolean => {
    const next = getEmployeeFormErrors(form, selectedId === "new");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (isSaving) return;
    if (selectedRecord && currentEmployee?.id === selectedRecord.id && !form.isActive) {
      toast.error("Không thể tạm khoá tài khoản đang đăng nhập.");
      return;
    }
    if (selectedRecord && !form.isActive && isFinalActiveAdmin(selectedRecord)) {
      toast.error("Cần giữ ít nhất một quản lý đang hoạt động.");
      return;
    }

    try {
      if (selectedId === "new") {
        const created = await createEmployeeMutation.mutateAsync({
          employee: {
            id: createEmployeeId(),
            name: form.name.trim(),
            role: form.role,
            pin: form.newPin,
          },
        });
        const finalEmployee = form.isActive
          ? created
          : await updateEmployeeMutation.mutateAsync({ employee: { id: created.id, isActive: false } });

        setSelectedId(finalEmployee.id);
        setForm({
          name: finalEmployee.name,
          role: finalEmployee.role,
          isActive: finalEmployee.isActive,
          newPin: "",
          confirmPin: "",
        });
        toast.success("Đã tạo nhân viên");
      } else if (selectedRecord) {
        const shouldResetPin = form.newPin !== "";
        const updated = await updateEmployeeMutation.mutateAsync({
          employee: {
            id: selectedRecord.id,
            name: form.name.trim(),
            role: form.role,
            isActive: form.isActive,
          },
        });
        if (shouldResetPin) {
          await resetPinMutation.mutateAsync({ employeeId: selectedRecord.id, newPin: form.newPin });
        }
        setForm({
          name: updated.name,
          role: updated.role,
          isActive: updated.isActive,
          newPin: "",
          confirmPin: "",
        });
        toast.success(shouldResetPin ? "Đã lưu nhân viên và đặt lại PIN" : "Đã lưu nhân viên");
      }
      setErrors({});
    } catch (error) {
      toast.error(toToastError(error));
    }
  };

  if (!allowed) {
    return (
      <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="employees-drawer">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
          <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
            <h2>Quản lý nhân viên</h2>
            <p>Chỉ dành cho quản lý</p>
          </div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid h-full place-items-center content-center gap-2.5 text-center [&_h3]:m-0" data-testid="employees-forbidden">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="text-pos-muted">Tài khoản hiện tại không thể quản lý nhân viên.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="employees-drawer">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Quản lý nhân viên</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />{employeeStatusText}</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button
            variant="contained"
            startIcon={<UserPlus size={16} />}
            data-testid="add-employee-button"
            onClick={() => requestSelect("new")}
            disabled={isSaving}
          >
            Thêm nhân viên
          </Button>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin]">
          {filterChips.map((fc) => (
            <button
              key={fc.key}
              className={clsx("cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted", filter === fc.key && "border-pos-primary bg-pos-primary text-white")}
              onClick={() => setFilter(fc.key)}
            >
              {fc.label}
              <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">{countFor(fc.key)}</span>
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-2.5 max-[980px]:min-w-[650px]">
          <EmployeeListPane
            employees={filtered}
            selectedId={selectedId}
            isLoading={employeesQuery.isLoading}
            isError={employeesQuery.isError}
            error={employeesQuery.error}
            isSaving={isSaving}
            roleLabel={EMP_ROLE_LABEL}
            onSelect={requestSelect}
            onResetPin={setPinResetTarget}
            onToggleActive={toggleActive}
          />

          <EmployeeDetailPane
            selectedId={selectedId}
            selectedRecord={selectedRecord}
            currentEmployeeId={currentEmployee?.id}
            form={form}
            setForm={setForm}
            errors={errors}
            setErrors={setErrors}
            roleOptions={EMP_ROLE_ORDER.map((role) => ({ role, label: EMP_ROLE_LABEL[role] }))}
            nameInputRef={nameInputRef}
            isSaving={isSaving}
            isLastActiveAdmin={isFinalActiveAdmin}
            onSave={() => void handleSave()}
          />
        </div>
      </div>

      {discardTarget && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/50" onClick={() => setDiscardTarget(null)}>
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi chưa lưu?</h3>
            <p>Thông tin đang chỉnh sửa sẽ không được lưu.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setDiscardTarget(null)}>Ở lại</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  const t = discardTarget.target;
                  setDiscardTarget(null);
                  applySelect(t);
                }}
              >
                Bỏ thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}

      {pinResetTarget && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/50" onClick={() => setPinResetTarget(null)}>
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" onClick={(e) => e.stopPropagation()}>
            <h3>Đặt lại PIN</h3>
            <p>
              Mở form chi tiết của {pinResetEmployee?.name ?? "nhân viên"} rồi nhập PIN mới. PIN chỉ được lưu khi bấm Lưu nhân viên.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setPinResetTarget(null)}>Huỷ</Button>
              <Button
                variant="contained"
                onClick={() => {
                  const target = pinResetTarget;
                  setPinResetTarget(null);
                  requestSelect(target);
                  toast.success("Nhập PIN mới trong form chi tiết rồi bấm Lưu.");
                }}
              >
                Mở form
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function EmployeesStubDrawer() {
  return <EmployeesDrawer />;
}
