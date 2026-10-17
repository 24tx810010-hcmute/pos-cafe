import clsx from "clsx";
import { Button } from "@mui/material";
import { AlertTriangle, Lock, UserPlus, X } from "lucide-react";
import type { EmployeeAdminView, PermissionRole } from "@/domain/permissions";
import { toToastError } from "../../appErrors";
export type PermissionEmployeeFilter =
  "all" | "manager" | "cashier" | "waiter" | "inactive";
const labels: Record<PermissionRole, string> = {
  owner: "Chủ quán",
  manager: "Quản lý",
  cashier: "Thu ngân",
  waiter: "Phục vụ",
  kitchen: "Bếp (chưa hỗ trợ)",
};
export function PermissionEmployeeListPane(p: {
  employees: EmployeeAdminView[];
  selectedId: string | "new" | null;
  filter: PermissionEmployeeFilter;
  loading: boolean;
  error: unknown;
  saving: boolean;
  canCreate: boolean;
  onFilter(v: PermissionEmployeeFilter): void;
  onSelect(v: string | "new"): void;
  onClose(): void;
}) {
  const filters: Array<[PermissionEmployeeFilter, string]> = [
    ["all", "Tất cả"],
    ["manager", "Quản lý"],
    ["cashier", "Thu ngân"],
    ["waiter", "Phục vụ"],
    ["inactive", "Tạm khoá"],
  ];
  const rows = p.employees.filter(
    (e) =>
      p.filter === "all" ||
      (p.filter === "inactive"
        ? !e.isActive
        : e.role === p.filter && e.isActive),
  );
  const count = (f: PermissionEmployeeFilter) =>
    f === "all"
      ? p.employees.length
      : f === "inactive"
        ? p.employees.filter((e) => !e.isActive).length
        : p.employees.filter((e) => e.role === f && e.isActive).length;
  return (
    <section
      className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden border-r border-pos-line bg-pos-surface"
      data-testid="employee-list-pane"
    >
      <header className="flex min-h-16 items-center justify-between bg-pos-primary px-3.5 py-3 text-white">
        <div>
          <strong>Nhân viên</strong>
          <small className="block text-white/75">
            {p.employees.length} nhân viên
          </small>
        </div>
        <button
          type="button"
          data-testid="employees-close-button"
          className="grid h-8 w-8 place-items-center rounded border border-white/25 bg-white/10"
          onClick={p.onClose}
          aria-label="Đóng"
        >
          <X size={16} />
        </button>
      </header>
      <div className="flex flex-wrap gap-1.5 border-b border-pos-line bg-pos-bg px-2.5 py-2">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={p.filter === key}
            onClick={() => p.onFilter(key)}
            className={clsx(
              "rounded-full border px-2 py-1 text-[11px] font-bold",
              p.filter === key
                ? "border-pos-primary bg-pos-primary text-white"
                : "border-pos-line bg-white text-pos-muted",
            )}
          >
            {label} · {count(key)}
          </button>
        ))}
      </div>
      <div className="min-h-0 overflow-auto">
        {p.loading ? (
          <p className="p-4 text-pos-muted">Đang tải nhân viên...</p>
        ) : p.error ? (
          <p className="flex gap-2 p-4 text-pos-danger">
            <AlertTriangle size={18} />
            {toToastError(p.error)}
          </p>
        ) : (
          rows.map((e) => (
            <button
              key={e.id}
              type="button"
              data-testid={`employee-row-${e.id}`}
              onClick={() => p.onSelect(e.id)}
              className={clsx(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] border-0 border-b border-pos-line p-3 text-left",
                p.selectedId === e.id
                  ? "bg-pos-primary text-white"
                  : "bg-white",
              )}
            >
              <span>
                <strong className="block truncate">{e.name}</strong>
                <small
                  className={
                    p.selectedId === e.id ? "text-white/75" : "text-pos-muted"
                  }
                >
                  {labels[e.role]}
                </small>
              </span>
              {!e.isActive && <Lock size={15} />}
            </button>
          ))
        )}
      </div>
      <footer className="border-t border-pos-line p-2.5">
        <Button
          fullWidth
          variant="contained"
          startIcon={<UserPlus size={16} />}
          data-testid="add-employee-button"
          disabled={!p.canCreate || p.saving}
          onClick={() => p.onSelect("new")}
        >
          Thêm nhân viên
        </Button>
      </footer>
    </section>
  );
}
