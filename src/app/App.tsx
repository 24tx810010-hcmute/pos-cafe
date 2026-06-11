import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Coffee,
  Copy,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogIn,
  Minus,
  Plus,
  ReceiptText,
  Save,
  Settings,
  Store,
  UserCog,
  Users,
  Utensils,
} from "lucide-react";
import { Button, TextField, Tooltip } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type {
  FloorPlan,
  FloorTable,
  MenuCatalog,
  MenuItem,
  OrderDetail,
  OrderItemSnapshot,
  OrderSummary,
  SubmitOrderDraftItem,
} from "@/domain";
import { canAccessModule, type AppModule } from "@/core/guards";
import { formatCompactVnd, formatVnd } from "@/core/money";
import { isAppError } from "@/core/appError";
import { usePorts } from "./portsContext";
import { useAppStore, type DrawerModule } from "./useAppStore";

const logicalStage = { width: 1600, height: 900 };

const orderQueryKeys = {
  employees: ["employees"] as const,
  menu: ["menu"] as const,
  floorPlan: ["floorPlan"] as const,
  openOrders: ["orders", "open"] as const,
  order: (orderId: string | null) => ["orders", "detail", orderId] as const,
  report: ["report", "core"] as const,
  settings: ["settings"] as const,
};

export function App() {
  const screen = useAppStore((state) => state.screen);
  const currentEmployee = useAppStore((state) => state.currentEmployee);

  return (
    <>
      <RotateGuidance />
      {currentEmployee ? (
        <AppShell />
      ) : screen === "landing" ? (
        <LandingScreen />
      ) : screen === "storePairing" ? (
        <StorePairingScreen />
      ) : screen === "createStore" ? (
        <CreateStoreScreen />
      ) : (
        <PasscodeScreen />
      )}
    </>
  );
}

function RotateGuidance() {
  return (
    <div className="rotate-guidance" data-testid="rotate-guidance">
      <section className="rotate-card">
        <Store size={36} color="#0F766E" />
        <h1>Xoay ngang thiết bị</h1>
        <p className="muted">POS dùng layout landscape để giữ đủ bàn, menu, thanh toán, báo cáo và editor.</p>
      </section>
    </div>
  );
}

function LandingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  return (
    <main className="landing-screen" data-testid="landing-screen">
      <div className="landing-inner">
        <header className="landing-header">
          <div className="brand-mark">P</div>
          <span className="landing-brand-name">POS Cafe</span>
        </header>
        <div className="landing-hero">
          <h1>POS quán cà phê</h1>
          <p>Quản lý order, bàn, menu và thanh toán trên nhiều thiết bị.</p>
        </div>
        <div className="landing-actions">
          <button
            className="landing-card"
            data-testid="go-store-pairing"
            onClick={() => setScreen("storePairing")}
            onKeyDown={(e) => e.key === "Enter" && setScreen("storePairing")}
          >
            <LogIn size={26} className="landing-card-icon" />
            <strong>Đã có quán</strong>
            <span>Nhập Store Key để ghép máy vào quán hiện có.</span>
          </button>
          <button
            className="landing-card"
            data-testid="go-create-store"
            onClick={() => setScreen("createStore")}
            onKeyDown={(e) => e.key === "Enter" && setScreen("createStore")}
          >
            <Store size={26} className="landing-card-icon" />
            <strong>Tạo quán mới</strong>
            <span>Thiết lập quán và nhận Store Key + Admin PIN.</span>
          </button>
        </div>
        <p className="landing-note">Đây là bản UI mock, thao tác chỉ giả lập.</p>
      </div>
    </main>
  );
}

function StorePairingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateKey = (value: string) => {
    const parts = value.split("-");
    if (parts.length < 2) return false;
    const [before, ...rest] = parts;
    const after = rest.join("-");
    return /\d/.test(before) && after.length >= 4;
  };

  const handleSubmit = () => {
    if (!validateKey(key)) {
      setError("Sai định dạng. Ví dụ: 0001-X8F3QA");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Đã ghép thiết bị (mock)");
      setScreen("passcode");
    }, 400);
  };

  return (
    <main className="preauth-screen" data-testid="store-pairing-screen">
      <div className="preauth-card">
        <header className="preauth-header">
          <button className="preauth-back" onClick={() => setScreen("landing")}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className="preauth-brand">
            <div className="brand-mark">P</div>
            <span className="landing-brand-name">POS Cafe</span>
          </div>
        </header>

        <div className="preauth-body">
          <div className="preauth-form">
            <div className="title-stack" style={{ marginBottom: 20 }}>
              <h2>Ghép thiết bị với quán</h2>
              <p>Nhập mã chủ quán cung cấp. Đây là mock, không kết nối backend.</p>
            </div>

            <div className="preauth-field">
              <TextField
                label="Store Key"
                placeholder="0001-X8F3QA"
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                error={!!error}
                helperText={error || "Nhập mã chủ quán cung cấp. Đây là mock, không kết nối backend."}
                fullWidth
                size="small"
                inputProps={{ "data-testid": "store-key-input" }}
              />
            </div>

            <Button
              variant="contained"
              fullWidth
              data-testid="go-passcode"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "Đang ghép..." : "Ghép thiết bị"}
            </Button>

            <button className="preauth-link" onClick={() => setScreen("createStore")}>
              Chưa có quán? Tạo quán mới
            </button>
          </div>

          <aside className="preauth-notes">
            <div className="preauth-note-item">
              <Store size={16} className="preauth-note-icon" />
              <p>Một Store Key có thể dùng cho nhiều thiết bị.</p>
            </div>
            <div className="preauth-note-item">
              <LogIn size={16} className="preauth-note-icon" />
              <p>Sau khi ghép, mỗi ngày nhân viên chọn tên và nhập PIN.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function CreateStoreScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ storeKey: string; adminPin: string } | null>(null);

  const handleCreate = () => {
    if (!storeName.trim()) {
      setNameError("Tên quán không được để trống.");
      return;
    }
    setNameError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResult({ storeKey: "0001-X8F3QA", adminPin: "123456" });
    }, 500);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Đã copy ${label}`),
      () => toast(`Đã copy ${label} (mock)`),
    );
  };

  return (
    <main className="preauth-screen" data-testid="create-store-screen">
      <div className="preauth-card">
        <header className="preauth-header">
          <button className="preauth-back" onClick={() => setScreen("landing")}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className="preauth-brand">
            <div className="brand-mark">P</div>
            <span className="landing-brand-name">POS Cafe</span>
          </div>
        </header>

        {result ? (
          <div className="create-store-success" data-testid="create-store-result">
            <div className="create-store-success-icon">
              <CheckCircle2 size={40} color="#15803d" />
            </div>
            <h2>Tạo quán thành công!</h2>
            <p className="muted">Lưu lại thông tin bên dưới trước khi tiếp tục.</p>

            <div className="create-store-key-row">
              <div className="create-store-key-block">
                <span className="create-store-key-label">Store Key</span>
                <span className="create-store-key-value" data-testid="result-store-key">{result.storeKey}</span>
                <button className="create-store-copy" onClick={() => copyText(result.storeKey, "Store Key")}>
                  <Copy size={14} /> Copy
                </button>
              </div>
              <div className="create-store-key-block">
                <span className="create-store-key-label">Admin PIN</span>
                <span className="create-store-key-value" data-testid="result-admin-pin">{result.adminPin}</span>
                <button className="create-store-copy" onClick={() => copyText(result.adminPin, "Admin PIN")}>
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>

            <p className="create-store-warning">
              ⚠ Chỉ hiện một lần trong flow thật; trong mock có thể hiện lại để demo.
            </p>

            <Button variant="contained" data-testid="go-passcode" onClick={() => setScreen("passcode")}>
              Vào màn hình PIN
            </Button>
          </div>
        ) : (
          <div className="preauth-body">
            <div className="preauth-form">
              <div className="title-stack" style={{ marginBottom: 20 }}>
                <h2>Tạo quán mới</h2>
                <p>Thiết lập thông tin quán để nhận Store Key và Admin PIN.</p>
              </div>

              <div className="preauth-field">
                <TextField
                  label="Tên quán"
                  placeholder="Cafe Demo"
                  value={storeName}
                  onChange={(e) => { setStoreName(e.target.value); setNameError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  error={!!nameError}
                  helperText={nameError}
                  fullWidth
                  size="small"
                  inputProps={{ "data-testid": "store-name-input" }}
                />
              </div>

              <div className="preauth-field">
                <TextField
                  label="Địa chỉ (tuỳ chọn)"
                  placeholder="123 Nguyễn Huệ, Q.1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  fullWidth
                  size="small"
                />
              </div>

              <div className="preauth-field">
                <TextField
                  label="Múi giờ"
                  value="Asia/Ho_Chi_Minh"
                  disabled
                  fullWidth
                  size="small"
                />
              </div>

              <div className="create-store-check-row">
                <input type="checkbox" id="seed-demo" defaultChecked disabled />
                <label htmlFor="seed-demo" style={{ color: "var(--muted)", fontSize: 13 }}>
                  Seed dữ liệu demo (mock)
                </label>
              </div>

              <Button
                variant="contained"
                fullWidth
                data-testid="create-store-button"
                disabled={loading}
                onClick={handleCreate}
              >
                {loading ? "Đang tạo quán..." : "Tạo quán mới"}
              </Button>

              <button className="preauth-link" onClick={() => setScreen("storePairing")}>
                Đã có quán? Ghép thiết bị
              </button>
            </div>

            <aside className="preauth-notes">
              <div className="preauth-note-item">
                <Store size={16} className="preauth-note-icon" />
                <p>Store Key sinh ra sau khi tạo, dùng để ghép nhiều thiết bị vào cùng một quán.</p>
              </div>
              <div className="preauth-note-item">
                <CheckCircle2 size={16} className="preauth-note-icon" />
                <p>Admin PIN mặc định <strong>123456</strong>. Đổi PIN sau khi vào hệ thống.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function PasscodeScreen() {
  const ports = usePorts();
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const setScreen = useAppStore((state) => state.setScreen);
  const employeesQuery = useQuery({
    queryKey: orderQueryKeys.employees,
    queryFn: () => ports.employee.listActiveEmployees(),
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [shaking, setShaking] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!selectedEmployeeId && employeesQuery.data?.length) {
      setSelectedEmployeeId(employeesQuery.data[0].id);
    }
  }, [employeesQuery.data, selectedEmployeeId]);

  const verifyMutation = useMutation({
    mutationFn: () => ports.employee.verifyPin(selectedEmployeeId, pin),
    onSuccess: (employee) => {
      setCurrentEmployee(employee);
      toast.success(`Xin chào ${employee.name}`);
    },
    onError: (error) => {
      const msg = isAppError(error) ? error.message : "PIN không đúng.";
      setPinError(msg);
      setPin("");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    },
  });

  const appendPin = (value: string) => {
    setPinError("");
    setPin((current) => (current.length < 6 ? `${current}${value}` : current));
  };

  const backspace = () => {
    setPinError("");
    setPin((current) => current.slice(0, -1));
  };

  return (
    <main className="passcode-screen" data-testid="passcode-screen">
      <section className="passcode-brand">
        <div className="passcode-brand-top">
          <div className="brand-mark">P</div>
          <div>
            <div className="passcode-store-name">Cửa hàng #0001</div>
            <div className="passcode-store-status">
              <span className="passcode-status-dot" />
              Realtime online mock
            </div>
          </div>
        </div>
        <div className="passcode-brand-mid">
          <div className="passcode-datetime">{timeStr}</div>
          <div className="passcode-date-sub">{dateStr}</div>
          <p className="passcode-brand-hint">Nhân viên chọn tên và nhập PIN để mở phiên làm việc.</p>
        </div>
        <span
          className="pair-strip"
          style={{ cursor: "pointer", width: "fit-content" }}
          onClick={() => setScreen("landing")}
        >
          ← Đổi quán / Gỡ ghép
        </span>
      </section>

      <section className={`passcode-panel${shaking ? " pin-shake" : ""}`}>
        <div className="title-stack">
          <h2>Chọn nhân viên</h2>
          <p>Ca làm việc · {dateStr}</p>
        </div>

        {employeesQuery.isLoading ? (
          <div className="passcode-empty">Đang tải danh sách nhân viên...</div>
        ) : !employeesQuery.data?.length ? (
          <div className="passcode-empty">Chưa có nhân viên mock.</div>
        ) : (
          <div className="employee-grid">
            {employeesQuery.data.map((employee) => (
              <button
                key={employee.id}
                className={`employee-card ${employee.id === selectedEmployeeId ? "active" : ""}`}
                data-testid={`employee-${employee.id}`}
                onClick={() => { setSelectedEmployeeId(employee.id); setPinError(""); setPin(""); }}
              >
                <strong>{employee.name}</strong>
                <div className="employee-card-meta">
                  <span className="role-pill">{employee.role}</span>
                  <span className="status-pill status-active">● active</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={`pin-display${pinError ? " pin-error" : ""}`} aria-label="PIN hiện tại">
          {Array.from({ length: 6 }).map((_, index) => (
            <span className={`pin-dot${index < pin.length ? " filled" : ""}`} key={index} />
          ))}
        </div>
        {pinError && <p className="pin-error-msg">{pinError}</p>}

        <div className="pin-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
            <button className="pin-key" data-testid={`pin-${value}`} key={value} onClick={() => appendPin(value)}>
              {value}
            </button>
          ))}
          <button className="pin-key" onClick={backspace} aria-label="Xoá ký tự">⌫</button>
          <button className="pin-key" data-testid="pin-0" onClick={() => appendPin("0")}>0</button>
          <Button
            variant="contained"
            data-testid="unlock-button"
            disabled={!selectedEmployeeId || pin.length < 4 || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
            sx={{ borderRadius: "8px", fontWeight: 700 }}
          >
            {verifyMutation.isPending ? "..." : "Mở khoá"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function AppShell() {
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

  const roleLabel: Record<string, string> = { admin: "Admin", cashier: "Thu ngân", kitchen: "Bếp" };

  return (
    <main className="app-shell" data-testid="app-shell">
      <aside className="left-rail">
        <div className="rail-top">
          <div className="rail-logo">P</div>
          {currentEmployee && (
            <div className="rail-employee-badge" title={`${currentEmployee.name} · ${currentEmployee.role}`}>
              <div className="rail-employee-initial">{currentEmployee.name.charAt(0).toUpperCase()}</div>
              <span className="rail-employee-role">{roleLabel[currentEmployee.role] ?? currentEmployee.role}</span>
            </div>
          )}
        </div>

        <nav className="rail-list" aria-label="POS modules">
          <RailButton active={!drawer} icon={<LayoutDashboard size={18} />} label="Bàn" onClick={closeDrawer} />
          <RailButton
            active={drawer === "order"}
            icon={<ClipboardList size={18} />}
            label="Mang đi"
            onClick={() => openOrder({ orderId: null, tableId: null, orderType: "takeaway" })}
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
            label="NV"
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
            active={drawer === "settings"}
            icon={<Settings size={18} />}
            label="Cài đặt"
            onClick={() => guardedOpen("settings", "settings")}
            disabled={!canAccess("settings")}
          />
        </nav>

        <div className="rail-bottom">
          <RailButton
            active={false}
            icon={<Lock size={18} />}
            label="Khoá"
            onClick={() => { closeDrawer(); setCurrentEmployee(null); setScreen("passcode"); }}
          />
        </div>
      </aside>

      <section className="workspace">
        <FloorWorkspace />
        {drawer === "order" ? <OrderDrawer /> : null}
        {drawer === "payment" ? <PaymentDrawer /> : null}
        {drawer === "menuEditor" ? <MenuEditorDrawer /> : null}
        {drawer === "floorEditor" ? <FloorEditorDrawer /> : null}
        {drawer === "reportSettings" ? <ReportSettingsDrawer /> : null}
        {drawer === "orderHistory" ? <OrderHistoryStubDrawer /> : null}
        {drawer === "employees" ? <EmployeesStubDrawer /> : null}
        {drawer === "settings" ? <SettingsStubDrawer /> : null}
      </section>
    </main>
  );
}

function RailButton({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const btn = (
    <button
      className={`rail-action ${active ? "active" : ""} ${disabled ? "rail-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  if (disabled) {
    return (
      <Tooltip title="Không có quyền" placement="right" arrow>
        <span style={{ display: "contents" }}>{btn}</span>
      </Tooltip>
    );
  }
  return btn;
}

function StubDrawer({ testId, title, subtitle, icon }: { testId: string; title: string; subtitle: string; icon: ReactNode }) {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  return (
    <section className="drawer-overlay" data-testid={testId}>
      <header className="drawer-header">
        <div className="title-stack">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>
      <div className="drawer-body stub-body">
        {icon}
        <p className="stub-label">{title} — sẽ implement ở bước tiếp theo.</p>
      </div>
    </section>
  );
}

function OrderHistoryStubDrawer() {
  return <StubDrawer testId="order-history-drawer" title="Lịch sử đơn" subtitle="Xem lại đơn đã thanh toán / huỷ" icon={<ReceiptText size={40} color="#0F766E" />} />;
}

function EmployeesStubDrawer() {
  return <StubDrawer testId="employees-drawer" title="Nhân viên" subtitle="Quản lý tài khoản nhân viên" icon={<Users size={40} color="#0F766E" />} />;
}

function SettingsStubDrawer() {
  return <StubDrawer testId="settings-drawer" title="Cài đặt chung" subtitle="Thông tin quán và cấu hình" icon={<Settings size={40} color="#0F766E" />} />;
}

type TableFilter = "all" | "empty" | "occupied";

function FloorWorkspace() {
  const ports = usePorts();
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const activeAreaId = useAppStore((state) => state.activeAreaId);
  const setActiveAreaId = useAppStore((state) => state.setActiveAreaId);
  const openOrder = useAppStore((state) => state.openOrder);

  const floorPlanQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
  const openOrdersQuery = useQuery({ queryKey: orderQueryKeys.openOrders, queryFn: () => ports.order.listOpenOrders() });

  const [tableFilter, setTableFilter] = useState<TableFilter>("all");

  useEffect(() => {
    const firstArea = floorPlanQuery.data?.areas[0]?.id;
    if (!activeAreaId && firstArea) setActiveAreaId(firstArea);
  }, [activeAreaId, floorPlanQuery.data, setActiveAreaId]);

  const floorPlan = floorPlanQuery.data;
  const orders = openOrdersQuery.data ?? [];
  const areaId = activeAreaId ?? floorPlan?.areas[0]?.id ?? null;
  const allTables = floorPlan?.tables.filter((t) => t.areaId === areaId) ?? [];
  const decorItems = floorPlan?.decorItems.filter((d) => d.areaId === areaId) ?? [];

  const isOccupied = (tableId: string) =>
    allTables.find((t) => t.id === tableId)?.status === "occupied" ||
    orders.some((o) => o.tableId === tableId);

  const filteredTables = allTables.filter((t) => {
    if (tableFilter === "empty") return !isOccupied(t.id);
    if (tableFilter === "occupied") return isOccupied(t.id);
    return true;
  });

  const emptyCount = allTables.filter((t) => !isOccupied(t.id)).length;
  const occupiedCount = allTables.filter((t) => isOccupied(t.id)).length;
  const takeawayOrders = orders.filter((o) => o.orderType === "takeaway");
  const dineInOrders = orders.filter((o) => o.orderType === "dine_in");

  return (
    <>
      <header className="workspace-header">
        <div className="title-stack">
          <h1>Sơ đồ bàn</h1>
          <p>
            <span className="sync-dot" /> {currentEmployee?.name} · {allTables.length} bàn · realtime online mock
          </p>
        </div>
        <div className="header-actions">
          <Button
            variant="outlined"
            startIcon={<ClipboardList size={15} />}
            onClick={() => openOrder({ orderId: null, tableId: null, orderType: "takeaway" })}
          >
            Mang đi
          </Button>
          <Button variant="outlined" onClick={() => toast("Đã làm mới (mock)")}>Làm mới</Button>
          <Button variant="contained" onClick={() => toast("Tạo đơn nhanh sẽ dùng draft order.")}>
            Tạo đơn nhanh
          </Button>
        </div>
      </header>

      <div className="workspace-body floor-workspace-body">
        {/* Left summary panel */}
        <aside className="floor-side-panel">
          <div className="floor-side-section">
            <div className="floor-side-title">Khu vực</div>
            {floorPlan?.areas.map((area) => (
              <button
                key={area.id}
                className={`floor-area-item ${area.id === areaId ? "active" : ""}`}
                onClick={() => setActiveAreaId(area.id)}
              >
                {area.name}
              </button>
            ))}
          </div>
          <div className="floor-side-section">
            <div className="floor-side-title">Tổng quan</div>
            <div className="floor-stat-row">
              <span className="floor-stat-dot dot-empty" />
              <span>Trống</span>
              <strong>{emptyCount}</strong>
            </div>
            <div className="floor-stat-row">
              <span className="floor-stat-dot dot-occupied" />
              <span>Đang phục vụ</span>
              <strong>{occupiedCount}</strong>
            </div>
            <div className="floor-stat-row">
              <span className="floor-stat-dot dot-takeaway" />
              <span>Mang đi</span>
              <strong>{takeawayOrders.length}</strong>
            </div>
          </div>
          <div className="floor-side-section floor-legend">
            <div className="floor-side-title">Chú giải</div>
            <div className="floor-legend-item"><span className="legend-box empty" />Trống</div>
            <div className="floor-legend-item"><span className="legend-box occupied" />Đang phục vụ</div>
            <div className="floor-legend-item"><span className="legend-box decor" />Trang trí</div>
          </div>
        </aside>

        {/* Center canvas */}
        <section className="floor-shell" data-testid="floor-view">
          <div className="floor-filter-bar">
            <div className="area-tabs" style={{ borderBottom: "none", padding: "6px 12px", flex: 1 }}>
              {floorPlan?.areas.map((area) => (
                <button
                  className={`area-tab ${area.id === areaId ? "active" : ""}`}
                  key={area.id}
                  onClick={() => setActiveAreaId(area.id)}
                >
                  {area.name}
                </button>
              ))}
            </div>
            <div className="status-chips">
              {(["all", "empty", "occupied"] as TableFilter[]).map((f) => (
                <button
                  key={f}
                  className={`status-chip ${tableFilter === f ? "active" : ""}`}
                  onClick={() => setTableFilter(f)}
                >
                  {f === "all" ? "Tất cả" : f === "empty" ? "Trống" : "Đang phục vụ"}
                </button>
              ))}
            </div>
          </div>
          {floorPlanQuery.isLoading ? (
            <div className="floor-empty-state">Đang tải sơ đồ...</div>
          ) : allTables.length === 0 ? (
            <div className="floor-empty-state">
              <LayoutGrid size={32} color="#94a3b8" />
              <p>Chưa có bàn. Vào Sơ đồ để tạo bàn.</p>
            </div>
          ) : (
            <div className="stage-scroll">
              <div className="floor-stage">
                {decorItems.map((decor) => (
                  <div
                    className={`decor-node decor-${decor.kind}`}
                    key={decor.id}
                    style={stageStyle(decor.posX, decor.posY, decor.width, decor.height)}
                  >
                    {decor.label ?? decor.assetKey}
                  </div>
                ))}
                {filteredTables.map((table) => {
                  const openOrderSummary = orders.find((o) => o.tableId === table.id);
                  const occupied = isOccupied(table.id);
                  const isRound = table.shape === "round" || table.shape === "circle";
                  return (
                    <button
                      className={`table-node ${occupied ? "occupied" : "empty"} ${isRound ? "round" : ""}`}
                      data-testid={`table-${table.id}`}
                      key={table.id}
                      style={stageStyle(table.posX, table.posY, table.width, table.height)}
                      onClick={() =>
                        openOrder({
                          orderId: openOrderSummary?.id ?? null,
                          tableId: table.id,
                          orderType: "dine_in",
                        })
                      }
                    >
                      <strong className="table-name">{table.name}</strong>
                      <span className="table-seats">{table.seats} chỗ</span>
                      {openOrderSummary ? (
                        <small className="table-amount">{formatCompactVnd(openOrderSummary.total)}</small>
                      ) : (
                        <small className="table-empty-label">Trống</small>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right open orders panel */}
        <aside className="floor-orders-panel">
          <div className="floor-side-title" style={{ padding: "12px 14px 8px" }}>Đơn đang mở · {dineInOrders.length}</div>
          <div className="floor-orders-list">
            {dineInOrders.length === 0 ? (
              <p className="floor-orders-empty">Chưa có đơn dine-in.</p>
            ) : (
              dineInOrders.map((ord) => {
                const table = floorPlan?.tables.find((t) => t.id === ord.tableId);
                return (
                  <button
                    key={ord.id}
                    className="floor-order-card"
                    onClick={() => openOrder({ orderId: ord.id, tableId: ord.tableId, orderType: "dine_in" })}
                  >
                    <div className="floor-order-card-top">
                      <strong>{table?.name ?? ord.tableId}</strong>
                      <span className="floor-order-no">#{ord.orderNo}</span>
                    </div>
                    <div className="floor-order-card-amount">{formatCompactVnd(ord.total)}</div>
                    <div className="floor-order-card-items">{formatCompactVnd(ord.total)}</div>
                  </button>
                );
              })
            )}
          </div>
          {takeawayOrders.length > 0 && (
            <>
              <div className="floor-side-title" style={{ padding: "10px 14px 8px", borderTop: "1px solid var(--line)" }}>
                Mang đi · {takeawayOrders.length}
              </div>
              <div className="floor-orders-list">
                {takeawayOrders.map((ord) => (
                  <button
                    key={ord.id}
                    className="floor-order-card takeaway"
                    onClick={() => openOrder({ orderId: ord.id, tableId: null, orderType: "takeaway" })}
                  >
                    <div className="floor-order-card-top">
                      <strong>Mang đi</strong>
                      <span className="floor-order-no">#{ord.orderNo}</span>
                    </div>
                    <div className="floor-order-card-amount">{formatCompactVnd(ord.total)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function OrderDrawer() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openPayment = useAppStore((state) => state.openPayment);
  const context = useAppStore((state) => state.orderContext);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const draftItems = useAppStore((state) => state.draftItems);
  const setDraftItems = useAppStore((state) => state.setDraftItems);
  const activeCategoryId = useAppStore((state) => state.activeCategoryId);
  const setActiveCategoryId = useAppStore((state) => state.setActiveCategoryId);

  const [search, setSearch] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);

  const menuQuery = useQuery({ queryKey: orderQueryKeys.menu, queryFn: () => ports.menu.getMenu() });
  const floorPlanQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
  const orderQuery = useQuery({
    queryKey: orderQueryKeys.order(context?.orderId ?? null),
    queryFn: () => ports.order.getOrder(context!.orderId!),
    enabled: !!context?.orderId,
  });

  useEffect(() => {
    const firstCategory = menuQuery.data?.categories[0]?.id;
    if (!activeCategoryId && firstCategory) setActiveCategoryId(firstCategory);
  }, [activeCategoryId, menuQuery.data, setActiveCategoryId]);

  useEffect(() => {
    if (context?.orderId && orderQuery.data) {
      setDraftItems(orderQuery.data.items.map(snapshotToDraft));
    }
    if (context && !context.orderId) setDraftItems([]);
  }, [context, orderQuery.data, setDraftItems]);

  const menu = menuQuery.data;
  const categoryId = activeCategoryId ?? menu?.categories[0]?.id ?? "";
  const allCategoryItems = menu?.menuItems.filter((item) => item.categoryId === categoryId) ?? [];
  const items = search
    ? (menu?.menuItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) ?? [])
    : allCategoryItems;
  const orderDetail = orderQuery.data ?? null;
  const table = context?.tableId ? floorPlanQuery.data?.tables.find((t) => t.id === context.tableId) : null;
  const cartLines = useMemo(() => (menu ? buildCartLines(menu, draftItems) : []), [draftItems, menu]);
  const total = cartLines.reduce((sum, line) => sum + line.total, 0);
  const isDirty = draftItems.length > 0;

  const handleClose = () => {
    if (isDirty && !orderDetail) { setConfirmClose(true); return; }
    closeDrawer();
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      ports.order.submitOrderChanges({
        orderId: context?.orderId ?? null,
        tableId: context?.tableId ?? null,
        orderType: context?.orderType ?? "takeaway",
        employeeId: currentEmployee!.id,
        expectedVersion: orderDetail?.lockVersion ?? null,
        items: draftItems,
      }),
    onSuccess: async (result) => {
      if (result.ticket) await ports.print.renderOrderTicket(result.ticket);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.openOrders }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.floorPlan }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.report }),
      ]);
      toast.success(result.status === "void" ? "Đã huỷ đơn mở." : "Đã in/gửi đơn.");
      closeDrawer();
    },
    onError: (error) => toast.error(isAppError(error) ? error.message : "Không thể gửi đơn."),
  });

  const addItem = (menuItem: MenuItem) => {
    if (!menuItem.isAvailable) return;
    const existing = draftItems.find((d) => d.menuItemId === menuItem.id && d.options.length === 0);
    if (existing) {
      setDraftItems(draftItems.map((d) => (d.id === existing.id ? { ...d, quantity: d.quantity + 1 } : d)));
      return;
    }
    setDraftItems([...draftItems, { id: crypto.randomUUID(), menuItemId: menuItem.id, quantity: 1, note: null, options: [] }]);
  };

  const adjustQuantity = (id: string, delta: number) => {
    setDraftItems(
      draftItems.map((d) => (d.id === id ? { ...d, quantity: Math.max(0, d.quantity + delta) } : d)).filter((d) => d.quantity > 0),
    );
  };

  const updateNote = (id: string, note: string) => {
    setDraftItems(draftItems.map((d) => (d.id === id ? { ...d, note: note || null } : d)));
  };

  const orderTypeLabel = context?.orderType === "takeaway" ? "Mang đi" : `Bàn ${table?.name ?? "?"}`;
  const titleLabel = orderDetail ? `${orderTypeLabel} · Đơn #${orderDetail.orderNo}` : `${orderTypeLabel} · Draft mới`;

  // Category color swatches for visual variety
  const catColors: Record<string, string> = {
    "cat-coffee": "#7c3aed",
    "cat-tea": "#0891b2",
    "cat-blended": "#0d9488",
    "cat-snack": "#d97706",
  };

  return (
    <section className="drawer-overlay" data-testid="order-drawer">
      {/* Confirm close dialog */}
      {confirmClose && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Bỏ thay đổi?</h3>
            <p>Draft chưa gửi sẽ bị xoá.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setConfirmClose(false)}>Tiếp tục soạn</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmClose(false); closeDrawer(); }}>Bỏ draft</Button>
            </div>
          </div>
        </div>
      )}

      <header className="drawer-header">
        <div className="title-stack">
          <h2>{titleLabel}</h2>
          <p>
            <span className={`order-type-chip ${context?.orderType === "takeaway" ? "takeaway" : "dine-in"}`}>
              {context?.orderType === "takeaway" ? "Mang đi" : "Dine-in"}
            </span>
            {orderDetail ? ` · v${orderDetail.lockVersion}` : " · Draft chưa ghi DB"}
            {" · "}<span className="sync-dot" />mock
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={handleClose}>Đóng</Button>
          {orderDetail && (
            <Button variant="outlined" startIcon={<CreditCard size={16} />} onClick={() => openPayment(orderDetail.id)}>
              Thanh toán
            </Button>
          )}
          <Button
            variant="contained"
            data-testid="submit-order-button"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Đang gửi..." : "In/Gửi đơn"}
          </Button>
        </div>
      </header>

      <div className="drawer-body">
        <div className="three-pane">
          {/* Left: Categories */}
          <aside className="pane">
            <div className="pane-head">Danh mục</div>
            <div className="pane-scroll">
              <div className="category-list">
                {menu?.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`category-button ${cat.id === categoryId && !search ? "active" : ""}`}
                    onClick={() => { setActiveCategoryId(cat.id); setSearch(""); }}
                  >
                    <span className="cat-dot" style={{ background: catColors[cat.id] ?? "#64748b" }} />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Center: Menu grid */}
          <section className="pane">
            <div className="pane-head">
              <span>Menu</span>
              <TextField
                size="small"
                placeholder="Tìm món..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ maxWidth: 160 }}
              />
            </div>
            <div className="pane-scroll">
              {menuQuery.isLoading ? (
                <p className="muted" style={{ padding: 12 }}>Đang tải menu...</p>
              ) : items.length === 0 ? (
                <p className="muted" style={{ padding: 12 }}>Không có món.</p>
              ) : (
                <div className="menu-grid">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className={`menu-card ${!item.isAvailable ? "unavailable" : ""}`}
                      data-testid={`menu-item-${item.id}`}
                      onClick={() => addItem(item)}
                      disabled={!item.isAvailable}
                    >
                      <div className="menu-card-swatch" style={{ background: catColors[item.categoryId] ?? "#64748b" }} />
                      <div className="menu-card-body">
                        <strong className="menu-card-name">{item.name}</strong>
                        {!item.isAvailable && <span className="unavailable-badge">Tạm hết</span>}
                      </div>
                      <span className="price-text">{formatVnd(item.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: Cart */}
          <aside className="pane cart-pane">
            <div className="pane-head">
              <span>Giỏ hàng</span>
              <span className="muted">{cartLines.length} món</span>
            </div>
            <div className="cart-list">
              {cartLines.length ? (
                cartLines.map((line) => (
                  <div className="cart-item" key={line.id}>
                    <div className="cart-line">
                      <strong className="cart-item-name">{line.name}</strong>
                      <strong className="price-text">{formatCompactVnd(line.total)}</strong>
                    </div>
                    {line.optionText && (
                      <div className="cart-line muted" style={{ fontSize: 12 }}>
                        <span>{line.optionText}</span>
                      </div>
                    )}
                    <div className="cart-line">
                      <span className="quantity-actions">
                        <button className="icon-button" onClick={() => adjustQuantity(line.id, -1)}><Minus size={14} /></button>
                        <span className="qty-badge">{line.quantity}</span>
                        <button className="icon-button" onClick={() => adjustQuantity(line.id, 1)}><Plus size={14} /></button>
                      </span>
                      <button
                        className={`note-toggle ${noteOpenId === line.id ? "active" : ""}`}
                        onClick={() => setNoteOpenId(noteOpenId === line.id ? null : line.id)}
                      >
                        Ghi chú
                      </button>
                    </div>
                    {noteOpenId === line.id && (
                      <TextField
                        size="small"
                        placeholder="VD: ít đá, không đường..."
                        value={draftItems.find((d) => d.id === line.id)?.note ?? ""}
                        onChange={(e) => updateNote(line.id, e.target.value)}
                        fullWidth
                        autoFocus
                      />
                    )}
                    {draftItems.find((d) => d.id === line.id)?.note && noteOpenId !== line.id && (
                      <div className="cart-note-preview">📝 {draftItems.find((d) => d.id === line.id)?.note}</div>
                    )}
                  </div>
                ))
              ) : (
                <p className="cart-empty-hint">Chọn món từ menu để tạo draft.</p>
              )}
            </div>
            <footer className="cart-footer">
              <div className="total-row"><span>Tạm tính</span><strong>{formatVnd(total)}</strong></div>
              <div className="total-row final"><span>Tổng</span><strong>{formatVnd(total)}</strong></div>
              <Button
                variant="contained"
                fullWidth
                data-testid="submit-order-button-footer"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                In/Gửi đơn
              </Button>
            </footer>
          </aside>
        </div>
      </div>
    </section>
  );
}

function PaymentDrawer() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const paymentOrderId = useAppStore((state) => state.paymentOrderId);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const floorPlanQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });

  const orderQuery = useQuery({
    queryKey: orderQueryKeys.order(paymentOrderId),
    queryFn: () => ports.order.getOrder(paymentOrderId!),
    enabled: !!paymentOrderId,
  });
  const order = orderQuery.data;
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<"cash" | "qr" | "bank">("cash");

  useEffect(() => {
    if (order) setReceivedAmount(order.total);
  }, [order]);

  const changeAmount = receivedAmount - (order?.total ?? 0);
  const insufficient = receivedAmount < (order?.total ?? 0);

  const table = order?.tableId ? floorPlanQuery.data?.tables.find((t) => t.id === order.tableId) : null;

  const payMutation = useMutation({
    mutationFn: () =>
      ports.payment.payOrder({
        paymentId: crypto.randomUUID(),
        orderId: order!.id,
        employeeId: currentEmployee!.id,
        method: payMethod === "cash" ? "cash" : payMethod === "qr" ? "qr" : "bank_transfer",
        expectedVersion: order!.lockVersion,
        receivedAmount,
      }),
    onSuccess: async (result) => {
      await ports.print.renderReceipt(result.receipt);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.openOrders }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.floorPlan }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.report }),
      ]);
      toast.success("Đã thanh toán (mock). Bàn đã trống.");
      closeDrawer();
    },
    onError: (error) => toast.error(isAppError(error) ? error.message : "Không thể thanh toán."),
  });

  if (!paymentOrderId) {
    return (
      <section className="drawer-overlay" data-testid="payment-drawer">
        <header className="drawer-header">
          <div className="title-stack"><h2>Thanh toán</h2></div>
          <div className="header-actions"><Button variant="outlined" onClick={closeDrawer}>Đóng</Button></div>
        </header>
        <div className="drawer-body"><p className="muted" style={{ padding: 16 }}>Không tìm thấy đơn mock.</p></div>
      </section>
    );
  }

  return (
    <section className="drawer-overlay" data-testid="payment-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Thanh toán · Đơn #{order?.orderNo ?? "..."}</h2>
          <p>
            {table ? `Bàn ${table.name}` : order?.orderType === "takeaway" ? "Mang đi" : "—"}
            {" · "}Xác nhận trước khi in biên lai
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={closeDrawer}>Quay lại</Button>
          <Button
            variant="contained"
            data-testid="pay-button"
            disabled={!order || insufficient || payMutation.isPending}
            onClick={() => payMutation.mutate()}
            color={insufficient ? "error" : "primary"}
          >
            {payMutation.isPending ? "Đang xử lý..." : "Hoàn tất"}
          </Button>
        </div>
      </header>

      <div className="drawer-body">
        <div className="payment-three-pane">
          {/* Left: Order info */}
          <aside className="panel payment-info-panel">
            <div className="panel-head">Thông tin đơn</div>
            <div className="panel-scroll payment-info-body">
              <div className="payment-info-row">
                <span>Loại</span>
                <strong>{order?.orderType === "takeaway" ? "Mang đi" : "Dine-in"}</strong>
              </div>
              {table && (
                <div className="payment-info-row">
                  <span>Bàn</span>
                  <strong>{table.name}</strong>
                </div>
              )}
              <div className="payment-info-row">
                <span>Đơn số</span>
                <strong>#{order?.orderNo ?? "—"}</strong>
              </div>
              <div className="payment-info-row">
                <span>Nhân viên</span>
                <strong>{currentEmployee?.name ?? "—"}</strong>
              </div>
              <div className="payment-info-row">
                <span>Ngày</span>
                <strong>{order?.businessDate ?? new Date().toLocaleDateString("vi-VN")}</strong>
              </div>
              <div className="payment-info-divider" />
              <div className="payment-info-row total">
                <span>Tổng cần thu</span>
                <strong className="price-text payment-total-large">{formatVnd(order?.total ?? 0)}</strong>
              </div>
            </div>
          </aside>

          {/* Center: Bill snapshot */}
          <section className="panel">
            <div className="panel-head">Hoá đơn tạm</div>
            <div className="panel-scroll">
              {orderQuery.isLoading ? (
                <p className="muted" style={{ padding: 12 }}>Đang tải đơn...</p>
              ) : (
                <CartSnapshotList order={order} />
              )}
            </div>
          </section>

          {/* Right: Payment panel */}
          <aside className="panel payment-panel">
            <div className="panel-head">Thanh toán</div>
            <div className="panel-scroll payment-panel-body">
              {/* Method segmented */}
              <div className="pay-method-group">
                {(["cash", "qr", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    className={`pay-method-btn ${payMethod === m ? "active" : ""} ${m !== "cash" ? "disabled-method" : ""}`}
                    onClick={() => m === "cash" && setPayMethod(m)}
                    title={m !== "cash" ? "Tính năng sẽ ra sau" : undefined}
                  >
                    {m === "cash" ? "Tiền mặt" : m === "qr" ? "QR / VietQR" : "Chuyển khoản"}
                    {m !== "cash" && <span className="method-soon">Sau</span>}
                  </button>
                ))}
              </div>

              {/* Received amount */}
              <div className="pay-received-section">
                <label className="pay-label">Tiền khách đưa</label>
                <TextField
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(Math.max(0, Number(e.target.value)))}
                  size="small"
                  fullWidth
                  error={insufficient}
                  helperText={insufficient ? "Tiền khách chưa đủ" : " "}
                  inputProps={{ min: 0, step: 1000 }}
                />
              </div>

              {/* Quick cash buttons */}
              <div className="pay-quick-label">Chọn nhanh</div>
              <div className="pay-quick-grid">
                {[
                  { label: "Đúng tiền", value: order?.total ?? 0 },
                  { label: "+10k", value: (order?.total ?? 0) + 10000 },
                  { label: "+20k", value: (order?.total ?? 0) + 20000 },
                  { label: "+50k", value: (order?.total ?? 0) + 50000 },
                  { label: "100k", value: 100000 },
                  { label: "200k", value: 200000 },
                  { label: "500k", value: 500000 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    className={`pay-quick-btn ${receivedAmount === opt.value ? "active" : ""}`}
                    onClick={() => setReceivedAmount(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Change */}
              <div className={`pay-change-card ${insufficient ? "insufficient" : "sufficient"}`}>
                <div className="pay-change-row">
                  <span>Tổng cần thu</span>
                  <strong>{formatVnd(order?.total ?? 0)}</strong>
                </div>
                <div className="pay-change-row">
                  <span>Khách đưa</span>
                  <strong>{formatVnd(receivedAmount)}</strong>
                </div>
                <div className="pay-change-divider" />
                <div className="pay-change-row highlight">
                  <span>{insufficient ? "⚠ Còn thiếu" : "Tiền thối"}</span>
                  <strong className={insufficient ? "text-danger" : "price-text"}>
                    {formatVnd(Math.abs(changeAmount))}
                  </strong>
                </div>
              </div>
            </div>

            {/* Sticky complete button */}
            <div className="pay-footer">
              <Button
                variant="contained"
                fullWidth
                size="large"
                data-testid="pay-button-footer"
                disabled={!order || insufficient || payMutation.isPending}
                onClick={() => payMutation.mutate()}
                sx={{ borderRadius: "8px", fontWeight: 800, fontSize: 16 }}
              >
                {payMutation.isPending ? "Đang xử lý..." : "Hoàn tất thanh toán"}
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function MenuEditorDrawer() {
  const ports = usePorts();
  const menuQuery = useQuery({ queryKey: orderQueryKeys.menu, queryFn: () => ports.menu.getMenu() });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  useEffect(() => {
    if (!selectedCategoryId && menuQuery.data?.categories[0]) {
      setSelectedCategoryId(menuQuery.data.categories[0].id);
    }
  }, [menuQuery.data, selectedCategoryId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      ports.menu.saveMenuChanges({
        categories: { created: [], updated: [], deleted: [] },
        menuItems: { created: [], updated: [], deleted: [] },
        optionGroups: { created: [], updated: [], deleted: [] },
        optionValues: { created: [], updated: [], deleted: [] },
      }),
    onSuccess: () => toast.success("Đã lưu changeset menu mock."),
  });

  const menu = menuQuery.data;
  const items = menu?.menuItems.filter((item) => item.categoryId === selectedCategoryId) ?? [];
  const selectedItem = items[0];

  return (
    <EditorDrawer title="Menu Editor" subtitle="Changeset created / updated / deleted" testId="menu-editor">
      <div className="three-pane">
        <aside className="pane">
          <div className="pane-head">Category</div>
          <div className="pane-scroll">
            <div className="category-list">
              {menu?.categories.map((category) => (
                <button
                  className={`category-button ${category.id === selectedCategoryId ? "active" : ""}`}
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="pane">
          <div className="pane-head">Món</div>
          <div className="pane-scroll editor-table">
            {items.map((item) => (
              <div className="table-row-card" key={item.id}>
                <strong>{item.name}</strong>
                <span>{formatVnd(item.price)}</span>
                <span>{menu?.optionGroups.filter((group) => group.menuItemId === item.id).map((group) => group.name).join(", ") || "Không option"}</span>
                <span className="status-pill">{item.isAvailable ? "Bán" : "Tạm hết"}</span>
              </div>
            ))}
          </div>
        </section>
        <aside className="pane">
          <div className="pane-head">
            Thuộc tính
            <Button data-testid="save-menu-button" variant="contained" size="small" startIcon={<Save size={14} />} onClick={() => saveMutation.mutate()}>
              Save
            </Button>
          </div>
          <div className="pane-scroll editor-card">
            <TextField label="Tên món" value={selectedItem?.name ?? ""} size="small" />
            <TextField label="Giá" value={selectedItem?.price ?? ""} size="small" />
            <TextField label="Nhóm option" value={selectedItem ? "Size, đường, đá" : ""} size="small" />
            <p className="muted">Save gửi changeset; deleted là tombstone, không hard-delete.</p>
          </div>
        </aside>
      </div>
    </EditorDrawer>
  );
}

function FloorEditorDrawer() {
  const ports = usePorts();
  const floorQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
  const activeAreaId = useAppStore((state) => state.activeAreaId);
  const setActiveAreaId = useAppStore((state) => state.setActiveAreaId);
  const [selectedTableId, setSelectedTableId] = useState<string>("");

  const saveMutation = useMutation({
    mutationFn: () =>
      ports.floorPlan.saveFloorPlan({
        areas: { created: [], updated: [], deleted: [] },
        tables: { created: [], updated: [], deleted: [] },
        decorItems: { created: [], updated: [], deleted: [] },
      }),
    onSuccess: () => toast.success("Đã lưu layout/decor mock."),
  });

  const floorPlan = floorQuery.data;
  const areaId = activeAreaId ?? floorPlan?.areas[0]?.id ?? "";
  const tables = floorPlan?.tables.filter((table) => table.areaId === areaId) ?? [];
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? tables[0];

  return (
    <EditorDrawer title="Floor-Plan Editor" subtitle="Layout/decor only, không ghi đè status" testId="floor-editor">
      <div className="three-pane">
        <aside className="pane">
          <div className="pane-head">Khu/tầng</div>
          <div className="pane-scroll">
            <div className="category-list">
              {floorPlan?.areas.map((area) => (
                <button
                  className={`category-button ${area.id === areaId ? "active" : ""}`}
                  key={area.id}
                  onClick={() => setActiveAreaId(area.id)}
                >
                  {area.name}
                </button>
              ))}
              <span className="status-pill">Decor built-in</span>
            </div>
          </div>
        </aside>
        <section className="pane">
          <div className="pane-head">Canvas 1600x900</div>
          <div className="pane-scroll">
            <div className="floor-stage">
              {floorPlan?.decorItems
                .filter((decor) => decor.areaId === areaId)
                .map((decor) => (
                  <div className="decor-node" key={decor.id} style={stageStyle(decor.posX, decor.posY, decor.width, decor.height)}>
                    {decor.assetKey}
                  </div>
                ))}
              {tables.map((table) => (
                <button
                  className={`table-node ${table.status === "occupied" ? "occupied" : ""} ${table.id === selectedTable?.id ? "selected" : ""}`}
                  key={table.id}
                  style={stageStyle(table.posX, table.posY, table.width, table.height)}
                  onClick={() => setSelectedTableId(table.id)}
                >
                  {table.name}
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside className="pane">
          <div className="pane-head">
            Thuộc tính
            <Button data-testid="save-floor-button" variant="contained" size="small" startIcon={<Save size={14} />} onClick={() => saveMutation.mutate()}>
              Save
            </Button>
          </div>
          <div className="pane-scroll editor-card">
            <TextField label="Tên" value={selectedTable?.name ?? ""} size="small" />
            <TextField label="Toạ độ" value={selectedTable ? `x ${selectedTable.posX} · y ${selectedTable.posY}` : ""} size="small" />
            <TextField label="Status" value={selectedTable?.status ?? ""} size="small" />
            <p className="muted">Floor save chỉ ghi layout/decor, không ghi đè trạng thái bàn.</p>
          </div>
        </aside>
      </div>
    </EditorDrawer>
  );
}

function ReportSettingsDrawer() {
  const ports = usePorts();
  const reportQuery = useQuery({ queryKey: orderQueryKeys.report, queryFn: () => ports.report.getCoreReport({ businessDate: "2026-06-11" }) });
  const settingsQuery = useQuery({ queryKey: orderQueryKeys.settings, queryFn: () => ports.settings.getSettings() });
  const currentEmployee = useAppStore((state) => state.currentEmployee);

  const updateSettingsMutation = useMutation({
    mutationFn: () => ports.settings.updateSettings({ billFooter: "Cảm ơn quý khách." }),
    onSuccess: () => toast.success("Đã lưu cài đặt mock."),
  });

  const clearDemoMutation = useMutation({
    mutationFn: () => ports.settings.clearDemoData(currentEmployee!.id),
    onError: (error) => toast.error(isAppError(error) ? error.message : "Không thể clear demo."),
  });

  const report = reportQuery.data;
  const settings = settingsQuery.data;

  return (
    <EditorDrawer title="Báo cáo hôm nay" subtitle="Chỉ tính paid order, loại void" testId="report-settings">
      <div className="two-pane">
        <section className="panel">
          <div className="panel-head">Dashboard</div>
          <div className="panel-scroll">
            <div className="report-grid">
              <div className="metrics-grid">
                <Metric label="Doanh thu" value={formatVnd(report?.revenue ?? 0)} />
                <Metric label="Số đơn" value={`${report?.paidOrders ?? 0}`} />
                <Metric label="Trung bình" value={formatVnd(report?.averageTicket ?? 0)} />
                <Metric label="Top món" value={report?.topItemName ?? "Bạc xỉu"} />
              </div>
              <div className="panel">
                <div className="panel-head">Doanh thu theo giờ</div>
                <div className="panel-scroll">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={report?.hourlyRevenue ?? []}>
                      <XAxis dataKey="label" />
                      <YAxis hide />
                      <Bar dataKey="revenue" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>
        <aside className="panel">
          <div className="panel-head">
            Cài đặt
            <Button variant="contained" size="small" onClick={() => updateSettingsMutation.mutate()}>
              Save
            </Button>
          </div>
          <div className="panel-scroll editor-card">
            <TextField label="Tên cửa hàng" value={settings?.displayName ?? ""} size="small" />
            <TextField label="Timezone" value={settings?.timezone ?? ""} size="small" />
            <TextField label="Bill footer" value={settings?.billFooter ?? ""} size="small" multiline minRows={3} />
            <Button variant="outlined" color="error" onClick={() => clearDemoMutation.mutate()}>
              Clear demo data
            </Button>
          </div>
        </aside>
      </div>
    </EditorDrawer>
  );
}

function EditorDrawer({
  title,
  subtitle,
  testId,
  children,
}: {
  title: string;
  subtitle: string;
  testId: string;
  children: ReactNode;
}) {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  return (
    <section className="drawer-overlay" data-testid={testId}>
      <header className="drawer-header">
        <div className="title-stack">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
      </header>
      <div className="drawer-body">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CartSnapshotList({ order }: { order: OrderDetail | undefined }) {
  if (!order) {
    return <p className="muted">Đang tải đơn...</p>;
  }

  return (
    <div className="editor-table">
      {order.items.map((item) => (
        <div className="cart-item" key={item.id}>
          <div className="cart-line">
            <strong>{item.itemName}</strong>
            <strong>{formatVnd(item.quantity * (item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta, 0)))}</strong>
          </div>
          <span className="muted">x{item.quantity}{item.options.length ? ` · ${item.options.map((option) => option.optionName).join(", ")}` : ""}</span>
        </div>
      ))}
      <div className="metric-card">
        <span>Tổng cần thu</span>
        <strong>{formatVnd(order.total)}</strong>
      </div>
    </div>
  );
}

function snapshotToDraft(item: OrderItemSnapshot): SubmitOrderDraftItem {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    quantity: item.quantity,
    note: item.note ?? null,
    options: item.options.map((option) => ({ id: option.id, optionValueId: option.optionValueId })),
  };
}

function buildCartLines(menu: MenuCatalog, draftItems: SubmitOrderDraftItem[]) {
  return draftItems.map((draft) => {
    const menuItem = menu.menuItems.find((item) => item.id === draft.menuItemId);
    const options = draft.options
      .map((option) => menu.optionValues.find((candidate) => candidate.id === option.optionValueId))
      .filter(Boolean);
    const optionDelta = options.reduce((sum, option) => sum + (option?.priceDelta ?? 0), 0);
    const unitPrice = menuItem?.price ?? 0;

    return {
      id: draft.id,
      name: menuItem?.name ?? "Món không còn hợp lệ",
      quantity: draft.quantity,
      optionText: options.map((option) => option?.name).filter(Boolean).join(", "),
      total: (unitPrice + optionDelta) * draft.quantity,
    };
  });
}

function stageStyle(posX: number, posY: number, width: number, height: number) {
  return {
    left: `${(posX / logicalStage.width) * 100}%`,
    top: `${(posY / logicalStage.height) * 100}%`,
    width: `${(width / logicalStage.width) * 100}%`,
    height: `${(height / logicalStage.height) * 100}%`,
  };
}
