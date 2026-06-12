import { posQueryKeys } from "@/features/shared/queryKeys";

export const adminQueryKeys = {
  employees: ["admin", "employees"] as const,
  settings: ["admin", "settings"] as const,
  menu: posQueryKeys.menu,
  floorPlan: posQueryKeys.floorPlan,
  reportsRoot: posQueryKeys.reportsRoot,
  report: posQueryKeys.report,
};
