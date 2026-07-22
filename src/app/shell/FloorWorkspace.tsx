import { AlertTriangle, LayoutGrid, RefreshCw } from "lucide-react";
import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { FloorTable, OrderSummary } from "@/domain";
import { formatCompactVnd } from "@/core/money";
import { useFloorPlanQuery, useOpenOrdersQuery } from "@/features/pos";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";
import { getLabelBoost, getObjectBoost, stageStyle } from "../floorStage";
import { ScaledFloorStage } from "../components/ScaledFloorStage";
import clsx from "clsx";

type TableFilter = "all" | "empty" | "occupied";

const decorToneClass = (kind: string) => {
  switch (kind) {
    case "counter":
      return "border-[#94a3b8] bg-[#e2e8f0] text-[#475569]";
    case "decor":
    case "image":
      return "border-[#c4b5fd] bg-[#ede9fe] text-[#6d28d9]";
    case "door":
      return "border-[#fde047] bg-[#fef9c3] text-[#713f12]";
    case "plant":
      return "border-[#86efac] bg-[#dcfce7] text-[#166534]";
    case "wall":
      return "border-[#cbd5e1] bg-[#f1f5f9] text-[#64748b]";
    default:
      return "border-[#cbd5e1] bg-[#e2e8f0] text-[#475569]";
  }
};

const nodeTransform = (rotation = 0, boost = 1) => ({
  transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${boost})`,
  transformOrigin: "center",
});

export function FloorWorkspace() {
  const activeAreaId = useAppStore((state) => state.activeAreaId);
  const setActiveAreaId = useAppStore((state) => state.setActiveAreaId);
  const openOrder = useAppStore((state) => state.openOrder);

  const floorPlanQuery = useFloorPlanQuery();
  const openOrdersQuery = useOpenOrdersQuery();

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

  const openTableOrder = async (table: FloorTable, cachedOrder?: OrderSummary) => {
    if (cachedOrder) {
      openOrder({
        orderId: cachedOrder.id,
        tableId: table.id,
        orderType: "dine_in",
      });
      return;
    }

    const refreshed = await openOrdersQuery.refetch();
    const freshOrder = refreshed.data?.find((order) => order.tableId === table.id);
    openOrder({
      orderId: freshOrder?.id ?? null,
      tableId: table.id,
      orderType: "dine_in",
    });
  };

  const filteredTables = allTables.filter((t) => {
    if (tableFilter === "empty") return !isOccupied(t.id);
    if (tableFilter === "occupied") return isOccupied(t.id);
    return true;
  });

  const takeawayOrders = orders.filter((o) => o.orderType === "takeaway");
  const dineInOrders = orders.filter((o) => o.orderType === "dine_in");

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_200px] gap-2.5 overflow-hidden p-3.5 max-[1024px]:grid-cols-[minmax(0,1fr)_160px] max-[980px]:p-2 max-[740px]:grid-cols-1">
        {/* Main region: floor canvas */}
        <section className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface" data-testid="floor-view">
          <div className="flex min-h-12 min-w-0 items-center overflow-x-auto border-b border-pos-line">
            <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3 py-1.5">
              {floorPlan?.areas.map((area) => (
                <button
                  className={clsx(
                    "min-h-[34px] whitespace-nowrap rounded-[7px] border px-3 font-extrabold",
                    area.id === areaId
                      ? "border-[rgb(15_118_110_/_45%)] bg-pos-primarySoft text-pos-primary"
                      : "border-pos-line bg-pos-surface text-pos-muted",
                  )}
                  key={area.id}
                  onClick={() => setActiveAreaId(area.id)}
                >
                  {area.name}
                </button>
              ))}
            </div>
            <button
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-[7px] border border-pos-line bg-pos-surface px-3 text-xs font-extrabold text-pos-primary transition-colors hover:border-pos-primary hover:bg-pos-primarySoft"
              data-testid="floor-refresh-button"
              onClick={() => {
                void floorPlanQuery.refetch();
                void openOrdersQuery.refetch();
                toast.success("Đã làm mới dữ liệu");
              }}
            >
              <RefreshCw size={14} />
              Làm mới
            </button>
            <div className="flex shrink-0 gap-1.5 border-l border-pos-line px-3 py-1.5">
              {(["all", "empty", "occupied"] as TableFilter[]).map((f) => (
                <button
                  key={f}
                  className={clsx(
                    "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[3px] text-xs font-bold",
                    tableFilter === f
                      ? "border-pos-primary bg-pos-primary text-white"
                      : "border-pos-line bg-pos-surface text-pos-muted",
                  )}
                  onClick={() => setTableFilter(f)}
                >
                  {f === "all" ? "Tất cả" : f === "empty" ? "Trống" : "Đang phục vụ"}
                </button>
              ))}
            </div>
          </div>
          {floorPlanQuery.isLoading ? (
            <div className="grid flex-1 place-items-center gap-2.5 p-10 text-center text-sm text-pos-muted">Đang tải sơ đồ...</div>
          ) : floorPlanQuery.isError ? (
            <div className="grid flex-1 place-items-center gap-2.5 p-10 text-center text-sm text-pos-muted" data-testid="floor-error-state">
              <AlertTriangle size={32} color="#b45309" />
              <p>Không tải được sơ đồ bàn.</p>
              <p className="text-pos-muted">{toToastError(floorPlanQuery.error)}</p>
              <Button variant="contained" size="small" onClick={() => void floorPlanQuery.refetch()}>
                Thử tải lại
              </Button>
            </div>
          ) : allTables.length === 0 ? (
            <div className="grid flex-1 place-items-center gap-2.5 p-10 text-center text-sm text-pos-muted">
              <LayoutGrid size={32} color="#94a3b8" />
              <p>Chưa có bàn. Vào Sơ đồ để tạo bàn.</p>
            </div>
          ) : (
            <div className="min-h-0 p-3.5 max-[980px]:p-2">
              <ScaledFloorStage testId="floor-stage">
                {({ scale }) => {
                  const tableBoost = getObjectBoost(scale);
                  const tableLabelBoost = getLabelBoost(scale * tableBoost);
                  const decorLabelBoost = getLabelBoost(scale);

                  return (
                    <>
                {decorItems.map((decor) => (
                  <div
                    className={clsx(
                      "absolute grid place-items-center rounded-pos border border-dashed text-center text-xs font-black",
                      decorToneClass(decor.kind),
                    )}
                    data-testid={`decor-${decor.id}`}
                    key={decor.id}
                    style={{ ...stageStyle(decor.posX, decor.posY, decor.width, decor.height), ...nodeTransform(decor.rotation) }}
                  >
                    <span
                      data-floor-label="name"
                      style={{ transform: `scale(${decorLabelBoost})`, transformOrigin: "center" }}
                    >
                      {decor.label ?? decor.assetKey}
                    </span>
                  </div>
                ))}
                {filteredTables.map((table) => {
                  const openOrderSummary = orders.find((o) => o.tableId === table.id);
                  const occupied = isOccupied(table.id);
                  const isRound = table.shape === "round";
                  return (
                    <button
                      className={clsx(
                        "absolute grid place-items-center border-2 text-center font-black shadow-[0_8px_18px_rgb(15_23_42_/_10%)]",
                        occupied ? "border-[#f97316] bg-[#fff7ed]" : "border-[#86efac] bg-[#f0fdf4]",
                        isRound ? "rounded-full" : "rounded-pos",
                      )}
                      data-testid={`table-${table.id}`}
                      key={table.id}
                      style={{ ...stageStyle(table.posX, table.posY, table.width, table.height), ...nodeTransform(table.rotation, tableBoost) }}
                      onClick={() => void openTableOrder(table, openOrderSummary)}
                    >
                      <span
                        className="grid place-items-center gap-0.5 leading-none"
                        style={{ transform: `scale(${tableLabelBoost})`, transformOrigin: "center" }}
                      >
                        <strong data-floor-label="name" className="block text-[13px] font-extrabold leading-none">
                          {table.name}
                        </strong>
                        {openOrderSummary && (
                          <small data-floor-label="price" className="block text-[11px] font-bold leading-none text-[#ea580c]">
                            {formatCompactVnd(openOrderSummary.total)}
                          </small>
                        )}
                      </span>
                    </button>
                  );
                })}
                    </>
                  );
                }}
              </ScaledFloorStage>
            </div>
          )}
        </section>

        {/* Right open orders panel */}
        <aside className="grid content-start grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface max-[740px]:hidden">
          <div className="px-3.5 pb-2 pt-3 text-[10px] font-extrabold uppercase tracking-[0.07em] text-pos-muted">Đơn đang mở · {dineInOrders.length}</div>
          <div className="grid content-start gap-1.5 overflow-y-auto px-2.5 pb-2.5 pt-1.5">
            {openOrdersQuery.isLoading ? (
              <p className="m-0 py-3 text-center text-[13px] text-pos-muted">Đang tải đơn đang mở...</p>
            ) : openOrdersQuery.isError ? (
              <div className="m-0 py-3 text-center text-[13px] text-pos-muted" data-testid="floor-orders-error-state">
                <p>Không tải được đơn đang mở.</p>
                <Button variant="outlined" size="small" onClick={() => void openOrdersQuery.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : dineInOrders.length === 0 ? (
              <p className="m-0 py-3 text-center text-[13px] text-pos-muted">Chưa có đơn tại bàn.</p>
            ) : (
              dineInOrders.map((ord) => {
                const table = floorPlan?.tables.find((t) => t.id === ord.tableId);
                return (
                  <button
                    key={ord.id}
                    className="grid cursor-pointer gap-[3px] rounded-[7px] border border-pos-line bg-pos-bg px-2.5 py-2 text-left transition-colors hover:border-pos-primary"
                    onClick={() => openOrder({ orderId: ord.id, tableId: ord.tableId, orderType: "dine_in" })}
                  >
                    <div className="flex justify-between text-[13px]">
                      <strong>{table?.name ?? ord.tableId}</strong>
                      <span className="text-[11px] font-bold text-pos-muted">#{ord.orderNo}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#ea580c]">Đang phục vụ</span>
                      <span className="text-sm font-extrabold text-pos-primary">{formatCompactVnd(ord.total)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {takeawayOrders.length > 0 && (
            <>
              <div className="border-t border-pos-line px-3.5 pb-2 pt-2.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-pos-muted">
                Mang đi · {takeawayOrders.length}
              </div>
              <div className="grid content-start gap-1.5 overflow-y-auto px-2.5 pb-2.5 pt-1.5">
                {takeawayOrders.map((ord) => (
                  <button
                    key={ord.id}
                    className="grid cursor-pointer gap-[3px] rounded-[7px] border border-pos-line bg-pos-bg px-2.5 py-2 text-left transition-colors hover:border-pos-primary border-l-[3px] border-l-[#6366f1]"
                    onClick={() => openOrder({ orderId: ord.id, tableId: null, orderType: "takeaway" })}
                  >
                    <div className="flex justify-between text-[13px]">
                      <strong>Mang đi</strong>
                      <span className="text-[11px] font-bold text-pos-muted">#{ord.orderNo}</span>
                    </div>
                    <div className="text-sm font-extrabold text-pos-primary">{formatCompactVnd(ord.total)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
    </div>
  );
}
