/** Candidate contract; legacy Employee/EmployeeRole stay in models until activation. */
export type PermissionRole = "owner" | "manager" | "cashier" | "waiter" | "kitchen";
export type SelectablePermissionRole = "manager" | "cashier" | "waiter";
export type PermissionCode =
  | "floor.view" | "order.create" | "order.update" | "order.voidOpen"
  | "payment.take" | "orderHistory.view" | "order.voidPaid" | "menu.manage"
  | "floor.manage" | "employee.manage" | "employee.permission.edit" | "report.view"
  | "settings.manage" | "data.clearDemo" | "receipt.reprint";
export type PermissionModule =
  | "floor" | "order" | "payment" | "orderHistory" | "menuEditor" | "floorEditor"
  | "employees" | "report" | "settings" | "clearDemo" | "receipt";
export type PermissionNavigationModule = Exclude<PermissionModule, "receipt">;
export type PermissionRoleDefinition = {
  code: PermissionRole; labelVi: string; enabled: boolean; selectable: boolean;
};
export type PermissionDefinition = {
  code: PermissionCode; labelVi: string; module: PermissionModule; ownerOnly: boolean; baseline: boolean;
};
export type PermissionCatalog = {
  contractVersion: 1;
  revision: number;
  roles: readonly PermissionRoleDefinition[];
  permissions: readonly PermissionDefinition[];
  defaults: readonly { roleCode: PermissionRole; permissionCode: PermissionCode }[];
};
export type PermissionOverrides = { grants: PermissionCode[]; denies: PermissionCode[] } | null;
export type PermissionSource = "default" | "grant" | "deny" | "baseline";
export type PermissionExplanation = {
  permission: PermissionCode; effective: boolean; sources: PermissionSource[];
};
export type ConfiguredPermissionSnapshot = {
  permissions: PermissionCode[]; sources: PermissionExplanation[];
};
export type PermissionEmployee = {
  id: string; storeId: string; name: string; role: PermissionRole; isActive: boolean;
  permissionRevision: number; overrides: PermissionOverrides;
};
export type AuthoritySnapshot = ConfiguredPermissionSnapshot & {
  storeId: string; employeeId: string; role: PermissionRole; active: true;
  employeeRevision: number; catalogRevision: number;
};
export type AuthorityRevision = {
  employeeRevision: number; catalogRevision: number; serverTime: string;
};
export type AuthorityBundle = { catalog: PermissionCatalog; snapshot: AuthoritySnapshot };
/** The opaque credential stays inside the adapter, never in UI/authority state. */
export type NormalPermissionSession = {
  kind: "normal"; pinChangeRequired: false; authority: AuthorityBundle; issuedAt: string; expiresAt: string;
};
export type RequiredPinSession = {
  kind: "required_pin_change"; storeId: string; employeeId: string; name: string;
  employeeRevision: number; issuedAt: string; expiresAt: string;
};
export type PermissionSession = NormalPermissionSession | RequiredPinSession;
export type RequiredPinSessionProof = {
  valid: true; purpose: "required_pin_change"; employeeRevision: number; expiresAt: string;
};
export type RequiredPinChangeRequest = { requestId: string; expectedRevision: number; newPin: string };
export type RequiredPinChangeResult = {
  outcome: "applied"; credentialChanged: true; pinChangeRequired: false; employeeRevision: number;
};
export type OwnerPinChangeRequest = { requestId: string; expectedRevision: number; currentPin: string; newPin: string };
export type PermissionPinChangeResult = { outcome: "applied" | "noop" | "replayed"; credentialChanged: boolean; employeeRevision: number };
export type PermissionBootstrapRequest = { requestId: string; ownerId: string; storeNo: number; displayName: string; address: string; seedDemo: boolean };
export type PermissionBootstrapResult = {
  outcome: "applied" | "replayed"; storeId: string; storeNo: number; ownerId: string;
  seedRequested: boolean; seedWorkflowId: string;
};
export type InitialSeedStage = "employee" | "menu" | "floor";
export type InitialSeedStageReceipt = { stage: InitialSeedStage; stageId: string; status: "pending" | "committed"; committedAt: string | null };
export type InitialSeedStatus = {
  workflowId: string; status: "skipped" | "pending" | "in_progress" | "needs_retry" | "completed";
  workflowRevision: number; autoEligible: boolean; runGeneration: number; lastErrorCode: string | null;
  stages: InitialSeedStageReceipt[];
};
export type InitialSeedBeginRequest = { mode: "initial" | "retry"; expectedWorkflowRevision: number };
export type InitialSeedBeginResult = { acquired: boolean; runGeneration: number; workflowRevision: number };
export type PermissionAuthority =
  | { status: "unverified" | "loading" | "unavailable" }
  | { status: "verified"; snapshot: AuthoritySnapshot };
export type EmployeeRosterEntry = { id: string; name: string };
export type EmployeeAdminView = Omit<PermissionEmployee, "storeId"> & {
  effective: PermissionCode[]; sources: PermissionExplanation[];
};
export type EmployeePermissionPatch = {
  name?: string; role?: SelectablePermissionRole; isActive?: boolean; overrides?: PermissionOverrides;
};
export type EmployeeAdminCreateRequest = {
  requestId: string; id: string; name: string; role: SelectablePermissionRole; pin: string;
  expectedCatalogRevision: number; overrides?: PermissionOverrides;
};
export type EmployeeAdminUpdateRequest = {
  requestId: string; targetId: string; expectedRevision: number;
  expectedCatalogRevision?: number; patch: EmployeePermissionPatch;
};
export type EmployeePinResetRequest = {
  requestId: string; targetId: string; expectedRevision: number; newPin: string;
};
export type PermissionErrorCode =
  | "INVALID_EMPLOYEE_REQUEST" | "EMPLOYEE_ROLE_UNAVAILABLE" | "OWNER_PROTECTED"
  | "SELF_DISABLE_FORBIDDEN" | "SELF_PERMISSION_EDIT_FORBIDDEN" | "OWNER_ONLY_PERMISSION"
  | "PERMISSION_BASELINE_REQUIRED" | "PERMISSION_CEILING_EXCEEDED" | "EMPLOYEE_VERSION_CONFLICT"
  | "PERMISSION_CATALOG_STALE" | "ADMIN_REQUEST_REUSED" | "PERMISSION_UPDATE_UNAVAILABLE"
  | "PERMISSION_REFRESH_UNAVAILABLE" | "OWNER_MIGRATION_REVIEW_REQUIRED"
  | "OWNER_RECOVERY_REVIEW_REQUIRED" | "BOOTSTRAP_CONFLICT"
  | "PIN_CHANGE_REQUIRED" | "PIN_REUSE_NOT_ALLOWED" | "PIN_CONFIRMATION_MISMATCH" | "INITIAL_SEED_ATTEMPT_STALE";
export type PermissionFieldErrors = Partial<Record<"name" | "pin" | "confirmPin", string>>;
export type PermissionErrorDetails = {
  fieldErrors?: PermissionFieldErrors; missingPermissions?: PermissionCode[];
};
export type EmployeeAdminEnvelope<T> =
  | { ok: true; outcome: "applied" | "noop" | "replayed"; data: T }
  | { ok: false; error: {
    code: PermissionErrorCode | "FORBIDDEN" | "NOT_FOUND" | "AUTH_REQUIRED" | "EMPLOYEE_SESSION_REQUIRED";
    message: string; details: PermissionErrorDetails | null;
  } };
export type EmployeeAuditSnapshot = Omit<EmployeeAdminView, "sources">;
export type EmployeeAuditEntry = {
  auditKey: string; storeId: string; actorType: "employee" | "operator"; actorKey: string;
  requestId: string; targetId: string; occurredAt: string; kind: string;
  outcome: "applied" | "noop" | "denied"; reason: string | null;
  actorEffective: PermissionCode[]; catalogRevision: number;
  before: EmployeeAuditSnapshot | null; proposedAfter: EmployeeAuditSnapshot | null;
  actualAfter: EmployeeAuditSnapshot | null; credentialChanged: boolean;
  details: PermissionErrorDetails | null;
  operatorCaseRef?: string | null; operatorProofRef?: string | null;
};
export type EmployeeAuditFilter = { cursor?: string; limit?: number; targetId?: string; outcome?: "applied" | "denied" | "noop" };
export type EmployeeAuditPage = { rows: EmployeeAuditEntry[]; nextCursor: string | null };
export type PermissionSignal = {
  storeId: string; topic: "permission" | "menu" | "floor" | "orders" | "report" | "settings";
  revision: number; eventId: string; targetId?: string;
};
export type PermissionCatalogSignal = { revision: number; eventId: string };
