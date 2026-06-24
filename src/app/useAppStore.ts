import { create } from "zustand";
import type { Employee, OrderType, PrintReceipt, PrintTicket, SubmitOrderDraftItem } from "@/domain";

export type ReceiptPreview =
  | { variant: "ticket"; doc: PrintTicket }
  | { variant: "kitchen"; doc: PrintTicket }
  | { variant: "receipt"; doc: PrintReceipt };

export type DrawerModule = "order" | "payment" | "takeaway" | "menuEditor" | "floorEditor" | "reportSettings" | "orderHistory" | "employees" | "settings" | "kitchen" | "paymentSettings" | null;
export type AppScreen = "landing" | "storePairing" | "createStore" | "passcode";

export type OrderDrawerContext = {
  orderId: string | null;
  tableId: string | null;
  orderType: OrderType;
};

type AppState = {
  screen: AppScreen;
  currentEmployee: Employee | null;
  activeAreaId: string | null;
  activeCategoryId: string | null;
  drawer: DrawerModule;
  orderContext: OrderDrawerContext | null;
  paymentOrderId: string | null;
  draftItems: SubmitOrderDraftItem[];
  receiptPreview: ReceiptPreview | null;
  setCurrentEmployee: (employee: Employee | null) => void;
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
  screen: "landing",
  currentEmployee: null,
  activeAreaId: null,
  activeCategoryId: null,
  drawer: null,
  orderContext: null,
  paymentOrderId: null,
  draftItems: [],
  receiptPreview: null,
  setCurrentEmployee: (employee) => set({ currentEmployee: employee }),
  setScreen: (screen) => set({ screen }),
  setActiveAreaId: (areaId) => set({ activeAreaId: areaId }),
  setActiveCategoryId: (categoryId) => set({ activeCategoryId: categoryId }),
  openDrawer: (drawer) => set({ drawer, orderContext: null, paymentOrderId: null }),
  closeDrawer: () => set({ drawer: null, orderContext: null, paymentOrderId: null }),
  openOrder: (context) => set({ drawer: "order", orderContext: context, paymentOrderId: null }),
  openPayment: (orderId) => set({ drawer: "payment", paymentOrderId: orderId }),
  setDraftItems: (items) => set({ draftItems: items }),
  openReceiptPreview: (preview) => set({ receiptPreview: preview }),
  closeReceiptPreview: () => set({ receiptPreview: null }),
}));
