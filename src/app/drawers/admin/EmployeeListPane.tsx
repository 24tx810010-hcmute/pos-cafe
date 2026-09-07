import clsx from "clsx";
import { AlertTriangle, Lock, UserPlus, Users, X } from "lucide-react";
import type { Employee, EmployeeRole } from "@/domain";
import type { EnabledEmployeeRole } from "@/core/guards";
import { toToastError } from "../../appErrors";

export type EmployeeListFilter = "all" | EnabledEmployeeRole | "inactive";

interface EmployeeListPaneProps {
  employees: Employee[];
  totalCount: number;
  selectedId: string | "new" | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isSaving: boolean;
  statusText: string;
  filter: EmployeeListFilter;
  filterOptions: Array<{ key: EmployeeListFilter; label: string }>;
  countForFilter: (filter: EmployeeListFilter) => number;
  roleLabel: Record<EmployeeRole, string>;
  onFilterChange: (filter: EmployeeListFilter) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function EmployeeListPane({
  employees,
  totalCount,
  selectedId,
  isLoading,
  isError,
  error,
  isSaving,
  statusText,
  filter,
  filterOptions,
  countForFilter,
  roleLabel,
  onFilterChange,
  onSelect,
  onAdd,
  onClose,
}: EmployeeListPaneProps) {
  return (
    <section
      className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden border-r border-pos-line bg-pos-surface"
      data-testid="employee-list-pane"
    >
      <header className="flex min-h-16 items-center justify-between gap-2 bg-pos-primary px-3.5 py-3 text-white max-[560px]:min-h-14 max-[560px]:px-2.5">
        <div className="grid min-w-0 gap-0.5">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-black max-[560px]:text-sm">
            Nhân viên
          </strong>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-white/75">
            {statusText}
          </span>
        </div>
        <button
          type="button"
          data-testid="employees-close-button"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[7px] border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Đóng quản lý nhân viên"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-pos-line bg-pos-bg px-2.5 py-2 max-[560px]:px-1.5">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={clsx(
              "inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold transition-colors max-[560px]:px-1.5 max-[560px]:text-[10px]",
              filter === option.key
                ? "border-pos-primary bg-pos-primary text-white"
                : "border-pos-line bg-pos-surface text-pos-muted hover:border-pos-primary hover:text-pos-primary",
            )}
            aria-pressed={filter === option.key}
            onClick={() => onFilterChange(option.key)}
          >
            <span>{option.label}</span>
            <span
              className={clsx(
                "rounded-full px-1.5 py-px text-[10px]",
                filter === option.key ? "bg-white/15 text-white" : "bg-pos-surface2 text-pos-muted",
              )}
            >
              {countForFilter(option.key)}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-pos-muted">
            <Users size={30} className="text-pos-primary" />
            <p>Đang tải nhân viên...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-pos-muted">
            <AlertTriangle size={30} className="text-pos-warning" />
            <p>{toToastError(error)}</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-pos-muted">
            <Users size={30} className="text-pos-primary" />
            <p>Chưa có nhân viên.</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-pos-muted">
            Không có nhân viên phù hợp bộ lọc.
          </div>
        ) : (
          <div className="grid content-start">
            {employees.map((employee) => {
              const isSelected = selectedId === employee.id;
              return (
                <button
                  key={employee.id}
                  type="button"
                  className={clsx(
                    "grid w-full cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 border-0 border-b border-pos-line px-3 py-3 text-left transition-colors max-[560px]:grid-cols-[32px_minmax(0,1fr)] max-[560px]:gap-2 max-[560px]:px-2",
                    isSelected
                      ? "bg-pos-primary text-white hover:bg-pos-primary"
                      : "bg-pos-surface text-pos-ink hover:bg-pos-primarySoft",
                    !employee.isActive && !isSelected && "opacity-70",
                  )}
                  data-testid={`employee-row-${employee.id}`}
                  aria-selected={isSelected}
                  onClick={() => onSelect(employee.id)}
                >
                  <span
                    className={clsx(
                      "grid h-[38px] w-[38px] place-items-center rounded-full text-xs font-black max-[560px]:h-8 max-[560px]:w-8 max-[560px]:text-[10px]",
                      isSelected
                        ? "bg-white/15 text-white"
                        : "bg-pos-primarySoft text-pos-primary",
                    )}
                  >
                    {employeeInitials(employee.name)}
                  </span>

                  <span className="grid min-w-0 gap-1">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold max-[560px]:text-xs">
                      {employee.name}
                    </strong>
                    <span
                      className={clsx(
                        "overflow-hidden text-ellipsis whitespace-nowrap text-[11px]",
                        isSelected ? "text-white/75" : "text-pos-muted",
                      )}
                    >
                      {roleLabel[employee.role]}
                      {!employee.isActive && " · Tạm khoá"}
                    </span>
                  </span>

                  <span className="max-[560px]:hidden">
                    {employee.isActive ? (
                      <span
                        className={clsx(
                          "block h-2 w-2 rounded-full",
                          isSelected ? "bg-white" : "bg-pos-success",
                        )}
                        aria-label="Đang hoạt động"
                      />
                    ) : (
                      <Lock
                        size={15}
                        className={isSelected ? "text-white/75" : "text-pos-muted"}
                        aria-label="Tạm khoá"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-pos-line bg-pos-surface p-2.5 max-[560px]:p-1.5">
        <button
          type="button"
          className="inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-pos-primary bg-pos-primary px-3 py-2 text-sm font-extrabold text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 max-[560px]:px-1.5 max-[560px]:text-[11px]"
          data-testid="add-employee-button"
          onClick={onAdd}
          disabled={isSaving}
        >
          <UserPlus size={16} className="shrink-0" />
          <span>Thêm nhân viên</span>
        </button>
      </footer>
    </section>
  );
}
