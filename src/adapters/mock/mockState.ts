import type { Employee, FloorPlan, MenuCatalog, OrderDetail, PrintReceipt, PrintTicket, StoreSession, StoreSettings } from "@/domain";
import { mockEmployees, mockFloorPlan, mockMenuCatalog, mockOrders, mockPins, mockSettings } from "./mockData";

export const clone = <T>(value: T): T => structuredClone(value);

export const getTodayBusinessDate = (date = new Date(), timeZone = mockSettings.timezone): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
};

const cloneMockOrders = (): OrderDetail[] => {
  const today = getTodayBusinessDate();
  return clone(mockOrders).map((order) => (
    order.status === "open" ? { ...order, businessDate: today } : order
  ));
};

export type MockState = {
  session: StoreSession | null;
  employees: Employee[];
  pins: Record<string, string>;
  menu: MenuCatalog;
  floorPlan: FloorPlan;
  orders: OrderDetail[];
  settings: StoreSettings;
  nextOrderNo: number;
  lastTicket: PrintTicket | null;
  lastReceipt: PrintReceipt | null;
};

export const createMockState = (): MockState => ({
  session: null,
  employees: clone(mockEmployees),
  pins: clone(mockPins),
  menu: clone(mockMenuCatalog),
  floorPlan: clone(mockFloorPlan),
  orders: cloneMockOrders(),
  settings: clone(mockSettings),
  nextOrderNo: 30,
  lastTicket: null,
  lastReceipt: null,
});
