import type { AuthorityBundle, AuthorityRevision, EmployeeRosterEntry, OwnerPinChangeRequest, PermissionBootstrapRequest, PermissionBootstrapResult, PermissionPinChangeResult, PermissionSession, RequiredPinSession, RequiredPinSessionProof, RequiredPinChangeRequest, RequiredPinChangeResult } from "@/domain/permissions";
import type { IPermissionAuthorityRepo, IPermissionSessionRepo, IPermissionBootstrapRepo } from "@/ports/permissions";
import { AppError } from "@/core/appError";
import { validatePermissionCatalog } from "@/core/permissionCatalog";
import { permissionEmployeeName, permissionPin, permissionRevision, permissionUuid } from "@/core/permissionInputs";
import { parseOwnerPinChange, parsePermissionBootstrap, parseRequiredPinChange } from "@/core/permissionIdentityInputs";
import { mapSupabaseError } from "./errors";
import { employeeCredential, clearEmployeeCredential } from "./employeeCredential";
import type { SupabaseAnyClient } from "./repoShared";

const stale = () => new AppError("EMPLOYEE_SESSION_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
/** Permission identity adapter. Employee credentials remain private to the runtime. */
export class SupabasePermissionIdentityRepo implements IPermissionSessionRepo, IPermissionAuthorityRepo, IPermissionBootstrapRepo {
  private restricted: { generation: number; session: RequiredPinSession } | null = null;
  constructor(private readonly client: SupabaseAnyClient) {}
  private async call(name: string, args?: Record<string, unknown>, token?: string) {
    const call = this.client.rpc(name, args);
    const { data, error } = await (token ? call.setHeader("x-pos-employee-token", token) : call);
    if (error || data?.ok !== true) {
      const mapped = mapSupabaseError(error ?? { message: data?.error?.code }, "PERMISSION_UPDATE_UNAVAILABLE");
      // Never keep raw request/response objects (potential credential material) in the UI error.
      throw new AppError(mapped.code, mapped.message);
    }
    return data;
  }
  private assertGeneration(generation: number) { if (generation !== employeeCredential(this.client).generation) throw stale(); }
  private bundle(value: AuthorityBundle): AuthorityBundle {
    validatePermissionCatalog(value.catalog);
    permissionRevision(value.snapshot.employeeRevision); permissionRevision(value.snapshot.catalogRevision);
    permissionUuid(value.snapshot.employeeId); permissionUuid(value.snapshot.storeId);
    if (!value.snapshot.active || value.snapshot.catalogRevision !== value.catalog.revision
      || !value.catalog.roles.some(r => r.code === value.snapshot.role && r.enabled)) throw stale();
    return value;
  }
  async startSession(employeeId: string, pin: string): Promise<PermissionSession> {
    this.restricted = null;
    clearEmployeeCredential(this.client);
    const credential = employeeCredential(this.client), generation = credential.generation;
    permissionUuid(employeeId);
    try { permissionPin(pin); } catch { throw new AppError("INVALID_PIN", "PIN không đúng."); }
    const data = await this.call("permission_start_session", { p_employee_id: employeeId, p_pin: pin });
    this.assertGeneration(generation);
    const duration = data.kind === "normal" ? 43200000 : data.kind === "required_pin_change" ? 300000 : 0;
    if (!duration || typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.token)
      || typeof data.issuedAt !== "string" || typeof data.expiresAt !== "string"
      || !Number.isFinite(Date.parse(data.issuedAt)) || Date.parse(data.expiresAt) - Date.parse(data.issuedAt) !== duration) throw stale();
    if (data.kind === "required_pin_change") {
      if ("authority" in data || "role" in data || "permissions" in data || permissionUuid(data.employeeId) !== employeeId.toLowerCase()) throw stale();
      const session: RequiredPinSession = {
        kind: "required_pin_change", storeId: permissionUuid(data.storeId), employeeId: permissionUuid(data.employeeId),
        name: permissionEmployeeName(data.name), employeeRevision: permissionRevision(data.employeeRevision),
        issuedAt: data.issuedAt, expiresAt: data.expiresAt,
      };
      credential.token = data.token;
      this.restricted = { generation, session };
      return session;
    }
    if (data.pinChangeRequired !== false || !data.authority?.snapshot || !data.authority?.catalog) throw stale();
    const authority = this.bundle(data.authority);
    if (authority.snapshot.employeeId !== employeeId.toLowerCase()) throw stale();
    credential.token = data.token;
    return { kind: "normal", pinChangeRequired: false, authority, issuedAt: data.issuedAt, expiresAt: data.expiresAt };
  }
  async revokeSession(): Promise<void> {
    this.restricted = null;
    const token = employeeCredential(this.client).token;
    clearEmployeeCredential(this.client);
    if (token) await this.call("permission_revoke_session", undefined, token);
  }
  async checkRequiredPinSession(): Promise<RequiredPinSessionProof> {
    const { token, generation } = employeeCredential(this.client), restricted = this.restricted;
    if (!token || !restricted || restricted.generation !== generation) throw stale();
    const response = await this.call("permission_check_required_pin_session", undefined, token);
    this.assertGeneration(generation);
    const data = response.data;
    if (!data || data.valid !== true || data.purpose !== "required_pin_change"
      || data.employeeRevision !== restricted.session.employeeRevision
      || data.expiresAt !== restricted.session.expiresAt
      || Object.keys(data).some(key => !["valid", "purpose", "employeeRevision", "expiresAt"].includes(key))) throw stale();
    return { valid: true, purpose: "required_pin_change", employeeRevision: data.employeeRevision, expiresAt: data.expiresAt };
  }
  async completeRequiredPinChange(request: RequiredPinChangeRequest): Promise<RequiredPinChangeResult> {
    const p = parseRequiredPinChange(request), { token, generation } = employeeCredential(this.client);
    if (!token || !this.restricted || this.restricted.generation !== generation) throw stale();
    try {
      const response = await this.call("permission_complete_required_pin_change", { p_request: p }, token);
      this.assertGeneration(generation);
      const data = response.data;
      if (response.outcome !== "applied" || data?.credentialChanged !== true || data.pinChangeRequired !== false
        || data.employeeRevision !== p.expectedRevision + 1)
        throw new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.");
      clearEmployeeCredential(this.client); this.restricted = null;
      return { outcome: "applied", credentialChanged: true, pinChangeRequired: false, employeeRevision: data.employeeRevision };
    } catch (error) {
      this.assertGeneration(generation);
      if (error instanceof AppError && ["PERMISSION_UPDATE_UNAVAILABLE", "EMPLOYEE_SESSION_REQUIRED", "EMPLOYEE_VERSION_CONFLICT", "AUTH_REQUIRED"].includes(error.code)) {
        clearEmployeeCredential(this.client); this.restricted = null;
      }
      if (!(error instanceof AppError) || error.code === "PERMISSION_UPDATE_UNAVAILABLE") {
        if (employeeCredential(this.client).generation === generation) clearEmployeeCredential(this.client);
        this.restricted = null;
        throw new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.");
      }
      throw error;
    }
  }
  async changeOwnPin(request: OwnerPinChangeRequest): Promise<PermissionPinChangeResult> {
    const p = parseOwnerPinChange(request), credential = employeeCredential(this.client), generation = credential.generation;
    if (!credential.token) throw stale();
    let data;
    try { data = await this.call("permission_change_own_pin", { p_request: p }, credential.token); }
    catch (error) {
      this.assertGeneration(generation);
      if (error instanceof AppError && error.code === "INVALID_PIN") throw new AppError("INVALID_PIN", "PIN hiện tại không đúng.");
      throw error;
    }
    this.assertGeneration(generation);
    permissionRevision(data.data.employeeRevision);
    // A replay reports a historical change; it must not lock a newly issued session.
    if (data.outcome === "applied" && data.data.credentialChanged) clearEmployeeCredential(this.client);
    return { outcome: data.outcome, credentialChanged: data.data.credentialChanged, employeeRevision: data.data.employeeRevision };
  }
  async getAuthority(): Promise<AuthorityBundle> {
    const { token, generation } = employeeCredential(this.client);
    if (!token) throw stale();
    const data = await this.call("permission_get_authority", undefined, token);
    this.assertGeneration(generation); return this.bundle(data.data);
  }
  async getRevision(): Promise<AuthorityRevision> {
    const { token, generation } = employeeCredential(this.client);
    if (!token) throw stale();
    const data = await this.call("permission_get_revision", undefined, token);
    this.assertGeneration(generation);
    permissionRevision(data.data.employeeRevision); permissionRevision(data.data.catalogRevision);
    if (!Number.isFinite(Date.parse(data.data.serverTime))) throw stale();
    return data.data;
  }
  async listRoster(): Promise<EmployeeRosterEntry[]> {
    const data = await this.call("permission_list_roster");
    return data.data.map((e: EmployeeRosterEntry) => ({ id: permissionUuid(e.id), name: e.name }));
  }
  async bootstrapStore(request: PermissionBootstrapRequest): Promise<PermissionBootstrapResult> {
    const data = await this.call("permission_bootstrap_store", { p_request: parsePermissionBootstrap(request) });
    if (!["applied", "replayed"].includes(data.outcome) || !Number.isInteger(data.data?.storeNo)
      || data.data.storeNo < 1 || data.data.storeNo > 2147483647 || typeof data.data.seedRequested !== "boolean")
      throw new AppError("BOOTSTRAP_CONFLICT", "Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán.");
    return { outcome: data.outcome, storeId: permissionUuid(data.data.storeId), ownerId: permissionUuid(data.data.ownerId), storeNo: data.data.storeNo,
      seedRequested: data.data.seedRequested, seedWorkflowId: permissionUuid(data.data.seedWorkflowId) };
  }
}
