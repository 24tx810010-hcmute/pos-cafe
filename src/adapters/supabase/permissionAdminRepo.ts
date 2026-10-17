import { AppError, type AppErrorCode } from "@/core/appError";
import { permissionErrorMessages } from "@/core/permissionErrors";
import type {
  EmployeeAdminCreateRequest,
  EmployeeAdminEnvelope,
  EmployeeAdminUpdateRequest,
  EmployeeAdminView,
  EmployeeAuditEntry,
  EmployeeAuditFilter,
  EmployeeAuditPage,
  EmployeeAuditSnapshot,
  EmployeePinResetRequest,
  PermissionCode,
  PermissionErrorCode,
  PermissionErrorDetails,
  PermissionExplanation,
  PermissionOverrides,
  PermissionRole,
  PermissionSource,
} from "@/domain/permissions";
import type { IEmployeeAdminRepo } from "@/ports/permissions";
import { employeeCredential } from "./employeeCredential";
import { mapSupabaseError } from "./errors";
import type { SupabaseAnyClient } from "./repoShared";

type AdminErrorCode = Extract<EmployeeAdminEnvelope<never>, { ok: false }>["error"]["code"];
type FailureCode = "PERMISSION_UPDATE_UNAVAILABLE" | "PERMISSION_REFRESH_UNAVAILABLE";

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const ceilingPrefix = "Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: ";
const standardMessages = {
  AUTH_REQUIRED: sessionMessage,
  EMPLOYEE_SESSION_REQUIRED: sessionMessage,
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được phép truy cập.",
} as const;

const permissionCodes = [
  "floor.view", "order.create", "order.update", "order.voidOpen", "payment.take",
  "orderHistory.view", "order.voidPaid", "menu.manage", "floor.manage", "employee.manage",
  "employee.permission.edit", "report.view", "settings.manage", "data.clearDemo", "receipt.reprint",
] as const satisfies readonly PermissionCode[];
const roles = ["owner", "manager", "cashier", "waiter", "kitchen"] as const satisfies readonly PermissionRole[];
const sources = ["default", "grant", "deny", "baseline"] as const satisfies readonly PermissionSource[];
const outcomes = ["applied", "noop", "replayed"] as const;
const auditOutcomes = ["applied", "noop", "denied"] as const;
const permissionCodeSet = new Set<string>(permissionCodes);
const roleSet = new Set<string>(roles);
const sourceSet = new Set<string>(sources);
const permissionErrorCodeSet = new Set<string>(Object.keys(permissionErrorMessages));
const adminErrorCodeSet = new Set<string>([
  ...permissionErrorCodeSet, "FORBIDDEN", "NOT_FOUND", "AUTH_REQUIRED", "EMPLOYEE_SESSION_REQUIRED",
]);
const safeTransportCodeSet = new Set<string>(adminErrorCodeSet);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const controlPattern = /[\u0000-\u001f\u007f]/;

const failure = (code: FailureCode): AppError => new AppError(code, permissionErrorMessages[code]);
const stale = (): AppError => new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function record(value: unknown, code: FailureCode): Record<string, unknown> {
  if (!isRecord(value)) throw failure(code);
  return value;
}

function safeString(value: unknown, code: FailureCode, max = 1_000): string {
  if (typeof value !== "string" || value.length > max || controlPattern.test(value)) throw failure(code);
  return value;
}

function nonNegativeInteger(value: unknown, code: FailureCode): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw failure(code);
  return value;
}

function uuid(value: unknown, code: FailureCode): string {
  if (typeof value !== "string" || !uuidPattern.test(value) || value === "00000000-0000-0000-0000-000000000000") {
    throw failure(code);
  }
  return value.toLowerCase();
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<string>, code: FailureCode): T {
  if (typeof value !== "string" || !values.has(value)) throw failure(code);
  return value as T;
}

function permissionList(value: unknown, code: FailureCode): PermissionCode[] {
  if (!Array.isArray(value) || value.length > permissionCodes.length) throw failure(code);
  const result = value.map(item => enumValue<PermissionCode>(item, permissionCodeSet, code));
  if (new Set(result).size !== result.length) throw failure(code);
  return result;
}

function mapOverrides(value: unknown, code: FailureCode): PermissionOverrides {
  if (value === null) return null;
  const input = record(value, code);
  return { grants: permissionList(input.grants, code), denies: permissionList(input.denies, code) };
}

function mapExplanations(value: unknown, code: FailureCode): PermissionExplanation[] {
  if (!Array.isArray(value) || value.length > permissionCodes.length) throw failure(code);
  const result = value.map(item => {
    const input = record(item, code);
    if (typeof input.effective !== "boolean" || !Array.isArray(input.sources) || input.sources.length > sources.length) {
      throw failure(code);
    }
    const mappedSources = input.sources.map(source => enumValue<PermissionSource>(source, sourceSet, code));
    if (new Set(mappedSources).size !== mappedSources.length) throw failure(code);
    return {
      permission: enumValue<PermissionCode>(input.permission, permissionCodeSet, code),
      effective: input.effective,
      sources: mappedSources,
    };
  });
  if (new Set(result.map(item => item.permission)).size !== result.length) throw failure(code);
  return result;
}

function mapEmployeeView(value: unknown, code: FailureCode): EmployeeAdminView {
  const input = record(value, code);
  if (typeof input.isActive !== "boolean" || typeof input.name !== "string") throw failure(code);
  return {
    id: uuid(input.id, code),
    // Preserve accepted Unicode whitespace and legacy names on reads. Input
    // validation belongs to the write contract, not a lossy projection mapper.
    name: input.name,
    role: enumValue<PermissionRole>(input.role, roleSet, code),
    isActive: input.isActive,
    permissionRevision: nonNegativeInteger(input.permissionRevision, code),
    overrides: mapOverrides(input.overrides, code),
    effective: permissionList(input.effective, code),
    sources: mapExplanations(input.sources, code),
  };
}

function mapAuditSnapshot(value: unknown, code: FailureCode): EmployeeAuditSnapshot | null {
  if (value === null) return null;
  const view = mapEmployeeView({ ...record(value, code), sources: [] }, code);
  const { sources: _sources, ...snapshot } = view;
  return snapshot;
}

const fieldMessages = {
  name: new Set(["Tên nhân viên không được để trống.", "Tên nhân viên tối đa 120 ký tự."]),
  pin: new Set(["PIN phải gồm đúng 6 chữ số."]),
  confirmPin: new Set(["Xác nhận PIN không khớp."]),
} as const;

function mapDetails(value: unknown, code: FailureCode): PermissionErrorDetails | null {
  if (value === null || value === undefined) return null;
  const input = record(value, code);
  const details: PermissionErrorDetails = {};
  if (input.fieldErrors !== undefined) {
    const fields = record(input.fieldErrors, code);
    const fieldErrors: NonNullable<PermissionErrorDetails["fieldErrors"]> = {};
    for (const key of ["name", "pin", "confirmPin"] as const) {
      if (fields[key] === undefined) continue;
      if (typeof fields[key] !== "string" || !(fieldMessages[key] as ReadonlySet<string>).has(fields[key])) throw failure(code);
      fieldErrors[key] = fields[key] as string;
    }
    if (Object.keys(fieldErrors).length) details.fieldErrors = fieldErrors;
  }
  if (input.missingPermissions !== undefined) {
    details.missingPermissions = permissionList(input.missingPermissions, code).sort();
  }
  return details;
}

function messageFor(code: AdminErrorCode, rawMessage: unknown, details: PermissionErrorDetails | null, fallback: FailureCode): string {
  if (code === "PERMISSION_CEILING_EXCEEDED") {
    const message = safeString(rawMessage, fallback, 1_000);
    const labels = message.startsWith(ceilingPrefix) ? message.slice(ceilingPrefix.length) : "";
    if (!labels.trim() || controlPattern.test(labels) || !details?.missingPermissions?.length) throw failure(fallback);
    return message;
  }
  if (code in standardMessages) return standardMessages[code as keyof typeof standardMessages];
  return permissionErrorMessages[code as PermissionErrorCode];
}

function mapDenial(value: unknown, fallback: FailureCode): Extract<EmployeeAdminEnvelope<never>, { ok: false }> {
  const input = record(value, fallback);
  const error = record(input.error, fallback);
  const code = enumValue<AdminErrorCode>(error.code, adminErrorCodeSet, fallback);
  const details = mapDetails(error.details, fallback);
  return { ok: false, error: { code, message: messageFor(code, error.message, details, fallback), details } };
}

function mapTransportError(value: unknown, fallback: FailureCode): AppError {
  const mapped = mapSupabaseError(value, fallback);
  const code = safeTransportCodeSet.has(mapped.code) ? mapped.code as AdminErrorCode : fallback;
  const message = code in standardMessages
    ? standardMessages[code as keyof typeof standardMessages]
    : permissionErrorMessages[code as PermissionErrorCode];
  return new AppError(code as AppErrorCode, message);
}

function mapAuditEntry(value: unknown, code: FailureCode): EmployeeAuditEntry {
  const input = record(value, code);
  if (input.actorType !== "employee" && input.actorType !== "operator") throw failure(code);
  if (!auditOutcomes.includes(input.outcome as typeof auditOutcomes[number])) throw failure(code);
  if (typeof input.credentialChanged !== "boolean") throw failure(code);
  const occurredAt = safeString(input.occurredAt, code);
  if (!Number.isFinite(Date.parse(occurredAt))) throw failure(code);
  const reason = input.reason === null ? null : safeString(input.reason, code);
  const mapped = {
    auditKey: safeString(input.auditKey, code),
    storeId: uuid(input.storeId, code),
    actorType: input.actorType,
    actorKey: safeString(input.actorKey, code),
    requestId: uuid(input.requestId, code),
    targetId: uuid(input.targetId, code),
    occurredAt,
    kind: safeString(input.kind, code),
    outcome: input.outcome,
    reason,
    details: mapDetails(input.details, code),
    actorEffective: permissionList(input.actorEffective, code),
    catalogRevision: nonNegativeInteger(input.catalogRevision, code),
    before: mapAuditSnapshot(input.before, code),
    proposedAfter: mapAuditSnapshot(input.proposedAfter, code),
    actualAfter: mapAuditSnapshot(input.actualAfter, code),
    credentialChanged: input.credentialChanged,
    ...(input.operatorCaseRef === undefined || input.operatorCaseRef === null
      ? {} : { operatorCaseRef: safeString(input.operatorCaseRef, code) }),
    ...(input.operatorProofRef === undefined || input.operatorProofRef === null
      ? {} : { operatorProofRef: safeString(input.operatorProofRef, code) }),
  };
  return mapped as EmployeeAuditEntry;
}

/** Staged T05 adapter. Runtime composition stays on the legacy ports until consumer activation. */
export class SupabasePermissionAdminRepo implements IEmployeeAdminRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  private assertGeneration(generation: number): void {
    if (generation !== employeeCredential(this.client).generation) throw stale();
  }

  private async call(name: string, args: Record<string, unknown> | undefined, fallback: FailureCode): Promise<unknown> {
    const credential = employeeCredential(this.client);
    const token = credential.token;
    const generation = credential.generation;
    if (!token) throw stale();

    let response: { data: unknown; error: unknown };
    try {
      const request = args === undefined ? this.client.rpc(name) : this.client.rpc(name, args);
      response = await request.setHeader("x-pos-employee-token", token);
    } catch (error) {
      this.assertGeneration(generation);
      throw mapTransportError(error, fallback);
    }
    this.assertGeneration(generation);
    if (response.error) throw mapTransportError(response.error, fallback);
    return response.data;
  }

  private async mutate(
    name: string,
    request: EmployeeAdminCreateRequest | EmployeeAdminUpdateRequest | EmployeePinResetRequest,
  ): Promise<EmployeeAdminEnvelope<EmployeeAdminView>> {
    const raw = record(await this.call(name, { p_request: request }, "PERMISSION_UPDATE_UNAVAILABLE"), "PERMISSION_UPDATE_UNAVAILABLE");
    if (raw.ok === false) {
      const denial = mapDenial(raw, "PERMISSION_UPDATE_UNAVAILABLE");
      if (denial.error.code === "AUTH_REQUIRED" || denial.error.code === "EMPLOYEE_SESSION_REQUIRED") {
        throw new AppError(denial.error.code, denial.error.message, denial.error.details ?? undefined);
      }
      return denial;
    }
    if (raw.ok !== true || !outcomes.includes(raw.outcome as typeof outcomes[number])) {
      throw failure("PERMISSION_UPDATE_UNAVAILABLE");
    }
    return {
      ok: true,
      outcome: raw.outcome as typeof outcomes[number],
      data: mapEmployeeView(raw.data, "PERMISSION_UPDATE_UNAVAILABLE"),
    };
  }

  async listEmployees(): Promise<EmployeeAdminView[]> {
    const raw = record(await this.call("permission_admin_list", undefined, "PERMISSION_REFRESH_UNAVAILABLE"), "PERMISSION_REFRESH_UNAVAILABLE");
    if (raw.ok === false) this.throwReadDenial(raw);
    if (raw.ok !== true || !Array.isArray(raw.data)) throw failure("PERMISSION_REFRESH_UNAVAILABLE");
    return raw.data.map(value => mapEmployeeView(value, "PERMISSION_REFRESH_UNAVAILABLE"));
  }

  async getEmployee(targetId: string): Promise<EmployeeAdminView> {
    const raw = record(await this.call("permission_admin_get", { p_target_id: targetId }, "PERMISSION_REFRESH_UNAVAILABLE"), "PERMISSION_REFRESH_UNAVAILABLE");
    if (raw.ok === false) this.throwReadDenial(raw);
    if (raw.ok !== true) throw failure("PERMISSION_REFRESH_UNAVAILABLE");
    return mapEmployeeView(raw.data, "PERMISSION_REFRESH_UNAVAILABLE");
  }

  createEmployee(request: EmployeeAdminCreateRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>> {
    return this.mutate("permission_admin_create", request);
  }

  updateEmployee(request: EmployeeAdminUpdateRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>> {
    return this.mutate("permission_admin_update", request);
  }

  resetPin(request: EmployeePinResetRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>> {
    return this.mutate("permission_admin_reset_pin", request);
  }

  async listAudit(filter?: EmployeeAuditFilter): Promise<EmployeeAuditPage> {
    const raw = record(await this.call("permission_admin_audit", { p_filter: filter ?? {} }, "PERMISSION_REFRESH_UNAVAILABLE"), "PERMISSION_REFRESH_UNAVAILABLE");
    if (raw.ok === false) this.throwReadDenial(raw);
    if (raw.ok !== true) throw failure("PERMISSION_REFRESH_UNAVAILABLE");
    const page = record(raw.data, "PERMISSION_REFRESH_UNAVAILABLE");
    if (!Array.isArray(page.rows)) throw failure("PERMISSION_REFRESH_UNAVAILABLE");
    const nextCursor = page.nextCursor === null ? null : safeString(page.nextCursor, "PERMISSION_REFRESH_UNAVAILABLE", 4_096);
    return { rows: page.rows.map(value => mapAuditEntry(value, "PERMISSION_REFRESH_UNAVAILABLE")), nextCursor };
  }

  private throwReadDenial(value: unknown): never {
    const denial = mapDenial(value, "PERMISSION_REFRESH_UNAVAILABLE");
    throw new AppError(denial.error.code, denial.error.message, denial.error.details ?? undefined);
  }
}
