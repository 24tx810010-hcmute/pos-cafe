import clsx from "clsx";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import type { OrderItemSnapshot, OrderStatus } from "@/domain";
import { formatVnd } from "@/core/money";
import { useFloorPlanQuery, useOrderDetailQuery, useOrderHistoryQuery } from "@/features/pos";
import { useAdminEmployeesQuery, useStoreSettingsQuery } from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import {
  DEFAULT_TIMEZONE,
  PAY_METHOD_LABEL,
  businessDateInTimezone,
  businessRangeFor,
  formatBusinessDate,
  historyRowFromOrder,
  tableNameMap,
  type HistoryDateRange,
  type HistoryOrderTypeFilter,
  type HistoryStatusFilter,
} from "@/features/pos/historyHelpers";
import { PortalDrawer } from "../../components/PortalDrawer";
import { receiptFromOrderDetail } from "../../components/ReceiptPreview";

const PAGE_SIZE = 8;

const dateRangeOptions: Array<{ key: HistoryDateRange; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "7days", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn" },
];

const statusOptions: Array<{ key: HistoryStatusFilter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "paid", label: "Đã thanh toán" },
  { key: "void", label: "Đã hủy" },
];

const orderTypeOptions: Array<{ key: HistoryOrderTypeFilter; label: string }> = [
  { key: "all", label: "Tất cả loại" },
  { key: "dine_in", label: "Tại bàn" },
  { key: "takeaway", label: "Mang đi" },
];

const statusLabel: Record<OrderStatus, string> = {
  paid: "Đã thanh toán",
  open: "Đang mở",
  void: "Đã hủy",
};

const statusClass: Record<OrderStatus, string> = {
  paid: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]",
  open: "bg-[#fef9c3] text-[#854d0e] border-[#fde68a]",
  void: "bg-[#fee2e2] text-[#991b1b] border-[#fecaca]",
};

const formatMoney = (amount: number): string => formatVnd(amount).replace(/\s/g, "").replace("₫", "đ");

const itemLineTotal = (item: OrderItemSnapshot): number => {
  const optionDelta = item.options.reduce((sum, option) => sum + option.priceDelta, 0);
  return (item.unitPrice + optionDelta) * item.quantity;
};

const itemMeta = (item: OrderItemSnapshot): string => {
  const options = item.options.map((option) => option.optionName);
  const note = item.note ? [`ghi chú: ${item.note}`] : [];
  return [...options, ...note].join(" · ");
};

const IconButton = ({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-pos-line bg-white text-pos-ink transition-[border-color,color,background] hover:border-pos-primary hover:bg-pos-primarySoft hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:h-8 max-[760px]:w-8"
  >
    {children}
  </button>
);

function OrderHistoryDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openReceiptPreview = useAppStore((state) => state.openReceiptPreview);
  const settingsQuery = useStoreSettingsQuery();
  const employeesQuery = useAdminEmployeesQuery();
  const floorQuery = useFloorPlanQuery();
  const [dateRange, setDateRange] = useState<HistoryDateRange>("today");
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<HistoryOrderTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const timezone = settingsQuery.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = businessDateInTimezone(new Date(), timezone);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const selectedRange = useMemo(
    () => businessRangeFor(dateRange, today, customFrom, customTo),
    [customFrom, customTo, dateRange, today],
  );

  const tables = useMemo(() => tableNameMap(floorQuery.data), [floorQuery.data]);
  const normalizedSearch = search.trim();
  const matchedTableIds = useMemo(() => {
    if (!normalizedSearch) return undefined;
    const query = normalizedSearch.toLowerCase();
    const ids = Array.from(tables.entries())
      .filter(([, tableName]) => tableName.toLowerCase().includes(query))
      .map(([tableId]) => tableId);
    return ids.length > 0 ? ids : undefined;
  }, [normalizedSearch, tables]);
  const historyQuery = useOrderHistoryQuery({
    ...selectedRange,
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
    orderType: orderTypeFilter === "all" ? undefined : orderTypeFilter,
    search: normalizedSearch || undefined,
    tableIds: matchedTableIds,
  });
  const detailQuery = useOrderDetailQuery(selectedId);

  const employeeNames = useMemo(
    () => new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee.name])),
    [employeesQuery.data],
  );
  const historyRows = useMemo(
    () => (historyQuery.data?.items ?? []).map((order) => historyRowFromOrder(order, tables)),
    [historyQuery.data?.items, tables],
  );

  const filtered = historyRows;

  const totalPages = Math.max(1, Math.ceil((historyQuery.data?.total ?? 0) / PAGE_SIZE));
  const selected = historyRows.find((order) => order.id === selectedId) ?? null;
  const selectedDetail = detailQuery.data?.id === selectedId ? detailQuery.data : null;
  const selectedPayment = selectedDetail?.payment ?? null;
  const selectedDateLabel = dateRangeOptions.find((option) => option.key === dateRange)?.label ?? "Hôm nay";
  const cashierLabel = selectedPayment?.employeeId
    ? employeeNames.get(selectedPayment.employeeId) ?? selectedPayment.employeeId
    : "Chưa ghi nhận";
  const paymentMethodLabel = selectedPayment?.method
    ? PAY_METHOD_LABEL[selectedPayment.method] ?? selectedPayment.method
    : "Chưa ghi nhận";
  const paidTimeLabel = selectedDetail?.paidAt
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(selectedDetail.paidAt))
    : "Chưa ghi nhận";

  const resetList = () => {
    setPage(1);
    setSelectedId(null);
  };

  const selectDateRange = (range: HistoryDateRange) => {
    setDateRange(range);
    resetList();
    if (range !== "custom") {
      setIsDateMenuOpen(false);
    }
  };

  useEffect(() => {
    if (historyQuery.data && page > totalPages) {
      setPage(totalPages);
    }
  }, [historyQuery.data, page, totalPages]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (selectedId && filtered.some((order) => order.id === selectedId)) return;
    setSelectedId(filtered[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, statusFilter, orderTypeFilter, search]);

  const copyOrderNo = () => {
    if (!selected) return;
    const text = `#${selected.orderNo}`;
    void navigator.clipboard?.writeText(text);
    toast.success(`Đã sao chép ${text}`);
  };

  return (
    <PortalDrawer testId="order-history-drawer" onOutsideClick={closeDrawer}>
      <header className="flex min-h-[68px] items-center justify-between gap-3 border-b border-pos-line bg-white px-4 py-3 max-[900px]:min-h-[58px] max-[900px]:gap-2 max-[900px]:px-3 max-[900px]:py-2">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-[22px] font-black leading-tight text-pos-ink max-[760px]:text-[17px]">
            Lịch sử đơn
          </h2>
          <p className="m-0 mt-1 truncate text-xs font-semibold text-pos-muted max-[760px]:hidden">
            Xem nhanh đơn đã thực hiện theo ngày, trạng thái và loại đơn
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 max-[760px]:gap-1.5">
          <div className="relative shrink-0">
            <button
              type="button"
              data-testid="history-date-filter-button"
              onClick={() => setIsDateMenuOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-pos-primaryLine bg-pos-primarySoft px-3 text-sm font-black text-pos-primary transition-colors hover:border-pos-primary max-[760px]:h-9 max-[760px]:px-2 max-[760px]:text-xs"
            >
              <CalendarDays size={17} />
              <span className="max-[640px]:max-w-[70px] max-[640px]:truncate">{selectedDateLabel}</span>
              <ChevronDown size={16} />
            </button>

            {isDateMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[292px] rounded-[10px] border border-pos-line bg-white p-2 shadow-[0_18px_45px_rgb(15_23_42_/_16%)] max-[760px]:right-[-44px] max-[760px]:w-[260px]">
                <div className="grid grid-cols-2 gap-1.5">
                  {dateRangeOptions.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      data-testid={`history-date-range-${option.key}`}
                      onClick={() => selectDateRange(option.key)}
                      className={clsx(
                        "min-h-9 rounded-[8px] border px-2 text-sm font-extrabold transition-colors max-[760px]:text-xs",
                        dateRange === option.key
                          ? "border-pos-primary bg-pos-primary text-white"
                          : "border-pos-line bg-pos-surface2 text-pos-ink hover:border-pos-primaryLine",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {dateRange === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-pos-line pt-2">
                    <label className="grid gap-1 text-[11px] font-bold text-pos-muted">
                      Từ ngày
                      <input
                        type="date"
                        data-testid="history-from-date"
                        value={customFrom}
                        onChange={(event) => {
                          setCustomFrom(event.target.value);
                          resetList();
                        }}
                        className="h-9 min-w-0 rounded-[8px] border border-pos-line bg-white px-2 text-xs font-bold text-pos-ink outline-none focus:border-pos-primary"
                      />
                    </label>
                    <label className="grid gap-1 text-[11px] font-bold text-pos-muted">
                      Đến ngày
                      <input
                        type="date"
                        data-testid="history-to-date"
                        value={customTo}
                        onChange={(event) => {
                          setCustomTo(event.target.value);
                          resetList();
                        }}
                        className="h-9 min-w-0 rounded-[8px] border border-pos-line bg-white px-2 text-xs font-bold text-pos-ink outline-none focus:border-pos-primary"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <label className="relative block w-[230px] max-[900px]:w-[184px] max-[700px]:w-[132px]">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pos-muted max-[760px]:left-2"
            />
            <input
              data-testid="history-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetList();
              }}
              placeholder="Mã đơn, bàn..."
              className="h-10 w-full rounded-[9px] border border-pos-line bg-pos-surface2 pl-9 pr-3 text-sm font-semibold text-pos-ink outline-none transition-colors placeholder:text-pos-muted focus:border-pos-primary max-[760px]:h-9 max-[760px]:pl-7 max-[760px]:text-xs"
            />
          </label>

          <IconButton label="Làm mới danh sách" onClick={() => void historyQuery.refetch()}>
            <RefreshCw size={17} />
          </IconButton>
          <IconButton label="Đóng" onClick={closeDrawer}>
            <X size={18} />
          </IconButton>
        </div>
      </header>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden bg-pos-bg p-3 max-[900px]:gap-2 max-[900px]:p-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-[760px]:gap-1.5">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {statusOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                onClick={() => {
                  setStatusFilter(option.key);
                  resetList();
                }}
                className={clsx(
                  "min-h-8 rounded-full border px-3 text-xs font-black transition-colors max-[760px]:min-h-7 max-[760px]:px-2 max-[760px]:text-[11px]",
                  statusFilter === option.key
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-white text-pos-muted hover:border-pos-primaryLine hover:text-pos-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-pos-line max-[700px]:hidden" />
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {orderTypeOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                onClick={() => {
                  setOrderTypeFilter(option.key);
                  resetList();
                }}
                className={clsx(
                  "min-h-8 rounded-full border px-3 text-xs font-black transition-colors max-[760px]:min-h-7 max-[760px]:px-2 max-[760px]:text-[11px]",
                  orderTypeFilter === option.key
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-white text-pos-muted hover:border-pos-primaryLine hover:text-pos-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] gap-3 max-[900px]:gap-2 max-[760px]:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]">
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-pos-line bg-white">
            <div className="flex min-h-[48px] items-center justify-between gap-2 border-b border-pos-line px-3 py-2 max-[760px]:min-h-[40px] max-[760px]:px-2">
              <div className="min-w-0">
                <h3 className="m-0 truncate text-[15px] font-black text-pos-ink max-[760px]:text-[13px]">
                  Danh sách đơn
                </h3>
                <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-pos-muted max-[760px]:hidden">
                  {formatBusinessDate(selectedRange.fromDate)} - {formatBusinessDate(selectedRange.toDate)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-pos-surface2 px-2 py-1 text-xs font-black text-pos-muted max-[760px]:text-[11px]">
                {filtered.length}/{historyQuery.data?.total ?? 0}
              </span>
            </div>

            <div className="min-h-0 overflow-auto p-2 max-[760px]:p-1.5">
              {historyQuery.isLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-[76px] rounded-[9px] bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]"
                    />
                  ))}
                </div>
              ) : historyQuery.isError ? (
                <div className="grid h-full min-h-[220px] place-items-center content-center gap-3 text-center text-pos-muted">
                  <AlertTriangle size={32} color="#b45309" />
                  <p className="m-0 px-4 text-sm">{toToastError(historyQuery.error)}</p>
                  <button
                    type="button"
                    onClick={() => void historyQuery.refetch()}
                    className="min-h-9 rounded-[8px] border border-pos-line bg-white px-3 text-sm font-black text-pos-ink hover:border-pos-primary"
                  >
                    Tải lại
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="grid h-full min-h-[220px] place-items-center content-center gap-3 text-center text-pos-muted">
                  <ReceiptText size={34} color="#94a3b8" />
                  <p className="m-0 px-4 text-sm">Không có đơn phù hợp với bộ lọc hiện tại.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRange("today");
                      setStatusFilter("all");
                      setOrderTypeFilter("all");
                      setSearch("");
                      resetList();
                    }}
                    className="min-h-9 rounded-[8px] border border-pos-line bg-white px-3 text-sm font-black text-pos-ink hover:border-pos-primary"
                  >
                    Xem hôm nay
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((order) => (
                    <button
                      type="button"
                      key={order.id}
                      data-testid={`history-row-${order.id}`}
                      onClick={() => setSelectedId(order.id)}
                      className={clsx(
                        "grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-[9px] border px-3 py-2 text-left transition-[border-color,background,box-shadow] max-[760px]:min-h-[68px] max-[760px]:px-2 max-[760px]:py-1.5",
                        selectedId === order.id
                          ? "border-pos-primary bg-pos-primarySoft shadow-[inset_3px_0_0_var(--primary)]"
                          : "border-pos-line bg-white hover:border-pos-primaryLine hover:bg-pos-surface2",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <strong className="truncate text-[18px] font-black text-pos-ink max-[760px]:text-[14px]">
                            #{order.orderNo}
                          </strong>
                          <span
                            className={clsx(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black max-[760px]:px-1.5 max-[760px]:text-[10px]",
                              statusClass[order.status],
                            )}
                          >
                            {statusLabel[order.status]}
                          </span>
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                          <span className="truncate">{order.tableLabel}</span>
                          <span className="max-[700px]:hidden">·</span>
                          <span className="truncate max-[700px]:hidden">{order.createdAt}</span>
                        </div>
                      </div>
                      <div className="grid justify-items-end gap-1 text-right">
                        <strong className="whitespace-nowrap text-[16px] font-black text-pos-primary max-[760px]:text-[13px]">
                          {formatMoney(order.total)}
                        </strong>
                        <span className="rounded-full bg-pos-surface2 px-2 py-0.5 text-[11px] font-black text-pos-muted max-[700px]:hidden">
                          {order.orderType === "takeaway" ? "Mang đi" : "Tại bàn"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex min-h-[48px] items-center justify-between gap-2 border-t border-pos-line px-3 py-2 max-[760px]:min-h-[40px] max-[760px]:px-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="inline-flex min-h-8 items-center gap-1 rounded-[8px] border border-pos-line bg-white px-2.5 text-xs font-black text-pos-ink hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:px-1.5"
              >
                <ChevronLeft size={15} />
                <span className="max-[700px]:hidden">Trước</span>
              </button>
              <span className="text-xs font-black text-pos-muted">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="inline-flex min-h-8 items-center gap-1 rounded-[8px] border border-pos-line bg-white px-2.5 text-xs font-black text-pos-ink hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:px-1.5"
              >
                <span className="max-[700px]:hidden">Sau</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </section>

          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-pos-line bg-white">
            <div className="flex min-h-[54px] items-center justify-between gap-2 border-b border-pos-line px-3 py-2 max-[760px]:min-h-[44px] max-[760px]:px-2">
              <div className="min-w-0">
                <h3 className="m-0 truncate text-[15px] font-black text-pos-ink max-[760px]:text-[13px]">
                  {selected ? `Chi tiết đơn #${selected.orderNo}` : "Chi tiết đơn"}
                </h3>
                <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-pos-muted max-[760px]:hidden">
                  {selected ? `${selected.tableLabel} · ${selected.createdAt}` : "Chọn một đơn bên trái"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton
                  disabled={!selected}
                  label="In lại hóa đơn"
                  onClick={() => {
                    if (!selectedDetail) {
                      toast("Đang tải chi tiết đơn, thử lại sau giây lát.");
                      return;
                    }
                    const tableName = selectedDetail.tableId ? tables.get(selectedDetail.tableId) ?? null : null;
                    const receipt = receiptFromOrderDetail(selectedDetail, tableName);
                    if (!receipt) {
                      toast("Đơn này chưa có thông tin thanh toán để in lại.");
                      return;
                    }
                    openReceiptPreview({ variant: "receipt", doc: receipt });
                  }}
                >
                  <Printer size={16} />
                </IconButton>
                <IconButton disabled={!selected} label="Sao chép mã đơn" onClick={copyOrderNo}>
                  <Copy size={16} />
                </IconButton>
                <IconButton disabled={!selected} label="Tải lại chi tiết" onClick={() => void detailQuery.refetch()}>
                  <RefreshCw size={16} />
                </IconButton>
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-3 max-[760px]:p-2">
              {!selected ? (
                <div className="grid h-full min-h-[260px] place-items-center content-center gap-3 text-center text-pos-muted">
                  <ReceiptText size={34} color="#94a3b8" />
                  <p className="m-0 px-4 text-sm">Chọn một đơn để xem danh sách món và thông tin thanh toán.</p>
                </div>
              ) : detailQuery.isError ? (
                <div className="grid h-full min-h-[260px] place-items-center content-center gap-3 text-center text-pos-muted">
                  <AlertTriangle size={32} color="#b45309" />
                  <p className="m-0 px-4 text-sm">{toToastError(detailQuery.error)}</p>
                  <button
                    type="button"
                    onClick={() => void detailQuery.refetch()}
                    className="min-h-9 rounded-[8px] border border-pos-line bg-white px-3 text-sm font-black text-pos-ink hover:border-pos-primary"
                  >
                    Tải lại
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="flex min-w-0 items-start justify-between gap-2 border-b border-pos-line pb-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <strong className="truncate text-[24px] font-black leading-tight text-pos-ink max-[760px]:text-[17px]">
                          #{selected.orderNo}
                        </strong>
                        <span
                          className={clsx(
                            "shrink-0 rounded-full border px-2 py-1 text-xs font-black max-[760px]:px-1.5 max-[760px]:py-0.5 max-[760px]:text-[10px]",
                            statusClass[selected.status],
                          )}
                        >
                          {statusLabel[selected.status]}
                        </span>
                      </div>
                      <p className="m-0 mt-1 text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                        Ngày bán {selected.createdAt} · Thanh toán {paidTimeLabel}
                      </p>
                    </div>
                    {selected.status === "paid" && <CheckCircle2 className="shrink-0 text-[#16a34a]" size={22} />}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs max-[760px]:gap-1.5">
                    <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                      <span className="block truncate font-bold text-pos-muted">Khách hàng</span>
                      <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">Khách lẻ</strong>
                    </div>
                    <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                      <span className="block truncate font-bold text-pos-muted">Người thanh toán</span>
                      <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">Khách lẻ</strong>
                    </div>
                    <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                      <span className="block truncate font-bold text-pos-muted">Thu ngân</span>
                      <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">{cashierLabel}</strong>
                    </div>
                    <div className="min-w-0 rounded-[8px] border border-pos-line bg-pos-surface2 px-2 py-1.5">
                      <span className="block truncate font-bold text-pos-muted">Phương thức</span>
                      <strong className="block truncate text-[13px] text-pos-ink max-[760px]:text-xs">{paymentMethodLabel}</strong>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="m-0 text-sm font-black text-pos-ink max-[760px]:text-xs">
                        Danh sách món
                      </h4>
                      <span className="text-xs font-bold text-pos-muted">
                        {selectedDetail?.items.length ?? 0} món
                      </span>
                    </div>

                    {detailQuery.isLoading ? (
                      <div className="grid gap-2">
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="h-[64px] rounded-[9px] bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]"
                          />
                        ))}
                      </div>
                    ) : selectedDetail?.items.length ? (
                      <div className="grid gap-2">
                        {selectedDetail.items.map((item) => {
                          const meta = itemMeta(item);
                          return (
                            <div
                              key={item.id}
                              className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[9px] border border-pos-line bg-pos-surface2 px-2.5 py-2 max-[760px]:grid-cols-[34px_minmax(0,1fr)_auto] max-[760px]:gap-2 max-[760px]:px-2"
                            >
                              <div className="grid h-11 w-11 place-items-center rounded-[8px] border border-pos-line bg-white text-xs font-black text-pos-primary max-[760px]:h-[34px] max-[760px]:w-[34px]">
                                x{item.quantity}
                              </div>
                              <div className="min-w-0">
                                <strong className="block truncate text-sm font-black text-pos-ink max-[760px]:text-xs">
                                  {item.itemName}
                                </strong>
                                <span className="mt-0.5 block truncate text-xs font-semibold text-pos-muted max-[760px]:text-[11px]">
                                  {meta || "Không có tuỳ chọn"}
                                </span>
                              </div>
                              <strong className="whitespace-nowrap text-sm font-black text-pos-ink max-[760px]:text-xs">
                                {formatMoney(itemLineTotal(item))}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="m-0 rounded-[9px] border border-pos-line bg-pos-surface2 p-3 text-sm font-semibold text-pos-muted">
                        Không có chi tiết món.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              data-testid="history-payment-summary"
              className="grid gap-1.5 border-t border-pos-line bg-white px-3 py-3 shadow-[0_-10px_28px_rgb(15_23_42_/_6%)] max-[760px]:px-2 max-[760px]:py-2"
            >
              <div className="flex items-center justify-between gap-3 text-sm max-[760px]:text-xs">
                <span data-testid="history-payment-label" className="font-bold text-pos-muted">
                  Khách đưa
                </span>
                <strong className="whitespace-nowrap font-black text-pos-ink">
                  {selectedPayment ? formatMoney(selectedPayment.receivedAmount) : "Chưa ghi nhận"}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm max-[760px]:text-xs">
                <span data-testid="history-payment-label" className="font-bold text-pos-muted">
                  Tiền thừa
                </span>
                <strong className="whitespace-nowrap font-black text-[#0f766e]">
                  {selectedPayment ? formatMoney(selectedPayment.changeAmount) : "Chưa ghi nhận"}
                </strong>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-pos-line pt-2">
                <span data-testid="history-payment-label" className="text-sm font-black text-pos-ink max-[760px]:text-xs">
                  Tổng tiền
                </span>
                <strong className="whitespace-nowrap text-[24px] font-black text-pos-primary max-[760px]:text-[17px]">
                  {formatMoney(selectedDetail?.total ?? selected?.total ?? 0)}
                </strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PortalDrawer>
  );
}

export function OrderHistoryStubDrawer() {
  return <OrderHistoryDrawer />;
}
