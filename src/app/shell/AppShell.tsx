import type { ComponentType } from "react";
import { useAppStore, type DrawerModule } from "../useAppStore";
import { EmployeesStubDrawer } from "../drawers/admin/EmployeesDrawer";
import { FloorEditorDrawer } from "../drawers/admin/FloorEditorDrawer";
import { GeneralSettingsDrawer } from "../drawers/admin/GeneralSettingsDrawer";
import { KitchenQueueDrawer } from "../drawers/admin/KitchenQueueDrawer";
import { MenuEditorDrawer } from "../drawers/admin/MenuEditorDrawer";
import { OrderHistoryDrawer } from "../drawers/admin/OrderHistoryDrawer";
import { PaymentSettingsDrawer } from "../drawers/admin/PaymentSettingsDrawer";
import { ReportDrawer } from "../drawers/admin/ReportDrawer";
import { OrderDrawer } from "../drawers/pos/OrderDrawer";
import { PaymentDrawer } from "../drawers/pos/PaymentDrawer";
import { TakeawayDrawer } from "../drawers/pos/TakeawayDrawer";
import { ReceiptPreviewPopup } from "../components/ReceiptPreview";
import { FloorWorkspace } from "./FloorWorkspace";
import { LeftNav } from "./LeftNav";

const DRAWER_REGISTRY: Record<NonNullable<DrawerModule>, ComponentType> = {
  order: OrderDrawer,
  payment: PaymentDrawer,
  takeaway: TakeawayDrawer,
  menuEditor: MenuEditorDrawer,
  floorEditor: FloorEditorDrawer,
  report: ReportDrawer,
  orderHistory: OrderHistoryDrawer,
  employees: EmployeesStubDrawer,
  settings: GeneralSettingsDrawer,
  kitchen: KitchenQueueDrawer,
  paymentSettings: PaymentSettingsDrawer,
};

export function AppShell() {
  const drawer = useAppStore((state) => state.drawer);
  const ActiveDrawer = drawer ? DRAWER_REGISTRY[drawer] : null;

  return (
    <main
      className="grid h-screen w-screen grid-cols-[176px_minmax(0,1fr)] overflow-hidden [@media(orientation:portrait)]:hidden max-[980px]:grid-cols-[68px_minmax(0,1fr)]"
      data-testid="app-shell"
    >
      <LeftNav />

      <section className="relative min-h-0 min-w-0 overflow-hidden bg-pos-bg">
        <FloorWorkspace />
        {ActiveDrawer ? <ActiveDrawer /> : null}
        <ReceiptPreviewPopup />
      </section>
    </main>
  );
}
