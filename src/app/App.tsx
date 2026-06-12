import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Coffee,
  Copy,
  CreditCard,
  Download,
  Eye,
  Hand,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogIn,
  Magnet,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  QrCode,
  ReceiptText,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Store,
  Trash2,
  Unlock,
  ZoomIn,
  ZoomOut,
  UserCog,
  UserPlus,
  Users,
  Utensils,
} from "lucide-react";
import { Button, TextField, Tooltip } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type {
  DecorKind,
  EmployeeRole,
  FloorPlan,
  FloorTable,
  MenuCatalog,
  MenuItem,
  TableShape,
  TableStatus,
  OrderDetail,
  OrderItemSnapshot,
  OrderSummary,
  SubmitOrderDraftItem,
} from "@/domain";
import { canAccessModule, type AppModule } from "@/core/guards";
import { formatCompactVnd, formatVnd } from "@/core/money";
import { isAppError } from "@/core/appError";
import { usePorts } from "@/ports/portsContext";
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
            active={drawer === "kitchen"}
            icon={<ChefHat size={18} />}
            label="Bếp"
            onClick={() => guardedOpen("kitchen", "kitchen")}
            disabled={!canAccess("kitchen")}
          />
          <RailButton
            active={drawer === "paymentSettings"}
            icon={<QrCode size={18} />}
            label="TT/QR"
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

type TakeawayFilter = "open" | "paid" | "today";

const MOCK_PAID_TAKEAWAY = [
  { id: "tw-paid-1", orderNo: 88, createdAt: "08:30", itemCount: 2, total: 75000, status: "paid" as const, note: null as string | null, employeeName: "Ngân" },
  { id: "tw-paid-2", orderNo: 91, createdAt: "09:15", itemCount: 3, total: 120000, status: "paid" as const, note: "Ít đường" as string | null, employeeName: "Minh" },
  { id: "tw-paid-3", orderNo: 94, createdAt: "10:02", itemCount: 1, total: 45000, status: "paid" as const, note: null as string | null, employeeName: "Admin" },
];

function TakeawayDrawer() {
  const ports = usePorts();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openOrder = useAppStore((state) => state.openOrder);
  const openPayment = useAppStore((state) => state.openPayment);
  const [filter, setFilter] = useState<TakeawayFilter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openOrdersQuery = useQuery({ queryKey: orderQueryKeys.openOrders, queryFn: () => ports.order.listOpenOrders() });
  const takeawayOpen = (openOrdersQuery.data ?? []).filter((o) => o.orderType === "takeaway");

  const detailQuery = useQuery({
    queryKey: orderQueryKeys.order(selectedId),
    queryFn: () => ports.order.getOrder(selectedId!),
    enabled: !!selectedId && filter !== "paid",
  });

  const filterChips: Array<{ key: TakeawayFilter; label: string }> = [
    { key: "open", label: "Đang mở" },
    { key: "paid", label: "Đã thanh toán" },
    { key: "today", label: "Hôm nay" },
  ];

  const timeBuckets = [
    { label: "Sáng (6–11h)" },
    { label: "Trưa (11–14h)" },
    { label: "Chiều (14–18h)" },
    { label: "Tối (18–24h)" },
  ];

  const displayOrders: Array<{ id: string; orderNo: number; total: number; status?: string; createdAt?: string; itemCount?: number; note?: string | null; employeeName?: string }> =
    filter === "open"
      ? takeawayOpen.map((o) => ({ id: o.id, orderNo: o.orderNo, total: o.total }))
      : filter === "paid"
      ? MOCK_PAID_TAKEAWAY
      : [...takeawayOpen.map((o) => ({ id: o.id, orderNo: o.orderNo, total: o.total })), ...MOCK_PAID_TAKEAWAY];

  const selectedPaidOrder = filter !== "open" ? MOCK_PAID_TAKEAWAY.find((o) => o.id === selectedId) : null;

  return (
    <section className="drawer-overlay" data-testid="takeaway-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Đơn mang đi</h2>
          <p><span className="sync-dot" /> {takeawayOpen.length} đơn đang mở · mock</p>
        </div>
        <div className="header-actions">
          <div className="tw-filter-chips">
            {filterChips.map((fc) => (
              <button
                key={fc.key}
                className={`status-chip ${filter === fc.key ? "active" : ""}`}
                onClick={() => { setFilter(fc.key); setSelectedId(null); }}
              >
                {fc.label}
              </button>
            ))}
          </div>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => { closeDrawer(); openOrder({ orderId: null, tableId: null, orderType: "takeaway" }); }}
          >
            Tạo đơn mang đi
          </Button>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="drawer-body">
        <div className="three-pane">
          {/* Left: time buckets */}
          <aside className="pane tw-left-pane">
            <div className="pane-head">Khung giờ</div>
            <div className="pane-scroll">
              <button className="tw-bucket-btn active" onClick={() => setSelectedId(null)}>
                Tất cả ({displayOrders.length})
              </button>
              {timeBuckets.map((bucket) => (
                <button key={bucket.label} className="tw-bucket-btn">
                  {bucket.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Center: order list */}
          <section className="pane">
            <div className="pane-head">
              <span>Danh sách</span>
              <span className="muted">{displayOrders.length} đơn</span>
            </div>
            <div className="pane-scroll">
              {openOrdersQuery.isLoading ? (
                <div className="tw-list-loading">
                  {[1, 2, 3].map((i) => <div key={i} className="tw-skeleton-card" />)}
                </div>
              ) : displayOrders.length === 0 ? (
                <div className="tw-empty-state">
                  <ClipboardList size={32} color="#94a3b8" />
                  <p>Chưa có đơn mang đi đang mở.</p>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => { closeDrawer(); openOrder({ orderId: null, tableId: null, orderType: "takeaway" }); }}
                  >
                    Tạo đơn đầu tiên
                  </Button>
                </div>
              ) : (
                <div className="tw-order-list">
                  {displayOrders.map((ord) => {
                    const isPaid = ord.status === "paid";
                    const isSelected = selectedId === ord.id;
                    return (
                      <div
                        key={ord.id}
                        className={`tw-order-card${isSelected ? " selected" : ""}${isPaid ? " paid" : ""}`}
                        onClick={() => setSelectedId(isSelected ? null : ord.id)}
                      >
                        <div className="tw-card-top">
                          <span className="tw-order-no">#{ord.orderNo}</span>
                          <span className={`tw-status-badge ${isPaid ? "badge-paid" : "badge-open"}`}>
                            {isPaid ? "Đã TT" : "Đang mở"}
                          </span>
                        </div>
                        <div className="tw-card-meta">
                          {ord.createdAt && <span className="muted">{ord.createdAt}</span>}
                          {ord.itemCount !== undefined && <span className="muted">{ord.itemCount} món</span>}
                        </div>
                        <div className="tw-card-total">
                          <strong className="price-text">{formatVnd(ord.total)}</strong>
                        </div>
                        {!isPaid && (
                          <div className="tw-card-actions">
                            <button
                              className="tw-action-btn"
                              onClick={(e) => { e.stopPropagation(); closeDrawer(); openOrder({ orderId: ord.id, tableId: null, orderType: "takeaway" }); }}
                            >
                              Mở đơn
                            </button>
                            <button
                              className="tw-action-btn primary"
                              onClick={(e) => { e.stopPropagation(); closeDrawer(); openPayment(ord.id); }}
                            >
                              Thanh toán
                            </button>
                          </div>
                        )}
                        {isPaid && (
                          <div className="tw-card-actions">
                            <button className="tw-action-btn" onClick={(e) => e.stopPropagation()}>
                              In lại
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: detail */}
          <aside className="pane">
            <div className="pane-head">Chi tiết đơn</div>
            <div className="pane-scroll">
              {!selectedId ? (
                <p className="muted" style={{ padding: 16 }}>Chọn đơn để xem chi tiết.</p>
              ) : selectedPaidOrder ? (
                <div className="tw-detail-body">
                  <div className="tw-detail-row"><span>Đơn số</span><strong>#{selectedPaidOrder.orderNo}</strong></div>
                  <div className="tw-detail-row"><span>Giờ tạo</span><strong>{selectedPaidOrder.createdAt}</strong></div>
                  <div className="tw-detail-row"><span>Nhân viên</span><strong>{selectedPaidOrder.employeeName}</strong></div>
                  <div className="tw-detail-row"><span>Số món</span><strong>{selectedPaidOrder.itemCount} món</strong></div>
                  {selectedPaidOrder.note && <div className="tw-detail-row"><span>Ghi chú</span><strong>{selectedPaidOrder.note}</strong></div>}
                  <div className="tw-detail-divider" />
                  <div className="tw-detail-row total"><span>Tổng</span><strong className="price-text">{formatVnd(selectedPaidOrder.total)}</strong></div>
                  <div className="tw-detail-actions">
                    <Button variant="outlined" size="small" fullWidth onClick={(e) => e.preventDefault()}>In lại</Button>
                  </div>
                </div>
              ) : detailQuery.isLoading ? (
                <p className="muted" style={{ padding: 16 }}>Đang tải...</p>
              ) : detailQuery.data ? (
                <div className="tw-detail-body">
                  <div className="tw-detail-row"><span>Đơn số</span><strong>#{detailQuery.data.orderNo}</strong></div>
                  <div className="tw-detail-row"><span>Ngày</span><strong>{detailQuery.data.businessDate}</strong></div>
                  <div className="tw-detail-divider" />
                  {detailQuery.data.items.map((item) => (
                    <div key={item.id} className="tw-detail-item">
                      <span>{item.itemName} × {item.quantity}</span>
                      <strong>{formatCompactVnd(item.unitPrice * item.quantity)}</strong>
                    </div>
                  ))}
                  <div className="tw-detail-divider" />
                  <div className="tw-detail-row total"><span>Tổng</span><strong className="price-text">{formatVnd(detailQuery.data.total)}</strong></div>
                  <div className="tw-detail-actions">
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<ClipboardList size={15} />}
                      onClick={() => { closeDrawer(); openOrder({ orderId: detailQuery.data!.id, tableId: null, orderType: "takeaway" }); }}
                    >
                      Mở đơn
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<CreditCard size={15} />}
                      onClick={() => { closeDrawer(); openPayment(detailQuery.data!.id); }}
                    >
                      Thanh toán
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ padding: 16 }}>Không tìm thấy đơn.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

type HistoryDateRange = "today" | "7days" | "month" | "custom";
type HistoryStatusFilter = "all" | "paid" | "void" | "open";
type HistoryOrderTypeFilter = "all" | "dine_in" | "takeaway";

interface MockHistoryOrder {
  id: string;
  orderNo: number;
  createdAt: string;
  tableLabel: string;
  orderType: "dine_in" | "takeaway";
  total: number;
  status: "paid" | "void" | "open";
  employeeName: string;
  payMethod: "cash" | "qr" | "bank_transfer" | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}

const MOCK_HISTORY: MockHistoryOrder[] = [
  { id: "h-1", orderNo: 101, createdAt: "08:12", tableLabel: "B01", orderType: "dine_in", total: 95000, status: "paid", employeeName: "Ngân", payMethod: "cash", items: [{ name: "Cà phê sữa", quantity: 2, unitPrice: 35000 }, { name: "Trà đào", quantity: 1, unitPrice: 25000 }] },
  { id: "h-2", orderNo: 102, createdAt: "08:45", tableLabel: "Mang đi", orderType: "takeaway", total: 55000, status: "paid", employeeName: "Minh", payMethod: "cash", items: [{ name: "Bạc xỉu", quantity: 1, unitPrice: 30000 }, { name: "Bánh mì", quantity: 1, unitPrice: 25000 }] },
  { id: "h-3", orderNo: 103, createdAt: "09:10", tableLabel: "B03", orderType: "dine_in", total: 140000, status: "paid", employeeName: "Admin", payMethod: "qr", items: [{ name: "Cà phê đen", quantity: 2, unitPrice: 30000 }, { name: "Sinh tố", quantity: 2, unitPrice: 40000 }] },
  { id: "h-4", orderNo: 104, createdAt: "09:35", tableLabel: "B05", orderType: "dine_in", total: 75000, status: "void", employeeName: "Ngân", payMethod: null, items: [{ name: "Trà sữa", quantity: 3, unitPrice: 25000 }] },
  { id: "h-5", orderNo: 105, createdAt: "10:02", tableLabel: "Mang đi", orderType: "takeaway", total: 45000, status: "paid", employeeName: "Ngân", payMethod: "cash", items: [{ name: "Cà phê sữa", quantity: 1, unitPrice: 35000 }, { name: "Snack", quantity: 1, unitPrice: 10000 }] },
  { id: "h-6", orderNo: 106, createdAt: "10:30", tableLabel: "B02", orderType: "dine_in", total: 120000, status: "paid", employeeName: "Minh", payMethod: "cash", items: [{ name: "Cà phê đen", quantity: 4, unitPrice: 30000 }] },
  { id: "h-7", orderNo: 107, createdAt: "11:15", tableLabel: "B06", orderType: "dine_in", total: 80000, status: "paid", employeeName: "Admin", payMethod: "bank_transfer", items: [{ name: "Matcha latte", quantity: 2, unitPrice: 40000 }] },
  { id: "h-8", orderNo: 108, createdAt: "11:48", tableLabel: "Mang đi", orderType: "takeaway", total: 60000, status: "paid", employeeName: "Ngân", payMethod: "cash", items: [{ name: "Bạc xỉu", quantity: 2, unitPrice: 30000 }] },
  { id: "h-9", orderNo: 109, createdAt: "14:05", tableLabel: "B04", orderType: "dine_in", total: 170000, status: "paid", employeeName: "Minh", payMethod: "qr", items: [{ name: "Cà phê sữa", quantity: 2, unitPrice: 35000 }, { name: "Trà đào", quantity: 2, unitPrice: 25000 }, { name: "Bánh mì", quantity: 2, unitPrice: 25000 }] },
  { id: "h-10", orderNo: 110, createdAt: "15:30", tableLabel: "B07", orderType: "dine_in", total: 90000, status: "void", employeeName: "Ngân", payMethod: null, items: [{ name: "Sinh tố", quantity: 2, unitPrice: 40000 }, { name: "Snack", quantity: 1, unitPrice: 10000 }] },
  { id: "h-11", orderNo: 111, createdAt: "16:20", tableLabel: "Mang đi", orderType: "takeaway", total: 35000, status: "paid", employeeName: "Minh", payMethod: "cash", items: [{ name: "Cà phê đen", quantity: 1, unitPrice: 30000 }, { name: "Snack", quantity: 1, unitPrice: 5000 }] },
  { id: "h-12", orderNo: 112, createdAt: "17:00", tableLabel: "B01", orderType: "dine_in", total: 210000, status: "paid", employeeName: "Admin", payMethod: "cash", items: [{ name: "Matcha latte", quantity: 3, unitPrice: 40000 }, { name: "Trà sữa", quantity: 2, unitPrice: 25000 }, { name: "Bánh mì", quantity: 2, unitPrice: 20000 }] },
];

const PAY_METHOD_LABEL: Record<string, string> = { cash: "Tiền mặt", qr: "QR / VietQR", bank_transfer: "Chuyển khoản" };

function OrderHistoryDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const [dateRange, setDateRange] = useState<HistoryDateRange>("today");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<HistoryOrderTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const filtered = MOCK_HISTORY.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (orderTypeFilter !== "all" && o.orderType !== orderTypeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!String(o.orderNo).includes(q) && !o.tableLabel.toLowerCase().includes(q) && !o.employeeName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = MOCK_HISTORY.find((o) => o.id === selectedId) ?? null;

  const dateRangeChips: Array<{ key: HistoryDateRange; label: string }> = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày" },
    { key: "month", label: "Tháng này" },
    { key: "custom", label: "Tuỳ chọn" },
  ];

  const statusChips: Array<{ key: HistoryStatusFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "paid", label: "Đã TT" },
    { key: "void", label: "Đã huỷ" },
    { key: "open", label: "Đang mở" },
  ];

  const orderTypeChips: Array<{ key: HistoryOrderTypeFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "dine_in", label: "Dine-in" },
    { key: "takeaway", label: "Mang đi" },
  ];

  const handleFilterChange = () => { setPage(1); setSelectedId(null); };

  const statusBadgeClass = (status: string) =>
    status === "paid" ? "hx-badge paid" : status === "void" ? "hx-badge void" : "hx-badge open";
  const statusLabel = (s: string) => s === "paid" ? "Đã TT" : s === "void" ? "Đã huỷ" : "Đang mở";

  return (
    <section className="drawer-overlay" data-testid="order-history-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Lịch sử đơn</h2>
          <p><span className="sync-dot" />{filtered.length} đơn · mock</p>
        </div>
        <div className="header-actions hx-header-actions">
          <div className="hx-date-chips">
            {dateRangeChips.map((dc) => (
              <button
                key={dc.key}
                className={`status-chip ${dateRange === dc.key ? "active" : ""}`}
                onClick={() => { setDateRange(dc.key); handleFilterChange(); }}
              >
                {dc.label}
              </button>
            ))}
          </div>
          <TextField
            size="small"
            placeholder="Tìm mã đơn / bàn / NV..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
            sx={{ maxWidth: 200 }}
            inputProps={{ "data-testid": "history-search" }}
          />
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="drawer-body">
        <div className="three-pane">
          {/* Left: filter pane */}
          <aside className="pane hx-filter-pane">
            <div className="pane-head">Lọc</div>
            <div className="pane-scroll">
              <div className="hx-filter-section">
                <div className="hx-filter-label">Trạng thái</div>
                {statusChips.map((sc) => (
                  <button
                    key={sc.key}
                    className={`tw-bucket-btn ${statusFilter === sc.key ? "active" : ""}`}
                    onClick={() => { setStatusFilter(sc.key); handleFilterChange(); }}
                  >
                    {sc.label}
                    <span className="hx-filter-count">
                      {sc.key === "all" ? MOCK_HISTORY.length : MOCK_HISTORY.filter((o) => o.status === sc.key).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="hx-filter-section" style={{ marginTop: 12 }}>
                <div className="hx-filter-label">Loại đơn</div>
                {orderTypeChips.map((oc) => (
                  <button
                    key={oc.key}
                    className={`tw-bucket-btn ${orderTypeFilter === oc.key ? "active" : ""}`}
                    onClick={() => { setOrderTypeFilter(oc.key); handleFilterChange(); }}
                  >
                    {oc.label}
                    <span className="hx-filter-count">
                      {oc.key === "all" ? MOCK_HISTORY.length : MOCK_HISTORY.filter((o) => o.orderType === oc.key).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="hx-filter-section hx-summary-box" style={{ marginTop: 16 }}>
                <div className="hx-filter-label">Tổng hôm nay</div>
                <div className="hx-summary-row">
                  <span>Doanh thu</span>
                  <strong className="price-text">{formatVnd(MOCK_HISTORY.filter((o) => o.status === "paid").reduce((s, o) => s + o.total, 0))}</strong>
                </div>
                <div className="hx-summary-row">
                  <span>Số đơn TT</span>
                  <strong>{MOCK_HISTORY.filter((o) => o.status === "paid").length}</strong>
                </div>
                <div className="hx-summary-row">
                  <span>Đã huỷ</span>
                  <strong>{MOCK_HISTORY.filter((o) => o.status === "void").length}</strong>
                </div>
              </div>
            </div>
          </aside>

          {/* Center: table list */}
          <section className="pane">
            <div className="pane-head">
              <span>Danh sách đơn</span>
              <span className="muted">{filtered.length} kết quả</span>
            </div>
            <div className="pane-scroll hx-table-pane">
              {filtered.length === 0 ? (
                <div className="tw-empty-state">
                  <ReceiptText size={32} color="#94a3b8" />
                  <p>Hôm nay chưa có đơn nào.</p>
                </div>
              ) : (
                <>
                  {/* Desktop/tablet table */}
                  <table className="hx-table">
                    <thead>
                      <tr>
                        <th>Giờ</th>
                        <th>Mã đơn</th>
                        <th>Bàn / Loại</th>
                        <th>Nhân viên</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((o) => (
                        <tr
                          key={o.id}
                          className={`hx-row${selectedId === o.id ? " selected" : ""}`}
                          onClick={() => setSelectedId(selectedId === o.id ? null : o.id)}
                        >
                          <td className="muted">{o.createdAt}</td>
                          <td><strong>#{o.orderNo}</strong></td>
                          <td>
                            <span className={`hx-type-pill ${o.orderType}`}>
                              {o.orderType === "takeaway" ? "Mang đi" : o.tableLabel}
                            </span>
                          </td>
                          <td>{o.employeeName}</td>
                          <td><strong className="price-text">{formatCompactVnd(o.total)}</strong></td>
                          <td><span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Phone landscape cards */}
                  <div className="hx-card-list">
                    {paginated.map((o) => (
                      <div
                        key={o.id}
                        className={`hx-history-card${selectedId === o.id ? " selected" : ""}`}
                        onClick={() => setSelectedId(selectedId === o.id ? null : o.id)}
                      >
                        <div className="hx-hcard-top">
                          <strong>#{o.orderNo}</strong>
                          <span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span>
                        </div>
                        <div className="hx-hcard-meta">
                          <span className="muted">{o.createdAt}</span>
                          <span className={`hx-type-pill ${o.orderType}`}>{o.orderType === "takeaway" ? "Mang đi" : o.tableLabel}</span>
                          <span className="muted">{o.employeeName}</span>
                        </div>
                        <strong className="price-text">{formatVnd(o.total)}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="hx-pagination">
                      <button className="hx-page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
                      <span className="hx-page-info">Trang {page} / {totalPages}</span>
                      <button className="hx-page-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Sau ›</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Right: detail */}
          <aside className="pane">
            <div className="pane-head">Chi tiết đơn</div>
            <div className="pane-scroll">
              {!selected ? (
                <p className="muted" style={{ padding: 16 }}>Chọn đơn để xem chi tiết.</p>
              ) : (
                <div className="tw-detail-body">
                  <div className="tw-detail-row"><span>Đơn số</span><strong>#{selected.orderNo}</strong></div>
                  <div className="tw-detail-row"><span>Giờ tạo</span><strong>{selected.createdAt}</strong></div>
                  <div className="tw-detail-row">
                    <span>Loại</span>
                    <strong>
                      <span className={`hx-type-pill ${selected.orderType}`}>
                        {selected.orderType === "takeaway" ? "Mang đi" : `Dine-in · ${selected.tableLabel}`}
                      </span>
                    </strong>
                  </div>
                  <div className="tw-detail-row"><span>Nhân viên</span><strong>{selected.employeeName}</strong></div>
                  <div className="tw-detail-row">
                    <span>Trạng thái</span>
                    <strong><span className={statusBadgeClass(selected.status)}>{statusLabel(selected.status)}</span></strong>
                  </div>
                  {selected.payMethod && (
                    <div className="tw-detail-row"><span>Thanh toán</span><strong>{PAY_METHOD_LABEL[selected.payMethod] ?? selected.payMethod}</strong></div>
                  )}
                  <div className="tw-detail-divider" />
                  <div className="hx-filter-label" style={{ marginBottom: 4 }}>Món</div>
                  {selected.items.map((item, i) => (
                    <div key={i} className="tw-detail-item">
                      <span>{item.name} × {item.quantity}</span>
                      <strong>{formatCompactVnd(item.unitPrice * item.quantity)}</strong>
                    </div>
                  ))}
                  <div className="tw-detail-divider" />
                  <div className="tw-detail-row total"><span>Tổng</span><strong className="price-text">{formatVnd(selected.total)}</strong></div>
                  <div className="tw-detail-actions">
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<ReceiptText size={15} />}
                      onClick={() => toast("Đã mở preview hoá đơn (mock).")}
                    >
                      In lại
                    </Button>
                    <Button variant="outlined" size="small" fullWidth onClick={() => setSelectedId(null)}>
                      Đóng chi tiết
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function OrderHistoryStubDrawer() {
  return <OrderHistoryDrawer />;
}

type EmpFilter = "all" | EmployeeRole | "inactive";

interface EmployeeRecord {
  id: string;
  name: string;
  role: EmployeeRole;
  isActive: boolean;
  lastUnlock: string | null;
}

interface EmpForm {
  name: string;
  role: EmployeeRole;
  isActive: boolean;
  newPin: string;
  confirmPin: string;
}

const EMP_ROLE_LABEL: Record<EmployeeRole, string> = { admin: "Admin", cashier: "Thu ngân", kitchen: "Bếp" };
const EMP_ROLE_ORDER: EmployeeRole[] = ["admin", "cashier", "kitchen"];
const EMPTY_EMP_FORM: EmpForm = { name: "", role: "cashier", isActive: true, newPin: "", confirmPin: "" };

const INITIAL_EMPLOYEES: EmployeeRecord[] = [
  { id: "emp-admin", name: "Quản lý", role: "admin", isActive: true, lastUnlock: "Hôm nay · 07:45" },
  { id: "emp-cashier-1", name: "Thu ngân 1", role: "cashier", isActive: true, lastUnlock: "Hôm nay · 08:02" },
  { id: "emp-cashier-2", name: "Thu ngân 2", role: "cashier", isActive: true, lastUnlock: "Hôm qua · 21:10" },
  { id: "emp-kitchen", name: "Bếp", role: "kitchen", isActive: false, lastUnlock: "3 ngày trước" },
];

function empInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function EmployeesDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "employees");

  const [employees, setEmployees] = useState<EmployeeRecord[]>(INITIAL_EMPLOYEES);
  const [filter, setFilter] = useState<EmpFilter>("all");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<EmpForm>(EMPTY_EMP_FORM);
  const [errors, setErrors] = useState<{ name?: string; pin?: string }>({});
  const [discardTarget, setDiscardTarget] = useState<{ target: string | "new" | null } | null>(null);
  const [pinResetTarget, setPinResetTarget] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const selectedRecord =
    typeof selectedId === "string" && selectedId !== "new"
      ? employees.find((e) => e.id === selectedId) ?? null
      : null;

  const isDirty = (() => {
    if (selectedId === "new") {
      return form.name.trim() !== "" || form.newPin !== "" || form.confirmPin !== "";
    }
    if (selectedRecord) {
      return (
        form.name !== selectedRecord.name ||
        form.role !== selectedRecord.role ||
        form.isActive !== selectedRecord.isActive ||
        form.newPin !== "" ||
        form.confirmPin !== ""
      );
    }
    return false;
  })();

  const applySelect = (target: string | "new" | null) => {
    setErrors({});
    setSelectedId(target);
    if (target === "new") {
      setForm(EMPTY_EMP_FORM);
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } else if (target) {
      const rec = employees.find((e) => e.id === target);
      if (rec) setForm({ name: rec.name, role: rec.role, isActive: rec.isActive, newPin: "", confirmPin: "" });
    } else {
      setForm(EMPTY_EMP_FORM);
    }
  };

  const requestSelect = (target: string | "new" | null) => {
    if (target === selectedId) return;
    if (isDirty) {
      setDiscardTarget({ target });
      return;
    }
    applySelect(target);
  };

  const filtered = employees.filter((e) => {
    if (filter === "all") return true;
    if (filter === "inactive") return !e.isActive;
    return e.role === filter && e.isActive;
  });

  const countFor = (f: EmpFilter) =>
    f === "all"
      ? employees.length
      : f === "inactive"
      ? employees.filter((e) => !e.isActive).length
      : employees.filter((e) => e.role === f && e.isActive).length;

  const filterChips: Array<{ key: EmpFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "admin", label: "Admin" },
    { key: "cashier", label: "Thu ngân" },
    { key: "kitchen", label: "Bếp" },
    { key: "inactive", label: "Tạm khoá" },
  ];

  const toggleActive = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    const nextActive = !target.isActive;
    setEmployees((list) => list.map((e) => (e.id === id ? { ...e, isActive: nextActive } : e)));
    if (selectedId === id) setForm((f) => ({ ...f, isActive: nextActive }));
    toast.success(nextActive ? "Đã mở khoá nhân viên (mock)" : "Đã tạm khoá nhân viên (mock)");
  };

  const validate = (): boolean => {
    const next: { name?: string; pin?: string } = {};
    if (!form.name.trim()) next.name = "Tên nhân viên không được để trống.";
    const pinTouched = selectedId === "new" || form.newPin !== "" || form.confirmPin !== "";
    if (pinTouched) {
      if (!/^\d{4,6}$/.test(form.newPin)) next.pin = "PIN phải gồm 4–6 chữ số.";
      else if (form.newPin !== form.confirmPin) next.pin = "Xác nhận PIN không khớp.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (selectedId === "new") {
      const id = `emp-${Date.now()}`;
      const rec: EmployeeRecord = { id, name: form.name.trim(), role: form.role, isActive: form.isActive, lastUnlock: null };
      setEmployees((list) => [...list, rec]);
      setSelectedId(id);
      setForm({ name: rec.name, role: rec.role, isActive: rec.isActive, newPin: "", confirmPin: "" });
    } else if (selectedRecord) {
      setEmployees((list) =>
        list.map((e) =>
          e.id === selectedRecord.id ? { ...e, name: form.name.trim(), role: form.role, isActive: form.isActive } : e,
        ),
      );
      setForm((f) => ({ ...f, newPin: "", confirmPin: "" }));
    }
    setErrors({});
    toast.success("Đã lưu nhân viên (mock)");
  };

  if (!allowed) {
    return (
      <section className="drawer-overlay" data-testid="employees-drawer">
        <header className="drawer-header">
          <div className="title-stack">
            <h2>Quản lý nhân viên</h2>
            <p>Chỉ dành cho quản lý</p>
          </div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="drawer-body emp-forbidden" data-testid="employees-forbidden">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="muted">Tài khoản hiện tại không thể quản lý nhân viên.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="drawer-overlay" data-testid="employees-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Quản lý nhân viên</h2>
          <p><span className="sync-dot" />{employees.length} nhân viên · mock</p>
        </div>
        <div className="header-actions">
          <Button
            variant="contained"
            startIcon={<UserPlus size={16} />}
            data-testid="add-employee-button"
            onClick={() => requestSelect("new")}
          >
            Thêm nhân viên
          </Button>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="drawer-body">
        <div className="three-pane">
          {/* Left: role filters */}
          <aside className="pane">
            <div className="pane-head">Vai trò</div>
            <div className="pane-scroll">
              <div className="category-list">
                {filterChips.map((fc) => (
                  <button
                    key={fc.key}
                    className={`tw-bucket-btn ${filter === fc.key ? "active" : ""}`}
                    onClick={() => setFilter(fc.key)}
                  >
                    {fc.label}
                    <span className="hx-filter-count">{countFor(fc.key)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Center: employee list */}
          <section className="pane">
            <div className="pane-head">
              <span>Nhân viên</span>
              <span className="muted">{filtered.length} người</span>
            </div>
            <div className="pane-scroll">
              {filtered.length === 0 ? (
                <div className="tw-empty-state">
                  <Users size={32} color="#94a3b8" />
                  <p>Chưa có nhân viên.</p>
                </div>
              ) : (
                <div className="emp-list">
                  {filtered.map((emp) => (
                    <div
                      key={emp.id}
                      className={`emp-card${selectedId === emp.id ? " selected" : ""}${emp.isActive ? "" : " inactive"}`}
                      data-testid={`employee-row-${emp.id}`}
                      onClick={() => requestSelect(emp.id)}
                    >
                      <div className="emp-avatar">{empInitials(emp.name)}</div>
                      <div className="emp-card-main">
                        <strong>{emp.name}</strong>
                        <div className="emp-card-meta">
                          <span className="role-pill">{EMP_ROLE_LABEL[emp.role]}</span>
                          <span className={`status-pill${emp.isActive ? " status-active" : ""}`}>
                            {emp.isActive ? "● Đang hoạt động" : "● Tạm khoá"}
                          </span>
                        </div>
                        <span className="emp-last-unlock">Mở khoá: {emp.lastUnlock ?? "Chưa có"}</span>
                      </div>
                      <div className="emp-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="emp-action-btn" title="Sửa" onClick={() => requestSelect(emp.id)}>
                          <Pencil size={15} />
                        </button>
                        <button className="emp-action-btn" title="Đặt lại PIN" onClick={() => setPinResetTarget(emp.id)}>
                          <KeyRound size={15} />
                        </button>
                        <button
                          className="emp-action-btn"
                          title={emp.isActive ? "Tạm khoá" : "Mở khoá"}
                          onClick={() => toggleActive(emp.id)}
                        >
                          {emp.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: detail form */}
          <aside className="pane cart-pane">
            <div className="pane-head">{selectedId === "new" ? "Thêm nhân viên" : "Chi tiết"}</div>
            <div className="pane-scroll">
              {!selectedId ? (
                <p className="muted" style={{ padding: 8 }}>
                  Chọn nhân viên để xem / sửa, hoặc bấm “Thêm nhân viên”.
                </p>
              ) : (
                <div className="emp-form">
                  <TextField
                    label="Tên nhân viên"
                    value={form.name}
                    inputRef={nameInputRef}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      setErrors((er) => ({ ...er, name: undefined }));
                    }}
                    error={!!errors.name}
                    helperText={errors.name}
                    size="small"
                    fullWidth
                    inputProps={{ "data-testid": "employee-name-input" }}
                  />

                  <div className="emp-field">
                    <span className="emp-field-label">Vai trò</span>
                    <div className="emp-segment">
                      {EMP_ROLE_ORDER.map((r) => (
                        <button
                          key={r}
                          className={`emp-segment-btn${form.role === r ? " active" : ""}`}
                          onClick={() => setForm((f) => ({ ...f, role: r }))}
                        >
                          {EMP_ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="emp-field">
                    <span className="emp-field-label">Trạng thái</span>
                    <div className="emp-segment">
                      <button
                        className={`emp-segment-btn${form.isActive ? " active" : ""}`}
                        onClick={() => setForm((f) => ({ ...f, isActive: true }))}
                      >
                        Đang hoạt động
                      </button>
                      <button
                        className={`emp-segment-btn${form.isActive ? "" : " active danger"}`}
                        onClick={() => setForm((f) => ({ ...f, isActive: false }))}
                      >
                        Tạm khoá
                      </button>
                    </div>
                  </div>

                  <div className="emp-pin-section">
                    <div className="emp-field-label">{selectedId === "new" ? "Đặt PIN" : "Đặt lại PIN"}</div>
                    <TextField
                      label="PIN mới"
                      value={form.newPin}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, "").slice(0, 6) }));
                        setErrors((er) => ({ ...er, pin: undefined }));
                      }}
                      size="small"
                      fullWidth
                      inputProps={{ inputMode: "numeric", "data-testid": "employee-pin-input" }}
                    />
                    <TextField
                      label="Xác nhận PIN"
                      value={form.confirmPin}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 6) }));
                        setErrors((er) => ({ ...er, pin: undefined }));
                      }}
                      error={!!errors.pin}
                      helperText={errors.pin || (selectedId === "new" ? "PIN 4–6 chữ số." : "Để trống nếu không đổi PIN.")}
                      size="small"
                      fullWidth
                      inputProps={{ inputMode: "numeric", "data-testid": "employee-confirm-pin-input" }}
                    />
                  </div>
                </div>
              )}
            </div>
            {selectedId && (
              <div className="cart-footer">
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Save size={15} />}
                  data-testid="save-employee-button"
                  onClick={handleSave}
                >
                  Lưu nhân viên
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {discardTarget && (
        <div className="confirm-overlay" onClick={() => setDiscardTarget(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi chưa lưu?</h3>
            <p>Thông tin đang chỉnh sửa sẽ không được lưu.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setDiscardTarget(null)}>Ở lại</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  const t = discardTarget.target;
                  setDiscardTarget(null);
                  applySelect(t);
                }}
              >
                Bỏ thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}

      {pinResetTarget && (
        <div className="confirm-overlay" onClick={() => setPinResetTarget(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Đặt lại PIN?</h3>
            <p>
              Gửi yêu cầu đặt lại PIN cho {employees.find((e) => e.id === pinResetTarget)?.name}. Đây là thao tác mock.
            </p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setPinResetTarget(null)}>Huỷ</Button>
              <Button
                variant="contained"
                onClick={() => {
                  setPinResetTarget(null);
                  toast.success("Đã gửi yêu cầu đặt lại PIN (mock)");
                }}
              >
                Đặt lại PIN
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EmployeesStubDrawer() {
  return <EmployeesDrawer />;
}

type PaymentMethodKey = "cash" | "qr" | "bank" | "other";
interface PaymentForm {
  qrEnabled: boolean;
  bankEnabled: boolean;
  bankName: string;
  accountNo: string;
  accountHolder: string;
  qrInfo: string;
  showQrOnBill: boolean;
}

const INITIAL_PAYMENT: PaymentForm = {
  qrEnabled: false,
  bankEnabled: false,
  bankName: "",
  accountNo: "",
  accountHolder: "",
  qrInfo: '{\n  "provider": "vietqr",\n  "bankBin": "970415",\n  "template": "compact"\n}',
  showQrOnBill: false,
};

function PaymentSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "settings");

  const [base, setBase] = useState<PaymentForm>(INITIAL_PAYMENT);
  const [form, setForm] = useState<PaymentForm>(INITIAL_PAYMENT);
  const [method, setMethod] = useState<PaymentMethodKey>("cash");
  const [mobileTab, setMobileTab] = useState<"nav" | "form" | "preview">("form");
  const [accountError, setAccountError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const patch = (p: Partial<PaymentForm>) => setForm((prev) => ({ ...prev, ...p }));

  const accountValid = (v: string) => /^\d{6,20}$/.test(v.trim());

  const handleSave = () => {
    if (form.bankEnabled && !accountValid(form.accountNo)) {
      setAccountError("Số tài khoản phải gồm 6–20 chữ số.");
      setMethod("bank");
      setMobileTab("form");
      return;
    }
    setAccountError("");
    setBase(form);
    toast.success("Đã lưu cài đặt thanh toán (mock)");
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const methods: Array<{ key: PaymentMethodKey; label: string; on: boolean; disabled?: boolean }> = [
    { key: "cash", label: "Tiền mặt", on: true },
    { key: "qr", label: "QR", on: form.qrEnabled },
    { key: "bank", label: "Chuyển khoản", on: form.bankEnabled },
    { key: "other", label: "Khác", on: false, disabled: true },
  ];

  const tabBtn = (key: "nav" | "form" | "preview", label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  if (!allowed) {
    return (
      <section className="drawer-overlay" data-testid="payment-settings-drawer">
        <header className="drawer-header">
          <div className="title-stack"><h2>Cài đặt thanh toán</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="drawer-body emp-forbidden">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="muted">Tài khoản hiện tại không thể chỉnh cài đặt thanh toán.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="drawer-overlay" data-testid="payment-settings-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Cài đặt thanh toán {dirty && <span className="dirty-badge" data-testid="payment-dirty-badge">Chưa lưu</span>}</h2>
          <p><span className="sync-dot" />Optional · QR/CK mock</p>
        </div>
        <div className="header-actions">
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="contained" startIcon={<Save size={15} />} data-testid="save-payment-button" onClick={handleSave}>
            Lưu mock
          </Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        <div className="menu-tabs">
          {tabBtn("nav", "Phương thức")}
          {tabBtn("form", "Cấu hình")}
          {tabBtn("preview", "Xem trước")}
        </div>

        <div className="menu-three-pane rp-three-pane">
          {/* Left: methods nav */}
          <aside className={`pane menu-pane${mobileTab === "nav" ? " tab-active" : ""}`}>
            <div className="pane-head">Phương thức</div>
            <div className="pane-scroll">
              <div className="menu-cat-list">
                {methods.map((m) => (
                  <button
                    key={m.key}
                    className={`tw-bucket-btn pay-method-row ${method === m.key ? "active" : ""}${m.disabled ? " disabled" : ""}`}
                    onClick={() => { if (!m.disabled) { setMethod(m.key); setMobileTab("form"); } }}
                  >
                    <span className={`pay-dot${m.on ? " on" : ""}`} />
                    {m.label}
                    {m.disabled ? <span className="pay-soon">Sau MVP</span> : <span className="hx-filter-count">{m.on ? "Bật" : "Tắt"}</span>}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Center: form config */}
          <section className={`pane menu-pane${mobileTab === "form" ? " tab-active" : ""}`}>
            <div className="pane-head">{methods.find((m) => m.key === method)?.label}</div>
            <div className="pane-scroll menu-props">
              {method === "cash" ? (
                <>
                  <div className="fe-status-row">
                    <span className="emp-field-label">Tiền mặt</span>
                    <span className="status-pill status-active">● Luôn bật</span>
                  </div>
                  <p className="muted">Tiền mặt luôn bật cho POS. Không thể tắt trong bản mock.</p>
                </>
              ) : method === "qr" ? (
                <>
                  <div className="menu-field">
                    <span className="emp-field-label">Kích hoạt QR</span>
                    <div className="emp-segment">
                      <button className={`emp-segment-btn${form.qrEnabled ? " active" : ""}`} onClick={() => patch({ qrEnabled: true })}>Bật</button>
                      <button className={`emp-segment-btn${form.qrEnabled ? "" : " active danger"}`} onClick={() => patch({ qrEnabled: false })}>Tắt</button>
                    </div>
                  </div>
                  <TextField
                    label="QR info (JSON mock)"
                    value={form.qrInfo}
                    onChange={(e) => patch({ qrInfo: e.target.value })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={4}
                    disabled={!form.qrEnabled}
                    inputProps={{ "data-testid": "qr-info-input" }}
                  />
                  <button className={`menu-chip-toggle${form.showQrOnBill ? " on" : ""}`} disabled={!form.qrEnabled} onClick={() => patch({ showQrOnBill: !form.showQrOnBill })}>
                    {form.showQrOnBill ? "✓ Hiện QR trên hoá đơn" : "Hiện QR trên hoá đơn"}
                  </button>
                  <p className="muted">QR chỉ là placeholder mock, không tạo mã thật.</p>
                </>
              ) : method === "bank" ? (
                <>
                  <div className="menu-field">
                    <span className="emp-field-label">Kích hoạt chuyển khoản</span>
                    <div className="emp-segment">
                      <button className={`emp-segment-btn${form.bankEnabled ? " active" : ""}`} onClick={() => patch({ bankEnabled: true })}>Bật</button>
                      <button className={`emp-segment-btn${form.bankEnabled ? "" : " active danger"}`} onClick={() => patch({ bankEnabled: false })}>Tắt</button>
                    </div>
                  </div>
                  <TextField label="Ngân hàng" value={form.bankName} onChange={(e) => patch({ bankName: e.target.value })} size="small" fullWidth disabled={!form.bankEnabled} />
                  <TextField
                    label="Số tài khoản"
                    value={form.accountNo}
                    onChange={(e) => { patch({ accountNo: e.target.value.replace(/[^\d]/g, "") }); setAccountError(""); }}
                    error={!!accountError || (form.bankEnabled && form.accountNo !== "" && !accountValid(form.accountNo))}
                    helperText={accountError || (form.bankEnabled && form.accountNo !== "" && !accountValid(form.accountNo) ? "Số tài khoản 6–20 chữ số." : "")}
                    size="small"
                    fullWidth
                    disabled={!form.bankEnabled}
                    inputProps={{ inputMode: "numeric", "data-testid": "account-no-input" }}
                  />
                  <TextField label="Chủ tài khoản" value={form.accountHolder} onChange={(e) => patch({ accountHolder: e.target.value })} size="small" fullWidth disabled={!form.bankEnabled} />
                </>
              ) : (
                <div className="tw-empty-state">
                  <CreditCard size={30} color="#94a3b8" />
                  <p>Phương thức khác — <strong>Sau MVP</strong>.</p>
                </div>
              )}
            </div>
          </section>

          {/* Right: preview */}
          <aside className={`pane menu-pane${mobileTab === "preview" ? " tab-active" : ""}`}>
            <div className="pane-head">Xem trước hoá đơn</div>
            <div className="pane-scroll">
              <div className="set-receipt">
                <strong className="set-receipt-name">POS Demo</strong>
                <span className="set-receipt-addr">01 Demo Street</span>
                <div className="set-receipt-divider" />
                <div className="set-receipt-line"><span>Cà phê sữa × 2</span><span>58.000</span></div>
                <div className="set-receipt-line"><span>Trà đào × 1</span><span>42.000</span></div>
                <div className="set-receipt-divider" />
                <div className="set-receipt-line total"><strong>Tổng</strong><strong>100.000đ</strong></div>

                <div className="pay-pre-methods">
                  <span className="kq-station-tag drink">Tiền mặt</span>
                  {form.qrEnabled && <span className="kq-station-tag drink">QR</span>}
                  {form.bankEnabled && <span className="kq-station-tag food">Chuyển khoản</span>}
                </div>

                {form.bankEnabled && (form.bankName || form.accountNo) && (
                  <div className="pay-bank-box">
                    <strong>{form.bankName || "Ngân hàng"}</strong>
                    <span>{form.accountNo || "Số tài khoản"}</span>
                    <span>{form.accountHolder || "Chủ tài khoản"}</span>
                  </div>
                )}

                {form.qrEnabled && form.showQrOnBill && (
                  <div className="pay-qr-placeholder" data-testid="pay-qr-preview">
                    <QrCode size={64} />
                    <span>QR mô phỏng</span>
                  </div>
                )}

                <div className="set-receipt-footer">Cảm ơn quý khách</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {confirmCancel && (
        <div className="confirm-overlay" onClick={() => setConfirmCancel(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi?</h3>
            <p>Các chỉnh sửa thanh toán chưa lưu sẽ bị huỷ.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type KitchenStatus = "waiting" | "done";
type KitchenStation = "drink" | "food";
type KitchenStationFilter = "all" | KitchenStation;
type KitchenStatusFilter = "waiting" | "done" | "all";

interface KitchenItem {
  id: string;
  name: string;
  qty: number;
  station: KitchenStation;
  options: string[];
  note: string | null;
}
interface KitchenTicket {
  id: string;
  orderNo: number;
  target: string;
  type: "dine_in" | "takeaway";
  minutesAgo: number;
  items: KitchenItem[];
}

const KITCHEN_TICKETS: KitchenTicket[] = [
  { id: "kt-1", orderNo: 128, target: "B02", type: "dine_in", minutesAgo: 3, items: [
    { id: "ki-1", name: "Cà phê sữa", qty: 2, station: "drink", options: ["Size L", "Ít đá"], note: "Ít đường" },
    { id: "ki-2", name: "Bạc xỉu", qty: 1, station: "drink", options: ["50% đường"], note: null },
    { id: "ki-3", name: "Croissant", qty: 1, station: "food", options: [], note: "Hâm nóng" },
  ] },
  { id: "kt-2", orderNo: 129, target: "Mang đi", type: "takeaway", minutesAgo: 6, items: [
    { id: "ki-4", name: "Trà đào", qty: 2, station: "drink", options: ["Thêm đào"], note: null },
    { id: "ki-5", name: "Bánh mì que", qty: 3, station: "food", options: [], note: null },
  ] },
  { id: "kt-3", orderNo: 130, target: "B05", type: "dine_in", minutesAgo: 11, items: [
    { id: "ki-6", name: "Matcha latte", qty: 1, station: "drink", options: ["Nóng"], note: null },
    { id: "ki-7", name: "Tiramisu", qty: 2, station: "food", options: [], note: "Cắt đôi" },
  ] },
  { id: "kt-4", orderNo: 131, target: "B07", type: "dine_in", minutesAgo: 1, items: [
    { id: "ki-8", name: "Cold brew", qty: 2, station: "drink", options: [], note: null },
  ] },
  { id: "kt-5", orderNo: 126, target: "B01", type: "dine_in", minutesAgo: 15, items: [
    { id: "ki-9", name: "Cà phê muối", qty: 1, station: "drink", options: [], note: null },
    { id: "ki-10", name: "Khoai tây chiên", qty: 1, station: "food", options: [], note: "Nhiều sốt" },
  ] },
];

const KITCHEN_STATION_LABEL: Record<KitchenStation, string> = { drink: "Pha chế", food: "Bánh" };

function KitchenQueueDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const [statusFilter, setStatusFilter] = useState<KitchenStatusFilter>("waiting");
  const [station, setStation] = useState<KitchenStationFilter>("all");
  const [statusById, setStatusById] = useState<Record<string, KitchenStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"station" | "queue" | "detail">("queue");

  const statusOf = (id: string) => statusById[id] ?? "waiting";
  const markDone = (id: string) => { setStatusById((p) => ({ ...p, [id]: "done" })); toast.success("Đã đánh dấu xong (mock)"); };
  const undoDone = (id: string) => setStatusById((p) => ({ ...p, [id]: "waiting" }));

  const stationItems = (t: KitchenTicket) => (station === "all" ? t.items : t.items.filter((i) => i.station === station));

  const tickets = KITCHEN_TICKETS.filter((t) => {
    const st = statusOf(t.id);
    if (statusFilter === "waiting" && st !== "waiting") return false;
    if (statusFilter === "done" && st !== "done") return false;
    if (station !== "all" && !t.items.some((i) => i.station === station)) return false;
    return true;
  });

  const waitingCount = KITCHEN_TICKETS.filter((t) => statusOf(t.id) === "waiting").length;
  const doneCount = KITCHEN_TICKETS.filter((t) => statusOf(t.id) === "done").length;
  const selected = KITCHEN_TICKETS.find((t) => t.id === selectedId) ?? null;

  const statusChips: Array<{ key: KitchenStatusFilter; label: string; count: number }> = [
    { key: "waiting", label: "Đang chờ", count: waitingCount },
    { key: "done", label: "Đã xong", count: doneCount },
    { key: "all", label: "Tất cả", count: KITCHEN_TICKETS.length },
  ];
  const stationChips: Array<{ key: KitchenStationFilter; label: string; count: number }> = [
    { key: "all", label: "Tất cả", count: KITCHEN_TICKETS.length },
    { key: "drink", label: "Pha chế", count: KITCHEN_TICKETS.filter((t) => t.items.some((i) => i.station === "drink")).length },
    { key: "food", label: "Bánh", count: KITCHEN_TICKETS.filter((t) => t.items.some((i) => i.station === "food")).length },
  ];

  const tabBtn = (key: "station" | "queue" | "detail", label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  const renderItemLine = (i: KitchenItem) => (
    <div className="kq-item" key={i.id}>
      <span className="kq-item-qty">{i.qty}×</span>
      <div className="kq-item-main">
        <strong>{i.name}</strong>
        {i.options.length > 0 && <span className="kq-item-opts">{i.options.join(" · ")}</span>}
        {i.note && <span className="kq-item-note">Ghi chú: {i.note}</span>}
      </div>
      <span className={`kq-station-tag ${i.station}`}>{KITCHEN_STATION_LABEL[i.station]}</span>
    </div>
  );

  return (
    <section className="drawer-overlay" data-testid="kitchen-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Bếp / Pha chế</h2>
          <p><span className="sync-dot" />{waitingCount} vé đang chờ · realtime mock</p>
        </div>
        <div className="header-actions fe-header-actions">
          <div className="fe-area-tabs">
            {statusChips.map((c) => (
              <button key={c.key} className={`status-chip ${statusFilter === c.key ? "active" : ""}`} onClick={() => { setStatusFilter(c.key); setSelectedId(null); }}>
                {c.label} ({c.count})
              </button>
            ))}
          </div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        <div className="menu-tabs">
          {tabBtn("station", "Trạm")}
          {tabBtn("queue", "Hàng chờ")}
          {tabBtn("detail", "Chi tiết")}
        </div>

        <div className="menu-three-pane rp-three-pane">
          {/* Left: station filter */}
          <aside className={`pane menu-pane${mobileTab === "station" ? " tab-active" : ""}`}>
            <div className="pane-head">Trạm</div>
            <div className="pane-scroll">
              <div className="menu-cat-list">
                {stationChips.map((c) => (
                  <button key={c.key} className={`tw-bucket-btn ${station === c.key ? "active" : ""}`} onClick={() => setStation(c.key)}>
                    {c.label}
                    <span className="hx-filter-count">{c.count}</span>
                  </button>
                ))}
              </div>
              <div className="kq-optional-note">
                <ChefHat size={15} />
                <span>Màn bếp là seam tuỳ chọn (optional) cho bản tương lai — hiện chỉ mock cục bộ.</span>
              </div>
            </div>
          </aside>

          {/* Center: queue cards */}
          <section className={`pane menu-pane${mobileTab === "queue" ? " tab-active" : ""}`}>
            <div className="pane-head">
              <span>Hàng chờ</span>
              <span className="muted">{tickets.length} vé</span>
            </div>
            <div className="pane-scroll">
              <div className="kq-offline">⚠ Realtime bếp là mock — cập nhật cục bộ, không đồng bộ thiết bị khác.</div>
              {tickets.length === 0 ? (
                <div className="tw-empty-state">
                  <ChefHat size={32} color="#94a3b8" />
                  <p>{statusFilter === "done" ? "Chưa có món đã xong." : "Không có món đang chờ."}</p>
                </div>
              ) : (
                <div className="kq-list">
                  {tickets.map((t) => {
                    const st = statusOf(t.id);
                    const items = stationItems(t);
                    return (
                      <div
                        key={t.id}
                        className={`kq-card${selectedId === t.id ? " selected" : ""}${st === "done" ? " done" : ""}`}
                        data-testid={`kitchen-ticket-${t.id}`}
                        onClick={() => { setSelectedId(t.id); setMobileTab("detail"); }}
                      >
                        <div className="kq-card-top">
                          <strong>#{t.orderNo}</strong>
                          <span className={`hx-type-pill ${t.type}`}>{t.type === "takeaway" ? "Mang đi" : t.target}</span>
                          <span className={`kq-elapsed${t.minutesAgo >= 10 ? " urgent" : ""}`}>{t.minutesAgo} phút</span>
                        </div>
                        <div className="kq-item-list">
                          {items.map(renderItemLine)}
                        </div>
                        <div className="kq-actions" onClick={(e) => e.stopPropagation()}>
                          <span className="muted">{items.reduce((s, i) => s + i.qty, 0)} món</span>
                          {st === "waiting" ? (
                            <Button variant="contained" size="small" startIcon={<CheckCircle2 size={15} />} data-testid={`kitchen-done-${t.id}`} onClick={() => markDone(t.id)}>
                              Đánh dấu xong
                            </Button>
                          ) : (
                            <Button variant="outlined" size="small" startIcon={<RotateCcw size={15} />} onClick={() => undoDone(t.id)}>
                              Hoàn tác
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: ticket detail */}
          <aside className={`pane menu-pane${mobileTab === "detail" ? " tab-active" : ""}`}>
            <div className="pane-head">Chi tiết vé</div>
            <div className="pane-scroll rp-detail">
              {!selected ? (
                <p className="muted" style={{ padding: 8 }}>Chọn một vé để xem chi tiết.</p>
              ) : (
                <>
                  <div className="rp-detail-card">
                    <div className="rp-card-head">Vé #{selected.orderNo}</div>
                    <div className="tw-detail-row"><span>Nơi nhận</span><strong>{selected.type === "takeaway" ? "Mang đi" : selected.target}</strong></div>
                    <div className="tw-detail-row"><span>Chờ</span><strong>{selected.minutesAgo} phút</strong></div>
                    <div className="tw-detail-row"><span>Trạng thái</span><strong>{statusOf(selected.id) === "done" ? "Đã xong" : "Đang chờ"}</strong></div>
                  </div>
                  <div className="rp-detail-card">
                    <div className="rp-card-head">Món ({selected.items.length})</div>
                    {selected.items.map(renderItemLine)}
                  </div>
                  {statusOf(selected.id) === "waiting" ? (
                    <Button variant="contained" fullWidth startIcon={<CheckCircle2 size={15} />} onClick={() => markDone(selected.id)}>Đánh dấu xong</Button>
                  ) : (
                    <Button variant="outlined" fullWidth startIcon={<RotateCcw size={15} />} onClick={() => undoDone(selected.id)}>Hoàn tác</Button>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

type SettingsSection = "info" | "bill" | "system" | "demo";
interface SettingsForm {
  displayName: string;
  address: string;
  billFooter: string;
}

function GeneralSettingsDrawer() {
  const ports = usePorts();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "settings");
  const settingsQuery = useQuery({ queryKey: orderQueryKeys.settings, queryFn: () => ports.settings.getSettings() });

  const [seeded, setSeeded] = useState(false);
  const [base, setBase] = useState<SettingsForm | null>(null);
  const [form, setForm] = useState<SettingsForm>({ displayName: "", address: "", billFooter: "" });
  const [section, setSection] = useState<SettingsSection>("info");
  const [mobileTab, setMobileTab] = useState<"nav" | "form" | "preview">("form");
  const [nameError, setNameError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const timezone = settingsQuery.data?.timezone ?? "Asia/Saigon";

  useEffect(() => {
    if (settingsQuery.data && !seeded) {
      const f: SettingsForm = {
        displayName: settingsQuery.data.displayName,
        address: settingsQuery.data.address,
        billFooter: settingsQuery.data.billFooter,
      };
      setForm(f);
      setBase(f);
      setSeeded(true);
    }
  }, [settingsQuery.data, seeded]);

  const dirty = !!base && (form.displayName !== base.displayName || form.address !== base.address || form.billFooter !== base.billFooter);

  const patch = (p: Partial<SettingsForm>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSave = () => {
    if (!form.displayName.trim()) {
      setNameError("Tên hiển thị bắt buộc.");
      setSection("info");
      setMobileTab("form");
      return;
    }
    setBase(form);
    setNameError("");
    toast.success("Đã lưu cài đặt (mock)");
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const sections: Array<{ key: SettingsSection; label: string }> = [
    { key: "info", label: "Thông tin" },
    { key: "bill", label: "Hoá đơn" },
    { key: "system", label: "Hệ thống" },
    { key: "demo", label: "Demo" },
  ];

  const tabBtn = (key: "nav" | "form" | "preview", label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  if (!allowed) {
    return (
      <section className="drawer-overlay" data-testid="settings-drawer">
        <header className="drawer-header">
          <div className="title-stack"><h2>Cài đặt chung</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="drawer-body emp-forbidden">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="muted">Tài khoản hiện tại không thể chỉnh cài đặt.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="drawer-overlay" data-testid="settings-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Cài đặt chung {dirty && <span className="dirty-badge" data-testid="settings-dirty-badge">Chưa lưu</span>}</h2>
          <p><span className="sync-dot" />Cấu hình quán · mock</p>
        </div>
        <div className="header-actions">
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="contained" startIcon={<Save size={15} />} data-testid="save-settings-button" onClick={handleSave}>
            Lưu cài đặt mock
          </Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        {!seeded ? (
          <p className="muted" style={{ padding: 16 }}>Đang tải cài đặt...</p>
        ) : (
          <>
            <div className="menu-tabs">
              {tabBtn("nav", "Mục")}
              {tabBtn("form", "Biểu mẫu")}
              {tabBtn("preview", "Xem trước")}
            </div>

            <div className="menu-three-pane rp-three-pane">
              {/* Left: settings nav */}
              <aside className={`pane menu-pane${mobileTab === "nav" ? " tab-active" : ""}`}>
                <div className="pane-head">Mục cài đặt</div>
                <div className="pane-scroll">
                  <div className="menu-cat-list">
                    {sections.map((s) => (
                      <button
                        key={s.key}
                        className={`tw-bucket-btn ${section === s.key ? "active" : ""}`}
                        onClick={() => { setSection(s.key); setMobileTab("form"); }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Center: form sections */}
              <section className={`pane menu-pane${mobileTab === "form" ? " tab-active" : ""}`}>
                <div className="pane-head">{sections.find((s) => s.key === section)?.label}</div>
                <div className="pane-scroll menu-props">
                  {section === "info" ? (
                    <>
                      <TextField
                        label="Tên hiển thị quán"
                        value={form.displayName}
                        onChange={(e) => { patch({ displayName: e.target.value }); setNameError(""); }}
                        error={!!nameError}
                        helperText={nameError}
                        size="small"
                        fullWidth
                        inputProps={{ "data-testid": "settings-name-input" }}
                      />
                      <TextField label="Địa chỉ" value={form.address} onChange={(e) => patch({ address: e.target.value })} size="small" fullWidth multiline minRows={2} />
                    </>
                  ) : section === "bill" ? (
                    <>
                      <TextField label="Chân hoá đơn (bill footer)" value={form.billFooter} onChange={(e) => patch({ billFooter: e.target.value })} size="small" fullWidth multiline minRows={3} helperText="Hiển thị cuối hoá đơn in." />
                    </>
                  ) : section === "system" ? (
                    <>
                      <TextField label="Múi giờ" value={timezone} size="small" fullWidth disabled />
                      <TextField label="Tiền tệ" value="VND" size="small" fullWidth disabled />
                      <div className="fe-status-row">
                        <span className="emp-field-label">Realtime</span>
                        <span className="status-pill status-active">● mock online</span>
                      </div>
                      <p className="muted">Múi giờ và tiền tệ cố định trong bản mock.</p>
                    </>
                  ) : (
                    <div className="set-demo-box">
                      <strong>Dữ liệu demo</strong>
                      <p className="muted">Chỉ clear dữ liệu seed demo, không xoá dữ liệu do người dùng tự tạo. Đây là thao tác mock.</p>
                      <Button variant="outlined" color="error" startIcon={<Trash2 size={15} />} data-testid="open-clear-demo" onClick={() => setClearOpen(true)}>
                        Clear demo data
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              {/* Right: preview */}
              <aside className={`pane menu-pane${mobileTab === "preview" ? " tab-active" : ""}`}>
                <div className="pane-head">Xem trước hoá đơn</div>
                <div className="pane-scroll">
                  <div className="set-receipt">
                    <strong className="set-receipt-name">{form.displayName || "Tên quán"}</strong>
                    {form.address && <span className="set-receipt-addr">{form.address}</span>}
                    <div className="set-receipt-divider" />
                    <div className="set-receipt-line"><span>Cà phê sữa × 2</span><span>58.000</span></div>
                    <div className="set-receipt-line"><span>Trà đào × 1</span><span>42.000</span></div>
                    <div className="set-receipt-divider" />
                    <div className="set-receipt-line total"><strong>Tổng</strong><strong>100.000đ</strong></div>
                    <div className="set-receipt-footer">{form.billFooter || "Cảm ơn quý khách"}</div>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {confirmCancel && (
        <div className="confirm-overlay" onClick={() => setConfirmCancel(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi?</h3>
            <p>Các chỉnh sửa cài đặt chưa lưu sẽ bị huỷ.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </div>
      )}

      {clearOpen && <ClearDemoDialog onClose={() => setClearOpen(false)} />}
    </section>
  );
}

function ClearDemoDialog({ onClose }: { onClose: () => void }) {
  const ports = usePorts();
  const openOrdersQuery = useQuery({ queryKey: orderQueryKeys.openOrders, queryFn: () => ports.order.listOpenOrders() });
  const openCount = openOrdersQuery.data?.length ?? 0;
  const [simulateClosed, setSimulateClosed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [processing, setProcessing] = useState(false);

  const blocked = openCount > 0 && !simulateClosed;
  const ready = !blocked && confirmText.trim().toUpperCase() === "CLEAR";

  const checklist = ["Menu demo", "Sơ đồ bàn demo", "Decor demo", "Cashier demo (deactivate)", "Giữ lại 1 admin"];

  const handleClear = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      toast.success("Đã clear demo data (mock)");
      onClose();
    }, 600);
  };

  return (
    <div className="confirm-overlay" onClick={processing ? undefined : onClose}>
      <div className="confirm-dialog clear-demo-dialog" data-testid="clear-demo-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="clear-demo-head">
          <AlertTriangle size={20} color="#b45309" />
          <h3>Clear demo data</h3>
        </div>
        <p>Thao tác mock này chỉ minh hoạ clear dữ liệu seed demo. Không gọi backend, không xoá record thật.</p>
        <div className="clear-demo-real">
          Trong bản thật: chặn nếu còn đơn đang mở, tombstone menu/sơ đồ/decor demo, deactivate cashier demo, giữ lại 1 admin.
        </div>

        {blocked ? (
          <div className="clear-demo-blocked" data-testid="clear-demo-blocked">
            <strong>Còn {openCount} đơn đang mở</strong>
            <span className="muted">Đóng hết đơn đang mở trước khi clear demo.</span>
            <div className="clear-demo-blocked-actions">
              <Button variant="contained" size="small" onClick={onClose}>Đóng đơn đang mở trước</Button>
              <button className="preauth-link" onClick={() => setSimulateClosed(true)}>(mock) Giả lập đã đóng hết đơn</button>
            </div>
          </div>
        ) : (
          <>
            <ul className="clear-demo-checklist">
              {checklist.map((c) => (
                <li key={c}><CheckCircle2 size={14} color="#0F766E" /> {c}</li>
              ))}
            </ul>
            <TextField
              label='Gõ "CLEAR" để xác nhận'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "clear-demo-confirm-input" }}
            />
          </>
        )}

        <div className="confirm-actions">
          <Button variant="outlined" onClick={onClose} disabled={processing}>Huỷ</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="clear-demo-confirm-button"
            disabled={!ready || processing}
            onClick={handleClear}
          >
            {processing ? "Đang xử lý..." : "Clear demo (mock)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type TableFilter = "all" | "empty" | "occupied";

function FloorWorkspace() {
  const ports = usePorts();
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const activeAreaId = useAppStore((state) => state.activeAreaId);
  const setActiveAreaId = useAppStore((state) => state.setActiveAreaId);
  const openOrder = useAppStore((state) => state.openOrder);
  const openDrawer = useAppStore((state) => state.openDrawer);

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
            onClick={() => openDrawer("takeaway")}
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
                  const isRound = table.shape === "round";
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

interface DraftCategory {
  id: string;
  name: string;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
interface DraftItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
  deleted?: boolean;
  isNew?: boolean;
}
interface DraftGroup {
  id: string;
  menuItemId: string;
  name: string;
  selectType: "single" | "multi";
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}
interface DraftValue {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  deleted?: boolean;
  isNew?: boolean;
}

let menuDraftSeq = 0;
const nextDraftId = (prefix: string) => `${prefix}-draft-${Date.now()}-${menuDraftSeq++}`;
const toInt = (raw: string) => {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};
const nextSort = (current: number[]) => (current.length ? Math.max(...current) + 1 : 1);

type MenuTab = "cat" | "item" | "props";

function MenuEditorDrawer() {
  const ports = usePorts();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const menuQuery = useQuery({ queryKey: orderQueryKeys.menu, queryFn: () => ports.menu.getMenu() });

  const [seeded, setSeeded] = useState(false);
  const [cats, setCats] = useState<DraftCategory[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [values, setValues] = useState<DraftValue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [mobileTab, setMobileTab] = useState<MenuTab>("item");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (menuQuery.data && !seeded) {
      setCats(menuQuery.data.categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })));
      setItems(
        menuQuery.data.menuItems.map((m) => ({
          id: m.id,
          categoryId: m.categoryId,
          name: m.name,
          price: m.price,
          sortOrder: m.sortOrder,
          isAvailable: m.isAvailable,
        })),
      );
      setGroups(
        menuQuery.data.optionGroups.map((g) => ({
          id: g.id,
          menuItemId: g.menuItemId,
          name: g.name,
          selectType: g.selectType,
          isRequired: g.isRequired,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: g.sortOrder,
        })),
      );
      setValues(
        menuQuery.data.optionValues.map((v) => ({
          id: v.id,
          optionGroupId: v.optionGroupId,
          name: v.name,
          priceDelta: v.priceDelta,
          sortOrder: v.sortOrder,
        })),
      );
      setSelectedCategoryId(menuQuery.data.categories[0]?.id ?? "");
      setSeeded(true);
    }
  }, [menuQuery.data, seeded]);

  const touch = () => setDirty(true);

  // --- Category ops ---
  const addCategory = () => {
    const id = nextDraftId("cat");
    setCats((list) => [...list, { id, name: "Danh mục mới", sortOrder: nextSort(list.map((c) => c.sortOrder)), isNew: true }]);
    setSelectedCategoryId(id);
    setSelectedItemId(null);
    setMobileTab("props");
    touch();
  };
  const patchCategory = (id: string, patch: Partial<DraftCategory>) => {
    setCats((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    touch();
  };
  const toggleDeleteCategory = (id: string) => {
    setCats((list) => list.map((c) => (c.id === id ? { ...c, deleted: !c.deleted } : c)));
    touch();
  };
  const moveCategory = (id: string, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((c) => c.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setCats((list) =>
      list.map((c) => (c.id === a.id ? { ...c, sortOrder: b.sortOrder } : c.id === b.id ? { ...c, sortOrder: a.sortOrder } : c)),
    );
    touch();
  };

  // --- Item ops ---
  const addItem = () => {
    if (!selectedCategoryId) return;
    const id = nextDraftId("mi");
    setItems((list) => [
      ...list,
      {
        id,
        categoryId: selectedCategoryId,
        name: "",
        price: 0,
        sortOrder: nextSort(list.filter((i) => i.categoryId === selectedCategoryId).map((i) => i.sortOrder)),
        isAvailable: true,
        isNew: true,
      },
    ]);
    setSelectedItemId(id);
    setMobileTab("props");
    touch();
  };
  const patchItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    touch();
  };
  const toggleDeleteItem = (id: string) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, deleted: !i.deleted } : i)));
    touch();
  };

  // --- Option group ops ---
  const addGroup = (itemId: string) => {
    const id = nextDraftId("og");
    setGroups((list) => [
      ...list,
      {
        id,
        menuItemId: itemId,
        name: "Nhóm tuỳ chọn",
        selectType: "single",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        sortOrder: nextSort(list.filter((g) => g.menuItemId === itemId).map((g) => g.sortOrder)),
        isNew: true,
      },
    ]);
    touch();
  };
  const patchGroup = (id: string, patch: Partial<DraftGroup>) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    touch();
  };
  const toggleDeleteGroup = (id: string) => {
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, deleted: !g.deleted } : g)));
    touch();
  };

  // --- Option value ops ---
  const addValue = (groupId: string) => {
    const id = nextDraftId("ov");
    setValues((list) => [
      ...list,
      { id, optionGroupId: groupId, name: "Giá trị mới", priceDelta: 0, sortOrder: nextSort(list.filter((v) => v.optionGroupId === groupId).map((v) => v.sortOrder)), isNew: true },
    ]);
    touch();
  };
  const patchValue = (id: string, patch: Partial<DraftValue>) => {
    setValues((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    touch();
  };
  const toggleDeleteValue = (id: string) => {
    setValues((list) => list.map((v) => (v.id === id ? { ...v, deleted: !v.deleted } : v)));
    touch();
  };

  // --- Derived ---
  const sortedCats = [...cats].sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedCategory = cats.find((c) => c.id === selectedCategoryId) ?? null;
  const catItems = items.filter((i) => i.categoryId === selectedCategoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const itemGroups = selectedItem ? groups.filter((g) => g.menuItemId === selectedItem.id).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const groupValues = (gid: string) => values.filter((v) => v.optionGroupId === gid).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCatCount = cats.filter((c) => !c.deleted).length;
  const activeItemCount = items.filter((i) => !i.deleted).length;

  const handleSave = () => {
    const badItem = items.find((i) => !i.deleted && (!i.name.trim() || i.price < 0));
    if (badItem) {
      setSelectedCategoryId(badItem.categoryId);
      setSelectedItemId(badItem.id);
      setMobileTab("props");
      toast.error("Kiểm tra lại: tên món bắt buộc, giá ≥ 0.");
      return;
    }
    const badGroup = groups.find((g) => !g.deleted && g.maxSelect < g.minSelect);
    if (badGroup) {
      setSelectedItemId(badGroup.menuItemId);
      setMobileTab("props");
      toast.error("Nhóm tuỳ chọn: số chọn tối đa phải ≥ tối thiểu.");
      return;
    }
    toast.success("Đã lưu menu (mock)");
    setDirty(false);
  };

  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const tabBtn = (key: MenuTab, label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  return (
    <section className="drawer-overlay" data-testid="menu-editor">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>
            Menu Editor {dirty && <span className="dirty-badge" data-testid="menu-dirty-badge">Chưa lưu</span>}
          </h2>
          <p>
            <span className="sync-dot" />
            {activeCatCount} danh mục · {activeItemCount} món · mock
          </p>
        </div>
        <div className="header-actions">
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="outlined" startIcon={<Eye size={15} />} onClick={() => setPreview((p) => !p)}>
            {preview ? "Thoát xem trước" : "Xem trước"}
          </Button>
          <Button variant="contained" startIcon={<Save size={15} />} data-testid="save-menu-button" onClick={handleSave}>
            Lưu mock
          </Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        {!seeded ? (
          <p className="muted" style={{ padding: 16 }}>Đang tải menu...</p>
        ) : (
          <>
            <div className="menu-tabs">
              {tabBtn("cat", "Danh mục")}
              {tabBtn("item", "Món")}
              {tabBtn("props", "Thuộc tính")}
            </div>

            <div className="menu-three-pane">
              {/* Left: categories */}
              <aside className={`pane menu-pane${mobileTab === "cat" ? " tab-active" : ""}`}>
                <div className="pane-head">
                  <span>Danh mục</span>
                  <button className="menu-mini-btn" title="Thêm danh mục" data-testid="add-category-button" onClick={addCategory}>
                    <Plus size={14} />
                  </button>
                </div>
                <div className="pane-scroll">
                  {sortedCats.length === 0 ? (
                    <div className="tw-empty-state">
                      <Coffee size={30} color="#94a3b8" />
                      <p>Chưa có danh mục.</p>
                      <Button size="small" variant="contained" onClick={addCategory}>Thêm danh mục</Button>
                    </div>
                  ) : (
                    <div className="menu-cat-list">
                      {sortedCats.map((c, idx) => (
                        <div
                          key={c.id}
                          className={`menu-cat-row${c.id === selectedCategoryId ? " active" : ""}${c.deleted ? " deleted" : ""}`}
                          onClick={() => { setSelectedCategoryId(c.id); setSelectedItemId(null); }}
                        >
                          <div className="menu-cat-main">
                            <strong>{c.name || "(chưa đặt tên)"}</strong>
                            <span className="muted">{items.filter((i) => i.categoryId === c.id && !i.deleted).length} món</span>
                          </div>
                          <div className="menu-cat-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="menu-mini-btn" disabled={idx === 0} onClick={() => moveCategory(c.id, -1)}>↑</button>
                            <button className="menu-mini-btn" disabled={idx === sortedCats.length - 1} onClick={() => moveCategory(c.id, 1)}>↓</button>
                            <button className="menu-mini-btn" title={c.deleted ? "Khôi phục" : "Xoá"} onClick={() => toggleDeleteCategory(c.id)}>
                              {c.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>

              {/* Center: items / preview */}
              <section className={`pane menu-pane${mobileTab === "item" ? " tab-active" : ""}`}>
                <div className="pane-head">
                  <span>{preview ? "Xem trước POS" : "Món trong danh mục"}</span>
                  <span className="muted">{catItems.filter((i) => !i.deleted).length} món</span>
                </div>
                <div className="pane-scroll">
                  {!selectedCategoryId ? (
                    <div className="tw-empty-state">
                      <Coffee size={30} color="#94a3b8" />
                      <p>Chọn hoặc thêm danh mục để bắt đầu.</p>
                    </div>
                  ) : preview ? (
                    catItems.filter((i) => !i.deleted).length === 0 ? (
                      <div className="tw-empty-state"><Coffee size={30} color="#94a3b8" /><p>Danh mục chưa có món.</p></div>
                    ) : (
                      <div className="menu-grid">
                        {catItems.filter((i) => !i.deleted).map((it) => (
                          <div key={it.id} className={`menu-preview-card${it.isAvailable ? "" : " soldout"}`}>
                            <div className="menu-item-thumb lg"><Coffee size={22} /></div>
                            <strong>{it.name || "(chưa đặt tên)"}</strong>
                            <span className="price-text">{formatVnd(it.price)}</span>
                            {!it.isAvailable && <span className="status-pill">Tạm hết</span>}
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="menu-item-grid">
                      {catItems.map((it) => (
                        <div
                          key={it.id}
                          className={`menu-edit-card${it.id === selectedItemId ? " selected" : ""}${it.deleted ? " deleted" : ""}${it.isAvailable ? "" : " soldout"}`}
                          data-testid={`menu-edit-card-${it.id}`}
                          onClick={() => { setSelectedItemId(it.id); setMobileTab("props"); }}
                        >
                          <div className="menu-item-thumb"><Coffee size={18} /></div>
                          <div className="menu-edit-card-body">
                            <strong>{it.name || "(chưa đặt tên)"}</strong>
                            <span className="price-text">{formatVnd(it.price)}</span>
                            <div className="menu-card-tags">
                              <span className="status-pill">{groups.filter((g) => g.menuItemId === it.id && !g.deleted).length} tuỳ chọn</span>
                              <span className={`status-pill${it.isAvailable ? " status-active" : ""}`}>{it.isAvailable ? "Đang bán" : "Tạm hết"}</span>
                            </div>
                          </div>
                          <div className="menu-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="menu-mini-btn wide" onClick={() => patchItem(it.id, { isAvailable: !it.isAvailable })}>
                              {it.isAvailable ? "Tạm hết" : "Mở bán"}
                            </button>
                            <button className="menu-mini-btn" title={it.deleted ? "Khôi phục" : "Xoá"} onClick={() => toggleDeleteItem(it.id)}>
                              {it.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button className="menu-add-card" data-testid="add-item-button" onClick={addItem}>
                        <Plus size={20} />
                        <span>Thêm món</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Right: properties */}
              <aside className={`pane menu-pane${mobileTab === "props" ? " tab-active" : ""}`}>
                <div className="pane-head">Thuộc tính</div>
                <div className="pane-scroll menu-props">
                  {selectedItem ? (
                    <>
                      <TextField
                        label="Tên món"
                        value={selectedItem.name}
                        onChange={(e) => patchItem(selectedItem.id, { name: e.target.value })}
                        error={!selectedItem.name.trim()}
                        helperText={!selectedItem.name.trim() ? "Tên món bắt buộc." : ""}
                        size="small"
                        fullWidth
                        inputProps={{ "data-testid": "menu-item-name-input" }}
                      />
                      <TextField
                        label="Giá (VND)"
                        value={String(selectedItem.price)}
                        onChange={(e) => patchItem(selectedItem.id, { price: toInt(e.target.value) })}
                        size="small"
                        fullWidth
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <div className="menu-field">
                        <span className="emp-field-label">Danh mục</span>
                        <div className="emp-segment">
                          {sortedCats.filter((c) => !c.deleted).map((c) => (
                            <button
                              key={c.id}
                              className={`emp-segment-btn${selectedItem.categoryId === c.id ? " active" : ""}`}
                              onClick={() => patchItem(selectedItem.id, { categoryId: c.id })}
                            >
                              {c.name || "(chưa đặt tên)"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TextField
                        label="Thứ tự"
                        value={String(selectedItem.sortOrder)}
                        onChange={(e) => patchItem(selectedItem.id, { sortOrder: toInt(e.target.value) })}
                        size="small"
                        fullWidth
                        inputProps={{ inputMode: "numeric" }}
                      />
                      <div className="menu-field">
                        <span className="emp-field-label">Trạng thái</span>
                        <div className="emp-segment">
                          <button className={`emp-segment-btn${selectedItem.isAvailable ? " active" : ""}`} onClick={() => patchItem(selectedItem.id, { isAvailable: true })}>Đang bán</button>
                          <button className={`emp-segment-btn${selectedItem.isAvailable ? "" : " active danger"}`} onClick={() => patchItem(selectedItem.id, { isAvailable: false })}>Tạm hết</button>
                        </div>
                      </div>
                      {selectedItem.deleted && (
                        <div className="menu-tombstone">
                          Món đang đánh dấu xoá.
                          <button className="menu-mini-btn" onClick={() => toggleDeleteItem(selectedItem.id)}><RotateCcw size={13} /> Khôi phục</button>
                        </div>
                      )}

                      <div className="menu-section">
                        <div className="menu-section-head">
                          <span>Nhóm tuỳ chọn</span>
                          <button className="menu-mini-btn wide" onClick={() => addGroup(selectedItem.id)}><Plus size={13} /> Nhóm</button>
                        </div>
                        {itemGroups.length === 0 ? (
                          <p className="muted">Chưa có nhóm tuỳ chọn.</p>
                        ) : (
                          itemGroups.map((g) => (
                            <div key={g.id} className={`menu-group-card${g.deleted ? " deleted" : ""}`}>
                              <div className="menu-group-top">
                                <TextField label="Tên nhóm" value={g.name} onChange={(e) => patchGroup(g.id, { name: e.target.value })} size="small" fullWidth />
                                <button className="menu-mini-btn" title={g.deleted ? "Khôi phục" : "Xoá nhóm"} onClick={() => toggleDeleteGroup(g.id)}>
                                  {g.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                                </button>
                              </div>
                              <div className="menu-group-row">
                                <div className="emp-segment">
                                  <button className={`emp-segment-btn${g.selectType === "single" ? " active" : ""}`} onClick={() => patchGroup(g.id, { selectType: "single" })}>Chọn 1</button>
                                  <button className={`emp-segment-btn${g.selectType === "multi" ? " active" : ""}`} onClick={() => patchGroup(g.id, { selectType: "multi" })}>Chọn nhiều</button>
                                </div>
                                <button className={`menu-chip-toggle${g.isRequired ? " on" : ""}`} onClick={() => patchGroup(g.id, { isRequired: !g.isRequired })}>
                                  {g.isRequired ? "Bắt buộc" : "Tuỳ chọn"}
                                </button>
                              </div>
                              <div className="menu-minmax">
                                <TextField label="Tối thiểu" value={String(g.minSelect)} onChange={(e) => patchGroup(g.id, { minSelect: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                                <TextField
                                  label="Tối đa"
                                  value={String(g.maxSelect)}
                                  onChange={(e) => patchGroup(g.id, { maxSelect: toInt(e.target.value) })}
                                  error={g.maxSelect < g.minSelect}
                                  helperText={g.maxSelect < g.minSelect ? "≥ tối thiểu" : ""}
                                  size="small"
                                  inputProps={{ inputMode: "numeric" }}
                                />
                              </div>
                              <div className="menu-values">
                                {groupValues(g.id).map((v) => (
                                  <div key={v.id} className={`menu-value-row${v.deleted ? " deleted" : ""}`}>
                                    <TextField label="Tên" value={v.name} onChange={(e) => patchValue(v.id, { name: e.target.value })} size="small" />
                                    <TextField label="+Giá" value={String(v.priceDelta)} onChange={(e) => patchValue(v.id, { priceDelta: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                                    <button className="menu-mini-btn" title={v.deleted ? "Khôi phục" : "Xoá"} onClick={() => toggleDeleteValue(v.id)}>
                                      {v.deleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                                    </button>
                                  </div>
                                ))}
                                <button className="menu-mini-btn add-value" onClick={() => addValue(g.id)}><Plus size={12} /> Giá trị</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : selectedCategory ? (
                    <>
                      <TextField label="Tên danh mục" value={selectedCategory.name} onChange={(e) => patchCategory(selectedCategory.id, { name: e.target.value })} size="small" fullWidth />
                      <TextField label="Thứ tự" value={String(selectedCategory.sortOrder)} onChange={(e) => patchCategory(selectedCategory.id, { sortOrder: toInt(e.target.value) })} size="small" fullWidth inputProps={{ inputMode: "numeric" }} />
                      <Button variant="outlined" color={selectedCategory.deleted ? "primary" : "error"} onClick={() => toggleDeleteCategory(selectedCategory.id)}>
                        {selectedCategory.deleted ? "Khôi phục danh mục" : "Xoá danh mục"}
                      </Button>
                      <p className="muted">Chọn một món để chỉnh sửa chi tiết và nhóm tuỳ chọn. Xoá là tombstone, vẫn hoàn tác được.</p>
                    </>
                  ) : (
                    <p className="muted" style={{ padding: 8 }}>Chọn món hoặc danh mục để chỉnh sửa.</p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {confirmCancel && (
        <div className="confirm-overlay" onClick={() => setConfirmCancel(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi?</h3>
            <p>Các chỉnh sửa menu chưa lưu sẽ bị huỷ.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface DraftArea {
  id: string;
  name: string;
  sortOrder: number;
  isNew?: boolean;
}
interface DraftTable {
  id: string;
  areaId: string;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  rotation: number;
  seats: number;
  sortOrder: number;
  status: TableStatus;
  deleted?: boolean;
  isNew?: boolean;
}
interface DraftDecor {
  id: string;
  areaId: string;
  kind: DecorKind;
  label: string | null;
  assetKey: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  isLocked: boolean;
  deleted?: boolean;
  isNew?: boolean;
}

type FloorTab = "tools" | "canvas" | "props";
type FloorTool = "select" | "pan";
type FloorSelection = { type: "table" | "decor"; id: string } | null;

const DECOR_LABEL: Record<DecorKind, string> = {
  wall: "Tường",
  plant: "Cây",
  counter: "Quầy",
  door: "Cửa",
  decor: "Trang trí",
  image: "Ảnh",
};
const DECOR_LIBRARY: DecorKind[] = ["plant", "wall", "counter", "door", "decor"];
const SHAPE_LABEL: Record<TableShape, string> = { round: "Tròn", square: "Vuông", rectangle: "Chữ nhật" };

const tableDefaultSize = (shape: TableShape) =>
  shape === "rectangle" ? { width: 150, height: 90 } : { width: 110, height: 110 };
const decorDefaultSize = (kind: DecorKind) => {
  switch (kind) {
    case "wall": return { width: 300, height: 36 };
    case "counter": return { width: 210, height: 72 };
    case "door": return { width: 52, height: 190 };
    case "plant": return { width: 120, height: 60 };
    default: return { width: 110, height: 110 };
  }
};

function FloorEditorDrawer() {
  const ports = usePorts();
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const floorQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });

  const [seeded, setSeeded] = useState(false);
  const [areas, setAreas] = useState<DraftArea[]>([]);
  const [tables, setTables] = useState<DraftTable[]>([]);
  const [decor, setDecor] = useState<DraftDecor[]>([]);
  const [areaId, setAreaId] = useState("");
  const [tool, setTool] = useState<FloorTool>("select");
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<FloorSelection>(null);
  const [dirty, setDirty] = useState(false);
  const [mobileTab, setMobileTab] = useState<FloorTab>("canvas");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: "table" | "decor"; id: string; offX: number; offY: number } | null>(null);

  useEffect(() => {
    if (floorQuery.data && !seeded) {
      setAreas(floorQuery.data.areas.map((a) => ({ id: a.id, name: a.name, sortOrder: a.sortOrder })));
      setTables(floorQuery.data.tables.map((t) => ({ ...t })));
      setDecor(floorQuery.data.decorItems.map((d) => ({ ...d })));
      setAreaId(floorQuery.data.areas[0]?.id ?? "");
      setSeeded(true);
    }
  }, [floorQuery.data, seeded]);

  const touch = () => setDirty(true);

  // --- Geometry ---
  const toLogical = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 800, y: 450 };
    return { x: ((clientX - rect.left) / rect.width) * 1600, y: ((clientY - rect.top) / rect.height) * 900 };
  };
  const snapVal = (v: number) => (snap ? Math.round(v / 20) * 20 : Math.round(v));
  const nodeStyle = (o: { posX: number; posY: number; width: number; height: number; rotation: number }) => ({
    left: `${(o.posX / 1600) * 100}%`,
    top: `${(o.posY / 900) * 100}%`,
    width: `${(o.width / 1600) * 100}%`,
    height: `${(o.height / 900) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
  });

  // --- Area ops ---
  const sortedAreas = [...areas].sort((a, b) => a.sortOrder - b.sortOrder);
  const addArea = () => {
    const id = nextDraftId("area");
    setAreas((list) => [...list, { id, name: `Khu ${list.length + 1}`, sortOrder: nextSort(list.map((a) => a.sortOrder)), isNew: true }]);
    setAreaId(id);
    setSelected(null);
    touch();
  };

  // --- Table ops ---
  const addTable = (shape: TableShape) => {
    if (!areaId) return;
    const id = nextDraftId("tbl");
    const size = tableDefaultSize(shape);
    const n = tables.filter((t) => t.areaId === areaId && !t.deleted).length + 1;
    const sortOrder = nextSort(tables.filter((t) => t.areaId === areaId).map((t) => t.sortOrder));
    setTables((list) => [
      ...list,
      { id, areaId, name: `B${String(n).padStart(2, "0")}`, posX: 800, posY: 450, ...size, shape, rotation: 0, seats: 4, sortOrder, status: "empty", isNew: true },
    ]);
    setSelected({ type: "table", id });
    setTool("select");
    setMobileTab("props");
    touch();
  };
  const patchTable = (id: string, patch: Partial<DraftTable>) => {
    setTables((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    touch();
  };
  const toggleDeleteTable = (id: string) => {
    setTables((list) => list.map((t) => (t.id === id ? { ...t, deleted: !t.deleted } : t)));
    touch();
  };

  // --- Decor ops ---
  const addDecor = (kind: DecorKind) => {
    if (!areaId) return;
    const id = nextDraftId("dec");
    const size = decorDefaultSize(kind);
    setDecor((list) => [
      ...list,
      { id, areaId, kind, label: DECOR_LABEL[kind], assetKey: `${kind}_mock`, posX: 800, posY: 450, ...size, rotation: 0, zIndex: 1, isLocked: false, isNew: true },
    ]);
    setSelected({ type: "decor", id });
    setTool("select");
    setMobileTab("props");
    touch();
  };
  const patchDecor = (id: string, patch: Partial<DraftDecor>) => {
    setDecor((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    touch();
  };
  const toggleDeleteDecor = (id: string) => {
    setDecor((list) => list.map((d) => (d.id === id ? { ...d, deleted: !d.deleted } : d)));
    touch();
  };

  // --- Drag ---
  const onNodePointerDown = (e: ReactPointerEvent, kind: "table" | "decor", obj: { id: string; posX: number; posY: number; isLocked?: boolean }) => {
    e.stopPropagation();
    setSelected({ type: kind, id: obj.id });
    setMobileTab("props");
    if (tool !== "select" || obj.isLocked) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toLogical(e.clientX, e.clientY);
    dragRef.current = { kind, id: obj.id, offX: p.x - obj.posX, offY: p.y - obj.posY };
  };
  const onNodePointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toLogical(e.clientX, e.clientY);
    const nx = Math.max(0, Math.min(1600, snapVal(p.x - d.offX)));
    const ny = Math.max(0, Math.min(900, snapVal(p.y - d.offY)));
    if (d.kind === "table") patchTable(d.id, { posX: nx, posY: ny });
    else patchDecor(d.id, { posX: nx, posY: ny });
  };
  const onNodePointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
    dragRef.current = null;
  };

  // --- Derived ---
  const areaTables = tables.filter((t) => t.areaId === areaId);
  const areaDecor = decor.filter((d) => d.areaId === areaId);
  const selectedTable = selected?.type === "table" ? tables.find((t) => t.id === selected.id) ?? null : null;
  const selectedDecor = selected?.type === "decor" ? decor.find((d) => d.id === selected.id) ?? null : null;
  const isEmptyArea = areaTables.filter((t) => !t.deleted).length === 0 && areaDecor.filter((d) => !d.deleted).length === 0;

  const handleSave = () => {
    toast.success("Đã lưu layout (mock)");
    setDirty(false);
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const tabBtn = (key: FloorTab, label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  return (
    <section className="drawer-overlay" data-testid="floor-editor">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>
            Floor-Plan Editor {dirty && <span className="dirty-badge" data-testid="floor-dirty-badge">Chưa lưu</span>}
          </h2>
          <p>
            <span className="sync-dot" />
            {areaTables.filter((t) => !t.deleted).length} bàn · trạng thái chỉ hiển thị · mock
          </p>
        </div>
        <div className="header-actions fe-header-actions">
          <div className="fe-area-tabs">
            {sortedAreas.map((a) => (
              <button
                key={a.id}
                className={`status-chip ${a.id === areaId ? "active" : ""}`}
                onClick={() => { setAreaId(a.id); setSelected(null); }}
              >
                {a.name}
              </button>
            ))}
            <button className="status-chip" data-testid="add-area-button" onClick={addArea}>+ Khu</button>
          </div>
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="contained" startIcon={<Save size={15} />} data-testid="save-floor-button" onClick={handleSave}>
            Lưu layout mock
          </Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        {!seeded ? (
          <p className="muted" style={{ padding: 16 }}>Đang tải sơ đồ...</p>
        ) : (
          <>
            <div className="menu-tabs">
              {tabBtn("tools", "Công cụ")}
              {tabBtn("canvas", "Sơ đồ")}
              {tabBtn("props", "Thuộc tính")}
            </div>

            <div className="menu-three-pane fe-three-pane">
              {/* Left: tools/library */}
              <aside className={`pane menu-pane${mobileTab === "tools" ? " tab-active" : ""}`}>
                <div className="pane-head">Công cụ</div>
                <div className="pane-scroll fe-tools">
                  <div className="fe-tool-row">
                    <button className={`menu-mini-btn wide${tool === "select" ? " on" : ""}`} onClick={() => setTool("select")} title="Chọn">
                      <MousePointer2 size={14} /> Chọn
                    </button>
                    <button className={`menu-mini-btn wide${tool === "pan" ? " on" : ""}`} onClick={() => setTool("pan")} title="Di chuyển khung nhìn">
                      <Hand size={14} /> Pan
                    </button>
                  </div>

                  <div className="fe-tool-group">
                    <div className="emp-field-label">Thêm bàn</div>
                    <div className="fe-lib-grid">
                      {(["round", "square", "rectangle"] as TableShape[]).map((shape) => (
                        <button key={shape} className="fe-lib-btn" data-testid={`add-table-${shape}`} onClick={() => addTable(shape)}>
                          <span className={`fe-lib-icon shape-${shape}`} />
                          {SHAPE_LABEL[shape]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fe-tool-group">
                    <div className="emp-field-label">Trang trí</div>
                    <div className="fe-lib-grid">
                      {DECOR_LIBRARY.map((kind) => (
                        <button key={kind} className="fe-lib-btn" onClick={() => addDecor(kind)}>
                          <span className={`fe-lib-icon decor-${kind}`} />
                          {DECOR_LABEL[kind]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fe-tool-group">
                    <div className="emp-field-label">Khung nhìn</div>
                    <div className="fe-tool-row">
                      <button className="menu-mini-btn" title="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}><ZoomOut size={14} /></button>
                      <span className="fe-zoom-label">{Math.round(zoom * 100)}%</span>
                      <button className="menu-mini-btn" title="Phóng to" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(1)))}><ZoomIn size={14} /></button>
                      <button className="menu-mini-btn" onClick={() => setZoom(1)}>Reset</button>
                    </div>
                    <button className={`menu-mini-btn wide${snap ? " on" : ""}`} onClick={() => setSnap((s) => !s)}>
                      <Magnet size={14} /> Bắt lưới {snap ? "Bật" : "Tắt"}
                    </button>
                  </div>
                </div>
              </aside>

              {/* Center: canvas */}
              <section className={`pane menu-pane${mobileTab === "canvas" ? " tab-active" : ""}`}>
                <div className="pane-head">
                  <span>Canvas 1600×900</span>
                  <span className="muted">{tool === "pan" ? "Pan" : "Chọn / kéo"}</span>
                </div>
                <div className="pane-scroll fe-canvas-scroll">
                  <div
                    ref={stageRef}
                    className="fe-stage"
                    style={{ width: `${zoom * 100}%` }}
                    onPointerDown={() => setSelected(null)}
                  >
                    {[...areaDecor].sort((a, b) => a.zIndex - b.zIndex).map((d) => (
                      <div
                        key={d.id}
                        className={`decor-node decor-${d.kind}${selected?.type === "decor" && selected.id === d.id ? " selected" : ""}${d.deleted ? " deleted" : ""}${d.isLocked ? " locked" : ""}`}
                        style={{ ...nodeStyle(d), zIndex: d.zIndex }}
                        onPointerDown={(e) => onNodePointerDown(e, "decor", d)}
                        onPointerMove={onNodePointerMove}
                        onPointerUp={onNodePointerUp}
                      >
                        {d.label ?? DECOR_LABEL[d.kind]}
                        {d.isLocked && <Lock size={11} className="fe-lock-badge" />}
                      </div>
                    ))}
                    {areaTables.map((t) => (
                      <button
                        key={t.id}
                        className={`table-node ${t.status === "occupied" ? "occupied" : "empty"} ${t.shape === "round" ? "round" : ""}${selected?.type === "table" && selected.id === t.id ? " selected" : ""}${t.deleted ? " deleted" : ""}`}
                        style={nodeStyle(t)}
                        data-testid={`fe-table-${t.id}`}
                        onPointerDown={(e) => onNodePointerDown(e, "table", t)}
                        onPointerMove={onNodePointerMove}
                        onPointerUp={onNodePointerUp}
                      >
                        {t.name}
                        <small>{t.seats} chỗ</small>
                      </button>
                    ))}

                    {isEmptyArea && (
                      <div className="fe-empty-cta" onPointerDown={(e) => e.stopPropagation()}>
                        <LayoutGrid size={30} color="#94a3b8" />
                        <p>Khu này chưa có bàn.</p>
                        <Button variant="contained" size="small" startIcon={<Plus size={15} />} onClick={() => addTable("rectangle")}>
                          Thêm bàn đầu tiên
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Right: properties */}
              <aside className={`pane menu-pane${mobileTab === "props" ? " tab-active" : ""}`}>
                <div className="pane-head">Thuộc tính</div>
                <div className="pane-scroll menu-props">
                  {selectedTable ? (
                    <>
                      <TextField label="Tên bàn" value={selectedTable.name} onChange={(e) => patchTable(selectedTable.id, { name: e.target.value })} size="small" fullWidth inputProps={{ "data-testid": "fe-table-name-input" }} />
                      <div className="menu-minmax">
                        <TextField label="Số chỗ" value={String(selectedTable.seats)} onChange={(e) => patchTable(selectedTable.id, { seats: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Xoay (°)" value={String(selectedTable.rotation)} onChange={(e) => patchTable(selectedTable.id, { rotation: toInt(e.target.value) % 360 })} size="small" inputProps={{ inputMode: "numeric" }} />
                      </div>
                      <div className="menu-field">
                        <span className="emp-field-label">Hình dạng</span>
                        <div className="emp-segment">
                          {(["round", "square", "rectangle"] as TableShape[]).map((shape) => (
                            <button key={shape} className={`emp-segment-btn${selectedTable.shape === shape ? " active" : ""}`} onClick={() => patchTable(selectedTable.id, { shape, ...tableDefaultSize(shape) })}>
                              {SHAPE_LABEL[shape]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="menu-minmax">
                        <TextField label="X" value={String(selectedTable.posX)} onChange={(e) => patchTable(selectedTable.id, { posX: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Y" value={String(selectedTable.posY)} onChange={(e) => patchTable(selectedTable.id, { posY: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Rộng" value={String(selectedTable.width)} onChange={(e) => patchTable(selectedTable.id, { width: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Cao" value={String(selectedTable.height)} onChange={(e) => patchTable(selectedTable.id, { height: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                      </div>
                      <div className="menu-field">
                        <span className="emp-field-label">Khu vực</span>
                        <div className="emp-segment">
                          {sortedAreas.map((a) => (
                            <button key={a.id} className={`emp-segment-btn${selectedTable.areaId === a.id ? " active" : ""}`} onClick={() => patchTable(selectedTable.id, { areaId: a.id })}>{a.name}</button>
                          ))}
                        </div>
                      </div>
                      <div className="fe-status-row">
                        <span className="emp-field-label">Trạng thái (chỉ xem)</span>
                        <span className={`status-pill${selectedTable.status === "occupied" ? "" : " status-active"}`}>{selectedTable.status === "occupied" ? "Có khách" : "Trống"}</span>
                      </div>
                      <Button variant="outlined" color={selectedTable.deleted ? "primary" : "error"} startIcon={selectedTable.deleted ? <RotateCcw size={15} /> : <Trash2 size={15} />} onClick={() => toggleDeleteTable(selectedTable.id)}>
                        {selectedTable.deleted ? "Khôi phục bàn" : "Xoá bàn"}
                      </Button>
                      <p className="muted">Editor chỉ chỉnh layout — không ghi đè trạng thái bàn.</p>
                    </>
                  ) : selectedDecor ? (
                    <>
                      <div className="menu-field">
                        <span className="emp-field-label">Loại</span>
                        <div className="emp-segment">
                          {DECOR_LIBRARY.map((kind) => (
                            <button key={kind} className={`emp-segment-btn${selectedDecor.kind === kind ? " active" : ""}`} onClick={() => patchDecor(selectedDecor.id, { kind })}>{DECOR_LABEL[kind]}</button>
                          ))}
                        </div>
                      </div>
                      <TextField label="Asset" value={selectedDecor.assetKey} onChange={(e) => patchDecor(selectedDecor.id, { assetKey: e.target.value })} size="small" fullWidth />
                      <TextField label="Nhãn" value={selectedDecor.label ?? ""} onChange={(e) => patchDecor(selectedDecor.id, { label: e.target.value })} size="small" fullWidth />
                      <div className="menu-minmax">
                        <TextField label="X" value={String(selectedDecor.posX)} disabled={selectedDecor.isLocked} onChange={(e) => patchDecor(selectedDecor.id, { posX: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Y" value={String(selectedDecor.posY)} disabled={selectedDecor.isLocked} onChange={(e) => patchDecor(selectedDecor.id, { posY: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Rộng" value={String(selectedDecor.width)} onChange={(e) => patchDecor(selectedDecor.id, { width: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Cao" value={String(selectedDecor.height)} onChange={(e) => patchDecor(selectedDecor.id, { height: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                      </div>
                      <div className="menu-minmax">
                        <TextField label="Xoay (°)" value={String(selectedDecor.rotation)} onChange={(e) => patchDecor(selectedDecor.id, { rotation: toInt(e.target.value) % 360 })} size="small" inputProps={{ inputMode: "numeric" }} />
                        <TextField label="Z-index" value={String(selectedDecor.zIndex)} onChange={(e) => patchDecor(selectedDecor.id, { zIndex: toInt(e.target.value) })} size="small" inputProps={{ inputMode: "numeric" }} />
                      </div>
                      <button className={`menu-mini-btn wide${selectedDecor.isLocked ? " on" : ""}`} onClick={() => patchDecor(selectedDecor.id, { isLocked: !selectedDecor.isLocked })}>
                        {selectedDecor.isLocked ? <Lock size={14} /> : <Unlock size={14} />} {selectedDecor.isLocked ? "Đã khoá (không kéo)" : "Khoá vị trí"}
                      </button>
                      <Button variant="outlined" color={selectedDecor.deleted ? "primary" : "error"} startIcon={selectedDecor.deleted ? <RotateCcw size={15} /> : <Trash2 size={15} />} onClick={() => toggleDeleteDecor(selectedDecor.id)}>
                        {selectedDecor.deleted ? "Khôi phục" : "Xoá trang trí"}
                      </Button>
                    </>
                  ) : (
                    <p className="muted" style={{ padding: 8 }}>Chọn bàn hoặc trang trí trên canvas, hoặc thêm từ thư viện công cụ.</p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {confirmCancel && (
        <div className="confirm-overlay" onClick={() => setConfirmCancel(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi?</h3>
            <p>Các chỉnh sửa sơ đồ chưa lưu sẽ bị huỷ.</p>
            <div className="confirm-actions">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type ReportRange = "today" | "7days" | "month" | "custom";
type ReportSection = "overview" | "hourly" | "top" | "orders";
type ReportPayMethod = "cash" | "qr" | "bank_transfer";

interface RpHour { label: string; revenue: number; orders: number; }
interface RpTopItem { name: string; qty: number; revenue: number; }
interface RpOrder { id: string; orderNo: number; time: string; table: string; total: number; method: ReportPayMethod; }
interface RpDataset {
  revenue: number;
  paidOrders: number;
  avgTicket: number;
  topItemName: string;
  voidCount: number;
  hourly: RpHour[];
  topItems: RpTopItem[];
  orders: RpOrder[];
}

const sumRevenue = (rows: RpHour[]) => rows.reduce((s, r) => s + r.revenue, 0);
const sumOrders = (rows: RpHour[]) => rows.reduce((s, r) => s + r.orders, 0);

function buildReportDataset(range: ReportRange): RpDataset {
  if (range === "custom") {
    return { revenue: 0, paidOrders: 0, avgTicket: 0, topItemName: "—", voidCount: 0, hourly: [], topItems: [], orders: [] };
  }
  if (range === "today") {
    const hourly: RpHour[] = [
      { label: "7–9h", revenue: 320000, orders: 9 },
      { label: "9–11h", revenue: 540000, orders: 14 },
      { label: "11–13h", revenue: 880000, orders: 22 },
      { label: "13–15h", revenue: 460000, orders: 12 },
      { label: "15–17h", revenue: 610000, orders: 16 },
      { label: "17–19h", revenue: 920000, orders: 24 },
      { label: "19–21h", revenue: 700000, orders: 18 },
    ];
    const paidOrders = sumOrders(hourly);
    const revenue = sumRevenue(hourly);
    return {
      revenue,
      paidOrders,
      avgTicket: Math.round(revenue / paidOrders),
      topItemName: "Trà đào",
      voidCount: 3,
      hourly,
      topItems: [
        { name: "Trà đào", qty: 39, revenue: 1638000 },
        { name: "Cà phê sữa", qty: 64, revenue: 1856000 },
        { name: "Bạc xỉu", qty: 48, revenue: 1536000 },
        { name: "Matcha latte", qty: 22, revenue: 1078000 },
        { name: "Bánh mì que", qty: 31, revenue: 775000 },
      ],
      orders: [
        { id: "r-1", orderNo: 112, time: "20:48", table: "B01", total: 210000, method: "cash" },
        { id: "r-2", orderNo: 109, time: "19:05", table: "B04", total: 170000, method: "qr" },
        { id: "r-3", orderNo: 108, time: "18:32", table: "Mang đi", total: 60000, method: "cash" },
        { id: "r-4", orderNo: 107, time: "18:11", table: "B06", total: 80000, method: "bank_transfer" },
        { id: "r-5", orderNo: 106, time: "17:40", table: "B02", total: 120000, method: "cash" },
        { id: "r-6", orderNo: 103, time: "15:10", table: "B03", total: 140000, method: "qr" },
      ],
    };
  }
  if (range === "7days") {
    const hourly: RpHour[] = [
      { label: "T2", revenue: 5200000, orders: 132 },
      { label: "T3", revenue: 4800000, orders: 121 },
      { label: "T4", revenue: 6100000, orders: 154 },
      { label: "T5", revenue: 5500000, orders: 139 },
      { label: "T6", revenue: 7900000, orders: 198 },
      { label: "T7", revenue: 9200000, orders: 232 },
      { label: "CN", revenue: 8400000, orders: 211 },
    ];
    const paidOrders = sumOrders(hourly);
    const revenue = sumRevenue(hourly);
    return {
      revenue,
      paidOrders,
      avgTicket: Math.round(revenue / paidOrders),
      topItemName: "Cà phê sữa",
      voidCount: 21,
      hourly,
      topItems: [
        { name: "Cà phê sữa", qty: 412, revenue: 11948000 },
        { name: "Trà đào", qty: 286, revenue: 12012000 },
        { name: "Bạc xỉu", qty: 244, revenue: 7808000 },
        { name: "Matcha latte", qty: 158, revenue: 7742000 },
        { name: "Cold brew", qty: 121, revenue: 5929000 },
      ],
      orders: [
        { id: "r-1", orderNo: 642, time: "CN 20:48", table: "B07", total: 320000, method: "qr" },
        { id: "r-2", orderNo: 631, time: "CN 19:05", table: "B02", total: 210000, method: "cash" },
        { id: "r-3", orderNo: 588, time: "T7 18:32", table: "Mang đi", total: 95000, method: "cash" },
        { id: "r-4", orderNo: 540, time: "T7 12:11", table: "B05", total: 180000, method: "bank_transfer" },
        { id: "r-5", orderNo: 512, time: "T6 17:40", table: "B01", total: 240000, method: "cash" },
      ],
    };
  }
  // month
  const hourly: RpHour[] = [
    { label: "Tuần 1", revenue: 22000000, orders: 552 },
    { label: "Tuần 2", revenue: 25000000, orders: 624 },
    { label: "Tuần 3", revenue: 19000000, orders: 481 },
    { label: "Tuần 4", revenue: 28000000, orders: 703 },
  ];
  const paidOrders = sumOrders(hourly);
  const revenue = sumRevenue(hourly);
  return {
    revenue,
    paidOrders,
    avgTicket: Math.round(revenue / paidOrders),
    topItemName: "Trà đào",
    voidCount: 88,
    hourly,
    topItems: [
      { name: "Trà đào", qty: 1180, revenue: 49560000 },
      { name: "Cà phê sữa", qty: 1642, revenue: 47618000 },
      { name: "Bạc xỉu", qty: 980, revenue: 31360000 },
      { name: "Matcha latte", qty: 612, revenue: 29988000 },
      { name: "Sinh tố bơ", qty: 421, revenue: 20629000 },
    ],
    orders: [
      { id: "r-1", orderNo: 2412, time: "28/06 20:48", table: "B07", total: 360000, method: "qr" },
      { id: "r-2", orderNo: 2380, time: "27/06 19:05", table: "B02", total: 250000, method: "cash" },
      { id: "r-3", orderNo: 2201, time: "24/06 12:32", table: "Mang đi", total: 120000, method: "cash" },
      { id: "r-4", orderNo: 2098, time: "21/06 18:11", table: "B05", total: 290000, method: "bank_transfer" },
      { id: "r-5", orderNo: 1990, time: "18/06 17:40", table: "B01", total: 210000, method: "cash" },
    ],
  };
}

function ReportSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "report");

  const [range, setRange] = useState<ReportRange>("today");
  const [section, setSection] = useState<ReportSection>("overview");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ type: "hour" | "item"; key: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<"nav" | "main" | "detail">("main");

  const dataset = useMemo(() => buildReportDataset(range), [range]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const t = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(t);
  }, [range]);

  const hasData = dataset.paidOrders > 0;
  const maxHour = dataset.hourly.reduce((m, h) => (h.revenue > m.revenue ? h : m), dataset.hourly[0] ?? { label: "—", revenue: 0, orders: 0 });
  const maxTopRevenue = Math.max(1, ...dataset.topItems.map((t) => t.revenue));
  const topMethod = (() => {
    const counts: Record<string, number> = {};
    dataset.orders.forEach((o) => { counts[o.method] = (counts[o.method] ?? 0) + 1; });
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return entry ? (PAY_METHOD_LABEL[entry[0]] ?? entry[0]) : "—";
  })();

  const dateChips: Array<{ key: ReportRange; label: string }> = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày" },
    { key: "month", label: "Tháng này" },
    { key: "custom", label: "Tuỳ chọn" },
  ];
  const sections: Array<{ key: ReportSection; label: string }> = [
    { key: "overview", label: "Tổng quan" },
    { key: "hourly", label: range === "today" ? "Theo giờ" : "Theo thời gian" },
    { key: "top", label: "Món bán chạy" },
    { key: "orders", label: "Đơn đã thanh toán" },
  ];

  const pickHour = (label: string) => {
    setSelected((prev) => (prev?.type === "hour" && prev.key === label ? null : { type: "hour", key: label }));
    setMobileTab("detail");
  };
  const pickItem = (name: string) => {
    setSelected((prev) => (prev?.type === "item" && prev.key === name ? null : { type: "item", key: name }));
    setMobileTab("detail");
  };

  const tabBtn = (key: "nav" | "main" | "detail", label: string) => (
    <button className={`menu-tab-btn${mobileTab === key ? " active" : ""}`} onClick={() => setMobileTab(key)}>
      {label}
    </button>
  );

  const renderChart = (height: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={dataset.hourly} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
        <YAxis hide />
        <RechartsTooltip formatter={(v: number) => formatVnd(v)} cursor={{ fill: "rgba(15,118,110,0.06)" }} labelStyle={{ fontWeight: 700 }} />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} onClick={(d: { label?: string }) => d?.label && pickHour(d.label)}>
          {dataset.hourly.map((h) => (
            <Cell key={h.label} cursor="pointer" fill={selected?.type === "hour" && selected.key === h.label ? "#0b5d57" : "#0F766E"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const metricsRow = (
    <div className="report-metrics">
      <Metric label="Doanh thu" value={formatVnd(dataset.revenue)} />
      <Metric label="Số đơn đã TT" value={`${dataset.paidOrders}`} />
      <Metric label="Trung bình đơn" value={formatVnd(dataset.avgTicket)} />
      <Metric label="Top món" value={dataset.topItemName} />
    </div>
  );

  if (!allowed) {
    return (
      <section className="drawer-overlay" data-testid="report-settings">
        <header className="drawer-header">
          <div className="title-stack"><h2>Báo cáo</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="drawer-body emp-forbidden">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="muted">Tài khoản hiện tại không thể xem báo cáo.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="drawer-overlay" data-testid="report-settings">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Báo cáo</h2>
          <p><span className="sync-dot" />Chỉ tính đơn đã thanh toán · mock</p>
        </div>
        <div className="header-actions fe-header-actions">
          <div className="fe-area-tabs">
            {dateChips.map((dc) => (
              <button key={dc.key} className={`status-chip ${range === dc.key ? "active" : ""}`} onClick={() => setRange(dc.key)}>
                {dc.label}
              </button>
            ))}
          </div>
          <Button variant="outlined" startIcon={<Download size={15} />} onClick={() => toast("Xuất báo cáo sẽ làm sau (mock)")}>
            Xuất
          </Button>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="drawer-body menu-editor-body">
        <div className="menu-tabs">
          {tabBtn("nav", "Mục")}
          {tabBtn("main", "Biểu đồ")}
          {tabBtn("detail", "Chi tiết")}
        </div>

        <div className="menu-three-pane rp-three-pane">
          {/* Left: section nav */}
          <aside className={`pane menu-pane${mobileTab === "nav" ? " tab-active" : ""}`}>
            <div className="pane-head">Mục báo cáo</div>
            <div className="pane-scroll">
              <div className="menu-cat-list">
                {sections.map((s) => (
                  <button
                    key={s.key}
                    className={`tw-bucket-btn ${section === s.key ? "active" : ""}`}
                    onClick={() => { setSection(s.key); setMobileTab("main"); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="rp-note" style={{ marginTop: 12 }}>
                <strong>{dateChips.find((d) => d.key === range)?.label}</strong>
                <span>Chỉ tính paid order, loại void.</span>
              </div>
            </div>
          </aside>

          {/* Center: charts & tables */}
          <section className={`pane menu-pane${mobileTab === "main" ? " tab-active" : ""}`}>
            <div className="pane-head">
              <span>{sections.find((s) => s.key === section)?.label}</span>
              {hasData && <span className="muted">{dataset.paidOrders} đơn</span>}
            </div>
            <div className="pane-scroll rp-main">
              {loading ? (
                <div className="rp-skel-wrap">
                  <div className="tw-skeleton-card" style={{ height: 88 }} />
                  <div className="tw-skeleton-card" style={{ height: 200 }} />
                </div>
              ) : !hasData ? (
                <>
                  {metricsRow}
                  <div className="tw-empty-state">
                    <BarChart3 size={32} color="#94a3b8" />
                    <p>Chưa có đơn đã thanh toán trong khoảng này.</p>
                  </div>
                </>
              ) : section === "overview" ? (
                <>
                  {metricsRow}
                  <div className="rp-card">
                    <div className="rp-card-head">Doanh thu theo {range === "today" ? "giờ" : range === "month" ? "tuần" : "ngày"}</div>
                    {renderChart(210)}
                  </div>
                  <div className="rp-card">
                    <div className="rp-card-head">Món bán chạy</div>
                    <div className="rp-top-list">
                      {dataset.topItems.slice(0, 4).map((it) => (
                        <button
                          key={it.name}
                          className={`rp-top-row${selected?.type === "item" && selected.key === it.name ? " active" : ""}`}
                          onClick={() => pickItem(it.name)}
                        >
                          <span className="rp-top-name">{it.name}</span>
                          <span className="rp-bar"><span className="rp-bar-fill" style={{ width: `${(it.revenue / maxTopRevenue) * 100}%` }} /></span>
                          <span className="rp-top-rev price-text">{formatCompactVnd(it.revenue)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : section === "hourly" ? (
                <>
                  <div className="rp-card">
                    <div className="rp-card-head">Doanh thu theo {range === "today" ? "giờ" : range === "month" ? "tuần" : "ngày"}</div>
                    {renderChart(260)}
                  </div>
                  <div className="rp-table-wrap">
                    <table className="rp-table">
                      <thead><tr><th>Mốc</th><th>Đơn</th><th>Doanh thu</th></tr></thead>
                      <tbody>
                        {dataset.hourly.map((h) => (
                          <tr key={h.label} className={selected?.type === "hour" && selected.key === h.label ? "selected" : ""} onClick={() => pickHour(h.label)}>
                            <td>{h.label}</td>
                            <td>{h.orders}</td>
                            <td><strong className="price-text">{formatCompactVnd(h.revenue)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : section === "top" ? (
                <div className="rp-top-list rp-top-full">
                  {dataset.topItems.map((it, idx) => (
                    <button
                      key={it.name}
                      className={`rp-top-row${selected?.type === "item" && selected.key === it.name ? " active" : ""}`}
                      onClick={() => pickItem(it.name)}
                    >
                      <span className="rp-top-rank">{idx + 1}</span>
                      <span className="rp-top-name">{it.name}<small>{it.qty} ly</small></span>
                      <span className="rp-bar"><span className="rp-bar-fill" style={{ width: `${(it.revenue / maxTopRevenue) * 100}%` }} /></span>
                      <span className="rp-top-rev price-text">{formatCompactVnd(it.revenue)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rp-table-wrap">
                  <table className="rp-table">
                    <thead><tr><th>Mã</th><th>Giờ</th><th>Bàn</th><th>Thanh toán</th><th>Tổng</th></tr></thead>
                    <tbody>
                      {dataset.orders.map((o) => (
                        <tr key={o.id}>
                          <td><strong>#{o.orderNo}</strong></td>
                          <td className="muted">{o.time}</td>
                          <td>{o.table}</td>
                          <td>{PAY_METHOD_LABEL[o.method] ?? o.method}</td>
                          <td><strong className="price-text">{formatCompactVnd(o.total)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Right: insights / detail */}
          <aside className={`pane menu-pane${mobileTab === "detail" ? " tab-active" : ""}`}>
            <div className="pane-head">Chi tiết</div>
            <div className="pane-scroll rp-detail">
              <div className="rp-note">
                <strong>Ghi chú</strong>
                <span>Chỉ tính paid order, loại void ({dataset.voidCount} đơn huỷ).</span>
              </div>

              {selected?.type === "hour" ? (
                (() => {
                  const h = dataset.hourly.find((x) => x.label === selected.key);
                  if (!h) return null;
                  return (
                    <div className="rp-detail-card">
                      <div className="rp-card-head">Mốc {h.label}</div>
                      <div className="tw-detail-row"><span>Doanh thu</span><strong className="price-text">{formatVnd(h.revenue)}</strong></div>
                      <div className="tw-detail-row"><span>Số đơn</span><strong>{h.orders}</strong></div>
                      <div className="tw-detail-row"><span>% doanh thu</span><strong>{Math.round((h.revenue / dataset.revenue) * 100)}%</strong></div>
                    </div>
                  );
                })()
              ) : selected?.type === "item" ? (
                (() => {
                  const it = dataset.topItems.find((x) => x.name === selected.key);
                  if (!it) return null;
                  return (
                    <div className="rp-detail-card">
                      <div className="rp-card-head">{it.name}</div>
                      <div className="tw-detail-row"><span>Đã bán</span><strong>{it.qty} ly</strong></div>
                      <div className="tw-detail-row"><span>Doanh thu</span><strong className="price-text">{formatVnd(it.revenue)}</strong></div>
                      <div className="tw-detail-row"><span>Đơn giá TB</span><strong>{formatVnd(Math.round(it.revenue / it.qty))}</strong></div>
                    </div>
                  );
                })()
              ) : (
                <>
                  <div className="rp-detail-card">
                    <div className="rp-card-head">Tổng quan nhanh</div>
                    <div className="tw-detail-row"><span>Giờ cao điểm</span><strong>{hasData ? maxHour.label : "—"}</strong></div>
                    <div className="tw-detail-row"><span>Thanh toán phổ biến</span><strong>{topMethod}</strong></div>
                    <div className="tw-detail-row"><span>Đơn huỷ</span><strong>{dataset.voidCount}</strong></div>
                  </div>
                  <div className="rp-detail-card">
                    <div className="rp-card-head">Đơn gần đây</div>
                    {dataset.orders.length === 0 ? (
                      <p className="muted">Chưa có đơn.</p>
                    ) : (
                      dataset.orders.slice(0, 5).map((o) => (
                        <div key={o.id} className="rp-recent-row">
                          <div>
                            <strong>#{o.orderNo}</strong>
                            <span className="muted"> · {o.time} · {o.table}</span>
                          </div>
                          <strong className="price-text">{formatCompactVnd(o.total)}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
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
