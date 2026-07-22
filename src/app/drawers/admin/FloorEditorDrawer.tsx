import clsx from "clsx";
import { AlertTriangle, LayoutGrid, Lock, Plus, Save } from "lucide-react";
import { Button } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { DecorKind, FloorPlan, TableShape } from "@/domain";
import {
  useAdminFloorPlanQuery,
  useSaveFloorPlanMutation,
  hasFloorPlanChanges,
} from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { nextDraftId, nextSort } from "@/features/admin/draftUtils";
import {
  DECOR_LABEL,
  buildFloorPlanChangesFromDrafts,
  decorDefaultSize,
  tableDefaultSize,
  type DraftArea,
  type DraftTable,
  type DraftDecor,
  type FloorSelection,
} from "@/features/admin/floorEditorDraft";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { getLabelBoost, getObjectBoost, logicalStage, stageStyle } from "../../floorStage";
import { ScaledFloorStage } from "../../components/ScaledFloorStage";
import { FloorEditorInspectorPane } from "./FloorEditorInspectorPane";
import { FloorEditorToolbar } from "./FloorEditorToolbar";
import { useFloorObjectTransforms } from "./floorObjectTransforms";

const decorToneClass = (kind: DecorKind) => {
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

export function FloorEditorDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const floorQuery = useAdminFloorPlanQuery();
  const saveFloorMutation = useSaveFloorPlanMutation(currentEmployee);

  const [seeded, setSeeded] = useState(false);
  const [baseFloorPlan, setBaseFloorPlan] = useState<FloorPlan | null>(null);
  const [areas, setAreas] = useState<DraftArea[]>([]);
  const [tables, setTables] = useState<DraftTable[]>([]);
  const [decor, setDecor] = useState<DraftDecor[]>([]);
  const [areaId, setAreaId] = useState("");
  const [snap, setSnap] = useState(true);
  const [selected, setSelected] = useState<FloorSelection>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Geometry/asset fields are secondary to name/seats/shape, so keep them folded
  // away under an "Nâng cao" section until the admin needs precise control.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);

  const seedDraftFromFloorPlan = (plan: FloorPlan) => {
    setBaseFloorPlan(plan);
    setAreas(plan.areas.map((a) => ({ id: a.id, name: a.name, sortOrder: a.sortOrder })));
    setTables(plan.tables.map((t) => ({ ...t })));
    setDecor(plan.decorItems.map((d) => ({ ...d })));
    setAreaId(plan.areas[0]?.id ?? "");
    setSelected(null);
    setDirty(false);
    setSeeded(true);
  };

  useEffect(() => {
    if (floorQuery.data && !seeded) {
      seedDraftFromFloorPlan(floorQuery.data);
    }
  }, [floorQuery.data, seeded]);

  const touch = () => setDirty(true);

  // --- Geometry ---
  const nodeStyle = (o: { posX: number; posY: number; width: number; height: number; rotation: number }, boost = 1) => ({
    ...stageStyle(o.posX, o.posY, o.width, o.height),
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg) scale(${boost})`,
    transformOrigin: "center",
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
  const patchArea = (id: string, patch: Partial<DraftArea>) => {
    setAreas((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    touch();
  };
  const toggleDeleteArea = (id: string) => {
    setAreas((list) => list.map((a) => (a.id === id ? { ...a, deleted: !a.deleted } : a)));
    setSelected(null);
    touch();
  };

  // --- Table ops ---
  const addTable = (shape: TableShape) => {
    if (!areaId) return;
    if (areas.find((area) => area.id === areaId)?.deleted) return;
    const id = nextDraftId("tbl");
    const size = tableDefaultSize(shape);
    const n = tables.filter((t) => t.areaId === areaId && !t.deleted).length + 1;
    const sortOrder = nextSort(tables.filter((t) => t.areaId === areaId).map((t) => t.sortOrder));
    setTables((list) => [
      ...list,
      {
        id,
        areaId,
        name: `B${String(n).padStart(2, "0")}`,
        posX: logicalStage.width / 2,
        posY: logicalStage.height / 2,
        ...size,
        shape,
        rotation: 0,
        seats: 4,
        sortOrder,
        status: "empty",
        isNew: true,
      },
    ]);
    setSelected({ type: "table", id });
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
    if (areas.find((area) => area.id === areaId)?.deleted) return;
    const id = nextDraftId("dec");
    const size = decorDefaultSize(kind);
    setDecor((list) => [
      ...list,
      {
        id,
        areaId,
        kind,
        label: DECOR_LABEL[kind],
        assetKey: `${kind}_default`,
        posX: logicalStage.width / 2,
        posY: logicalStage.height / 2,
        ...size,
        rotation: 0,
        zIndex: 1,
        isLocked: false,
        isNew: true,
      },
    ]);
    setSelected({ type: "decor", id });
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

  const { onNodePointerDown, onNodePointerMove, onNodePointerUp, renderTransformHandles } = useFloorObjectTransforms({
    decor,
    patchDecor,
    patchTable,
    selected,
    setSelected,
    snap,
    stageRef,
    tables,
  });

  // --- Derived ---
  const currentArea = areas.find((area) => area.id === areaId) ?? null;
  const areaTables = tables.filter((t) => t.areaId === areaId);
  const areaDecor = decor.filter((d) => d.areaId === areaId);
  const selectedTable = selected?.type === "table" ? tables.find((t) => t.id === selected.id) ?? null : null;
  const selectedDecor = selected?.type === "decor" ? decor.find((d) => d.id === selected.id) ?? null : null;
  const isEmptyArea = areaTables.filter((t) => !t.deleted).length === 0 && areaDecor.filter((d) => !d.deleted).length === 0;
  const activeAreaCount = areas.filter((area) => !area.deleted).length;

  const handleSave = async () => {
    if (saveFloorMutation.isPending) return;
    const sourcePlan = baseFloorPlan ?? floorQuery.data;
    if (!sourcePlan) {
      toast.error("Sơ đồ chưa tải xong.");
      return;
    }

    const changes = buildFloorPlanChangesFromDrafts({
      base: sourcePlan,
      areas,
      tables,
      decor,
      actorId: currentEmployee?.id,
    });
    if (!hasFloorPlanChanges(changes)) {
      setDirty(false);
      toast.success("Không có thay đổi cần lưu.");
      return;
    }

    try {
      await saveFloorMutation.mutateAsync({ changes });
      const refreshed = await floorQuery.refetch();
      if (refreshed.data) {
        seedDraftFromFloorPlan(refreshed.data);
      } else {
        setDirty(false);
      }
      toast.success("Đã lưu sơ đồ.");
    } catch (error) {
      toast.error(toToastError(error));
    }
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  return (
    <PortalDrawer testId="floor-editor" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>
            Quản lý sơ đồ bàn {dirty && <span className="ml-2 inline-flex items-center rounded-full bg-[#fff7ed] px-2 py-px text-[11px] font-extrabold text-[#c2410c]" data-testid="floor-dirty-badge">Chưa lưu</span>}
          </h2>
          <p>
            <span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />
            {areaTables.filter((t) => !t.deleted).length} bàn · {activeAreaCount} khu · online
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <div className="flex min-w-0 flex-wrap gap-2">
            {sortedAreas.map((a) => (
              <button
                key={a.id}
                className={clsx(
                  "cursor-pointer whitespace-nowrap rounded-full border px-3 py-[3px] text-xs font-bold",
                  a.id === areaId
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-pos-surface text-pos-muted",
                )}
                onClick={() => { setAreaId(a.id); setSelected(null); }}
              >
                {a.name}
              </button>
            ))}
            <button className="cursor-pointer whitespace-nowrap rounded-full border border-pos-line bg-pos-surface px-3 py-[3px] text-xs font-bold text-pos-muted" data-testid="add-area-button" onClick={addArea}>+ Khu</button>
          </div>
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button
            variant="contained"
            startIcon={<Save size={15} />}
            data-testid="save-floor-button"
            onClick={handleSave}
            disabled={!dirty || saveFloorMutation.isPending}
          >
            {saveFloorMutation.isPending ? "Đang lưu..." : "Lưu sơ đồ"}
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        {floorQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="floor-editor-error-state">
            <AlertTriangle size={32} color="#b45309" />
            <strong>Không tải được sơ đồ</strong>
            <p>{toToastError(floorQuery.error)}</p>
            <Button variant="contained" size="small" onClick={() => void floorQuery.refetch()}>
              Thử tải lại
            </Button>
          </div>
        ) : !seeded ? (
          <p className="text-pos-muted p-4">Đang tải sơ đồ...</p>
        ) : (
          <>
            <FloorEditorToolbar
              areaDeleted={currentArea?.deleted}
              snap={snap}
              setSnap={setSnap}
              addTable={addTable}
              addDecor={addDecor}
            />

            <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(340px,1fr)_minmax(290px,350px)] gap-2.5 max-[980px]:grid-cols-1 max-[980px]:grid-rows-[minmax(220px,1fr)_auto] max-[980px]:overflow-auto">
              <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
                <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">
                  <span>Khu vực thiết kế</span>
                  <span className="text-pos-muted">Chọn / kéo</span>
                </div>
                <div className="min-h-0 p-2.5 max-[980px]:p-2 grid place-items-center !p-3">
                  <ScaledFloorStage
                    ref={stageRef}
                    testId="floor-editor-stage"
                    onPointerDown={() => setSelected(null)}
                  >
                    {({ scale }) => {
                      const tableBoost = getObjectBoost(scale);
                      const tableLabelBoost = getLabelBoost(scale * tableBoost);
                      const decorLabelBoost = getLabelBoost(scale);

                      return (
                        <>
                    {[...areaDecor].sort((a, b) => a.zIndex - b.zIndex).map((d) => (
                      <div
                        key={d.id}
                        className={clsx(
                          "absolute grid cursor-grab place-items-center rounded-pos border border-dashed text-center text-xs font-black",
                          decorToneClass(d.kind),
                          selected?.type === "decor" && selected.id === d.id && "!z-50 outline outline-2 outline-offset-2 outline-pos-primary",
                          d.deleted && "opacity-40",
                          d.isLocked && "cursor-not-allowed",
                        )}
                        style={{ ...nodeStyle(d), zIndex: d.zIndex }}
                        data-testid={`fe-decor-${d.id}`}
                        onPointerDown={(e) => onNodePointerDown(e, "decor", d)}
                        onPointerMove={onNodePointerMove}
                        onPointerUp={onNodePointerUp}
                      >
                        <span
                          data-floor-label="name"
                          style={{ transform: `scale(${decorLabelBoost})`, transformOrigin: "center" }}
                        >
                          {d.label ?? DECOR_LABEL[d.kind]}
                        </span>
                        {d.isLocked && <Lock size={11} className="absolute right-0.5 top-0.5" />}
                      </div>
                    ))}
                    {areaTables.map((t) => (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        className={clsx(
                          "absolute grid cursor-grab place-items-center border-2 text-center font-black shadow-[0_8px_18px_rgb(15_23_42_/_10%)] active:cursor-grabbing [&_small]:mt-[3px] [&_small]:block [&_small]:text-[10px] [&_small]:font-bold [&_small]:text-pos-muted",
                          t.status === "occupied" ? "border-[#f97316] bg-[#fff7ed]" : "border-[#86efac] bg-[#f0fdf4]",
                          t.shape === "round" ? "rounded-full" : "rounded-pos",
                          selected?.type === "table" && selected.id === t.id && "!z-50 outline outline-2 outline-offset-2 outline-pos-primary",
                          t.deleted && "opacity-40",
                        )}
                        style={nodeStyle(t, tableBoost)}
                        data-testid={`fe-table-${t.id}`}
                        onPointerDown={(e) => onNodePointerDown(e, "table", t)}
                        onPointerMove={onNodePointerMove}
                        onPointerUp={onNodePointerUp}
                      >
                        <span
                          className="grid place-items-center leading-none"
                          style={{ transform: `scale(${tableLabelBoost})`, transformOrigin: "center" }}
                        >
                          <span data-floor-label="name">{t.name}</span>
                          <small>{t.seats} chỗ</small>
                        </span>
                      </div>
                    ))}
                    {areaDecor.map((d) => renderTransformHandles("decor", d))}
                    {areaTables.map((t) => renderTransformHandles("table", t))}

                    {isEmptyArea && (
                      <div className="absolute inset-0 m-auto grid h-fit w-fit justify-items-center gap-2 rounded-[10px] border border-dashed border-pos-line bg-white/90 px-[22px] py-[18px] text-center text-pos-muted [&_p]:m-0" onPointerDown={(e) => e.stopPropagation()}>
                        <LayoutGrid size={30} color="#94a3b8" />
                        <p>Khu này chưa có bàn.</p>
                        <Button variant="contained" size="small" startIcon={<Plus size={15} />} onClick={() => addTable("rectangle")}>
                          Thêm bàn đầu tiên
                        </Button>
                      </div>
                    )}
                        </>
                      );
                    }}
                  </ScaledFloorStage>
                </div>
              </section>

              <FloorEditorInspectorPane
                currentArea={currentArea}
                selectedTable={selectedTable}
                selectedDecor={selectedDecor}
                sortedAreas={sortedAreas}
                advancedOpen={advancedOpen}
                onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
                patchArea={patchArea}
                toggleDeleteArea={toggleDeleteArea}
                patchTable={patchTable}
                toggleDeleteTable={toggleDeleteTable}
                patchDecor={patchDecor}
                toggleDeleteDecor={toggleDeleteDecor}
              />
            </div>
          </>
        )}
      </div>

      {confirmCancel && (
        <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50" onOutsideClick={() => setConfirmCancel(false)}>
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi sơ đồ?</h3>
            <p>Các thay đổi chưa lưu sẽ bị huỷ.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </PortalPopup>
      )}
    </PortalDrawer>
  );
}
