import type { AuthorityBundle, PermissionCode } from "@/domain/permissions";
import { hasCatalogPermission } from "@/core/permissionAuthority";
import type { DrawerModule, OrderDrawerContext } from "./useAppStore";

export const purposePermissions: Record<string, readonly PermissionCode[]> = {
  floor: ["floor.view"], "pos-menu": ["order.create", "order.update"],
  "open-order": ["order.update", "order.voidOpen", "payment.take"],
  history: ["orderHistory.view"], "history-detail": ["orderHistory.view"],
  report: ["report.view"], "report-orders": ["report.view"],
  employees: ["employee.manage", "employee.permission.edit"],
  "menu-admin": ["menu.manage"], "floor-admin": ["floor.manage"], settings: ["settings.manage"], display: [],
};
export const bundleHas = (bundle: AuthorityBundle | null, permission: PermissionCode) => !!bundle
  && hasCatalogPermission(bundle.catalog, { status: "verified", snapshot: bundle.snapshot }, permission);
export function drawerAllowed(bundle: AuthorityBundle | null, drawer: DrawerModule, context?: OrderDrawerContext | null): boolean {
  if (!bundle) return false;
  const any = (...codes: PermissionCode[]) => codes.some(code => bundleHas(bundle, code));
  switch (drawer) {
    case null: case "takeaway": return any("floor.view");
    case "order": return context?.orderId ? any("order.update", "order.voidOpen", "payment.take") : any("order.create");
    case "payment": return any("payment.take");
    case "writeRecovery": return any("order.create", "order.update", "order.voidOpen", "payment.take", "order.voidPaid");
    case "employees": return any("employee.manage", "employee.permission.edit");
    case "orderHistory": return any("orderHistory.view");
    case "report": return any("report.view");
    case "menuEditor": return any("menu.manage");
    case "floorEditor": return any("floor.manage");
    case "settings": case "paymentSettings": return any("settings.manage");
  }
}
