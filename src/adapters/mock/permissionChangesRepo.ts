import type { FloorPlanChanges, MenuChanges, StoreSettings, StoreSettingsUpdate } from "@/domain";
import type { EmployeeAuditEntry, PermissionCode, PermissionEmployee } from "@/domain/permissions";
import type { ClearDemoDataRequest, IPermissionChangesRepo } from "@/ports/permissionChanges";
import { AppError } from "@/core/appError";
import { createAuthoritySnapshot, hasCatalogPermission } from "@/core/permissionAuthority";
import { configuredPermissions } from "@/core/permissionOverrides";
import { parsePermissionFloorPlanChanges, parsePermissionMenuChanges, parsePermissionStoreSettingsUpdate } from "@/core/permissionChangesInputs";
import { clone } from "./mockState";
import { mockPermissionSeedEmployees, type MockPermissionState } from "./permissionState";
import { applyMockMenuChanges } from "./menuRepo";
import { applyMockFloorPlanChanges } from "./floorPlanRepo";
import { removeDemoSeed } from "./demoSeedHelpers";
import { MockPermissionMenuImagePort } from "./permissionMenuImagePort";
import { mockPermissionRevokeSessions, requireMockNormalPermissionActor } from "./permissionIdentityRepo";
import { mockPermissionAuditRows, mockPermissionClearRecords, mockPermissionRequestReservations, withMockPermissionClearLock } from "./permissionAdminState";

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
function actor(state: MockPermissionState): PermissionEmployee {
  return requireMockNormalPermissionActor(state);
}
function requirePermission(state: MockPermissionState, permission: PermissionCode): PermissionEmployee {
  const employee = actor(state), authority = createAuthoritySnapshot(state.catalog, employee, true);
  if (!hasCatalogPermission(state.catalog, { status: "verified", snapshot: authority }, permission))
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  return employee;
}
function hasPermission(state: MockPermissionState, employee: PermissionEmployee, permission: PermissionCode): boolean {
  return hasCatalogPermission(state.catalog, { status: "verified", snapshot: createAuthoritySnapshot(state.catalog, employee, true) }, permission);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clearRequestKind = "clear_demo_data";

function clearCanonicalPayload(input: ClearDemoDataRequest): string {
  return JSON.stringify({ kind: clearRequestKind, requestId: input.requestId, confirmation: input.confirmation });
}

function permissionSnapshot(state: MockPermissionState, employee: PermissionEmployee): EmployeeAuditEntry["before"] {
  const rights = configuredPermissions(state.catalog, employee.role, employee.overrides);
  return { id: employee.id, name: employee.name, role: employee.role, isActive: employee.isActive,
    permissionRevision: employee.permissionRevision, overrides: clone(employee.overrides), effective: [...rights.permissions] };
}

function auditKey(state: MockPermissionState, actor: PermissionEmployee, requestId: string, targetId: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([state.storeId, "employee", actor.id, requestId, targetId]));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function storedError(error: AppError) {
  return { code: error.code, message: error.message, ...(error.cause === undefined ? {} : { cause: clone(error.cause) }) };
}

function restoreError(error: { code: AppError["code"]; message: string; cause?: unknown }): AppError {
  return new AppError(error.code, error.message, error.cause === undefined ? undefined : clone(error.cause));
}

/** T08 mock uses the same permission employees/session/catalog and business state as all staged permission ports. */
export class MockPermissionChangesRepo implements IPermissionChangesRepo {
  constructor(private readonly state: MockPermissionState, private readonly images?: MockPermissionMenuImagePort) {}
  async saveMenuChanges(changes: MenuChanges): Promise<void> {
    requirePermission(this.state, "menu.manage"); const parsed = parsePermissionMenuChanges(changes);
    const imageWrites = (parsed.imageChanges ?? []).map(change => ({ ...change,
      blob: change.uploadHandle === null ? null : this.images?.resolve(change.uploadHandle, change.itemId) ?? (() => { throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập."); })(),
    }));
    const next = clone(this.state.business); applyMockMenuChanges(next, parsed);
    for (const change of imageWrites) {
      const item = next.menu.menuItems.find(candidate => candidate.id === change.itemId);
      if (!item) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập.");
      item.imageAssetKey = change.uploadHandle;
    }
    for (const old of this.state.business.menu.menuItems) {
      const current = next.menu.menuItems.find(item => item.id === old.id);
      if (old.imageAssetKey && (!current || current.imageAssetKey !== old.imageAssetKey)) this.images?.unpublish(old.imageAssetKey);
    }
    this.state.business.menu = next.menu;
    for (const change of imageWrites) if (change.uploadHandle && change.blob) this.images!.publish(change.uploadHandle, change.blob);
  }
  async saveFloorPlan(changes: FloorPlanChanges): Promise<void> {
    requirePermission(this.state, "floor.manage"); const parsed = parsePermissionFloorPlanChanges(changes);
    const next = clone(this.state.business); applyMockFloorPlanChanges(next, parsed); this.state.business.floorPlan = next.floorPlan;
  }
  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    const employee = requirePermission(this.state, "settings.manage"), parsed = parsePermissionStoreSettingsUpdate(input);
    if (parsed.timezone !== undefined && parsed.timezone !== this.state.business.settings.timezone && employee.role !== "owner")
      throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    this.state.business.settings = { ...this.state.business.settings, ...parsed };
    return clone(this.state.business.settings);
  }
  async clearDemoData(input: ClearDemoDataRequest): Promise<void> {
    if (!uuid.test(input.requestId))
      throw new AppError("INVALID_WRITE_REQUEST", "Dữ liệu thay đổi không hợp lệ.");

    const initialActor = actor(this.state);
    const initialSession = this.state.session;
    return withMockPermissionClearLock(this.state, async () => {
      const currentActor = actor(this.state);
      if (this.state.session !== initialSession || currentActor.id !== initialActor.id)
        throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
      return this.clearDemoDataLocked(input, currentActor, initialSession);
    });
  }

  private async clearDemoDataLocked(
    input: ClearDemoDataRequest,
    requestActor: PermissionEmployee,
    requestSession: MockPermissionState["session"],
  ): Promise<void> {

    // A replay still authenticates and checks the current authority before the
    // shared request registry is consulted. This also keeps clear-demo in the
    // same namespace as employee admin and self-PIN requests.
    const key = `${this.state.storeId}:${requestActor.id}:${input.requestId}`;
    const canonicalPayload = clearCanonicalPayload(input);
    const reservations = mockPermissionRequestReservations(this.state);
    const prior = reservations.get(key);
    if (prior) {
      if (!hasPermission(this.state, requestActor, "data.clearDemo"))
        throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
      if (prior.kind !== clearRequestKind || prior.canonicalPayload !== canonicalPayload)
        throw new AppError("ADMIN_REQUEST_REUSED", "Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới.");
      const record = mockPermissionClearRecords(this.state).get(key);
      if (!record || record.canonicalPayload !== canonicalPayload)
        throw new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
      if (record.error) throw restoreError(record.error);
      return;
    }

    const next = clone(this.state.business);
    let clearError: AppError | null = !hasPermission(this.state, requestActor, "data.clearDemo")
      ? new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")
      : input.confirmation === true
        ? null
        : new AppError("INVALID_WRITE_REQUEST", "Dữ liệu thay đổi không hợp lệ.");
    if (!clearError) {
      try {
        if (next.orders.some(order => order.status === "open"))
          throw new AppError("OPEN_ORDERS_BLOCK_CLEAR_DEMO", "Còn đơn đang mở, không thể xoá demo data.");
        removeDemoSeed(next);
      } catch (error) {
        clearError = error instanceof AppError
          ? error.code === "OPEN_ORDERS_BLOCK_CLEAR_DEMO"
            ? new AppError(error.code, "Còn đơn đang mở. Hãy hoàn tất các đơn trước khi xóa dữ liệu mẫu.")
            : error
          : new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
      }
      const currentActor = actor(this.state);
      if (this.state.session !== requestSession || currentActor.id !== requestActor.id)
        throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
      if (!hasPermission(this.state, currentActor, "data.clearDemo"))
        clearError = new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }

    const bindings = mockPermissionSeedEmployees(this.state)
      .filter(({ employee }) => employee.role !== "owner")
      .filter((binding, index, all) => all.findIndex(other => other.employee.id === binding.employee.id) === index);
    const targets = clearError
      ? bindings
      : bindings.filter(({ employee }) => employee.isActive);
    const audits = mockPermissionAuditRows(this.state);
    const auditStart = audits.length;
    const actorEffective = [...createAuthoritySnapshot(this.state.catalog, requestActor, true).permissions];
    try {
      for (const { employee } of targets) {
        const before = permissionSnapshot(this.state, employee)!;
        const after = clearError ? before : { ...clone(before), isActive: false, permissionRevision: before.permissionRevision + 1 };
        audits.push({
          auditKey: auditKey(this.state, requestActor, input.requestId, employee.id),
          storeId: this.state.storeId,
          actorType: "employee",
          actorKey: requestActor.id,
          requestId: input.requestId,
          targetId: employee.id,
          occurredAt: new Date(this.state.now()).toISOString(),
          kind: clearRequestKind,
          outcome: clearError ? "denied" : "applied",
          reason: clearError?.code ?? null,
          actorEffective,
          catalogRevision: this.state.catalog.revision,
          before,
          proposedAfter: clearError ? null : after,
          actualAfter: clearError ? before : after,
          credentialChanged: false,
          details: null,
        });
      }
    } catch {
      audits.splice(auditStart);
      throw new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
    }

    if (clearError) {
      // A verified denial is terminal and replayable, just like employee admin
      // denials. It does not mutate business or identity state.
      mockPermissionClearRecords(this.state).set(key, { canonicalPayload, outcome: "noop", error: storedError(clearError) });
      reservations.set(key, { kind: clearRequestKind, canonicalPayload });
      throw clearError;
    }

    for (const old of this.state.business.menu.menuItems) {
      if (old.imageAssetKey && !next.menu.menuItems.some(item => item.id === old.id)) this.images?.unpublish(old.imageAssetKey);
    }
    this.state.business.menu = next.menu;
    this.state.business.floorPlan = next.floorPlan;
    this.state.business.employees = next.employees;
    this.state.business.pins = next.pins;
    for (const { employee } of bindings) {
      if (!employee.isActive) continue;
      employee.isActive = false;
      employee.permissionRevision += 1;
      mockPermissionRevokeSessions(this.state, employee.id);
    }
    mockPermissionClearRecords(this.state).set(key, { canonicalPayload, outcome: targets.length ? "applied" : "noop" });
    reservations.set(key, { kind: clearRequestKind, canonicalPayload });
  }
}
