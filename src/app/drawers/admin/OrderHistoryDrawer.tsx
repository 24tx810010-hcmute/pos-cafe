import clsx from "clsx";
import { AlertTriangle, ReceiptText, RefreshCw } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { formatCompactVnd, formatVnd } from "@/core/money";
import {
  useFloorPlanQuery,
  useOrderDetailQuery,
  useOrderHistoryQuery,
} from "@/features/pos";
import {
  useStoreSettingsQuery,
} from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import {
  DEFAULT_TIMEZONE,
  PAY_METHOD_LABEL,
  businessDateInTimezone,
  businessRangeFor,
  historyRowFromOrder,
  tableNameMap,
  type HistoryDateRange,
  type HistoryOrderTypeFilter,
  type HistoryStatusFilter,
} from "../../helpers/history.helpers";

function OrderHistoryDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const settingsQuery = useStoreSettingsQuery();
  const floorQuery = useFloorPlanQuery();
  const [dateRange, setDateRange] = useState<HistoryDateRange>("today");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<HistoryOrderTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const timezone = settingsQuery.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = businessDateInTimezone(new Date(), timezone);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const selectedRange = useMemo(
    () => businessRangeFor(dateRange, today, customFrom, customTo),
    [customFrom, customTo, dateRange, today],
  );
  const historyQuery = useOrderHistoryQuery({ ...selectedRange, page, pageSize: PAGE_SIZE });
  const detailQuery = useOrderDetailQuery(selectedId);
  const tables = useMemo(() => tableNameMap(floorQuery.data), [floorQuery.data]);
  const historyRows = useMemo(
    () => (historyQuery.data?.items ?? []).map((order) => historyRowFromOrder(order, tables)),
    [historyQuery.data?.items, tables],
  );

  const filtered = historyRows.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (orderTypeFilter !== "all" && o.orderType !== orderTypeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [o.orderNo, o.tableLabel, o.status, o.id, o.employeeName ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil((historyQuery.data?.total ?? 0) / PAGE_SIZE));
  const paginated = filtered;
  const selected = historyRows.find((o) => o.id === selectedId) ?? null;
  const selectedDetail = detailQuery.data;
  const pageRevenue = historyRows.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.total, 0);

  useEffect(() => {
    if (historyQuery.data && page > totalPages) {
      setPage(totalPages);
    }
  }, [historyQuery.data, page, totalPages]);

  // Auto-select first available order so the detail pane is never idle on load.
  // Keeps the current selection if it is still in the filtered list; re-picks the
  // first row when data arrives or filters change so no stale detail lingers.
  useEffect(() => {
    if (filtered.length === 0) return;
    if (selectedId && filtered.some((o) => o.id === selectedId)) return;
    setSelectedId(filtered[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, statusFilter, orderTypeFilter, search]);

  const dateRangeChips: Array<{ key: HistoryDateRange; label: string }> = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày" },
    { key: "month", label: "Tháng này" },
    { key: "custom", label: "Tuỳ chọn" },
  ];

  const statusChips: Array<{ key: HistoryStatusFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "paid", label: "Đã thanh toán" },
    { key: "void", label: "Đã huỷ" },
    { key: "open", label: "Đang mở" },
  ];

  const orderTypeChips: Array<{ key: HistoryOrderTypeFilter; label: string }> = [
    { key: "all", label: "Tất cả" },
    { key: "dine_in", label: "Tại bàn" },
    { key: "takeaway", label: "Mang đi" },
  ];

  const handleFilterChange = () => { setPage(1); setSelectedId(null); };

  const statusBadgeClass = (status: string) =>
    clsx(
      "inline-block rounded-[20px] px-2 py-0.5 text-[11px] font-bold",
      status === "paid" ? "bg-[#d1fae5] text-[#065f46]" : status === "void" ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#fef9c3] text-[#854d0e]",
    );
  const orderTypePillClass = (orderType: HistoryOrderTypeFilter) =>
    clsx("inline-block rounded-[20px] bg-pos-surface2 px-2 py-0.5 text-[11px] font-semibold text-pos-ink", orderType === "takeaway" ? "bg-[#ede9fe] text-[#5b21b6]" : "bg-[#e0f2fe] text-[#075985]");
  const statusLabel = (s: string) => s === "paid" ? "Đã thanh toán" : s === "void" ? "Đã huỷ" : "Đang mở";

  return (
    <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="order-history-drawer">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Lịch sử đơn</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />{historyQuery.data?.total ?? 0} đơn · online</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <div className="flex flex-wrap gap-1.5">
            {dateRangeChips.map((dc) => (
              <button
                key={dc.key}
                className={clsx("cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted", dateRange === dc.key && "border-pos-primary bg-pos-primary text-white")}
                onClick={() => { setDateRange(dc.key); handleFilterChange(); }}
              >
                {dc.label}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex flex-wrap gap-1.5">
              <TextField
                type="date"
                size="small"
                label="Từ"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); handleFilterChange(); }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "history-from-date" }}
              />
              <TextField
                type="date"
                size="small"
                label="Đến"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); handleFilterChange(); }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "history-to-date" }}
              />
            </div>
          )}
          <TextField
            size="small"
            placeholder="Tìm mã đơn / bàn..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
            className="max-w-[200px]"
            inputProps={{ "data-testid": "history-search" }}
          />
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin] gap-1.5">
          {statusChips.map((sc) => (
            <button
              key={sc.key}
              className={clsx("cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted", statusFilter === sc.key && "border-pos-primary bg-pos-primary text-white")}
              onClick={() => { setStatusFilter(sc.key); handleFilterChange(); }}
            >
              {sc.label}
              <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">
                {sc.key === "all" ? historyRows.length : historyRows.filter((o) => o.status === sc.key).length}
              </span>
            </button>
          ))}
          <span className="mx-1 my-0.5 min-h-6 w-px self-stretch bg-pos-line" aria-hidden="true" />
          {orderTypeChips.map((oc) => (
            <button
              key={oc.key}
              className={clsx("cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted", orderTypeFilter === oc.key && "border-pos-primary bg-pos-primary text-white")}
              onClick={() => { setOrderTypeFilter(oc.key); handleFilterChange(); }}
            >
              {oc.label}
              <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">
                {oc.key === "all" ? historyRows.length : historyRows.filter((o) => o.orderType === oc.key).length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-2.5 max-[980px]:min-w-[650px]">
          {/* List */}
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
              <span>Danh sách đơn</span>
              <span className="text-pos-muted">{filtered.length} kết quả</span>
            </div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 !p-0 flex flex-col gap-0">
              {historyQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-pos bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]" />)}
                </div>
              ) : historyQuery.isError ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                  <AlertTriangle size={32} color="#b45309" />
                  <p>{toToastError(historyQuery.error)}</p>
                  <Button variant="outlined" size="small" onClick={() => void historyQuery.refetch()}>
                    Tải lại
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                  <ReceiptText size={32} color="#94a3b8" />
                  <p>Chưa có đơn đã thanh toán trong khoảng này.</p>
                  {dateRange === "today" ? (
                    <Button variant="outlined" size="small" startIcon={<RefreshCw size={15} />} onClick={() => void historyQuery.refetch()}>
                      Làm mới
                    </Button>
                  ) : (
                    <Button variant="outlined" size="small" onClick={() => { setDateRange("today"); handleFilterChange(); }}>
                      Xem hôm nay
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-2.5 flex flex-wrap gap-x-[18px] gap-y-2 rounded-pos border border-pos-line bg-pos-surface2 px-2.5 py-2 text-xs text-pos-muted [&_strong]:text-pos-ink">
                    <span>Doanh thu trang này <strong className="font-black text-pos-primary">{formatVnd(pageRevenue)}</strong></span>
                    <span>Đã thanh toán <strong>{historyRows.filter((o) => o.status === "paid").length}</strong></span>
                    <span>Đã huỷ <strong>{historyRows.filter((o) => o.status === "void").length}</strong></span>
                  </div>
                  {/* Desktop/tablet table */}
                  <table className="w-full border-collapse text-[13px] max-[768px]:hidden [&_td]:border-b [&_td]:border-pos-line [&_td]:px-3 [&_td]:py-[9px] [&_td]:align-middle [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:border-b-[1.5px] [&_th]:border-pos-line [&_th]:bg-pos-surface [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-pos-muted">
                    <thead>
                      <tr>
                        <th>Ngày</th>
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
                          className={clsx("cursor-pointer transition-colors hover:bg-pos-surface2", selectedId === o.id && "bg-pos-primarySoft")}
                          data-testid={`history-row-${o.id}`}
                          onClick={() => setSelectedId(o.id)}
                        >
                          <td className="text-pos-muted">{o.createdAt}</td>
                          <td><strong>#{o.orderNo}</strong></td>
                          <td>
                            <span className={orderTypePillClass(o.orderType)}>
                              {o.orderType === "takeaway" ? "Mang đi" : o.tableLabel}
                            </span>
                          </td>
                          <td>{o.employeeName ?? "—"}</td>
                          <td><strong className="font-black text-pos-primary">{formatCompactVnd(o.total)}</strong></td>
                          <td><span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Phone landscape cards */}
                  <div className="hidden flex-col gap-2 p-2 max-[768px]:flex">
                    {paginated.map((o) => (
                      <div
                        key={o.id}
                        className={clsx("cursor-pointer rounded-pos border-[1.5px] border-pos-line px-3 py-2.5 transition-colors hover:border-pos-primary", selectedId === o.id && "border-pos-primary bg-pos-primarySoft")}
                        onClick={() => setSelectedId(o.id)}
                      >
                        <div className="mb-1 flex justify-between">
                          <strong>#{o.orderNo}</strong>
                          <span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span>
                        </div>
                        <div className="mb-1.5 flex flex-wrap gap-2 text-xs">
                          <span className="text-pos-muted">{o.createdAt}</span>
                          <span className={orderTypePillClass(o.orderType)}>{o.orderType === "takeaway" ? "Mang đi" : o.tableLabel}</span>
                          <span className="text-pos-muted">{o.employeeName ?? "—"}</span>
                        </div>
                        <strong className="font-black text-pos-primary">{formatVnd(o.total)}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-pos-line p-3">
                      <button className="cursor-pointer rounded-[6px] border-[1.5px] border-pos-line bg-transparent px-3.5 py-[5px] text-[13px] font-semibold text-pos-ink transition-[background,border-color,color] enabled:hover:border-pos-primary enabled:hover:bg-pos-surface2 enabled:hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
                      <span className="text-[13px] text-pos-muted">Trang {page} / {totalPages}</span>
                      <button className="cursor-pointer rounded-[6px] border-[1.5px] border-pos-line bg-transparent px-3.5 py-[5px] text-[13px] font-semibold text-pos-ink transition-[background,border-color,color] enabled:hover:border-pos-primary enabled:hover:bg-pos-surface2 enabled:hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Sau ›</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Right: detail */}
          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">Chi tiết đơn</div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
              {!selected ? (
                <p className="text-pos-muted p-4">Chọn đơn để xem chi tiết.</p>
              ) : (
                <div className="flex flex-col gap-2 px-3.5 py-3">
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Đơn số</span><strong>#{selected.orderNo}</strong></div>
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Ngày</span><strong>{selected.createdAt}</strong></div>
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                    <span>Loại</span>
                    <strong>
                      <span className={orderTypePillClass(selected.orderType)}>
                        {selected.orderType === "takeaway" ? "Mang đi" : `Tại bàn · ${selected.tableLabel}`}
                      </span>
                    </strong>
                  </div>
                  {selected.employeeName && (
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Nhân viên</span><strong>{selected.employeeName}</strong></div>
                  )}
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted">
                    <span>Trạng thái</span>
                    <strong><span className={statusBadgeClass(selected.status)}>{statusLabel(selected.status)}</span></strong>
                  </div>
                  {selected.payMethod && (
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Thanh toán</span><strong>{PAY_METHOD_LABEL[selected.payMethod] ?? selected.payMethod}</strong></div>
                  )}
                  <div className="my-1 border-t border-pos-line" />
                  <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.05em] text-pos-muted">Món</div>
                  {detailQuery.isLoading ? (
                    <p className="text-pos-muted">Đang tải chi tiết...</p>
                  ) : detailQuery.isError ? (
                    <p className="text-pos-muted">{toToastError(detailQuery.error)}</p>
                  ) : selectedDetail?.items.length ? (
                    selectedDetail.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-2 text-[13px]">
                        <span>{item.itemName} × {item.quantity}</span>
                        <strong>{formatCompactVnd(item.unitPrice * item.quantity)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-pos-muted">Không có chi tiết món.</p>
                  )}
                  <div className="my-1 border-t border-pos-line" />
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted mt-1 text-[15px]"><span>Tổng</span><strong className="font-black text-pos-primary">{formatVnd(selectedDetail?.total ?? selected.total)}</strong></div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<ReceiptText size={15} />}
                      onClick={() => toast("Tính năng in lại sẽ dùng bản lưu hoá đơn ở bước sau.")}
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

export function OrderHistoryStubDrawer() {
  return <OrderHistoryDrawer />;
}
