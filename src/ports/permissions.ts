import type {
  AuthorityBundle, AuthorityRevision, EmployeeAdminCreateRequest, EmployeeAdminEnvelope, EmployeeAdminUpdateRequest,
  EmployeeAdminView, EmployeeAuditFilter, EmployeeAuditPage, EmployeePinResetRequest, EmployeeRosterEntry,
  PermissionCatalogSignal, PermissionSignal,
  PermissionSession, OwnerPinChangeRequest, PermissionPinChangeResult, PermissionBootstrapRequest, PermissionBootstrapResult,
  RequiredPinChangeRequest, RequiredPinChangeResult, RequiredPinSessionProof,
  InitialSeedStatus, InitialSeedBeginRequest, InitialSeedBeginResult, InitialSeedStage,
} from "@/domain/permissions";
import type { CoreReport, FloorPlan, MenuCatalog, OrderDetail, OrderHistoryFilter, OrderSummary, OrderSummaryPage, ReceiptSnapshot, ReportFilter, StoreSettings } from "@/domain";
import type { IPermissionChangesRepo } from "./permissionChanges";

export interface IPermissionAuthorityRepo {
  /** Catalog and employee snapshot are read atomically. No actor ID supplied by the caller. */
  getAuthority(): Promise<AuthorityBundle>;
  getRevision(): Promise<AuthorityRevision>;
  listRoster(): Promise<EmployeeRosterEntry[]>;
}
export interface IPermissionSessionRepo {
  startSession(employeeId: string, pin: string): Promise<PermissionSession>;
  revokeSession(): Promise<void>;
  changeOwnPin(request: OwnerPinChangeRequest): Promise<PermissionPinChangeResult>;
  checkRequiredPinSession(): Promise<RequiredPinSessionProof>;
  completeRequiredPinChange(request: RequiredPinChangeRequest): Promise<RequiredPinChangeResult>;
}
export interface IInitialSeedRepo {
  getStatus(): Promise<InitialSeedStatus>;
  begin(request: InitialSeedBeginRequest): Promise<InitialSeedBeginResult>;
  runStage(request: { runGeneration: number; stage: InitialSeedStage }): Promise<InitialSeedStatus>;
}
/** Provisioning identity comes from store Auth. Recovery is deliberately absent. */
export interface IPermissionBootstrapRepo {
  bootstrapStore(request: PermissionBootstrapRequest): Promise<PermissionBootstrapResult>;
}
export interface IEmployeeAdminReadRepo {
  listEmployees(): Promise<EmployeeAdminView[]>;
  getEmployee(targetId: string): Promise<EmployeeAdminView>;
}
/** Mutations are implemented with server audit/ceiling in T05, not by the T03 read mock. */
export interface IEmployeeAdminRepo extends IEmployeeAdminReadRepo {
  createEmployee(request: EmployeeAdminCreateRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>>;
  updateEmployee(request: EmployeeAdminUpdateRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>>;
  resetPin(request: EmployeePinResetRequest): Promise<EmployeeAdminEnvelope<EmployeeAdminView>>;
  listAudit(filter?: EmployeeAuditFilter): Promise<EmployeeAuditPage>;
}
export type OperationalOrderSummary = Pick<OrderSummary, "id" | "tableId" | "orderType" | "orderNo" | "total"> & { createdAt: string | null };
export type FloorOperationalView = { floorPlan: FloorPlan; openOrders: OperationalOrderSummary[] };
export type OpenOrderOperationalView = Pick<OrderDetail, "id" | "orderNo" | "orderType" | "tableId" | "status" | "total" | "lockVersion" | "items">;
export type PaidOrderVoidView = Pick<OrderDetail, "id" | "orderNo" | "status" | "total" | "lockVersion">;
export type OrderHistoryView = OrderDetail & { cashierName: string | null; voidedByName: string | null };
export type StoreDisplayView = Pick<StoreSettings, "displayName" | "address" | "billFooter" | "currency" | "timezone">;
export type ReportSummaryFilter = { fromDate: string; toDate: string };
export type ReportOrderSummary = Pick<OrderSummary, "id" | "orderNo" | "businessDate" | "orderType" | "total"> & { status: "paid"; tableName: string | null };
export interface IPermissionReadRepo {
  getFloorOperational(): Promise<FloorOperationalView>;
  getPosMenu(): Promise<MenuCatalog>;
  getOpenOrderDetail(orderId: string): Promise<OpenOrderOperationalView>;
  getPaidOrderForVoid(orderId: string): Promise<PaidOrderVoidView>;
  listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage>;
  getOrderHistoryDetail(orderId: string): Promise<OrderHistoryView>;
  getReceipt(orderId: string): Promise<{ receipt: ReceiptSnapshot; legacyMetadata: boolean }>;
  getSalesReport(filter: ReportFilter): Promise<CoreReport>;
  /** At most 20 paid summaries across the whole range; grants no history detail. */
  listReportOrders(filter: ReportSummaryFilter): Promise<ReportOrderSummary[]>;
  getMenuAdmin(): Promise<MenuCatalog>;
  getFloorAdmin(): Promise<FloorPlan>;
  getSettingsAdmin(): Promise<StoreSettings>;
  getStoreDisplay(): Promise<StoreDisplayView>;
}
export interface IPermissionSignalPort {
  subscribe(input: {
    storeId: string; onStoreSignal(signal: PermissionSignal): void;
    onCatalogSignal(signal: PermissionCatalogSignal): void;
    onReconnect?: () => void;
  }): () => void;
}
/** Staged T03 contract. The legacy AppPorts composition stays active until consumers migrate. */
export type PermissionFoundationPorts = {
  authority: IPermissionAuthorityRepo;
  employeeAdmin: IEmployeeAdminRepo;
  read: IPermissionReadRepo;
};

export type PermissionRuntimePorts = PermissionFoundationPorts & {
  session: IPermissionSessionRepo;
  initialSeed: IInitialSeedRepo;
  changes: IPermissionChangesRepo;
  signals: IPermissionSignalPort;
  menuImages: import("./permissionImages").IPermissionMenuImagePort;
  print: import("./permissionPrint").IPermissionPrintRepo;
};
