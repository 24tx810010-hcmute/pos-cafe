import type { Changeset, FloorPlanChanges, MenuChanges, StoreSettings, StoreSettingsUpdate, TombstoneDelete } from "@/domain";
import type { ClearDemoDataRequest, IPermissionChangesRepo } from "@/ports/permissionChanges";
import { AppError, type AppErrorCode } from "@/core/appError";
import { permissionErrorMessages } from "@/core/permissionErrors";
import { parsePermissionFloorPlanChanges, parsePermissionMenuChanges, parsePermissionStoreSettingsUpdate } from "@/core/permissionChangesInputs";
import { employeeCredential } from "./employeeCredential";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const messages: Partial<Record<AppErrorCode, string>> = {
  AUTH_REQUIRED: sessionMessage, EMPLOYEE_SESSION_REQUIRED: sessionMessage,
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được phép truy cập.",
  OPEN_ORDERS_BLOCK_CLEAR_DEMO: "Còn đơn đang mở. Hãy hoàn tất các đơn trước khi xóa dữ liệu mẫu.",
  ADMIN_REQUEST_REUSED: permissionErrorMessages.ADMIN_REQUEST_REUSED,
};
const responseCodes = new Set(Object.keys(messages));
const failure = (): AppError => new AppError("PERMISSION_UPDATE_UNAVAILABLE", permissionErrorMessages.PERMISSION_UPDATE_UNAVAILABLE);
const stale = (): AppError => new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw failure(); return value;
}
function string(value: unknown): string { if (typeof value !== "string") throw failure(); return value; }
function denial(value: Record<string, unknown>): never {
  const error = exactRecord(value.error, ["code", "message", "details"]); const code = string(error.code);
  if (!responseCodes.has(code)) throw failure();
  throw new AppError(code as AppErrorCode, messages[code as AppErrorCode]!, error.details);
}
function mapSettings(value: unknown): StoreSettings {
  const row = exactRecord(value, ["storeId", "displayName", "address", "currency", "timezone", "billFooter"]);
  if (row.currency !== "VND") throw failure();
  const storeId = string(row.storeId); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) throw failure();
  return { storeId: storeId.toLowerCase(), displayName: string(row.displayName), address: string(row.address), currency: "VND", timezone: string(row.timezone), billFooter: string(row.billFooter) };
}

// The permission RPC derives the deletion actor from the verified employee session.
// Never forward the actor id carried by the shared menu/floor draft models.
function serverAttributedDeletes<Create, Update>(set: Changeset<Create, Update, TombstoneDelete>): Changeset<Create, Update, TombstoneDelete> {
  return { ...set, deleted: set.deleted.map(({ id }) => ({ id, deletedByEmployeeId: null })) };
}
function menuForRpc(changes: MenuChanges): MenuChanges {
  const parsed = parsePermissionMenuChanges(changes);
  return { ...parsed,
    categories: serverAttributedDeletes(parsed.categories), menuItems: serverAttributedDeletes(parsed.menuItems),
    optionGroups: serverAttributedDeletes(parsed.optionGroups), optionValues: serverAttributedDeletes(parsed.optionValues),
    menuItemOptionGroups: serverAttributedDeletes(parsed.menuItemOptionGroups),
  };
}
function floorForRpc(changes: FloorPlanChanges): FloorPlanChanges {
  const parsed = parsePermissionFloorPlanChanges(changes);
  return { areas: serverAttributedDeletes(parsed.areas), tables: serverAttributedDeletes(parsed.tables),
    decorItems: serverAttributedDeletes(parsed.decorItems) };
}

/** Staged T08 adapter. Runtime composition is activated by the integration task. */
export class SupabasePermissionChangesRepo implements IPermissionChangesRepo {
  constructor(private readonly client: SupabaseAnyClient) {}
  private assertGeneration(generation: number): void { if (generation !== employeeCredential(this.client).generation) throw stale(); }
  private async call(name: string, args?: Record<string, unknown>, responseKeys: readonly string[] = ["ok", "data", "error"]): Promise<Record<string, unknown>> {
    const credential = employeeCredential(this.client), token = credential.token, generation = credential.generation;
    if (!token) throw stale();
    let response: { data: unknown; error: unknown };
    try { const request = args === undefined ? this.client.rpc(name) : this.client.rpc(name, args); response = await request.setHeader("x-pos-employee-token", token); }
    catch (error) { this.assertGeneration(generation); throw mapSupabaseError(error, "PERMISSION_UPDATE_UNAVAILABLE"); }
    this.assertGeneration(generation);
    if (response.error) throw mapSupabaseError(response.error, "PERMISSION_UPDATE_UNAVAILABLE");
    const envelope = exactRecord(response.data, responseKeys);
    if (envelope.ok === false) denial(envelope); if (envelope.ok !== true) throw failure();
    await Promise.resolve(); this.assertGeneration(generation); return envelope;
  }
  private async voidCall(name: string, args?: Record<string, unknown>): Promise<void> {
    const envelope = await this.call(name, args); if (envelope.data !== null) throw failure();
  }
  saveMenuChanges(changes: MenuChanges): Promise<void> { return this.voidCall("apply_menu_changes", { p_changes: menuForRpc(changes) }); }
  saveFloorPlan(changes: FloorPlanChanges): Promise<void> { return this.voidCall("apply_floor_changes", { p_changes: floorForRpc(changes) }); }
  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    const envelope = await this.call("update_store_settings", { p_input: parsePermissionStoreSettingsUpdate(input) }); return mapSettings(envelope.data);
  }
  clearDemoData(input: ClearDemoDataRequest): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId) || input.confirmation !== true) throw failure();
    return this.clearDemoCall(input);
  }
  private async clearDemoCall(input: ClearDemoDataRequest): Promise<void> {
    const envelope = await this.call("clear_demo_data", { p_request_id: input.requestId, p_confirmation: true }, ["ok", "outcome", "data", "error"]);
    const result = exactRecord(envelope, ["ok", "outcome", "data"]);
    if (result.ok !== true || (result.outcome !== "applied" && result.outcome !== "noop") || result.data !== null) throw failure();
  }
}
