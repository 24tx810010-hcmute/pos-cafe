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
  PermissionEmployee,
  PermissionErrorDetails,
  PermissionOverrides,
  PermissionRole,
} from "@/domain/permissions";
import type { IEmployeeAdminRepo } from "@/ports/permissions";
import { AppError, isAppError } from "@/core/appError";
import { configuredPermissions, normalizePermissionOverrides } from "@/core/permissionOverrides";
import { permissionError } from "@/core/permissionErrors";
import {
  permissionEmployeeName,
  permissionPin,
  permissionRevision,
  permissionUuid,
  selectablePermissionRole,
} from "@/core/permissionInputs";
import { clone } from "./mockState";
import {
  mockPermissionPinMatches,
  mockPermissionRevokeSessions,
  mockPermissionSetPin,
  requireMockNormalPermissionActor,
} from "./permissionIdentityRepo";
import { mockPermissionAuditRows, mockPermissionRequestReservations } from "./permissionAdminState";
import type { MockPermissionState } from "./permissionState";
import { mockPermissionRequestMac } from "./permissionRequestMac";

type AdminError = Extract<EmployeeAdminEnvelope<never>, { ok: false }>["error"];
type TerminalEnvelope = EmployeeAdminEnvelope<EmployeeAdminView>;
type ErrorEnvelope = Extract<TerminalEnvelope, { ok: false }>;
type MutationKind = "create_employee" | "update_employee" | "reset_pin";
type RegistryRecord = {
  canonicalPayload: string;
  requiredPermissions: PermissionCode[];
  targetId: string;
  targetMustExist: boolean;
  result: TerminalEnvelope;
};
type AdminPrivateState = { requests: Map<string, RegistryRecord>; issuedCursors: Set<string> };

const privateStates = new WeakMap<MockPermissionState, AdminPrivateState>();
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

function looseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw permissionError("INVALID_EMPLOYEE_REQUEST");
  return value as Record<string, unknown>;
}

function privateState(state: MockPermissionState): AdminPrivateState {
  let value = privateStates.get(state);
  if (!value) {
    value = { requests: new Map(), issuedCursors: new Set() };
    privateStates.set(state, value);
  }
  return value;
}

function strictObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw permissionError("INVALID_EMPLOYEE_REQUEST");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) throw permissionError("INVALID_EMPLOYEE_REQUEST");
  return result;
}

function validateOverridesShape(value: unknown): void {
  if (value === null) return;
  const object = strictObject(value, ["grants", "denies"]);
  if (Object.keys(object).length !== 2 || !own(object, "grants") || !own(object, "denies"))
    throw permissionError("INVALID_EMPLOYEE_REQUEST");
  for (const key of ["grants", "denies"] as const) {
    const list = object[key];
    if (!Array.isArray(list) || list.length > 100) throw permissionError("INVALID_EMPLOYEE_REQUEST");
    for (const code of list) if (typeof code !== "string") throw permissionError("INVALID_EMPLOYEE_REQUEST");
  }
}

function stablePayload(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (!input || typeof input !== "object") return input;
    const source = input as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map(key => [key, normalize(source[key])]));
  };
  return JSON.stringify(normalize(value));
}

function encodeOpaque(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeOpaque(value: string): unknown {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(base64);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))));
  } catch {
    throw permissionError("INVALID_EMPLOYEE_REQUEST");
  }
}

function errorEnvelope(error: AppError): ErrorEnvelope {
  const details = error.cause && typeof error.cause === "object"
    ? clone(error.cause as PermissionErrorDetails)
    : null;
  return { ok: false, error: { code: error.code as AdminError["code"], message: error.message, details } };
}

function unavailableEnvelope(): TerminalEnvelope {
  return errorEnvelope(permissionError("PERMISSION_UPDATE_UNAVAILABLE"));
}

export class MockPermissionAdminRepo implements IEmployeeAdminRepo {
  constructor(private readonly state: MockPermissionState) {
    privateState(state);
    mockPermissionAuditRows(state);
  }

  private actor(): PermissionEmployee {
    return requireMockNormalPermissionActor(this.state);
  }

  private async sensitiveCanonicalPayload(
    kind: "create_employee" | "reset_pin",
    request: unknown,
    initialActor: PermissionEmployee,
    initialSession: MockPermissionState["session"],
  ): Promise<{ actor: PermissionEmployee; canonicalPayload: string }> {
    let canonicalPayload: string;
    try {
      canonicalPayload = await mockPermissionRequestMac(this.state, `${kind}:${stablePayload(request)}`);
    } catch {
      throw permissionError("PERMISSION_UPDATE_UNAVAILABLE");
    }
    const actor = this.actor();
    if (this.state.session !== initialSession || actor.id !== initialActor.id)
      throw new AppError("EMPLOYEE_SESSION_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
    return { actor, canonicalPayload };
  }

  private view(employee: PermissionEmployee): EmployeeAdminView {
    const configured = configuredPermissions(this.state.catalog, employee.role, employee.overrides);
    return clone({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      isActive: employee.isActive,
      permissionRevision: employee.permissionRevision,
      overrides: employee.overrides,
      effective: configured.permissions,
      sources: configured.sources,
    });
  }

  private auditSnapshot(employee: PermissionEmployee | null): EmployeeAuditSnapshot | null {
    if (!employee) return null;
    const { sources: _sources, ...snapshot } = this.view(employee);
    return snapshot;
  }

  private permissions(employee: PermissionEmployee): PermissionCode[] {
    return configuredPermissions(this.state.catalog, employee.role, employee.overrides).permissions;
  }

  private requireActions(actor: PermissionEmployee, required: readonly PermissionCode[]): void {
    const effective = this.permissions(actor);
    const allowed = required.length
      ? required.every(permission => effective.includes(permission))
      : effective.includes("employee.manage") || effective.includes("employee.permission.edit");
    if (!allowed) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }

  private findTarget(targetId: string): PermissionEmployee {
    const target = this.state.employees.find(employee => employee.id === targetId && employee.storeId === this.state.storeId);
    if (!target) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập.");
    return target;
  }

  private registryKey(actor: PermissionEmployee, requestId: string): string {
    return `${this.state.storeId}:${actor.id}:${requestId}`;
  }

  private replay(
    actor: PermissionEmployee,
    requestId: string,
    canonicalPayload: string,
    kind: MutationKind,
    actionError: AppError | null,
  ): TerminalEnvelope | null {
    const key = this.registryKey(actor, requestId);
    const reservation = mockPermissionRequestReservations(this.state).get(key);
    if (!reservation) return null;
    if (actionError) return errorEnvelope(actionError);
    if (reservation.kind !== kind || reservation.canonicalPayload !== canonicalPayload)
      return errorEnvelope(permissionError("ADMIN_REQUEST_REUSED"));
    const record = privateState(this.state).requests.get(key);
    if (!record) return unavailableEnvelope();
    try {
      if (record.targetMustExist) this.findTarget(record.targetId);
    } catch (error) {
      return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope();
    }
    if (!record.result.ok) return clone(record.result);
    return { ok: true, outcome: "replayed", data: clone(record.result.data) };
  }

  private storeTerminal(
    actor: PermissionEmployee,
    requestId: string,
    canonicalPayload: string,
    requiredPermissions: PermissionCode[],
    targetId: string,
    targetMustExist: boolean,
    kind: MutationKind,
    result: TerminalEnvelope,
  ): TerminalEnvelope {
    const key = this.registryKey(actor, requestId);
    privateState(this.state).requests.set(key, {
      canonicalPayload,
      requiredPermissions: [...requiredPermissions],
      targetId,
      targetMustExist,
      result: clone(result),
    });
    mockPermissionRequestReservations(this.state).set(key, { kind, canonicalPayload });
    return clone(result);
  }

  private ceiling(actor: PermissionEmployee, before: PermissionEmployee | null, after: PermissionEmployee): void {
    if (actor.role === "owner" && after.role !== "owner") return;
    const actorSet = new Set(this.permissions(actor));
    const missing = new Set<PermissionCode>();
    for (const snapshot of [before, after]) {
      if (!snapshot) continue;
      for (const permission of this.permissions(snapshot)) if (!actorSet.has(permission)) missing.add(permission);
    }
    if (!missing.size) return;
    const missingPermissions = [...missing].sort();
    const names = missingPermissions.map(code => this.state.catalog.permissions.find(permission => permission.code === code)!.labelVi);
    throw new AppError(
      "PERMISSION_CEILING_EXCEEDED",
      `Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: ${names.join(", ")}.`,
      { missingPermissions } satisfies PermissionErrorDetails,
    );
  }

  private appendAudit(input: {
    actor: PermissionEmployee;
    requestId: string;
    targetId: string;
    kind: MutationKind;
    outcome: EmployeeAuditEntry["outcome"];
    reason: string | null;
    details: PermissionErrorDetails | null;
    before: PermissionEmployee | null;
    proposedAfter: PermissionEmployee | null;
    actualAfter: PermissionEmployee | null;
    credentialChanged: boolean;
  }): void {
    const occurredAt = new Date(this.state.now()).toISOString();
    const auditKey = encodeOpaque({
      storeId: this.state.storeId,
      actorType: "employee",
      actorKey: input.actor.id,
      requestId: input.requestId,
      targetId: input.targetId,
    });
    mockPermissionAuditRows(this.state).push({
      auditKey,
      storeId: this.state.storeId,
      actorType: "employee",
      actorKey: input.actor.id,
      requestId: input.requestId,
      targetId: input.targetId,
      occurredAt,
      kind: input.kind,
      outcome: input.outcome,
      reason: input.reason,
      details: clone(input.details),
      actorEffective: [...this.permissions(input.actor)],
      catalogRevision: this.state.catalog.revision,
      before: this.auditSnapshot(input.before),
      proposedAfter: this.auditSnapshot(input.proposedAfter),
      actualAfter: this.auditSnapshot(input.actualAfter),
      credentialChanged: input.credentialChanged,
    });
  }

  private denied(input: {
    actor: PermissionEmployee;
    requestId: string;
    canonicalPayload: string;
    requiredPermissions: PermissionCode[];
    targetId: string;
    targetMustExist: boolean;
    kind: MutationKind;
    error: AppError;
    before: PermissionEmployee | null;
    proposedAfter: PermissionEmployee | null;
    actualAfter: PermissionEmployee | null;
  }): TerminalEnvelope {
    const result = errorEnvelope(input.error);
    const auditProposed = input.proposedAfter && input.before
      ? { ...clone(input.proposedAfter), permissionRevision: input.before.permissionRevision }
      : input.proposedAfter;
    try {
      this.appendAudit({ ...input, proposedAfter: auditProposed, outcome: "denied", reason: input.error.code,
        details: result.error.details, credentialChanged: false });
    } catch {
      return unavailableEnvelope();
    }
    return this.storeTerminal(
      input.actor,
      input.requestId,
      input.canonicalPayload,
      input.requiredPermissions,
      input.targetId,
      input.targetMustExist,
      input.kind,
      result,
    );
  }

  async listEmployees(): Promise<EmployeeAdminView[]> {
    const actor = this.actor();
    this.requireActions(actor, []);
    return this.state.employees.filter(employee => employee.storeId === this.state.storeId).map(employee => this.view(employee));
  }

  async getEmployee(targetId: string): Promise<EmployeeAdminView> {
    const actor = this.actor();
    this.requireActions(actor, []);
    return this.view(this.findTarget(permissionUuid(targetId)));
  }

  async createEmployee(request: EmployeeAdminCreateRequest): Promise<TerminalEnvelope> {
    let actor: PermissionEmployee;
    try { actor = this.actor(); } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const initialActor = actor;
    const initialSession = this.state.session;
    let requestId: string;
    let targetId: string;
    let early: Record<string, unknown>;
    try {
      early = looseObject(request);
      requestId = permissionUuid(early.requestId);
      targetId = permissionUuid(early.id);
    } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    let canonicalPayload: string;
    try {
      const secured = await this.sensitiveCanonicalPayload("create_employee", request, initialActor, initialSession);
      actor = secured.actor;
      canonicalPayload = secured.canonicalPayload;
    } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const collision = this.state.employees.find(employee => employee.id === targetId);
    if (collision && collision.storeId !== this.state.storeId)
      return errorEnvelope(new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập."));
    const requiredPermissions: PermissionCode[] = ["employee.manage", ...(own(early, "overrides") ? ["employee.permission.edit" as const] : [])];
    let actionError: AppError | null = null;
    try { this.requireActions(actor, requiredPermissions); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      actionError = error;
    }
    const replay = this.replay(actor, requestId, canonicalPayload, "create_employee", actionError);
    if (replay) return replay;

    let name: string;
    let pin: string;
    let rawRole: unknown;
    let expectedCatalogRevision: number;
    let hasOverrides: boolean;
    try {
      const raw = strictObject(request, ["requestId", "id", "name", "role", "pin", "expectedCatalogRevision", "overrides"]);
      if (!own(raw, "requestId") || !own(raw, "id") || !own(raw, "name") || !own(raw, "role")
        || !own(raw, "pin") || !own(raw, "expectedCatalogRevision")) throw permissionError("INVALID_EMPLOYEE_REQUEST");
      targetId = permissionUuid(raw.id);
      name = permissionEmployeeName(raw.name);
      pin = permissionPin(raw.pin);
      rawRole = raw.role;
      expectedCatalogRevision = permissionRevision(raw.expectedCatalogRevision);
      hasOverrides = own(raw, "overrides");
      if (hasOverrides) validateOverridesShape(raw.overrides);
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: !!collision,
        kind: "create_employee", error: chosen, before: null, proposedAfter: null, actualAfter: collision ?? null });
    }

    let proposed: PermissionEmployee | null = null;
    try {
      if (rawRole === "owner") throw permissionError("OWNER_PROTECTED");
      const role = selectablePermissionRole(this.state.catalog, rawRole);
      if (expectedCatalogRevision !== this.state.catalog.revision) throw permissionError("PERMISSION_CATALOG_STALE");
      const overrides = hasOverrides
        ? this.normalizeOverrides(role, (request as EmployeeAdminCreateRequest).overrides)
        : null;
      proposed = { id: targetId, storeId: this.state.storeId, name, role, isActive: true, permissionRevision: 0, overrides };
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      if (!proposed && error.code !== "PERMISSION_CATALOG_STALE") {
        try {
          const role = rawRole === "owner" ? "owner" : selectablePermissionRole(this.state.catalog, rawRole);
          const overrides = hasOverrides
            ? this.normalizeOverrides(role, (request as EmployeeAdminCreateRequest).overrides)
            : null;
          proposed = { id: targetId, storeId: this.state.storeId, name, role, isActive: true, permissionRevision: 0, overrides };
        } catch { /* invalid candidates stay null */ }
      }
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: !!collision,
        kind: "create_employee", error: chosen, before: null, proposedAfter: proposed, actualAfter: collision ?? null });
    }

    if (actionError) return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId,
      targetMustExist: !!collision, kind: "create_employee", error: actionError, before: null,
      proposedAfter: proposed, actualAfter: collision ?? null });
    if (collision) return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId,
      targetMustExist: true, kind: "create_employee", error: permissionError("INVALID_EMPLOYEE_REQUEST"),
      before: null, proposedAfter: proposed, actualAfter: collision });
    try { this.ceiling(actor, null, proposed); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: false,
        kind: "create_employee", error, before: null, proposedAfter: proposed, actualAfter: null });
    }

    const result: TerminalEnvelope = { ok: true, outcome: "applied", data: this.view(proposed) };
    try {
      this.appendAudit({ actor, requestId, targetId, kind: "create_employee", outcome: "applied", reason: null, details: null,
        before: null, proposedAfter: proposed, actualAfter: proposed, credentialChanged: false });
    } catch {
      return unavailableEnvelope();
    }
    this.state.employees.push(proposed);
    mockPermissionSetPin(this.state, targetId, pin);
    return this.storeTerminal(actor, requestId, canonicalPayload, requiredPermissions, targetId, true, "create_employee", result);
  }

  private normalizeOverrides(role: PermissionRole, value: unknown): PermissionOverrides {
    // Delayed until catalog revision and owner/self guards have passed.
    return normalizePermissionOverrides(this.state.catalog, role, value);
  }

  private updateCandidate(
    target: PermissionEmployee,
    rawPatch: Record<string, unknown>,
    name: string | undefined,
    role: PermissionRole | undefined,
    isActive: boolean | undefined,
  ): PermissionEmployee {
    const roleChanged = role !== undefined && role !== target.role;
    let overrides = roleChanged ? null : clone(target.overrides);
    if (own(rawPatch, "overrides")) overrides = this.normalizeOverrides(role ?? target.role, rawPatch.overrides);
    const proposed: PermissionEmployee = {
      ...clone(target),
      name: name ?? target.name,
      role: role ?? target.role,
      isActive: isActive ?? target.isActive,
      overrides,
    };
    const changed = proposed.name !== target.name || proposed.role !== target.role || proposed.isActive !== target.isActive
      || JSON.stringify(proposed.overrides) !== JSON.stringify(target.overrides);
    if (changed) proposed.permissionRevision = target.permissionRevision + 1;
    return proposed;
  }

  async updateEmployee(request: EmployeeAdminUpdateRequest): Promise<TerminalEnvelope> {
    let actor: PermissionEmployee;
    try { actor = this.actor(); } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const canonicalPayload = stablePayload(request);
    let requestId: string;
    let targetId: string;
    let early: Record<string, unknown>;
    try {
      early = looseObject(request);
      requestId = permissionUuid(early.requestId);
      targetId = permissionUuid(early.targetId);
    } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    let target: PermissionEmployee;
    try { target = this.findTarget(targetId); }
    catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const earlyPatch = early.patch && typeof early.patch === "object" && !Array.isArray(early.patch)
      ? early.patch as Record<string, unknown> : {};
    const requiredPermissions: PermissionCode[] = [];
    if (["name", "role", "isActive"].some(field => own(earlyPatch, field))) requiredPermissions.push("employee.manage");
    if (own(earlyPatch, "overrides")) requiredPermissions.push("employee.permission.edit");
    let actionError: AppError | null = null;
    try { this.requireActions(actor, requiredPermissions); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      actionError = error;
    }
    const replay = this.replay(actor, requestId, canonicalPayload, "update_employee", actionError);
    if (replay) return replay;

    let expectedRevision: number;
    let expectedCatalogRevision: number | undefined;
    let rawPatch: Record<string, unknown>;
    let isActive: boolean | undefined;
    let name: string | undefined;
    try {
      const outer = strictObject(request, ["requestId", "targetId", "expectedRevision", "expectedCatalogRevision", "patch"]);
      if (!own(outer, "requestId") || !own(outer, "targetId") || !own(outer, "expectedRevision") || !own(outer, "patch"))
        throw permissionError("INVALID_EMPLOYEE_REQUEST");
      targetId = permissionUuid(outer.targetId);
      expectedRevision = permissionRevision(outer.expectedRevision);
      rawPatch = strictObject(outer.patch, ["name", "role", "isActive", "overrides"]);
      if (own(rawPatch, "name")) name = permissionEmployeeName(rawPatch.name);
      if (own(rawPatch, "isActive")) {
        if (typeof rawPatch.isActive !== "boolean") throw permissionError("INVALID_EMPLOYEE_REQUEST");
        isActive = rawPatch.isActive;
      }
      if (own(rawPatch, "overrides")) validateOverridesShape(rawPatch.overrides);
      if (own(rawPatch, "role") || own(rawPatch, "overrides") || own(outer, "expectedCatalogRevision"))
        expectedCatalogRevision = permissionRevision(outer.expectedCatalogRevision);
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "update_employee", error: chosen, before: clone(target), proposedAfter: null, actualAfter: target });
    }

    const before = clone(target);
    let proposed: PermissionEmployee | null = null;
    let role: PermissionRole | undefined;
    try {
      if (target.role === "owner" && actor.id !== target.id) throw permissionError("OWNER_PROTECTED");
      if (actor.id === target.id && (own(rawPatch, "role") || own(rawPatch, "overrides")))
        throw permissionError("SELF_PERMISSION_EDIT_FORBIDDEN");
      if (actor.id === target.id && isActive === false) throw permissionError("SELF_DISABLE_FORBIDDEN");
      if (rawPatch.role === "owner" && target.role !== "owner") throw permissionError("OWNER_PROTECTED");
      if (own(rawPatch, "role")) role = selectablePermissionRole(this.state.catalog, rawPatch.role);
      if (expectedRevision !== target.permissionRevision) throw permissionError("EMPLOYEE_VERSION_CONFLICT");
      if (expectedCatalogRevision !== undefined && expectedCatalogRevision !== this.state.catalog.revision)
        throw permissionError("PERMISSION_CATALOG_STALE");
      proposed = this.updateCandidate(target, rawPatch, name, role, isActive);
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      if (!proposed && error.code !== "PERMISSION_CATALOG_STALE") {
        try {
          const auditName = own(rawPatch, "name") ? permissionEmployeeName(rawPatch.name) : undefined;
          const auditRole = own(rawPatch, "role")
            ? (rawPatch.role === "owner" ? "owner" : selectablePermissionRole(this.state.catalog, rawPatch.role))
            : undefined;
          proposed = this.updateCandidate(target, rawPatch, auditName, auditRole, isActive);
        } catch { /* invalid candidates stay null */ }
      }
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "update_employee", error: chosen, before, proposedAfter: proposed, actualAfter: target });
    }

    if (actionError) return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId,
      targetMustExist: true, kind: "update_employee", error: actionError, before, proposedAfter: proposed, actualAfter: target });
    try { this.ceiling(actor, before, proposed); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "update_employee", error, before, proposedAfter: proposed, actualAfter: target });
    }

    const applied = proposed.permissionRevision !== target.permissionRevision;
    const outcome = applied ? "applied" : "noop";
    const result: TerminalEnvelope = { ok: true, outcome, data: this.view(target) };
    try {
      this.appendAudit({ actor, requestId, targetId, kind: "update_employee", outcome, reason: null, details: null,
        before, proposedAfter: { ...clone(proposed), permissionRevision: before.permissionRevision },
        actualAfter: proposed, credentialChanged: false });
    } catch {
      return unavailableEnvelope();
    }
    if (applied) {
      const deactivated = target.isActive && !proposed.isActive;
      Object.assign(target, clone(proposed));
      if (deactivated) mockPermissionRevokeSessions(this.state, target.id);
    }
    if (applied) result.data = this.view(target);
    return this.storeTerminal(actor, requestId, canonicalPayload, requiredPermissions, targetId, true, "update_employee", result);
  }

  async resetPin(request: EmployeePinResetRequest): Promise<TerminalEnvelope> {
    let actor: PermissionEmployee;
    try { actor = this.actor(); } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const initialActor = actor;
    const initialSession = this.state.session;
    let requestId: string;
    let targetId: string;
    try {
      const early = looseObject(request);
      requestId = permissionUuid(early.requestId);
      targetId = permissionUuid(early.targetId);
    } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    let canonicalPayload: string;
    try {
      const secured = await this.sensitiveCanonicalPayload("reset_pin", request, initialActor, initialSession);
      actor = secured.actor;
      canonicalPayload = secured.canonicalPayload;
    } catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    let target: PermissionEmployee;
    try { target = this.findTarget(targetId); }
    catch (error) { return isAppError(error) ? errorEnvelope(error) : unavailableEnvelope(); }
    const requiredPermissions: PermissionCode[] = ["employee.manage"];
    let actionError: AppError | null = null;
    try { this.requireActions(actor, requiredPermissions); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      actionError = error;
    }
    const replay = this.replay(actor, requestId, canonicalPayload, "reset_pin", actionError);
    if (replay) return replay;

    let expectedRevision: number;
    let newPin: string;
    try {
      const raw = strictObject(request, ["requestId", "targetId", "expectedRevision", "newPin"]);
      if (!own(raw, "requestId") || !own(raw, "targetId") || !own(raw, "expectedRevision") || !own(raw, "newPin"))
        throw permissionError("INVALID_EMPLOYEE_REQUEST");
      targetId = permissionUuid(raw.targetId);
      expectedRevision = permissionRevision(raw.expectedRevision);
      newPin = permissionPin(raw.newPin);
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "reset_pin", error: chosen, before: clone(target), proposedAfter: null, actualAfter: target });
    }

    const before = clone(target);
    let proposed: PermissionEmployee | null = null;
    let credentialChanged = false;
    try {
      if (target.id === actor.id) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
      if (target.role === "owner") throw permissionError("OWNER_PROTECTED");
      if (expectedRevision !== target.permissionRevision) throw permissionError("EMPLOYEE_VERSION_CONFLICT");
      credentialChanged = !mockPermissionPinMatches(this.state, target.id, newPin);
      proposed = { ...clone(target), permissionRevision: target.permissionRevision + (credentialChanged ? 1 : 0) };
    } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      const chosen = actionError ?? error;
      if (!proposed) {
        credentialChanged = !mockPermissionPinMatches(this.state, target.id, newPin);
        proposed = { ...clone(target), permissionRevision: target.permissionRevision + (credentialChanged ? 1 : 0) };
      }
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "reset_pin", error: chosen, before, proposedAfter: proposed, actualAfter: target });
    }

    if (actionError) return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId,
      targetMustExist: true, kind: "reset_pin", error: actionError, before, proposedAfter: proposed, actualAfter: target });
    try { this.ceiling(actor, before, proposed); } catch (error) {
      if (!isAppError(error)) return unavailableEnvelope();
      return this.denied({ actor, requestId, canonicalPayload, requiredPermissions, targetId, targetMustExist: true,
        kind: "reset_pin", error, before, proposedAfter: proposed, actualAfter: target });
    }

    const outcome = credentialChanged ? "applied" : "noop";
    const result: TerminalEnvelope = { ok: true, outcome, data: this.view(proposed) };
    try {
      this.appendAudit({ actor, requestId, targetId, kind: "reset_pin", outcome, reason: null, details: null,
        before, proposedAfter: { ...clone(proposed), permissionRevision: before.permissionRevision },
        actualAfter: proposed, credentialChanged });
    } catch {
      return unavailableEnvelope();
    }
    if (credentialChanged) {
      mockPermissionSetPin(this.state, target.id, newPin);
      target.permissionRevision++;
      mockPermissionRevokeSessions(this.state, target.id);
      result.data = this.view(target);
    }
    return this.storeTerminal(actor, requestId, canonicalPayload, requiredPermissions, targetId, true, "reset_pin", result);
  }

  async listAudit(filter: EmployeeAuditFilter = {}): Promise<EmployeeAuditPage> {
    const actor = this.actor();
    const actorPermissions = this.permissions(actor);
    if (actor.role !== "owner" && !actorPermissions.includes("employee.permission.edit"))
      throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    const raw = strictObject(filter, ["cursor", "limit", "targetId", "outcome"]);
    const limit = own(raw, "limit") ? permissionRevision(raw.limit) : 50;
    if (limit < 1 || limit > 100) throw permissionError("INVALID_EMPLOYEE_REQUEST");
    const targetId = own(raw, "targetId") ? permissionUuid(raw.targetId) : null;
    const outcome = own(raw, "outcome") ? raw.outcome : null;
    if (outcome !== null && outcome !== "applied" && outcome !== "denied" && outcome !== "noop")
      throw permissionError("INVALID_EMPLOYEE_REQUEST");

    let after: { occurredAt: string; auditKey: string } | null = null;
    if (own(raw, "cursor")) {
      if (typeof raw.cursor !== "string" || !privateState(this.state).issuedCursors.has(raw.cursor))
        throw permissionError("INVALID_EMPLOYEE_REQUEST");
      const decoded = decodeOpaque(raw.cursor);
      const cursor = strictObject(decoded, ["version", "storeId", "targetId", "outcome", "occurredAt", "auditKey"]);
      if (Object.keys(cursor).length !== 6 || cursor.version !== 1 || cursor.storeId !== this.state.storeId
        || cursor.targetId !== targetId || cursor.outcome !== outcome || typeof cursor.occurredAt !== "string"
        || typeof cursor.auditKey !== "string") throw permissionError("INVALID_EMPLOYEE_REQUEST");
      after = { occurredAt: cursor.occurredAt, auditKey: cursor.auditKey };
    }

    let rows = mockPermissionAuditRows(this.state).filter(row => row.storeId === this.state.storeId
      && (!targetId || row.targetId === targetId) && (!outcome || row.outcome === outcome));
    const descendingCodeUnits = (left: string, right: string) => left === right ? 0 : left > right ? -1 : 1;
    rows = [...rows].sort((left, right) => descendingCodeUnits(left.occurredAt, right.occurredAt)
      || descendingCodeUnits(left.auditKey, right.auditKey));
    if (after) rows = rows.filter(row => row.occurredAt < after.occurredAt
      || (row.occurredAt === after.occurredAt && row.auditKey < after.auditKey));
    const pageRows = rows.slice(0, limit);
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = encodeOpaque({ version: 1, storeId: this.state.storeId, targetId, outcome,
        occurredAt: last.occurredAt, auditKey: last.auditKey });
      privateState(this.state).issuedCursors.add(nextCursor);
    }
    return { rows: clone(pageRows), nextCursor };
  }
}
