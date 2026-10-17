import { Button } from "@mui/material";
import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AppError } from "@/core/appError";
import type { EmployeeAdminView, EmployeePermissionPatch } from "@/domain/permissions";
import {
  usePermission,
  usePermissionSession,
} from "@/features/shared/permissionSession";
import {
  actorCoversTarget,
  createRequestId,
  emptyEmployeeForm,
  formForEmployee,
  defaultPermissionSelection,
  overridesFromSelection,
  validateEmployeeForm,
  type PermissionEmployeeErrors,
  type PermissionEmployeeForm,
} from "@/features/admin/permissionEmployeeFlow";
import {
  useCurrentPermissionBundle,
  usePermissionEmployeeMutations,
  usePermissionEmployees,
} from "@/features/admin/usePermissionEmployees";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { useViewLifetime } from "../../useViewLifetime";
import { EmployeeDetailPane } from "./EmployeeDetailPane";
import {
  PermissionEmployeeListPane,
  type PermissionEmployeeFilter,
} from "./PermissionEmployeeListPane";

function EmployeesDrawer() {
  const closeDrawer = useAppStore((s) => s.closeDrawer),
    setCurrentEmployee = useAppStore((s) => s.setCurrentEmployee);
  const bundle = useCurrentPermissionBundle(),
    status = usePermissionSession((s) => s.status),
    clearPermission = usePermissionSession((s) => s.clear);
  const canManage = usePermission("employee.manage"),
    canEditPermissions = usePermission("employee.permission.edit"),
    allowed =
      status === "verified" && !!bundle && (canManage || canEditPermissions);
  const query = usePermissionEmployees(allowed),
    mutations = usePermissionEmployeeMutations(),
    catalog = bundle?.catalog;
  const [filter, setFilter] = useState<PermissionEmployeeFilter>("all"),
    [selectedId, setSelectedId] = useState<string | "new" | null>(null),
    [errors, setErrors] = useState<PermissionEmployeeErrors>({}),
    [discard, setDiscard] = useState<string | "new" | null | undefined>(
      undefined,
    );
  const [form, setForm] = useState<PermissionEmployeeForm | null>(null),
    baseline = useRef<PermissionEmployeeForm | null>(null),
    nameRef = useRef<HTMLInputElement | null>(null);
  const employees = query.data ?? [],
    selected =
      typeof selectedId === "string" && selectedId !== "new"
        ? (employees.find((e) => e.id === selectedId) ?? null)
        : null;
  const saving =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.resetPin.isPending ||
    mutations.changeOwnPin.isPending;
  const actor = bundle?.snapshot,
    dirty =
      !!form &&
      !!baseline.current &&
      JSON.stringify(form) !== JSON.stringify(baseline.current);
  const captureView = useViewLifetime(`${selectedId}:${actor?.employeeRevision}:${actor?.catalogRevision}`);
  const setClean = (next: PermissionEmployeeForm) => {
    setForm(next);
    baseline.current = structuredClone(next);
    setErrors({});
  };
  const applySelect = (target: string | "new" | null) => {
    setSelectedId(target);
    if (!catalog) {
      setForm(null);
      return;
    }
    if (target === "new") {
      setClean(emptyEmployeeForm(catalog));
      setTimeout(() => nameRef.current?.focus(), 0);
    } else {
      const row = employees.find((e) => e.id === target);
      setForm(row ? formForEmployee(catalog, row) : null);
      baseline.current = row ? formForEmployee(catalog, row) : null;
      setErrors({});
    }
  };
  const requestSelect = (target: string | "new" | null) => {
    if (target === selectedId) return;
    if (dirty) {
      setDiscard(target);
      return;
    }
    applySelect(target);
  };
  useEffect(() => {
    if (selectedId === null && employees.length) applySelect(employees[0].id);
  }, [employees.length, selectedId]);
  useEffect(() => {
    if (selected && catalog && !dirty)
      setClean(formForEmployee(catalog, selected));
  }, [selected?.permissionRevision]);
  const previousRights = useRef(actor?.permissions);
  useEffect(() => {
    if (status !== "verified" || !actor || !catalog) return;
    const previous = previousRights.current; previousRights.current = actor.permissions;
    const lostManage = !!previous?.includes("employee.manage") && !canManage;
    const lostPermissions = !!previous?.includes("employee.permission.edit") && !canEditPermissions;
    if (!form || !baseline.current || !(lostManage || lostPermissions)) return;
    const notifyDiscard = () => toast("Quyền của bạn đã thay đổi. Phần đang thao tác không còn được phép đã đóng; dữ liệu chưa lưu của phần đó đã được bỏ.");
    if (selectedId === "new" && lostManage) { setSelectedId(null); setForm(null); baseline.current = null; notifyDiscard(); return; }
    const base = baseline.current;
    const next = { ...form };
    if (lostManage) {
      next.name = base.name; next.role = base.role; next.isActive = base.isActive;
      next.newPin = ""; next.confirmPin = ""; next.currentPin = "";
      if (!next.permissionsTouched) next.permissions = { ...base.permissions };
    }
    if (lostPermissions) {
      next.permissionsTouched = false;
      next.permissions = next.role === base.role ? { ...base.permissions } : defaultPermissionSelection(catalog, next.role);
    }
    if (JSON.stringify(next) !== JSON.stringify(form)) notifyDiscard();
    setForm(next); setErrors({}); setDiscard(undefined);
  }, [actor, catalog, status, canManage, canEditPermissions]);
  const fieldErrors = (error: unknown) => {
    if (
      error instanceof AppError &&
      error.cause &&
      typeof error.cause === "object" &&
      "fieldErrors" in error.cause
    )
      setErrors(
        (error.cause as { fieldErrors?: PermissionEmployeeErrors })
          .fieldErrors ?? {},
      );
  };
  const save = async () => {
    if (!form || !catalog || saving || !actor) return;
    const isCurrent = captureView();
    const ownerSelf =
      selected?.role === "owner" && selected.id === actor.employeeId;
    const nextErrors = validateEmployeeForm(
      form,
      selectedId === "new",
      ownerSelf,
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      if (selectedId === "new") {
        if (!canManage) return;
        const result = await mutations.create.mutateAsync({
          requestId: createRequestId(),
          id: createRequestId(),
          name: form.name.trim(),
          role: form.role,
          pin: form.newPin,
          expectedCatalogRevision: catalog.revision,
          ...(form.permissionsTouched && canEditPermissions
            ? {
                overrides: overridesFromSelection(
                  catalog,
                  form.role,
                  form.permissions,
                ),
              }
            : {}),
        });
        if (!isCurrent()) return;
        setSelectedId(result.id);
        setClean(formForEmployee(catalog, result));
        toast.success("Đã tạo nhân viên.");
        return;
      }
      if (!selected) return;
      let revision = selected.permissionRevision;
      const patch: EmployeePermissionPatch = {};
      if (form.name.trim() !== selected.name) patch.name = form.name.trim();
      if (
        form.role !== selected.role &&
        !(["owner", "kitchen"] as string[]).includes(selected.role)
      )
        patch.role = form.role;
      if (form.isActive !== selected.isActive) patch.isActive = form.isActive;
      if (form.permissionsTouched && canEditPermissions)
        patch.overrides = overridesFromSelection(
          catalog,
          form.role,
          form.permissions,
        );
      const keys = Object.keys(patch);
      let latest: EmployeeAdminView = selected;
      if (keys.length) {
        latest = await mutations.update.mutateAsync({
          requestId: createRequestId(),
          targetId: selected.id,
          expectedRevision: revision,
          ...(patch.role !== undefined || patch.overrides !== undefined
            ? { expectedCatalogRevision: catalog.revision }
            : {}),
          patch,
        });
        if (!isCurrent()) return;
        revision = latest.permissionRevision;
      }
      if (form.newPin) {
        if (ownerSelf) {
          const changed = await mutations.changeOwnPin.mutateAsync({
            requestId: createRequestId(),
            expectedRevision: revision,
            currentPin: form.currentPin,
            newPin: form.newPin,
          });
          if (!isCurrent()) return;
          if (changed.outcome === "noop") {
            toast("PIN mới trùng PIN hiện tại; không có thay đổi.");
            setClean({ ...form, currentPin: "", newPin: "", confirmPin: "" });
            return;
          }
          toast.success("Đã đổi PIN. Vui lòng đăng nhập lại.");
          setCurrentEmployee(null);
          clearPermission();
          closeDrawer();
          return;
        }
        latest = await mutations.resetPin.mutateAsync({
          requestId: createRequestId(),
          targetId: selected.id,
          expectedRevision: revision,
          newPin: form.newPin,
        });
        if (!isCurrent()) return;
        toast.success("Đã đặt lại PIN. Nhân viên cần đăng nhập lại.");
      } else if (!keys.length) {
        toast("Không có thay đổi để lưu.");
        return;
      } else if (patch.overrides !== undefined && keys.length === 1)
        toast.success("Đã cập nhật quyền nhân viên.");
      else if (patch.isActive !== undefined && keys.length === 1)
        toast.success(
          patch.isActive ? "Đã mở khóa nhân viên." : "Đã tạm khóa nhân viên.",
        );
      else toast.success("Đã lưu nhân viên.");
      setClean(formForEmployee(catalog, latest));
    } catch (error) {
      if (!isCurrent()) return;
      fieldErrors(error);
      toast.error(toToastError(error));
    }
  };
  if (!allowed || !catalog || !actor)
    return (
      <PortalDrawer testId="employees-drawer" onOutsideClick={closeDrawer}>
        <header className="flex min-h-16 items-center justify-between border-b border-pos-line px-4">
          <h2>Quản lý nhân viên</h2>
          <Button variant="outlined" onClick={closeDrawer}>
            Đóng
          </Button>
        </header>
        <div
          className="grid h-full place-items-center text-center"
          data-testid="employees-forbidden"
        >
          <div>
            <ShieldAlert className="mx-auto" size={42} />
            <h3>Không có quyền</h3>
            <p>Phần quản lý nhân viên không còn được phép.</p>
          </div>
        </div>
      </PortalDrawer>
    );
  const ceiling =
    !selected ||
    actor.role === "owner" ||
    actorCoversTarget(actor.permissions, selected);
  return (
    <PortalDrawer
      testId="employees-drawer"
      onOutsideClick={closeDrawer}
      panelClassName="grid-rows-[minmax(0,1fr)]"
    >
      <div
        className="grid min-h-0 grid-cols-[clamp(132px,26%,286px)_minmax(0,1fr)] overflow-hidden"
        data-testid="employees-split-layout"
      >
        <PermissionEmployeeListPane
          employees={employees}
          selectedId={selectedId}
          filter={filter}
          loading={query.isLoading}
          error={query.error}
          saving={saving}
          canCreate={canManage}
          onFilter={setFilter}
          onSelect={requestSelect}
          onClose={closeDrawer}
        />
        {form && (
          <EmployeeDetailPane
            selectedId={selectedId}
            selectedRecord={selected}
            actorId={actor.employeeId}
            actorRole={actor.role}
            actorPermissions={actor.permissions}
            catalog={catalog}
            form={form}
            setForm={(value) =>
              setForm((previous) =>
                typeof value === "function" ? value(previous!) : value,
              )
            }
            errors={errors}
            setErrors={setErrors}
            nameInputRef={nameRef}
            saving={saving}
            canManage={canManage}
            canEditPermissions={canEditPermissions}
            targetWithinCeiling={ceiling}
            onSave={() => void save()}
          />
        )}
      </div>
      {discard !== undefined && (
        <PortalPopup
          placement="Centered"
          viewport="workspace"
          onOutsideClick={() => setDiscard(undefined)}
        >
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-white p-6">
            <h3>Bỏ thay đổi chưa lưu?</h3>
            <p>Thông tin đang chỉnh sửa sẽ không được lưu.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDiscard(undefined)}>Ở lại</Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  const target = discard;
                  setDiscard(undefined);
                  applySelect(target ?? null);
                }}
              >
                Bỏ thay đổi
              </Button>
            </div>
          </div>
        </PortalPopup>
      )}
    </PortalDrawer>
  );
}
export function EmployeesStubDrawer() {
  return <EmployeesDrawer />;
}
