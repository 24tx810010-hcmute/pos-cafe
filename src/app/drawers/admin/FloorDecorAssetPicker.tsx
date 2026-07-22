import clsx from "clsx";
import { Button } from "@mui/material";
import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { PortalPopup } from "../../components/PortalPopup";
import {
  FLOOR_DECOR_ASSETS_BY_GROUP,
  FLOOR_DECOR_GROUPS,
  FLOOR_WALL_ASSETS,
  getFloorDecorAsset,
  type FloorDecorAsset,
  type FloorDecorAssetGroup,
  type FloorDecorAssetPickerMode,
} from "../../floorDecorAssets";

interface FloorDecorAssetPickerProps {
  mode: FloorDecorAssetPickerMode;
  initialAssetKey?: string | null;
  onClose: () => void;
  onSelect: (asset: FloorDecorAsset) => void;
}

export function FloorDecorAssetPicker({
  mode,
  initialAssetKey,
  onClose,
  onSelect,
}: FloorDecorAssetPickerProps) {
  const isReplacing = Boolean(initialAssetKey);
  const initialAsset = getFloorDecorAsset(initialAssetKey);
  const [activeGroup, setActiveGroup] = useState<FloorDecorAssetGroup>(initialAsset?.group ?? "tree");
  const initialOptions = mode === "wall" ? FLOOR_WALL_ASSETS : FLOOR_DECOR_ASSETS_BY_GROUP[activeGroup];
  const [selectedId, setSelectedId] = useState(initialAsset?.id ?? initialOptions[0]?.id ?? "");
  const options = mode === "wall" ? FLOOR_WALL_ASSETS : FLOOR_DECOR_ASSETS_BY_GROUP[activeGroup];
  const selectedAsset = options.find((asset) => asset.id === selectedId) ?? options[0] ?? null;

  const changeGroup = (group: FloorDecorAssetGroup) => {
    setActiveGroup(group);
    setSelectedId(FLOOR_DECOR_ASSETS_BY_GROUP[group][0]?.id ?? "");
  };

  return (
    <PortalPopup
      placement="Centered"
      viewport="workspace"
      zIndex={60}
      testId="floor-decor-asset-picker"
      overlayClassName="bg-slate-900/55 p-3"
      onOutsideClick={onClose}
    >
      <section
        className="flex max-h-[min(720px,calc(100vh-32px))] w-[min(760px,calc(100vw-24px))] flex-col overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_24px_70px_rgb(15_23_42_/_28%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pos-line px-4 py-3">
          <div className="min-w-0">
            <h3 className="m-0 text-base font-black text-pos-ink">
              {mode === "wall" ? "Chọn mẫu tường" : "Chọn ảnh trang trí"}
            </h3>
            <p className="m-0 mt-0.5 text-xs text-pos-muted">
              {mode === "wall" ? "9 texture tường" : "131 ảnh theo 4 nhóm"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-pos-line bg-pos-surface2 text-pos-muted hover:border-pos-primary hover:text-pos-primary"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        {mode === "decor" && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-pos-line bg-pos-bg px-3 py-2">
            {FLOOR_DECOR_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                data-testid={`decor-group-${group.id}`}
                className={clsx(
                  "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-extrabold transition-colors",
                  activeGroup === group.id
                    ? "border-pos-primary bg-pos-primary text-white"
                    : "border-pos-line bg-pos-surface text-pos-muted hover:border-pos-primary hover:text-pos-primary",
                )}
                onClick={() => changeGroup(group.id)}
              >
                {group.label} · {group.count}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-pos-bg p-3">
          <div className={clsx("grid gap-2", mode === "wall" ? "grid-cols-3 max-sm:grid-cols-2" : "grid-cols-6 max-[720px]:grid-cols-4 max-sm:grid-cols-3")}>
            {options.map((asset) => (
              <button
                key={asset.id}
                type="button"
                aria-label={asset.label}
                aria-pressed={selectedAsset?.id === asset.id}
                data-testid={`decor-asset-${asset.id}`}
                className={clsx(
                  "group relative grid cursor-pointer overflow-hidden rounded-[8px] border bg-white p-1.5 transition-[border-color,box-shadow]",
                  mode === "wall" ? "aspect-[2/1]" : "aspect-square",
                  selectedAsset?.id === asset.id
                    ? "border-pos-primary shadow-[0_0_0_2px_rgb(15_118_110_/_22%)]"
                    : "border-pos-line hover:border-pos-primaryLine",
                )}
                onClick={() => setSelectedId(asset.id)}
              >
                <img
                  alt=""
                  className={mode === "wall" ? "h-full w-full rounded-[5px] object-cover" : "h-full w-full object-contain"}
                  loading="lazy"
                  src={asset.assetKey}
                />
                <span className="absolute inset-x-1 bottom-1 truncate rounded bg-slate-900/70 px-1 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {asset.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-pos-line px-4 py-3">
          <span className="min-w-0 truncate text-xs font-bold text-pos-muted">
            {selectedAsset?.label ?? "Chưa chọn mẫu"}
          </span>
          <div className="flex gap-2">
            <Button variant="text" onClick={onClose}>Huỷ</Button>
            <Button
              variant="contained"
              startIcon={<ImagePlus size={15} />}
              data-testid="confirm-decor-asset"
              disabled={!selectedAsset}
              onClick={() => selectedAsset && onSelect(selectedAsset)}
            >
              {isReplacing ? "Áp dụng mẫu" : mode === "wall" ? "Dùng mẫu tường" : "Thêm trang trí"}
            </Button>
          </div>
        </footer>
      </section>
    </PortalPopup>
  );
}
