export const posQueryKeys = {
  menu: ["menu"] as const,
  floorPlan: ["floorPlan"] as const,
  ordersRoot: ["orders"] as const,
  openOrders: ["orders", "open"] as const,
  takeawayOpenOrders: ["orders", "takeaway", "open"] as const,
  order: (orderId: string | null) => ["orders", "detail", orderId] as const,
  reportsRoot: ["report"] as const,
  orderHistory: (fromDate: string, toDate: string, page: number, pageSize: number) =>
    ["orders", "history", fromDate, toDate, page, pageSize] as const,
  report: (businessDate: string) => ["report", "core", businessDate] as const,
};
