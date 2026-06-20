import { BarChart3, ChefHat, ClipboardList, Coffee, LayoutDashboard, LayoutGrid, Lock, QrCode, ReceiptText, Settings, Users } from "lucide-react";
import toast from "react-hot-toast";
import { canAccessModule, type AppModule } from "@/core/guards";
import type { DrawerModule } from "../useAppStore";
import { useAppStore } from "../useAppStore";
import { FloorWorkspace } from "./FloorWorkspace";
import { RailButton } from "./RailButton";
import { TakeawayDrawer } from "../drawers/pos/TakeawayDrawer";
import { OrderDrawer } from "../drawers/pos/OrderDrawer";
import { PaymentDrawer } from "../drawers/pos/PaymentDrawer";
import { MenuEditorDrawer } from "../drawers/admin/MenuEditorDrawer";
import { FloorEditorDrawer } from "../drawers/admin/FloorEditorDrawer";
import { ReportSettingsDrawer } from "../drawers/admin/ReportSettingsDrawer";
import { OrderHistoryStubDrawer } from "../drawers/admin/OrderHistoryDrawer";
import { EmployeesStubDrawer } from "../drawers/admin/EmployeesDrawer";
import { GeneralSettingsDrawer } from "../drawers/admin/GeneralSettingsDrawer";
import { KitchenQueueDrawer } from "../drawers/admin/KitchenQueueDrawer";
import { PaymentSettingsDrawer } from "../drawers/admin/PaymentSettingsDrawer";

export function AppShell() {
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const drawer = useAppStore((state) => state.drawer);
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const openOrder = useAppStore((state) => state.openOrder);
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const setScreen = useAppStore((state) => state.setScreen);

  const canAccess = (guard: AppModule) => canAccessModule(currentEmployee, guard);

  const guardedOpen = (module: Exclude<DrawerModule, null>, guard: AppModule) => {
    if (!canAccess(guard)) {
      toast.error("Nhân viên không có quyền dùng chức năng này.");
      return;
    }
    openDrawer(module);
  };

  const roleLabel: Record<string, string> = { admin: "Quản lý", cashier: "Thu ngân", kitchen: "Bếp" };

  return (
    <main
      className="grid h-screen w-screen grid-cols-[100px_minmax(0,1fr)] overflow-hidden [@media(orientation:portrait)]:hidden max-[980px]:grid-cols-[52px_minmax(0,1fr)]"
      data-testid="app-shell"
    >
      <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 bg-pos-rail px-1.5 py-3 text-[#dbe4ef] max-[980px]:px-1.5 max-[980px]:py-2">
        <div className="grid gap-2.5 border-b border-white/[0.08] pb-2">
          <div className="grid h-[42px] w-[42px] place-items-center rounded-pos bg-pos-primary font-black text-white max-[980px]:h-9 max-[980px]:w-9">P</div>
          {currentEmployee && (
            <div
              className="grid gap-0.5 px-1.5 pb-1 pt-1.5 text-center"
              title={`${currentEmployee.name} · ${roleLabel[currentEmployee.role] ?? currentEmployee.role}`}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-extrabold leading-[1.2] text-[#f1f5f9]">{currentEmployee.name}</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">{roleLabel[currentEmployee.role] ?? currentEmployee.role}</span>
            </div>
          )}
        </div>

        <nav className="grid min-h-0 content-start gap-1 overflow-auto [scrollbar-width:none]" aria-label="POS modules">
          <RailButton active={!drawer} icon={<LayoutDashboard size={18} />} label="Bàn" onClick={closeDrawer} />
          <RailButton
            active={drawer === "takeaway"}
            icon={<ClipboardList size={18} />}
            label="Mang đi"
            onClick={() => openDrawer("takeaway")}
          />
          <RailButton
            active={drawer === "orderHistory"}
            icon={<ReceiptText size={18} />}
            label="Lịch sử"
            onClick={() => guardedOpen("orderHistory", "orderHistory")}
            disabled={!canAccess("orderHistory")}
          />
          <RailButton
            active={drawer === "employees"}
            icon={<Users size={18} />}
            label="Nhân viên"
            onClick={() => guardedOpen("employees", "employees")}
            disabled={!canAccess("employees")}
          />
          <RailButton
            active={drawer === "menuEditor"}
            icon={<Coffee size={18} />}
            label="Menu"
            onClick={() => guardedOpen("menuEditor", "menuEditor")}
            disabled={!canAccess("menuEditor")}
          />
          <RailButton
            active={drawer === "floorEditor"}
            icon={<LayoutGrid size={18} />}
            label="Sơ đồ"
            onClick={() => guardedOpen("floorEditor", "floorEditor")}
            disabled={!canAccess("floorEditor")}
          />
          <RailButton
            active={drawer === "reportSettings"}
            icon={<BarChart3 size={18} />}
            label="Báo cáo"
            onClick={() => guardedOpen("reportSettings", "report")}
            disabled={!canAccess("report")}
          />
          <RailButton
            active={drawer === "kitchen"}
            icon={<ChefHat size={18} />}
            label="Bếp"
            onClick={() => guardedOpen("kitchen", "kitchen")}
            disabled={!canAccess("kitchen")}
          />
          <RailButton
            active={drawer === "paymentSettings"}
            icon={<QrCode size={18} />}
            label="Thanh toán"
            onClick={() => guardedOpen("paymentSettings", "settings")}
            disabled={!canAccess("settings")}
          />
          <RailButton
            active={drawer === "settings"}
            icon={<Settings size={18} />}
            label="Cài đặt"
            onClick={() => guardedOpen("settings", "settings")}
            disabled={!canAccess("settings")}
          />
        </nav>

        <div className="border-t border-white/[0.08] pt-2">
          <RailButton
            active={false}
            icon={<Lock size={18} />}
            label="Khoá"
            onClick={() => { closeDrawer(); setCurrentEmployee(null); setScreen("passcode"); }}
          />
        </div>
      </aside>

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
