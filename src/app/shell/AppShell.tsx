import { useAppStore } from "../useAppStore";
import { EmployeesStubDrawer } from "../drawers/admin/EmployeesDrawer";
import { FloorEditorDrawer } from "../drawers/admin/FloorEditorDrawer";
import { GeneralSettingsDrawer } from "../drawers/admin/GeneralSettingsDrawer";
import { KitchenQueueDrawer } from "../drawers/admin/KitchenQueueDrawer";
import { MenuEditorDrawer } from "../drawers/admin/MenuEditorDrawer";
import { OrderHistoryStubDrawer } from "../drawers/admin/OrderHistoryDrawer";
import { PaymentSettingsDrawer } from "../drawers/admin/PaymentSettingsDrawer";
import { ReportSettingsDrawer } from "../drawers/admin/ReportSettingsDrawer";
import { OrderDrawer } from "../drawers/pos/OrderDrawer";
import { PaymentDrawer } from "../drawers/pos/PaymentDrawer";
import { TakeawayDrawer } from "../drawers/pos/TakeawayDrawer";
import { FloorWorkspace } from "./FloorWorkspace";
import { LeftNav } from "./LeftNav";

export function AppShell() {
  const drawer = useAppStore((state) => state.drawer);

  return (
    <main
      className="grid h-screen w-screen grid-cols-[176px_minmax(0,1fr)] overflow-hidden [@media(orientation:portrait)]:hidden max-[980px]:grid-cols-[68px_minmax(0,1fr)]"
      data-testid="app-shell"
    >
      <LeftNav />

      <section className="relative min-h-0 min-w-0 overflow-hidden bg-pos-bg">
        <FloorWorkspace />
        {drawer === "order" ? <OrderDrawer /> : null}
        {drawer === "payment" ? <PaymentDrawer /> : null}
        {drawer === "menuEditor" ? <MenuEditorDrawer /> : null}
        {drawer === "floorEditor" ? <FloorEditorDrawer /> : null}
        {drawer === "reportSettings" ? <ReportSettingsDrawer /> : null}
        {drawer === "takeaway" ? <TakeawayDrawer /> : null}
        {drawer === "orderHistory" ? <OrderHistoryStubDrawer /> : null}
        {drawer === "employees" ? <EmployeesStubDrawer /> : null}
        {drawer === "settings" ? <GeneralSettingsDrawer /> : null}
        {drawer === "kitchen" ? <KitchenQueueDrawer /> : null}
        {drawer === "paymentSettings" ? <PaymentSettingsDrawer /> : null}
      </section>
    </main>
  );
}
