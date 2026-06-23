import { AlertTriangle, ClipboardList, CreditCard, Plus } from "lucide-react";
import clsx from "clsx";
import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import type { FloorPlan, OrderSummary } from "@/domain";
import { formatCompactVnd, formatVnd } from "@/core/money";
import { useOrderDetailQuery, useTakeawayOpenOrdersQuery } from "@/features/pos";
import { toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { useAppStore } from "../../useAppStore";

type TakeawayFilter = "open" | "paid" | "today";

export function TakeawayDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openOrder = useAppStore((state) => state.openOrder);
  const openPayment = useAppStore((state) => state.openPayment);
  const [filter, setFilter] = useState<TakeawayFilter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openOrdersQuery = useTakeawayOpenOrdersQuery();
  const takeawayOpen = openOrdersQuery.data ?? [];
  const detailQuery = useOrderDetailQuery(filter !== "paid" ? selectedId : null);

  const filterChips: Array<{ key: TakeawayFilter; label: string }> = [
    { key: "open", label: "Đang mở" },
    { key: "paid", label: "Đã thanh toán" },
    { key: "today", label: "Hôm nay" },
  ];

  // Lịch sử đơn đã thanh toán xem ở Lịch sử đơn; ở đây chỉ liệt kê đơn đang mở.
  const displayOrders: Array<{ id: string; orderNo: number; total: number; status?: string; createdAt?: string; itemCount?: number; note?: string | null; employeeName?: string }> =
    filter === "paid" ? [] : takeawayOpen.map((o) => ({ id: o.id, orderNo: o.orderNo, total: o.total }));

  useEffect(() => {
    if (!selectedId && displayOrders.length > 0) {
      setSelectedId(displayOrders[0].id);
    }
  }, [displayOrders, selectedId]);

  return (
    <PortalDrawer testId="takeaway-drawer" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Đơn mang đi</h2>
          <p>
            <span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" /> {takeawayOpen.length} đơn đang mở
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <div className="flex flex-wrap gap-2">
            {filterChips.map((fc) => (
              <button
                key={fc.key}
                className={clsx(
                  "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[3px] text-xs font-bold",
                  filter === fc.key
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-pos-surface text-pos-muted",
                )}
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

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2">
        <div className="grid h-full min-h-0 min-w-[600px] grid-cols-[minmax(340px,420px)_minmax(280px,1fr)] gap-2.5">
          {/* Left: order list */}
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
              <span>Danh sách</span>
              <span className="text-pos-muted">{displayOrders.length} đơn</span>
            </div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
              {openOrdersQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-pos bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite]" />)}
                </div>
              ) : openOrdersQuery.isError ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="takeaway-error-state">
                  <AlertTriangle size={32} color="#b45309" />
                  <strong>Không tải được đơn mang đi</strong>
                  <p>{toToastError(openOrdersQuery.error)}</p>
                  <Button variant="contained" size="small" onClick={() => void openOrdersQuery.refetch()}>
                    Thử tải lại
                  </Button>
                </div>
              ) : displayOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
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
                <div className="flex flex-col gap-2 p-2">
                  {displayOrders.map((ord) => {
                    const isPaid = ord.status === "paid";
                    const isSelected = selectedId === ord.id;
                    return (
                      <div
                        key={ord.id}
                        className={clsx(
                          "cursor-pointer rounded-pos border-[1.5px] px-3 py-2.5 text-left transition-[border-color,box-shadow] hover:border-pos-primary",
                          isSelected
                            ? "border-pos-primary bg-pos-primarySoft shadow-[0_0_0_2px_var(--primary-soft)]"
                            : "border-pos-line bg-pos-surface",
                          isPaid && "opacity-75",
                          isPaid && isSelected && "opacity-100",
                        )}
                        onClick={() => setSelectedId(isSelected ? null : ord.id)}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-bold">#{ord.orderNo}</span>
                          <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-bold", isPaid ? "bg-[#e0e7ff] text-[#3730a3]" : "bg-[#d1fae5] text-[#065f46]")}>
                            {isPaid ? "Đã thanh toán" : "Đang mở"}
                          </span>
                        </div>
                        <div className="mb-1 flex gap-2.5 text-xs">
                          {ord.createdAt && <span className="text-pos-muted">{ord.createdAt}</span>}
                          {ord.itemCount !== undefined && <span className="text-pos-muted">{ord.itemCount} món</span>}
                        </div>
                        <div className="mb-2">
                          <strong className="font-black text-pos-primary">{formatVnd(ord.total)}</strong>
                        </div>
                        {!isPaid && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="cursor-pointer rounded-[6px] border-[1.5px] border-pos-line bg-transparent px-2.5 py-1 text-xs font-semibold text-pos-ink transition-[background,border-color] hover:border-pos-primary hover:bg-pos-surface2"
                              onClick={(e) => { e.stopPropagation(); closeDrawer(); openOrder({ orderId: ord.id, tableId: null, orderType: "takeaway" }); }}
                            >
                              Mở đơn
                            </button>
                            <button
                              className="cursor-pointer rounded-[6px] border-[1.5px] border-pos-primary bg-pos-primary px-2.5 py-1 text-xs font-semibold text-white transition-[background,border-color] hover:bg-[#0d6560]"
                              onClick={(e) => { e.stopPropagation(); closeDrawer(); openPayment(ord.id); }}
                            >
                              Thanh toán
                            </button>
                          </div>
                        )}
                        {isPaid && (
                          <div className="flex flex-wrap gap-2">
                            <button className="cursor-pointer rounded-[6px] border-[1.5px] border-pos-line bg-transparent px-2.5 py-1 text-xs font-semibold text-pos-ink transition-[background,border-color] hover:border-pos-primary hover:bg-pos-surface2" onClick={(e) => e.stopPropagation()}>
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
          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">Chi tiết đơn</div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
              {!selectedId ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                  <ClipboardList size={30} color="#94a3b8" />
                  <p>Chưa có đơn để xem. Tạo đơn mang đi để bắt đầu.</p>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Plus size={15} />}
                    onClick={() => { closeDrawer(); openOrder({ orderId: null, tableId: null, orderType: "takeaway" }); }}
                  >
                    Tạo đơn mang đi
                  </Button>
                </div>
              ) : detailQuery.isLoading ? (
                <p className="text-pos-muted p-4">Đang tải...</p>
              ) : detailQuery.isError ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="takeaway-detail-error-state">
                  <AlertTriangle size={30} color="#b45309" />
                  <p>{toToastError(detailQuery.error)}</p>
                  <Button variant="outlined" size="small" onClick={() => void detailQuery.refetch()}>
                    Thử lại
                  </Button>
                </div>
              ) : detailQuery.data ? (
                <div className="flex flex-col gap-2 px-3.5 py-3">
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Đơn số</span><strong>#{detailQuery.data.orderNo}</strong></div>
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Ngày</span><strong>{detailQuery.data.businessDate}</strong></div>
                  <div className="my-1 border-t border-pos-line" />
                  {detailQuery.data.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 text-[13px]">
                      <span>{item.itemName} × {item.quantity}</span>
                      <strong>{formatCompactVnd(item.unitPrice * item.quantity)}</strong>
                    </div>
                  ))}
                  <div className="my-1 border-t border-pos-line" />
                  <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted mt-1 text-[15px]"><span>Tổng</span><strong className="font-black text-pos-primary">{formatVnd(detailQuery.data.total)}</strong></div>
                  <div className="mt-2 flex flex-col gap-2">
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
                <p className="text-pos-muted p-4">Không tìm thấy đơn.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PortalDrawer>
  );
}
