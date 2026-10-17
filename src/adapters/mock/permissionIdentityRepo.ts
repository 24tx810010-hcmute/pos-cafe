import type {
  OwnerPinChangeRequest,
  PermissionEmployee,
  PermissionPinChangeResult,
  PermissionSession,
  RequiredPinChangeRequest,
  RequiredPinChangeResult,
  RequiredPinSessionProof,
} from "@/domain/permissions";
import type { IPermissionSessionRepo } from "@/ports/permissions";
import { AppError } from "@/core/appError";
import { permissionError } from "@/core/permissionErrors";
import { parseOwnerPinChange, parseRequiredPinChange } from "@/core/permissionIdentityInputs";
import { createAuthoritySnapshot } from "@/core/permissionAuthority";
import { requireCatalogRole, validatePermissionCatalog } from "@/core/permissionCatalog";
import { configuredPermissions } from "@/core/permissionOverrides";
import { permissionRevision } from "@/core/permissionInputs";
import { clone } from "./mockState";
import {
  mockPermissionPinChangeRequired,
  mockPermissionSetPinChangeRequired,
  type MockPermissionState,
  type MockPermissionSession,
} from "./permissionState";
import { mockPermissionAuditRows, mockPermissionRequestReservations } from "./permissionAdminState";
import { mockPermissionRequestMac } from "./permissionRequestMac";

type NormalRequestRecord = { payloadMac: string; result?: PermissionPinChangeResult; error?: AppError };
type RequiredRequestRecord = { payloadMac: string; error?: AppError };
type IdentityPrivateState = {
  pins: Map<string, string>;
  sessions: MockPermissionSession[];
  normalRequests: Map<string, NormalRequestRecord>;
  requiredRequests: Map<string, RequiredRequestRecord>;
};

// Synthetic credentials and restricted-state request material never enter domain DTOs or audit projections.
const stores = new WeakMap<MockPermissionState, IdentityPrivateState>();

function credentials(state: MockPermissionState): IdentityPrivateState {
  let store = stores.get(state);
  if (!store) {
    store = {
      pins: new Map(state.employees.map(employee => [employee.id, state.initialPins[employee.id] ?? "384729"])),
      sessions: [],
      normalRequests: new Map(),
      requiredRequests: new Map(),
    };
    stores.set(state, store);
  }
  return store;
}

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";

function paired(state: MockPermissionState): void {
  if (!state.paired) throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
}

function activeSessionEmployee(state: MockPermissionState): { session: MockPermissionSession; employee: PermissionEmployee } {
  paired(state);
  validatePermissionCatalog(state.catalog);
  const session = state.session;
  const employee = session && state.employees.find(candidate =>
    candidate.id === session.employeeId && candidate.storeId === state.storeId);
  if (!session || session.storeId !== state.storeId || session.revoked || !Number.isFinite(session.expiresAt)
    || session.expiresAt <= state.now() || !employee?.isActive)
    throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
  return { session, employee };
}

/** Shared normal-route guard: current restricted state wins over cached/session authority. */
export function requireMockNormalPermissionActor(state: MockPermissionState): PermissionEmployee {
  const { session, employee } = activeSessionEmployee(state);
  if (session.purpose === "required_pin_change" || mockPermissionPinChangeRequired(state, employee.id))
    throw permissionError("PIN_CHANGE_REQUIRED");
  if (!requireCatalogRole(state.catalog, employee.role).enabled) throw permissionError("EMPLOYEE_ROLE_UNAVAILABLE");
  permissionRevision(employee.permissionRevision);
  return employee;
}

function requiredSessionActor(state: MockPermissionState): { session: MockPermissionSession; employee: PermissionEmployee } {
  const { session, employee } = activeSessionEmployee(state);
  if (session.purpose !== "required_pin_change" || employee.role !== "owner"
    || !mockPermissionPinChangeRequired(state, employee.id)
    || session.employeeRevision !== employee.permissionRevision)
    throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
  return { session, employee };
}

export const mockPermissionPinMatches = (state: MockPermissionState, id: string, pin: string): boolean =>
  credentials(state).pins.get(id) === pin;

export const mockPermissionSetPin = (state: MockPermissionState, id: string, pin: string): void => {
  credentials(state).pins.set(id, pin);
};

export function mockPermissionReplaceCredentials(
  state: MockPermissionState,
  values: readonly { employeeId: string; pin: string }[],
): void {
  const store = credentials(state);
  for (const session of store.sessions) session.revoked = true;
  store.pins = new Map(values.map(value => [value.employeeId, value.pin]));
  store.normalRequests.clear();
  store.requiredRequests.clear();
  state.session = null;
}

export function mockPermissionRevokeSessions(state: MockPermissionState, id: string): void {
  for (const session of credentials(state).sessions) {
    if (session.employeeId === id && session.storeId === state.storeId) session.revoked = true;
  }
  if (state.session?.employeeId === id && state.session.storeId === state.storeId) state.session.revoked = true;
}

function auditSnapshot(state: MockPermissionState, employee: PermissionEmployee) {
  const rights = configuredPermissions(state.catalog, employee.role, employee.overrides);
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    isActive: employee.isActive,
    permissionRevision: employee.permissionRevision,
    overrides: clone(employee.overrides),
    effective: rights.permissions,
  };
}

function auditKey(state: MockPermissionState, employee: PermissionEmployee, requestId: string): string {
  return btoa(JSON.stringify([state.storeId, "employee", employee.id, requestId, employee.id]))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class MockPermissionIdentityRepo implements IPermissionSessionRepo {
  constructor(private readonly state: MockPermissionState) {
    credentials(state);
  }

  async startSession(employeeId: string, pin: string): Promise<PermissionSession> {
    this.state.session = null;
    paired(this.state);
    const store = credentials(this.state);
    const employee = this.state.employees.find(candidate => candidate.id === employeeId && candidate.storeId === this.state.storeId);
    if (!employee?.isActive || !/^[0-9]{6}$/.test(pin) || store.pins.get(employeeId) !== pin)
      throw new AppError("INVALID_PIN", "PIN không đúng.");
    if (!this.state.catalog.roles.some(role => role.code === employee.role && role.enabled))
      throw permissionError("EMPLOYEE_ROLE_UNAVAILABLE");

    const issued = this.state.now();
    const restricted = mockPermissionPinChangeRequired(this.state, employee.id);
    const ttl = restricted ? 300_000 : 43_200_000;
    const session: MockPermissionSession = {
      storeId: this.state.storeId,
      employeeId,
      revoked: false,
      expiresAt: issued + ttl,
      purpose: restricted ? "required_pin_change" : "normal",
      employeeRevision: employee.permissionRevision,
    };
    this.state.session = session;
    store.sessions.push(session);
    const issuedAt = new Date(issued).toISOString();
    const expiresAt = new Date(issued + ttl).toISOString();
    if (restricted) {
      return {
        kind: "required_pin_change",
        storeId: this.state.storeId,
        employeeId: employee.id,
        name: employee.name,
        employeeRevision: employee.permissionRevision,
        issuedAt,
        expiresAt,
      };
    }
    return {
      kind: "normal",
      pinChangeRequired: false,
      issuedAt,
      expiresAt,
      authority: {
        catalog: clone(this.state.catalog),
        snapshot: createAuthoritySnapshot(this.state.catalog, employee, true),
      },
    };
  }

  async revokeSession(): Promise<void> {
    const session = this.state.session;
    this.state.session = null;
    if (session) {
      paired(this.state);
      session.revoked = true;
    }
  }

  async checkRequiredPinSession(): Promise<RequiredPinSessionProof> {
    const { session, employee } = requiredSessionActor(this.state);
    return {
      valid: true,
      purpose: "required_pin_change",
      employeeRevision: employee.permissionRevision,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async completeRequiredPinChange(request: RequiredPinChangeRequest): Promise<RequiredPinChangeResult> {
    const initial = requiredSessionActor(this.state);
    const parsed = parseRequiredPinChange(request);
    let payloadMac: string;
    try {
      payloadMac = await mockPermissionRequestMac(this.state,
        JSON.stringify(["required_pin_change", parsed.requestId, parsed.expectedRevision, parsed.newPin]));
    } catch {
      throw permissionError("PERMISSION_UPDATE_UNAVAILABLE");
    }
    const current = requiredSessionActor(this.state);
    if (current.session !== initial.session || current.employee.id !== initial.employee.id)
      throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
    const employee = current.employee;
    const store = credentials(this.state);
    const key = `${employee.id}:${parsed.requestId}`;
    const sharedKey = `${employee.storeId}:${employee.id}:${parsed.requestId}`;
    const reservations = mockPermissionRequestReservations(this.state);
    const reservation = reservations.get(sharedKey);
    if (reservation && reservation.kind !== "required_pin_change") throw permissionError("ADMIN_REQUEST_REUSED");
    const previous = store.requiredRequests.get(key);
    if (previous) {
      if (previous.payloadMac !== payloadMac) throw permissionError("ADMIN_REQUEST_REUSED");
      if (previous.error) throw previous.error;
      throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
    }

    let error: AppError | undefined;
    if (parsed.expectedRevision !== employee.permissionRevision) error = permissionError("EMPLOYEE_VERSION_CONFLICT");
    else if (store.pins.get(employee.id) === parsed.newPin) error = permissionError("PIN_REUSE_NOT_ALLOWED");

    const before = auditSnapshot(this.state, employee);
    const rights = configuredPermissions(this.state.catalog, employee.role, employee.overrides);
    const writeAudit = (outcome: "applied" | "denied", reason: AppError | undefined) => {
      try {
        mockPermissionAuditRows(this.state).push({
          auditKey: auditKey(this.state, employee, parsed.requestId),
          storeId: employee.storeId,
          actorType: "employee",
          actorKey: employee.id,
          requestId: parsed.requestId,
          targetId: employee.id,
          occurredAt: new Date(this.state.now()).toISOString(),
          kind: "required_pin_change",
          outcome,
          reason: reason?.code ?? null,
          details: null,
          actorEffective: rights.permissions,
          catalogRevision: this.state.catalog.revision,
          before,
          proposedAfter: outcome === "applied" ? { ...clone(before), permissionRevision: before.permissionRevision + 1 } : before,
          actualAfter: outcome === "applied" ? { ...clone(before), permissionRevision: before.permissionRevision + 1 } : before,
          credentialChanged: outcome === "applied",
        });
        reservations.set(sharedKey, { kind: "required_pin_change", canonicalPayload: payloadMac });
      } catch {
        throw permissionError("PERMISSION_UPDATE_UNAVAILABLE");
      }
    };

    if (error) {
      writeAudit("denied", error);
      store.requiredRequests.set(key, { payloadMac, error });
      throw error;
    }

    writeAudit("applied", undefined);
    store.pins.set(employee.id, parsed.newPin);
    mockPermissionSetPinChangeRequired(this.state, employee.id, false);
    employee.permissionRevision += 1;
    store.requiredRequests.set(key, { payloadMac });
    mockPermissionRevokeSessions(this.state, employee.id);
    this.state.session = null;
    return {
      outcome: "applied",
      credentialChanged: true,
      pinChangeRequired: false,
      employeeRevision: employee.permissionRevision,
    };
  }

  async changeOwnPin(request: OwnerPinChangeRequest): Promise<PermissionPinChangeResult> {
    const initialSession = this.state.session;
    const initialEmployee = requireMockNormalPermissionActor(this.state);
    if (initialEmployee.role !== "owner") throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    const parsed = parseOwnerPinChange(request);
    let payloadMac: string;
    try {
      payloadMac = await mockPermissionRequestMac(this.state,
        JSON.stringify(["self_pin", parsed.requestId, parsed.expectedRevision, parsed.currentPin, parsed.newPin]));
    } catch {
      throw permissionError("PERMISSION_UPDATE_UNAVAILABLE");
    }
    const employee = requireMockNormalPermissionActor(this.state);
    if (this.state.session !== initialSession || employee.id !== initialEmployee.id)
      throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage);
    const store = credentials(this.state);
    const key = `${employee.id}:${parsed.requestId}`;
    const sharedKey = `${employee.storeId}:${employee.id}:${parsed.requestId}`;
    const reservations = mockPermissionRequestReservations(this.state);
    if (reservations.has(sharedKey) && reservations.get(sharedKey)!.kind !== "self_pin")
      throw permissionError("ADMIN_REQUEST_REUSED");
    const previous = store.normalRequests.get(key);
    if (previous) {
      if (previous.payloadMac !== payloadMac) throw permissionError("ADMIN_REQUEST_REUSED");
      if (previous.error) throw previous.error;
      return { ...previous.result!, outcome: "replayed" };
    }

    const rights = configuredPermissions(this.state.catalog, employee.role, employee.overrides);
    const before = auditSnapshot(this.state, employee);
    const writeAudit = (outcome: "applied" | "noop" | "denied", changed: boolean, error?: AppError) => {
      try {
        mockPermissionAuditRows(this.state).push({
          auditKey: auditKey(this.state, employee, parsed.requestId),
          storeId: employee.storeId,
          actorType: "employee",
          actorKey: employee.id,
          requestId: parsed.requestId,
          targetId: employee.id,
          occurredAt: new Date(this.state.now()).toISOString(),
          kind: "self_pin",
          outcome,
          reason: error?.code ?? null,
          details: null,
          actorEffective: rights.permissions,
          catalogRevision: this.state.catalog.revision,
          before,
          proposedAfter: before,
          actualAfter: { ...before, permissionRevision: before.permissionRevision + (changed ? 1 : 0) },
          credentialChanged: changed,
        });
        reservations.set(sharedKey, { kind: "self_pin", canonicalPayload: payloadMac });
      } catch {
        throw permissionError("PERMISSION_UPDATE_UNAVAILABLE");
      }
    };

    let error: AppError | undefined;
    if (parsed.expectedRevision !== employee.permissionRevision) error = permissionError("EMPLOYEE_VERSION_CONFLICT");
    else if (store.pins.get(employee.id) !== parsed.currentPin) error = new AppError("INVALID_PIN", "PIN hiện tại không đúng.");
    if (error) {
      writeAudit("denied", false, error);
      store.normalRequests.set(key, { payloadMac, error });
      throw error;
    }

    const credentialChanged = parsed.newPin !== store.pins.get(employee.id);
    writeAudit(credentialChanged ? "applied" : "noop", credentialChanged);
    if (credentialChanged) {
      store.pins.set(employee.id, parsed.newPin);
      employee.permissionRevision += 1;
      mockPermissionRevokeSessions(this.state, employee.id);
      this.state.session = null;
    }
    const result: PermissionPinChangeResult = {
      outcome: credentialChanged ? "applied" : "noop",
      credentialChanged,
      employeeRevision: employee.permissionRevision,
    };
    store.normalRequests.set(key, { payloadMac, result });
    return { ...result };
  }
}
