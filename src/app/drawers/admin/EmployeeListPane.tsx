import clsx from "clsx";
import { AlertTriangle, KeyRound, Lock, Pencil, Unlock, Users } from "lucide-react";
import type { Employee, EmployeeRole } from "@/domain";
import { toToastError } from "../../appErrors";

type EmployeeListRecord = Employee & {
  lastUnlock: string | null;
};

interface EmployeeListPaneProps {
  employees: EmployeeListRecord[];
  selectedId: string | "new" | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isSaving: boolean;
  roleLabel: Record<EmployeeRole, string>;
  onSelect: (id: string) => void;
  onResetPin: (id: string) => void;
  onToggleActive: (id: string) => void;
}

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function EmployeeListPane({
  employees,
  selectedId,
  isLoading,
  isError,
  error,
  isSaving,
  roleLabel,
  onSelect,
  onResetPin,
  onToggleActive,
}: EmployeeListPaneProps) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
      <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
        <span>Nhân viên</span>
        <span className="text-pos-muted">{employees.length} người</span>
      </div>
      <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
            <Users size={32} color="#94a3b8" />
            <p>Đang tải nhân viên...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
            <AlertTriangle size={32} color="#b45309" />
            <p>{toToastError(error)}</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
            <Users size={32} color="#94a3b8" />
            <p>Chưa có nhân viên.</p>
          </div>
        ) : (
          <div className="grid content-start gap-2">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className={clsx(
                  "grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-pos border-[1.5px] border-pos-line bg-white px-3 py-2.5 transition-[border-color,background] hover:border-pos-primary",
                  selectedId === employee.id && "border-pos-primary bg-pos-primarySoft",
                  !employee.isActive && "opacity-[0.72]",
                )}
                data-testid={`employee-row-${employee.id}`}
                onClick={() => onSelect(employee.id)}
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-pos-primarySoft text-sm font-black text-pos-primary">{employeeInitials(employee.name)}</div>
                <div className="grid min-w-0 gap-1 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap">
                  <strong>{employee.name}</strong>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted">{roleLabel[employee.role]}</span>
                    <span className={clsx("inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted", employee.isActive && "border-[#bbf7d0] bg-[#f0fdf4] text-pos-success")}>
                      {employee.isActive ? "● Đang hoạt động" : "● Tạm khoá"}
                    </span>
                  </div>
                  <span className="text-[11px] text-pos-muted">Mở khoá: {employee.lastUnlock ?? "Chưa có"}</span>
                </div>
                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  <button className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] border border-pos-line bg-pos-surface text-pos-muted transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-50" title="Sửa" onClick={() => onSelect(employee.id)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] border border-pos-line bg-pos-surface text-pos-muted transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-50"
                    title="Đặt lại PIN"
                    disabled={isSaving}
                    onClick={() => onResetPin(employee.id)}
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] border border-pos-line bg-pos-surface text-pos-muted transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-50"
                    title={employee.isActive ? "Tạm khoá" : "Mở khoá"}
                    disabled={isSaving}
                    onClick={() => onToggleActive(employee.id)}
                  >
                    {employee.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
