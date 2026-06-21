import type { Employee, FloorPlan, MenuCatalog, OrderDetail, PrintReceipt, PrintTicket, StoreSession, StoreSettings } from "@/domain";
import { mockEmployees, mockFloorPlan, mockMenuCatalog, mockOrders, mockPins, mockSettings } from "./mockData";

export const clone = <T>(value: T): T => structuredClone(value);

export const todayBusinessDate = "2026-06-11";

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
  orders: clone(mockOrders),
  settings: clone(mockSettings),
  nextOrderNo: 30,
  lastTicket: null,
  lastReceipt: null,
});
