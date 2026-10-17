import { BarChart3, ClipboardList, Coffee, LayoutDashboard, LayoutGrid, Lock, QrCode, ReceiptText, Settings, Users } from "lucide-react";
import toast from "react-hot-toast";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { canAccessPermissionModule } from "@/core/permissionAuthority";
import type { PermissionNavigationModule } from "@/domain/permissions";
import { drawerAllowed } from "../permissionUi";
import type { DrawerModule } from "../useAppStore";
import { useAppStore } from "../useAppStore";
import { RailButton } from "./RailButton";

export function LeftNav() {
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const drawer = useAppStore((state) => state.drawer);
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const setScreen = useAppStore((state) => state.setScreen);

  const authority = usePermissionSession();
  const canAccess = (guard: PermissionNavigationModule) => authority.status === "verified" && !!authority.bundle
    && canAccessPermissionModule(authority.bundle.catalog, { status: "verified", snapshot: authority.bundle.snapshot }, guard);

  const guardedOpen = (module: Exclude<DrawerModule, null>, guard: PermissionNavigationModule) => {
    if (!canAccess(guard)) {
      toast.error("Nhân viên không có quyền dùng chức năng này.");
      return;
    }
    openDrawer(module);
  };

  const currentRole = authority.bundle?.snapshot.role;
  const currentRoleLabel = authority.bundle?.catalog.roles.find(role => role.code === currentRole)?.labelVi ?? "";
  const signedInLabel = currentEmployee ? `Đang đăng nhập: ${currentEmployee.name} · ${currentRoleLabel}` : "";
  const employeeInitial = currentEmployee?.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 border-r border-pos-line bg-pos-rail px-3 py-3 text-pos-ink max-[980px]:gap-2 max-[980px]:px-2 max-[980px]:py-2">
      <div className="grid gap-2 border-b border-[#dbe4ef] pb-3">
        {currentEmployee && (
          <div
            aria-label={signedInLabel}
            className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#dbe4ef] bg-white px-2.5 py-2 shadow-[0_8px_18px_rgb(15_23_42_/_5%)] max-[980px]:justify-center max-[980px]:px-0 max-[980px]:py-1.5"
            data-testid="left-nav-session"
            data-employee-id={currentEmployee.id}
            data-role={currentRole}
            title={signedInLabel}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-pos-primarySoft text-xs font-black text-pos-primary">{employeeInitial}</span>
            <div className="grid min-w-0 gap-0.5 max-[980px]:sr-only">
              <span className="text-[10px] font-black uppercase tracking-[0.05em] text-[#64748b]">Đang đăng nhập</span>
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-[1.15] text-[#172033]">{currentEmployee.name}</strong>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-black uppercase tracking-[0.04em] text-pos-primary">{currentRoleLabel}</span>
            </div>
          </div>
        )}
      </div>

      <nav className="grid min-h-0 content-start gap-3 overflow-auto py-1 [scrollbar-width:none]" aria-label="POS modules">
        <div className="grid gap-1.5">
          <span className="px-3 text-[10px] font-black uppercase tracking-[0.05em] text-[#64748b] max-[980px]:sr-only">Vận hành</span>
          <RailButton active={!drawer} icon={<LayoutDashboard size={18} />} label="Bàn" onClick={closeDrawer} testId="nav-floor" />
          {drawerAllowed(authority.bundle, "writeRecovery") && <RailButton active={drawer === "writeRecovery"} icon={<ClipboardList size={18} />} label="Tra cứu thao tác" onClick={() => openDrawer("writeRecovery")} testId="nav-write-recovery" />}
          <RailButton
            active={drawer === "takeaway"}
            icon={<ClipboardList size={18} />}
            label="Mang đi"
            onClick={() => openDrawer("takeaway")}
            testId="nav-takeaway"
          />
          <RailButton
            active={drawer === "orderHistory"}
            icon={<ReceiptText size={18} />}
            label="Lịch sử"
            onClick={() => guardedOpen("orderHistory", "orderHistory")}
            hidden={!canAccess("orderHistory")}
            testId="nav-order-history"
          />
        </div>

        <div className="grid gap-1.5 border-t border-[#dbe4ef] pt-3">
          <span className="px-3 text-[10px] font-black uppercase tracking-[0.05em] text-[#64748b] max-[980px]:sr-only">Quản trị</span>
          <RailButton
            active={drawer === "employees"}
            icon={<Users size={18} />}
            label="Nhân viên"
            onClick={() => guardedOpen("employees", "employees")}
            hidden={!canAccess("employees")}
            testId="nav-employees"
          />
          <RailButton
            active={drawer === "menuEditor"}
            icon={<Coffee size={18} />}
            label="Menu"
            onClick={() => guardedOpen("menuEditor", "menuEditor")}
            hidden={!canAccess("menuEditor")}
            testId="nav-menu-editor"
          />
          <RailButton
            active={drawer === "floorEditor"}
            icon={<LayoutGrid size={18} />}
            label="Sơ đồ"
            onClick={() => guardedOpen("floorEditor", "floorEditor")}
            hidden={!canAccess("floorEditor")}
            testId="nav-floor-editor"
          />
          <RailButton
            active={drawer === "report"}
            icon={<BarChart3 size={18} />}
            label="Báo cáo"
            onClick={() => guardedOpen("report", "report")}
            hidden={!canAccess("report")}
            testId="nav-report"
          />
          <RailButton
            active={drawer === "paymentSettings"}
            icon={<QrCode size={18} />}
            label="Thanh toán"
            onClick={() => guardedOpen("paymentSettings", "settings")}
            hidden={!canAccess("settings")}
            testId="nav-payment-settings"
          />
          <RailButton
            active={drawer === "settings"}
            icon={<Settings size={18} />}
            label="Cài đặt"
            onClick={() => guardedOpen("settings", "settings")}
            hidden={!canAccess("settings")}
            testId="nav-settings"
          />
        </div>
      </nav>

      <div className="border-t border-[#dbe4ef] pt-2">
        <RailButton
          active={false}
          icon={<Lock size={18} />}
          label="Khoá"
          testId="nav-lock"
          onClick={() => {
            setCurrentEmployee(null);
            closeDrawer();
            setScreen("passcode");
          }}
        />
      </div>
    </aside>
  );
}
