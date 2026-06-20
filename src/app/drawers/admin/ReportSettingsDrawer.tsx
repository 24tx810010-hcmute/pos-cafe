import clsx from "clsx";
import { AlertTriangle, BarChart3, Download, RefreshCw, ShieldAlert } from "lucide-react";
import { Button, TextField, Tooltip } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type { CoreReport } from "@/domain";
import { canAccessModule } from "@/core/guards";
import { formatCompactVnd, formatVnd } from "@/core/money";
import {
  useFloorPlanQuery,
  useCoreReportsQuery,
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
  enumerateBusinessDates,
  tableNameMap,
} from "../../helpers/history.helpers";
import {
  buildReportDatasetFromReports,
  type ReportRange,
  type ReportSection,
} from "../../helpers/report.helpers";
import { Metric } from "../../components/Metric";

export function ReportSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "report");
  const settingsQuery = useStoreSettingsQuery();
  const floorQuery = useFloorPlanQuery();

  const [range, setRange] = useState<ReportRange>("today");
  const [section, setSection] = useState<ReportSection>("overview");
  const [selected, setSelected] = useState<{ type: "hour" | "item"; key: string } | null>(null);
  const timezone = settingsQuery.data?.timezone ?? DEFAULT_TIMEZONE;
  const today = businessDateInTimezone(new Date(), timezone);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const selectedRange = useMemo(
    () => businessRangeFor(range, today, customFrom, customTo),
    [customFrom, customTo, range, today],
  );
  const reportDates = useMemo(() => enumerateBusinessDates(selectedRange), [selectedRange]);
  const reportFilters = useMemo(() => reportDates.map((businessDate) => ({ businessDate })), [reportDates]);
  const reportQueries = useCoreReportsQuery(reportFilters);
  const reportHistoryQuery = useOrderHistoryQuery({ ...selectedRange, page: 1, pageSize: 20 });
  const tables = useMemo(() => tableNameMap(floorQuery.data), [floorQuery.data]);
  const reports = reportQueries
    .map((query) => query.data)
    .filter((report): report is CoreReport => Boolean(report));
  const loading = reportQueries.some((query) => query.isLoading) || reportHistoryQuery.isLoading;
  const reportError = reportQueries.find((query) => query.isError)?.error ?? (reportHistoryQuery.isError ? reportHistoryQuery.error : null);

  const dataset = useMemo(
    () => buildReportDatasetFromReports(reports, reportDates, reportHistoryQuery.data?.items ?? [], tables),
    [reportDates, reportHistoryQuery.data?.items, reports, tables],
  );

  useEffect(() => {
    setSelected(null);
  }, [selectedRange.fromDate, selectedRange.toDate]);

  const hasData = dataset.paidOrders > 0;
  const maxHour = dataset.hourly.reduce((m, h) => (h.revenue > m.revenue ? h : m), dataset.hourly[0] ?? { label: "—", revenue: 0, orders: 0 });
  const maxTopRevenue = Math.max(1, ...dataset.topItems.map((t) => t.revenue));
  const topMethod = (() => {
    const counts: Record<string, number> = {};
    dataset.orders.forEach((o) => { counts[o.method] = (counts[o.method] ?? 0) + 1; });
    const entry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return entry ? (entry[0] === "paid" ? "Đã thanh toán" : (PAY_METHOD_LABEL[entry[0]] ?? entry[0])) : "—";
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
  };
  const pickItem = (name: string) => {
    setSelected((prev) => (prev?.type === "item" && prev.key === name ? null : { type: "item", key: name }));
  };

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
    <div className="grid grid-cols-2 gap-2.5 [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-lg">
      <Metric label="Doanh thu" value={formatVnd(dataset.revenue)} />
      <Metric label="Số đơn đã thanh toán" value={`${dataset.paidOrders}`} />
      <Metric label="Trung bình đơn" value={formatVnd(dataset.avgTicket)} />
      <Metric label="Top món" value={dataset.topItemName} />
    </div>
  );

  if (!allowed) {
    return (
      <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="report-settings">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
          <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap"><h2>Báo cáo</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid h-full place-items-center content-center gap-2.5 text-center [&_h3]:m-0">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="text-pos-muted">Tài khoản hiện tại không thể xem báo cáo.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="absolute inset-y-3 right-3 z-10 grid w-[min(88vw,1440px)] max-w-[calc(100vw-96px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_22px_60px_rgb(15_23_42_/_18%)] max-[980px]:inset-y-0 max-[980px]:right-0 max-[980px]:w-full max-[980px]:max-w-none max-[980px]:rounded-none max-[980px]:border-y-0" data-testid="report-settings">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Báo cáo</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />Chỉ tính đơn đã thanh toán · online</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <div className="flex min-w-0 flex-wrap gap-2">
            {dateChips.map((dc) => (
              <button key={dc.key} className={clsx("cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted", range === dc.key && "border-pos-primary bg-pos-primary text-white")} onClick={() => setRange(dc.key)}>
                {dc.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex flex-wrap gap-1.5">
              <TextField
                type="date"
                size="small"
                label="Từ"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "report-from-date" }}
              />
              <TextField
                type="date"
                size="small"
                label="Đến"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "report-to-date" }}
              />
            </div>
          )}
          <Tooltip title="Chưa hỗ trợ">
            <span>
              <Button variant="outlined" startIcon={<Download size={15} />} disabled>
                Xuất
              </Button>
            </span>
          </Tooltip>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin]">
          {sections.map((s) => (
            <button
              key={s.key}
              className={clsx("inline-flex min-h-9 flex-[1_0_112px] cursor-pointer items-center justify-center rounded-[7px] border border-pos-line bg-pos-surface px-2.5 py-2 text-xs font-extrabold text-pos-muted max-sm:basis-[104px]", section === s.key && "border-pos-primaryLine bg-pos-primarySoft text-pos-primary")}
              onClick={() => { setSection(s.key); setSelected(null); }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
          <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
            <span>{sections.find((s) => s.key === section)?.label}</span>
            {hasData && <span className="text-pos-muted">{dataset.paidOrders} đơn</span>}
          </div>
          <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
            {selected?.type === "hour" ? (
              (() => {
                const h = dataset.hourly.find((x) => x.label === selected.key);
                if (!h) return null;
                return (
                  <div className="rounded-pos border border-pos-line bg-pos-surface2 px-3 py-2.5 border-pos-primaryLine bg-pos-primarySoft">
                    <div className="text-[13px] font-extrabold">Mốc {h.label}</div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Doanh thu</span><strong className="font-black text-pos-primary">{formatVnd(h.revenue)}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Số đơn</span><strong>{h.orders || "—"}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>% doanh thu</span><strong>{dataset.revenue ? Math.round((h.revenue / dataset.revenue) * 100) : 0}%</strong></div>
                    <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => setSelected(null)}>Đóng chi tiết</button>
                  </div>
                );
              })()
            ) : selected?.type === "item" ? (
              (() => {
                const it = dataset.topItems.find((x) => x.name === selected.key);
                if (!it) return null;
                return (
                  <div className="rounded-pos border border-pos-line bg-pos-surface2 px-3 py-2.5 border-pos-primaryLine bg-pos-primarySoft">
                    <div className="text-[13px] font-extrabold">{it.name}</div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Xuất hiện</span><strong>{it.qty} ngày top</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Doanh thu ngày top</span><strong className="font-black text-pos-primary">{formatVnd(it.revenue)}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>TB ngày top</span><strong>{formatVnd(Math.round(it.revenue / Math.max(1, it.qty)))}</strong></div>
                    <button className="inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-pos-line bg-pos-surface2 px-2 text-xs font-bold text-pos-ink transition-[border-color,color] hover:border-pos-primary hover:text-pos-primary disabled:cursor-not-allowed disabled:opacity-40 px-2.5" onClick={() => setSelected(null)}>Đóng chi tiết</button>
                  </div>
                );
              })()
            ) : null}
              {loading ? (
                <div className="grid gap-3">
                  <div className="h-20 rounded-pos bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite] !h-[88px]" />
                  <div className="h-20 rounded-pos bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.4s_infinite] !h-[200px]" />
                </div>
              ) : reportError ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                  <AlertTriangle size={32} color="#b45309" />
                  <p>{toToastError(reportError)}</p>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      reportQueries.forEach((query) => void query.refetch());
                      void reportHistoryQuery.refetch();
                    }}
                  >
                    Tải lại
                  </Button>
                </div>
              ) : !hasData ? (
                <>
                  {metricsRow}
                  <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                    <BarChart3 size={32} color="#94a3b8" />
                    <p>Chưa có đơn đã thanh toán trong khoảng này.</p>
                    {range === "today" ? (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshCw size={15} />}
                        onClick={() => {
                          reportQueries.forEach((query) => void query.refetch());
                          void reportHistoryQuery.refetch();
                        }}
                      >
                        Làm mới
                      </Button>
                    ) : (
                      <Button variant="outlined" size="small" onClick={() => setRange("today")}>
                        Xem hôm nay
                      </Button>
                    )}
                  </div>
                </>
              ) : section === "overview" ? (
                <>
                  {metricsRow}
                  <div className="grid gap-2 rounded-pos border border-pos-line bg-white p-3">
                    <div className="text-[13px] font-extrabold">Doanh thu theo {range === "today" ? "giờ" : range === "month" ? "tuần" : "ngày"}</div>
                    {renderChart(210)}
                  </div>
                  <div className="grid gap-2 rounded-pos border border-pos-line bg-white p-3">
                    <div className="text-[13px] font-extrabold">Món bán chạy</div>
                    <div className="grid gap-2">
                      {dataset.topItems.slice(0, 4).map((it) => (
                        <button
                          key={it.name}
                          className={clsx(
                            "grid cursor-pointer grid-cols-[minmax(80px,1.1fr)_minmax(60px,2fr)_auto] items-center gap-2.5 rounded-[7px] border border-transparent bg-pos-surface2 px-2 py-[7px] text-left transition-[border-color,background] hover:border-pos-primaryLine",
                            selected?.type === "item" && selected.key === it.name && "border-pos-primary bg-pos-primarySoft",
                          )}
                          onClick={() => pickItem(it.name)}
                        >
                          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold [&_small]:block [&_small]:text-[11px] [&_small]:font-semibold [&_small]:text-pos-muted">{it.name}</span>
                          <span className="h-2.5 overflow-hidden rounded-full bg-[#e2e8f0]"><span className="block h-full rounded-full bg-pos-primary" style={{ width: `${(it.revenue / maxTopRevenue) * 100}%` }} /></span>
                          <span className="whitespace-nowrap text-[13px] font-black text-pos-primary">{formatCompactVnd(it.revenue)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-pos border border-pos-line bg-white p-3">
                    <div className="text-[13px] font-extrabold">Tổng quan nhanh</div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Giờ cao điểm</span><strong>{hasData ? maxHour.label : "—"}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Thanh toán phổ biến</span><strong>{topMethod}</strong></div>
                    <div className="flex justify-between gap-2 text-[13px] [&_span]:text-pos-muted"><span>Đơn đã huỷ</span><strong>{dataset.voidCount}</strong></div>
                  </div>
                </>
              ) : section === "hourly" ? (
                <>
                  <div className="grid gap-2 rounded-pos border border-pos-line bg-white p-3">
                    <div className="text-[13px] font-extrabold">Doanh thu theo {range === "today" ? "giờ" : range === "month" ? "tuần" : "ngày"}</div>
                    {renderChart(260)}
                  </div>
                  <div className="overflow-auto rounded-pos border border-pos-line">
                    <table className="w-full border-collapse text-[13px] [&_tbody_tr]:cursor-pointer [&_tbody_tr:hover]:bg-pos-surface2 [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-pos-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:text-left [&_td:last-child]:text-right [&_th]:sticky [&_th]:top-0 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-pos-line [&_th]:bg-[#fbfcfd] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-extrabold [&_th:last-child]:text-right">
                      <thead><tr><th>Mốc</th><th>Đơn</th><th>Doanh thu</th></tr></thead>
                      <tbody>
                        {dataset.hourly.map((h) => (
                          <tr
                            key={h.label}
                            className={clsx(selected?.type === "hour" && selected.key === h.label && "bg-pos-primarySoft")}
                            onClick={() => pickHour(h.label)}
                          >
                            <td>{h.label}</td>
                            <td>{h.orders || "—"}</td>
                            <td><strong className="font-black text-pos-primary">{formatCompactVnd(h.revenue)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : section === "top" ? (
                <div className="grid gap-2 [&>button]:grid-cols-[22px_minmax(90px,1.1fr)_minmax(50px,2fr)_auto]">
                  {dataset.topItems.map((it, idx) => (
                    <button
                      key={it.name}
                      className={clsx(
                        "grid cursor-pointer grid-cols-[minmax(80px,1.1fr)_minmax(60px,2fr)_auto] items-center gap-2.5 rounded-[7px] border border-transparent bg-pos-surface2 px-2 py-[7px] text-left transition-[border-color,background] hover:border-pos-primaryLine",
                        selected?.type === "item" && selected.key === it.name && "border-pos-primary bg-pos-primarySoft",
                      )}
                      onClick={() => pickItem(it.name)}
                    >
                      <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-pos-primarySoft text-xs font-black text-pos-primary">{idx + 1}</span>
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold [&_small]:block [&_small]:text-[11px] [&_small]:font-semibold [&_small]:text-pos-muted">{it.name}<small>{it.qty} ngày top</small></span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-[#e2e8f0]"><span className="block h-full rounded-full bg-pos-primary" style={{ width: `${(it.revenue / maxTopRevenue) * 100}%` }} /></span>
                      <span className="whitespace-nowrap text-[13px] font-black text-pos-primary">{formatCompactVnd(it.revenue)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="overflow-auto rounded-pos border border-pos-line">
                  <table className="w-full border-collapse text-[13px] [&_tbody_tr]:cursor-pointer [&_tbody_tr:hover]:bg-pos-surface2 [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-pos-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:text-left [&_td:last-child]:text-right [&_th]:sticky [&_th]:top-0 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-pos-line [&_th]:bg-[#fbfcfd] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-extrabold [&_th:last-child]:text-right">
                    <thead><tr><th>Mã</th><th>Giờ</th><th>Bàn</th><th>Thanh toán</th><th>Tổng</th></tr></thead>
                    <tbody>
                      {dataset.orders.map((o) => (
                        <tr key={o.id}>
                          <td><strong>#{o.orderNo}</strong></td>
                          <td className="text-pos-muted">{o.time}</td>
                          <td>{o.table}</td>
                          <td>{o.method === "paid" ? "Đã thanh toán" : (PAY_METHOD_LABEL[o.method] ?? o.method)}</td>
                          <td><strong className="font-black text-pos-primary">{formatCompactVnd(o.total)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </section>
      </div>
    </section>
  );
}
