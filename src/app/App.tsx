import {
  BarChart3,
  ClipboardList,
  Coffee,
  CreditCard,
  LayoutDashboard,
  Lock,
  Minus,
  Plus,
  ReceiptText,
  Save,
  Settings,
  Store,
  Utensils,
} from "lucide-react";
import { Button, TextField } from "@mui/material";
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
  const currentEmployee = useAppStore((state) => state.currentEmployee);

  return (
    <>
      <RotateGuidance />
      {currentEmployee ? <AppShell /> : <PasscodeScreen />}
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

function PasscodeScreen() {
  const ports = usePorts();
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const employeesQuery = useQuery({
    queryKey: orderQueryKeys.employees,
    queryFn: () => ports.employee.listActiveEmployees(),
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pin, setPin] = useState("");

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
      toast.error(isAppError(error) ? error.message : "Không thể đăng nhập.");
      setPin("");
    },
  });

  const appendPin = (value: string) => {
    setPin((current) => (current.length < 6 ? `${current}${value}` : current));
  };

  return (
    <main className="passcode-screen" data-testid="passcode-screen">
      <section className="passcode-brand">
        <div>
          <div className="brand-mark">P</div>
          <h1>POS vận hành nhanh cho nhiều loại cửa hàng</h1>
          <p>Store Key đã ghép máy. Nhân viên chọn tên và nhập PIN để mở phiên làm việc trong bộ nhớ.</p>
        </div>
        <span className="pair-strip">Đổi quán / Gỡ ghép</span>
      </section>

      <section className="passcode-panel">
        <div className="title-stack">
          <h2>Chọn nhân viên</h2>
          <p>Ca sáng · Cửa hàng #0001</p>
        </div>

        <div className="employee-grid">
          {employeesQuery.data?.map((employee) => (
            <button
              key={employee.id}
              className={`employee-card ${employee.id === selectedEmployeeId ? "active" : ""}`}
              data-testid={`employee-${employee.id}`}
              onClick={() => setSelectedEmployeeId(employee.id)}
            >
              <strong>{employee.name}</strong>
              <span className="role-pill">{employee.role}</span>
            </button>
          ))}
        </div>

        <div className="pin-display" aria-label="PIN hiện tại">
          {Array.from({ length: pin.length || 1 }).map((_, index) => (
            <span className="pin-dot" key={index} />
          ))}
        </div>

        <div className="pin-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
            <button className="pin-key" data-testid={`pin-${value}`} key={value} onClick={() => appendPin(value)}>
              {value}
            </button>
          ))}
          <button className="pin-key" onClick={() => setPin("")}>Xoá</button>
          <button className="pin-key" data-testid="pin-0" onClick={() => appendPin("0")}>0</button>
          <Button
            variant="contained"
            data-testid="unlock-button"
            disabled={!selectedEmployeeId || pin.length < 4 || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            OK
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

  const guardedOpen = (module: DrawerModule, guard: AppModule) => {
    if (!currentEmployee || !canAccessModule(currentEmployee, guard)) {
      toast.error("Nhân viên không có quyền dùng chức năng này.");
      return;
    }

    if (module) {
      openDrawer(module);
    }
  };

  return (
    <main className="app-shell" data-testid="app-shell">
      <aside className="left-rail">
        <div className="rail-logo">P</div>
        <nav className="rail-list" aria-label="POS modules">
          <RailButton active={!drawer} icon={<LayoutDashboard size={18} />} label="Bàn" onClick={closeDrawer} />
          <RailButton
            active={drawer === "order"}
            icon={<ClipboardList size={18} />}
            label="Mang đi"
            onClick={() => openOrder({ orderId: null, tableId: null, orderType: "takeaway" })}
          />
          <RailButton
            active={drawer === "menuEditor"}
            icon={<Coffee size={18} />}
            label="Menu"
            onClick={() => guardedOpen("menuEditor", "menuEditor")}
          />
          <RailButton
            active={drawer === "floorEditor"}
            icon={<Utensils size={18} />}
            label="Layout"
            onClick={() => guardedOpen("floorEditor", "floorEditor")}
          />
          <RailButton
            active={drawer === "reportSettings"}
            icon={<BarChart3 size={18} />}
            label="BC"
            onClick={() => guardedOpen("reportSettings", "report")}
          />
        </nav>
        <RailButton
          active={false}
          icon={<Lock size={18} />}
          label="Khoá"
          onClick={() => {
            closeDrawer();
            setCurrentEmployee(null);
          }}
        />
      </aside>

      <section className="workspace">
        <FloorWorkspace />
        {drawer === "order" ? <OrderDrawer /> : null}
        {drawer === "payment" ? <PaymentDrawer /> : null}
        {drawer === "menuEditor" ? <MenuEditorDrawer /> : null}
        {drawer === "floorEditor" ? <FloorEditorDrawer /> : null}
        {drawer === "reportSettings" ? <ReportSettingsDrawer /> : null}
      </section>
    </main>
  );
}

function RailButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`rail-action ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FloorWorkspace() {
  const ports = usePorts();
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const activeAreaId = useAppStore((state) => state.activeAreaId);
  const setActiveAreaId = useAppStore((state) => state.setActiveAreaId);
  const openOrder = useAppStore((state) => state.openOrder);

  const floorPlanQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
  const openOrdersQuery = useQuery({ queryKey: orderQueryKeys.openOrders, queryFn: () => ports.order.listOpenOrders() });

  useEffect(() => {
    const firstArea = floorPlanQuery.data?.areas[0]?.id;
    if (!activeAreaId && firstArea) {
      setActiveAreaId(firstArea);
    }
  }, [activeAreaId, floorPlanQuery.data, setActiveAreaId]);

  const floorPlan = floorPlanQuery.data;
  const orders = openOrdersQuery.data ?? [];
  const areaId = activeAreaId ?? floorPlan?.areas[0]?.id ?? null;
  const tables = floorPlan?.tables.filter((table) => table.areaId === areaId) ?? [];
  const decorItems = floorPlan?.decorItems.filter((decor) => decor.areaId === areaId) ?? [];

  return (
    <>
      <header className="workspace-header">
        <div className="title-stack">
          <h1>Sơ đồ bàn</h1>
          <p>
            {currentEmployee?.name} · {tables.length} bàn · realtime online mock
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={() => openOrder({ orderId: null, tableId: null, orderType: "takeaway" })}>
            Mang đi
          </Button>
          <Button variant="outlined">Làm mới</Button>
          <Button variant="contained" onClick={() => toast("Tạo đơn nhanh sẽ dùng draft order.")}>
            Tạo đơn nhanh
          </Button>
        </div>
      </header>

      <div className="workspace-body">
        <section className="floor-shell" data-testid="floor-view">
          <div className="area-tabs">
            {floorPlan?.areas.map((area) => (
              <button
                className={`area-tab ${area.id === areaId ? "active" : ""}`}
                key={area.id}
                onClick={() => setActiveAreaId(area.id)}
              >
                {area.name}
              </button>
            ))}
            <span className="status-pill">Mang đi đang mở · {orders.filter((order) => order.orderType === "takeaway").length}</span>
          </div>
          <div className="stage-scroll">
            <div className="floor-stage">
              {decorItems.map((decor) => (
                <div
                  className="decor-node"
                  key={decor.id}
                  style={stageStyle(decor.posX, decor.posY, decor.width, decor.height)}
                >
                  {decor.label ?? decor.assetKey}
                </div>
              ))}
              {tables.map((table) => {
                const openOrderSummary = orders.find((order) => order.tableId === table.id);
                const occupied = table.status === "occupied" || !!openOrderSummary;
                return (
                  <button
                    className={`table-node ${occupied ? "occupied" : ""}`}
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
                    <span>{table.name}</span>
                    <small>{openOrderSummary ? `${formatCompactVnd(openOrderSummary.total)} · #${openOrderSummary.orderNo}` : "Trống"}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
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

  const menuQuery = useQuery({ queryKey: orderQueryKeys.menu, queryFn: () => ports.menu.getMenu() });
  const floorPlanQuery = useQuery({ queryKey: orderQueryKeys.floorPlan, queryFn: () => ports.floorPlan.getFloorPlan() });
  const orderQuery = useQuery({
    queryKey: orderQueryKeys.order(context?.orderId ?? null),
    queryFn: () => ports.order.getOrder(context!.orderId!),
    enabled: !!context?.orderId,
  });

  useEffect(() => {
    const firstCategory = menuQuery.data?.categories[0]?.id;
    if (!activeCategoryId && firstCategory) {
      setActiveCategoryId(firstCategory);
    }
  }, [activeCategoryId, menuQuery.data, setActiveCategoryId]);

  useEffect(() => {
    if (context?.orderId && orderQuery.data) {
      setDraftItems(orderQuery.data.items.map(snapshotToDraft));
    }

    if (context && !context.orderId) {
      setDraftItems([]);
    }
  }, [context, orderQuery.data, setDraftItems]);

  const menu = menuQuery.data;
  const categoryId = activeCategoryId ?? menu?.categories[0]?.id ?? "";
  const items = menu?.menuItems.filter((item) => item.categoryId === categoryId && item.isAvailable) ?? [];
  const orderDetail = orderQuery.data ?? null;
  const table = context?.tableId ? floorPlanQuery.data?.tables.find((candidate) => candidate.id === context.tableId) : null;
  const cartLines = useMemo(() => (menu ? buildCartLines(menu, draftItems) : []), [draftItems, menu]);
  const total = cartLines.reduce((sum, line) => sum + line.total, 0);

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
      if (result.ticket) {
        await ports.print.renderOrderTicket(result.ticket);
      }
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
    const existing = draftItems.find((item) => item.menuItemId === menuItem.id && item.options.length === 0);
    if (existing) {
      setDraftItems(draftItems.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item)));
      return;
    }

    setDraftItems([
      ...draftItems,
      {
        id: crypto.randomUUID(),
        menuItemId: menuItem.id,
        quantity: 1,
        note: null,
        options: [],
      },
    ]);
  };

  const adjustQuantity = (id: string, delta: number) => {
    setDraftItems(
      draftItems
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  return (
    <section className="drawer-overlay" data-testid="order-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>{table ? `Bàn ${table.name}` : "Mang đi"} · {orderDetail ? `Đơn #${orderDetail.orderNo}` : "Draft mới"}</h2>
          <p>Draft chưa ghi DB cho tới khi bấm In/Gửi đơn</p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
          {orderDetail ? (
            <Button variant="outlined" startIcon={<CreditCard size={16} />} onClick={() => openPayment(orderDetail.id)}>
              Thanh toán
            </Button>
          ) : null}
          <Button
            variant="contained"
            data-testid="submit-order-button"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            In/Gửi đơn
          </Button>
        </div>
      </header>
      <div className="drawer-body">
        <div className="three-pane">
          <aside className="pane">
            <div className="pane-head">Danh mục</div>
            <div className="pane-scroll">
              <div className="category-list">
                {menu?.categories.map((category) => (
                  <button
                    className={`category-button ${category.id === categoryId ? "active" : ""}`}
                    key={category.id}
                    onClick={() => setActiveCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>
          <section className="pane">
            <div className="pane-head">
              <span>Menu</span>
              <TextField size="small" placeholder="Tìm món..." />
            </div>
            <div className="pane-scroll">
              <div className="menu-grid">
                {items.map((item) => (
                  <button
                    className="menu-card"
                    data-testid={`menu-item-${item.id}`}
                    key={item.id}
                    onClick={() => addItem(item)}
                  >
                    <strong>{item.name}</strong>
                    <span className="price-text">{formatVnd(item.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
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
                      <strong>{line.name}</strong>
                      <strong>{formatCompactVnd(line.total)}</strong>
                    </div>
                    <div className="cart-line muted">
                      <span>x{line.quantity}{line.optionText ? ` · ${line.optionText}` : ""}</span>
                      <span className="quantity-actions">
                        <button className="icon-button" onClick={() => adjustQuantity(line.id, -1)}><Minus size={14} /></button>
                        <button className="icon-button" onClick={() => adjustQuantity(line.id, 1)}><Plus size={14} /></button>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Chọn món từ menu để tạo draft.</p>
              )}
            </div>
            <footer className="cart-footer">
              <div className="total-row"><span>Tạm tính</span><strong>{formatVnd(total)}</strong></div>
              <div className="total-row final"><span>Tổng</span><strong>{formatVnd(total)}</strong></div>
              <Button variant="contained" data-testid="submit-order-button-footer" onClick={() => submitMutation.mutate()}>
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
  const orderQuery = useQuery({
    queryKey: orderQueryKeys.order(paymentOrderId),
    queryFn: () => ports.order.getOrder(paymentOrderId!),
    enabled: !!paymentOrderId,
  });
  const order = orderQuery.data;
  const [receivedAmount, setReceivedAmount] = useState(0);

  useEffect(() => {
    if (order) {
      setReceivedAmount(order.total);
    }
  }, [order]);

  const payMutation = useMutation({
    mutationFn: () =>
      ports.payment.payOrder({
        paymentId: crypto.randomUUID(),
        orderId: order!.id,
        employeeId: currentEmployee!.id,
        method: "cash",
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
      toast.success("Đã thanh toán và render bill.");
      closeDrawer();
    },
    onError: (error) => toast.error(isAppError(error) ? error.message : "Không thể thanh toán."),
  });

  return (
    <section className="drawer-overlay" data-testid="payment-drawer">
      <header className="drawer-header">
        <div className="title-stack">
          <h2>Thanh toán · Đơn #{order?.orderNo ?? "..."}</h2>
          <p>Complete trước, sau đó render/in final bill</p>
        </div>
        <div className="header-actions">
          <Button variant="outlined" onClick={closeDrawer}>Quay lại</Button>
          <Button variant="contained" data-testid="pay-button" disabled={!order || payMutation.isPending} onClick={() => payMutation.mutate()}>
            Complete
          </Button>
        </div>
      </header>
      <div className="drawer-body">
        <div className="two-pane">
          <section className="panel">
            <div className="panel-head">Hoá đơn tạm</div>
            <div className="panel-scroll">
              <CartSnapshotList order={order} />
            </div>
          </section>
          <aside className="panel">
            <div className="panel-head">Tiền khách đưa</div>
            <div className="panel-scroll editor-card">
              <TextField
                label="Received amount"
                type="number"
                value={receivedAmount}
                onChange={(event) => setReceivedAmount(Number(event.target.value))}
              />
              <div className="menu-grid">
                {[50000, 100000, 200000].map((amount) => (
                  <Button variant="outlined" key={amount} onClick={() => setReceivedAmount(amount)}>
                    {formatCompactVnd(amount)}
                  </Button>
                ))}
              </div>
              <div className="metric-card">
                <span>Tiền thối</span>
                <strong className="price-text">{formatVnd(Math.max(0, receivedAmount - (order?.total ?? 0)))}</strong>
              </div>
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
