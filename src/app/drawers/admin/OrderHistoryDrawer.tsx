import clsx from "clsx";
import { CalendarDays, ChevronDown, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useFloorPlanQuery, useOrderDetailQuery, useOrderHistoryQuery } from "@/features/pos";
import { useAdminEmployeesQuery, useStoreSettingsQuery } from "@/features/admin";
import { useAppStore } from "../../useAppStore";
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
import { OrderHistoryDetailPane } from "./OrderHistoryDetailPane";
import { OrderHistoryListPane } from "./OrderHistoryListPane";
import { IconButton } from "./orderHistoryShared";

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

export function OrderHistoryDrawer() {
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

  const reprintReceipt = () => {
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
  };

  const clearFilters = () => {
    setDateRange("today");
    setStatusFilter("all");
    setOrderTypeFilter("all");
    setSearch("");
    resetList();
  };

  const dateRangeLabel = `${formatBusinessDate(selectedRange.fromDate)} - ${formatBusinessDate(selectedRange.toDate)}`;

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
          <OrderHistoryListPane
            rows={filtered}
            total={historyQuery.data?.total ?? 0}
            dateRangeLabel={dateRangeLabel}
            isLoading={historyQuery.isLoading}
            isError={historyQuery.isError}
            error={historyQuery.error}
            selectedId={selectedId}
            page={page}
            totalPages={totalPages}
            onSelect={setSelectedId}
            onRetry={() => void historyQuery.refetch()}
            onClearFilters={clearFilters}
            onPageChange={setPage}
          />

          <OrderHistoryDetailPane
            selected={selected}
            detail={selectedDetail}
            payment={selectedPayment}
            isLoading={detailQuery.isLoading}
            isError={detailQuery.isError}
            error={detailQuery.error}
            cashierLabel={cashierLabel}
            paymentMethodLabel={paymentMethodLabel}
            paidTimeLabel={paidTimeLabel}
            onReprint={reprintReceipt}
            onCopyOrderNo={copyOrderNo}
            onRetry={() => void detailQuery.refetch()}
          />
        </div>
      </div>
    </PortalDrawer>
  );
}
