import { MoveDiagonal2, RotateCw } from "lucide-react";
import { useRef, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { logicalStage, pointerClientToLogical } from "../../floorStage";
import type { DraftDecor, DraftTable, FloorSelection } from "@/features/admin/floorEditorDraft";

type FloorObjectKind = "table" | "decor";
type FloorPointerAction =
  | { mode: "move"; kind: FloorObjectKind; id: string; offX: number; offY: number }
  | { mode: "resize"; kind: FloorObjectKind; id: string }
  | { mode: "rotate"; kind: FloorObjectKind; id: string };

const TABLE_MIN_SIZE = 60;
const DECOR_MIN_SIZE = 24;
const HANDLE_OFFSET = 12;
const ROTATION_SNAP_DEGREES = 15;

const normalizeRotation = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360;

interface UseFloorObjectTransformsInput {
  decor: DraftDecor[];
  patchDecor: (id: string, patch: Partial<DraftDecor>) => void;
  patchTable: (id: string, patch: Partial<DraftTable>) => void;
  selected: FloorSelection;
  setSelected: Dispatch<SetStateAction<FloorSelection>>;
  snap: boolean;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  tables: DraftTable[];
}

export function useFloorObjectTransforms({
  decor,
  patchDecor,
  patchTable,
  selected,
  setSelected,
  snap,
  stageRef,
  tables,
}: UseFloorObjectTransformsInput) {
  const pointerActionRef = useRef<FloorPointerAction | null>(null);
  const snapVal = (v: number) => (snap ? Math.round(v / 20) * 20 : Math.round(v));
  const snapRotation = (degrees: number) => (snap ? Math.round(degrees / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES : degrees);
  const handleStyle = (obj: DraftTable | DraftDecor, side: "left" | "right") => ({
    left: `${obj.posX + (side === "left" ? -obj.width / 2 : obj.width / 2)}px`,
    top: `${obj.posY + obj.height / 2 + HANDLE_OFFSET}px`,
    transform: "translate(-50%, 0)",
    transformOrigin: "center",
  });
  const toLogical = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: logicalStage.width / 2, y: logicalStage.height / 2 };
    return pointerClientToLogical(clientX, clientY, rect);
  };
  const getFloorObject = (kind: FloorObjectKind, id: string) =>
    kind === "table" ? tables.find((t) => t.id === id) ?? null : decor.find((d) => d.id === id) ?? null;
  const patchFloorObject = (kind: FloorObjectKind, id: string, patch: Partial<DraftTable> | Partial<DraftDecor>) => {
    if (kind === "table") patchTable(id, patch as Partial<DraftTable>);
    else patchDecor(id, patch as Partial<DraftDecor>);
  };
  const isFloorObjectLocked = (kind: FloorObjectKind, obj: { deleted?: boolean; isLocked?: boolean }) =>
    Boolean(obj.deleted || (kind === "decor" && obj.isLocked));
  const capturePointer = (e: ReactPointerEvent<HTMLElement>) => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  const releasePointer = (e: ReactPointerEvent<HTMLElement>) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
  };

  const onNodePointerDown = (e: ReactPointerEvent<HTMLElement>, kind: FloorObjectKind, obj: { id: string; posX: number; posY: number; isLocked?: boolean; deleted?: boolean }) => {
    e.stopPropagation();
    setSelected({ type: kind, id: obj.id });
    if (isFloorObjectLocked(kind, obj)) return;
    capturePointer(e);
    const p = toLogical(e.clientX, e.clientY);
    pointerActionRef.current = { mode: "move", kind, id: obj.id, offX: p.x - obj.posX, offY: p.y - obj.posY };
  };

  const onTransformHandlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    mode: Extract<FloorPointerAction["mode"], "resize" | "rotate">,
    kind: FloorObjectKind,
    obj: DraftTable | DraftDecor,
  ) => {
    e.stopPropagation();
    if (isFloorObjectLocked(kind, obj)) return;
    setSelected({ type: kind, id: obj.id });
    capturePointer(e);
    pointerActionRef.current = { mode, kind, id: obj.id };
  };

  const onNodePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const action = pointerActionRef.current;
    if (!action) return;
    const obj = getFloorObject(action.kind, action.id);
    if (!obj || isFloorObjectLocked(action.kind, obj)) return;

    const p = toLogical(e.clientX, e.clientY);
    if (action.mode === "move") {
      const nx = Math.max(0, Math.min(logicalStage.width, snapVal(p.x - action.offX)));
      const ny = Math.max(0, Math.min(logicalStage.height, snapVal(p.y - action.offY)));
      patchFloorObject(action.kind, action.id, { posX: nx, posY: ny });
      return;
    }

    if (action.mode === "resize") {
      const minSize = action.kind === "table" ? TABLE_MIN_SIZE : DECOR_MIN_SIZE;
      const nextWidth = Math.max(minSize, snapVal(Math.abs(p.x - obj.posX) * 2));
      const nextHeight = Math.max(minSize, snapVal(Math.abs(p.y - obj.posY) * 2));
      const keepSquare = action.kind === "table" && "shape" in obj && obj.shape !== "rectangle";
      if (keepSquare) {
        const size = Math.max(nextWidth, nextHeight);
        patchFloorObject(action.kind, action.id, { width: size, height: size });
      } else {
        patchFloorObject(action.kind, action.id, { width: nextWidth, height: nextHeight });
      }
      return;
    }

    const dx = p.x - obj.posX;
    const dy = p.y - obj.posY;
    if (dx === 0 && dy === 0) return;
    patchFloorObject(action.kind, action.id, { rotation: normalizeRotation(snapRotation((Math.atan2(dy, dx) * 180) / Math.PI)) });
  };

  const onNodePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (pointerActionRef.current) {
      releasePointer(e);
    }
    pointerActionRef.current = null;
  };

  const renderTransformHandles = (kind: FloorObjectKind, obj: DraftTable | DraftDecor) => {
    if (selected?.type !== kind || selected.id !== obj.id || isFloorObjectLocked(kind, obj)) return null;

    const handleClass = "absolute z-[60] grid h-7 w-7 cursor-grab place-items-center rounded-full border border-pos-primaryLine bg-white text-pos-primary shadow-[0_8px_18px_rgb(15_23_42_/_20%)] transition-[background,color,box-shadow] hover:bg-pos-primary hover:text-white active:cursor-grabbing";

    return [
      <button
        key={`${obj.id}-rotate`}
        type="button"
        aria-label="Xoay object"
        title="Xoay"
        className={handleClass}
        data-testid={`fe-object-rotate-handle-${obj.id}`}
        style={handleStyle(obj, "left")}
        onPointerDown={(e) => onTransformHandlePointerDown(e, "rotate", kind, obj)}
        onPointerMove={onNodePointerMove}
        onPointerUp={onNodePointerUp}
      >
        <RotateCw size={14} />
      </button>,
      <button
        key={`${obj.id}-resize`}
        type="button"
        aria-label="Resize object"
        title="Resize"
        className={handleClass}
        data-testid={`fe-object-resize-handle-${obj.id}`}
        style={handleStyle(obj, "right")}
        onPointerDown={(e) => onTransformHandlePointerDown(e, "resize", kind, obj)}
        onPointerMove={onNodePointerMove}
        onPointerUp={onNodePointerUp}
      >
        <MoveDiagonal2 size={14} />
      </button>,
    ];
  };

  return { onNodePointerDown, onNodePointerMove, onNodePointerUp, renderTransformHandles };
}
