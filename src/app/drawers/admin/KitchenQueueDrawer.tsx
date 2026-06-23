import clsx from "clsx";
import { CheckCircle2, ChefHat, RotateCcw } from "lucide-react";
import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PortalDrawer } from "../../components/PortalDrawer";
import { useAppStore } from "../../useAppStore";

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

// Seam UI-only: hàng chờ bếp sẽ nối với đơn thật ở giai đoạn sau. Hiện để rỗng
// (không dựng vé giả) — store mới sẽ thấy hàng chờ trống.
const KITCHEN_TICKETS: KitchenTicket[] = [];

const KITCHEN_STATION_LABEL: Record<KitchenStation, string> = { drink: "Pha chế", food: "Bánh" };

export function KitchenQueueDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const [statusFilter, setStatusFilter] = useState<KitchenStatusFilter>("waiting");
  const [station, setStation] = useState<KitchenStationFilter>("all");
  const [statusById, setStatusById] = useState<Record<string, KitchenStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const statusOf = (id: string) => statusById[id] ?? "waiting";
  const markDone = (id: string) => { setStatusById((p) => ({ ...p, [id]: "done" })); toast.success("Đã đánh dấu xong"); };
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

  // Keep the detail pane busy: auto-select the first ticket in the current filter
  // (the first waiting ticket on open) and re-pick when the visible queue changes.
  useEffect(() => {
    if (tickets.length === 0) return;
    if (selectedId && tickets.some((t) => t.id === selectedId)) return;
    setSelectedId(tickets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, station, statusById]);

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

  const renderItemLine = (i: KitchenItem, done = false) => (
    <div className="flex items-start gap-2" key={i.id}>
      <span className="min-w-[26px] font-black text-pos-primary">{i.qty}×</span>
      <div className={clsx("grid min-w-0 flex-1 gap-px", done && "[&_strong]:line-through")}>
        <strong>{i.name}</strong>
        {i.options.length > 0 && <span className="text-xs text-pos-muted">{i.options.join(" · ")}</span>}
        {i.note && <span className="text-xs text-pos-warning">Ghi chú: {i.note}</span>}
      </div>
      <span className={clsx("shrink-0 self-start rounded-full border px-2 py-px text-[11px] font-bold", i.station === "drink" ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-[#fde047] bg-[#fef9c3] text-[#854d0e]")}>{KITCHEN_STATION_LABEL[i.station]}</span>
    </div>
  );

  return (
    <PortalDrawer testId="kitchen-drawer" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Bếp / Pha chế</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />{waitingCount} vé đang chờ · online</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <div className="flex min-w-0 flex-wrap gap-2">
            {statusChips.map((c) => (
              <button
                key={c.key}
                className={clsx(
                  "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[3px] text-xs font-bold",
                  statusFilter === c.key
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-pos-surface text-pos-muted",
                )}
                onClick={() => { setStatusFilter(c.key); setSelectedId(null); }}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin]">
          {stationChips.map((c) => (
            <button
              key={c.key}
              className={clsx(
                "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[3px] text-xs font-bold",
                station === c.key
                  ? "border-pos-primary bg-pos-primary text-white"
                  : "border-pos-line bg-pos-surface text-pos-muted",
              )}
              onClick={() => setStation(c.key)}
            >
              {c.label}
              <span className="rounded-[10px] bg-pos-surface2 px-1.5 py-px text-[11px] font-semibold text-pos-muted">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-2.5 max-[980px]:min-w-[650px]">
          {/* Queue */}
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
              <span>Hàng chờ</span>
              <span className="text-pos-muted">{tickets.length} vé</span>
            </div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                  <ChefHat size={32} color="#94a3b8" />
                  <p>{statusFilter === "done" ? "Chưa có món đã xong." : "Không có món đang chờ."}</p>
                </div>
              ) : (
                <div className="grid content-start gap-2.5">
                  {tickets.map((t) => {
                    const st = statusOf(t.id);
                    const items = stationItems(t);
                    return (
                      <div
                        key={t.id}
                        className={clsx(
                          "grid cursor-pointer gap-2 rounded-pos border-[1.5px] px-3 py-2.5 transition-[border-color,box-shadow] hover:border-pos-primary",
                          selectedId === t.id
                            ? "border-pos-primary bg-white shadow-[0_0_0_2px_var(--primary-soft)]"
                            : st === "done"
                              ? "border-pos-line bg-pos-surface2"
                              : "border-pos-line bg-white",
                          st === "done" && "opacity-[0.62]",
                        )}
                        data-testid={`kitchen-ticket-${t.id}`}
                        onClick={() => setSelectedId(t.id)}
                      >
                        <div className="flex items-center gap-2 [&_strong]:text-[15px]">
                          <strong>#{t.orderNo}</strong>
                          <span className={clsx("inline-block rounded-[20px] px-2 py-0.5 text-[11px] font-semibold", t.type === "takeaway" ? "bg-[#ede9fe] text-[#5b21b6]" : "bg-[#e0f2fe] text-[#075985]")}>
                            {t.type === "takeaway" ? "Mang đi" : t.target}
                          </span>
                          <span className={clsx("ml-auto text-xs font-extrabold", t.minutesAgo >= 10 ? "text-pos-danger" : "text-pos-muted")}>{t.minutesAgo} phút</span>
                        </div>
                        <div className="grid gap-1.5">
                          {items.map((item) => renderItemLine(item, st === "done"))}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-pos-line pt-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-pos-muted">{items.reduce((s, i) => s + i.qty, 0)} món</span>
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

          {/* Detail */}
          <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
            <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">Chi tiết vé</div>
            <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
              {!selected ? (
                <p className="text-pos-muted p-2">Chọn một vé để xem chi tiết.</p>
              ) : (
                <>
                  <div className="rounded-pos border border-pos-line bg-pos-surface2 px-3 py-2.5">
                    <div className="text-[13px] font-extrabold">Vé #{selected.orderNo}</div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Nơi nhận</span><strong>{selected.type === "takeaway" ? "Mang đi" : selected.target}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Chờ</span><strong>{selected.minutesAgo} phút</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Trạng thái</span><strong>{statusOf(selected.id) === "done" ? "Đã xong" : "Đang chờ"}</strong></div>
                  </div>
                  <div className="rounded-pos border border-pos-line bg-pos-surface2 px-3 py-2.5">
                    <div className="text-[13px] font-extrabold">Món ({selected.items.length})</div>
                    {selected.items.map((item) => renderItemLine(item))}
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
    </PortalDrawer>
  );
}
