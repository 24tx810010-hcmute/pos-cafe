import { create } from "zustand";
import type { CreateStoreInput, OrderType, PrintReceipt, PrintTicket, SubmitOrderDraftItem } from "@/domain";
import type { EmployeeRosterEntry, PermissionSession } from "@/domain/permissions";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { clearDrawerExitGuard, requestDrawerExit } from "./drawerNavigation";

export type ReceiptPreview =
  | { variant: "ticket" | "kitchen"; doc: PrintTicket; requiredPermission?: "order.create" | "order.update" | "payment.take" }
  | { variant: "receipt"; doc: PrintReceipt; orderId?: string; legacyMetadata?: boolean;
      source?: { kind: "reprint" } | { kind: "initial"; grant: import("@/ports/permissionPrint").InitialReceiptPrintGrant } };

export type DrawerModule = "order" | "payment" | "takeaway" | "writeRecovery" | "menuEditor" | "floorEditor" | "report" | "orderHistory" | "employees" | "settings" | "paymentSettings" | null;
export type AppScreen = "landing" | "storePairing" | "createStore" | "passcode";

export type OrderDrawerContext = {
  orderId: string | null;
  tableId: string | null;
  orderType: OrderType;
};

type AppState = {
  updateRequired: boolean;
  createdStoreResult: { storeKey: string; adminPin: string; seedStatus: string; canRetrySeed: boolean } | null;
  pendingStoreCreationInput: CreateStoreInput | null;
  sessionNotice: string | null;
  screen: AppScreen;
  currentEmployee: EmployeeRosterEntry | null;
  employeeSessionVersion: number;
  activeAreaId: string | null;
  activeCategoryId: string | null;
  drawer: DrawerModule;
  orderContext: OrderDrawerContext | null;
  paymentOrderId: string | null;
  draftItems: SubmitOrderDraftItem[];
  receiptPreview: ReceiptPreview | null;
  setCurrentEmployee: (employee: EmployeeRosterEntry | null) => void;
  setCreatedStoreResult: (result: AppState["createdStoreResult"]) => void;
  setPendingStoreCreationInput: (input: CreateStoreInput | null) => void;
  setSessionNotice: (notice: string | null) => void;
  startEmployeeSession: (employee: EmployeeRosterEntry, session: PermissionSession) => void;
  setScreen: (screen: AppScreen) => void;
  setActiveAreaId: (areaId: string) => void;
  setActiveCategoryId: (categoryId: string) => void;
  openDrawer: (drawer: Exclude<DrawerModule, null>) => void;
  closeDrawer: () => void;
  openOrder: (context: OrderDrawerContext) => void;
  openPayment: (orderId: string) => void;
  setDraftItems: (items: SubmitOrderDraftItem[]) => void;
  openReceiptPreview: (preview: ReceiptPreview) => void;
  closeReceiptPreview: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  updateRequired: false,
  createdStoreResult: null,
  pendingStoreCreationInput: null,
  sessionNotice: null,
  screen: "landing",
  currentEmployee: null,
  employeeSessionVersion: 0,
  activeAreaId: null,
  activeCategoryId: null,
  drawer: null,
  orderContext: null,
  paymentOrderId: null,
  draftItems: [],
  receiptPreview: null,
  setCurrentEmployee: (employee) => {
    if (!employee) { clearDrawerExitGuard(); usePermissionSession.getState().clear(); }
    set((state) => ({ currentEmployee: employee, employeeSessionVersion: state.employeeSessionVersion + 1,
      ...(employee ? { createdStoreResult: null } : {}) }));
  },
  setCreatedStoreResult: createdStoreResult => set({ createdStoreResult }),
  setPendingStoreCreationInput: pendingStoreCreationInput => set({ pendingStoreCreationInput }),
  setSessionNotice: sessionNotice => set({ sessionNotice }),
  startEmployeeSession: (employee, session) => {
    clearDrawerExitGuard();
    if (session.kind === "required_pin_change") {
      if (employee.id !== session.employeeId) throw new Error("Session identity mismatch");
      usePermissionSession.getState().beginRequiredPinChange(session);
      set(state => ({ currentEmployee: null, employeeSessionVersion: state.employeeSessionVersion + 1,
        createdStoreResult: null, drawer: null, orderContext: null, paymentOrderId: null, draftItems: [], receiptPreview: null }));
      return;
    }
    if (employee.id !== session.authority.snapshot.employeeId) throw new Error("Session identity mismatch");
    usePermissionSession.getState().begin(session);
    set(state => ({ currentEmployee: { id: employee.id, name: employee.name }, employeeSessionVersion: state.employeeSessionVersion + 1,
      createdStoreResult: null, drawer: null, orderContext: null, paymentOrderId: null, draftItems: [], receiptPreview: null }));
  },
  setScreen: (screen) => set({ screen }),
  setActiveAreaId: (areaId) => set({ activeAreaId: areaId }),
  setActiveCategoryId: (categoryId) => set({ activeCategoryId: categoryId }),
  openDrawer: (drawer) => requestDrawerExit(() => set({ drawer, orderContext: null, paymentOrderId: null })),
  closeDrawer: () => requestDrawerExit(() => set({ drawer: null, orderContext: null, paymentOrderId: null })),
  openOrder: (context) => requestDrawerExit(() => set({ drawer: "order", orderContext: context, paymentOrderId: null })),
  openPayment: (orderId) => requestDrawerExit(() => set({ drawer: "payment", paymentOrderId: orderId })),
  setDraftItems: (items) => set({ draftItems: items }),
  openReceiptPreview: (preview) => set({ receiptPreview: preview }),
  closeReceiptPreview: () => set({ receiptPreview: null }),
}));
