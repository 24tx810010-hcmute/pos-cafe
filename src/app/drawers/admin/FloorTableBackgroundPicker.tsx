import clsx from "clsx";
import { Button } from "@mui/material";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { PortalPopup } from "../../components/PortalPopup";
import {
  DEFAULT_TABLE_BACKGROUND_ASSET,
  FLOOR_TABLE_BACKGROUND_OPTIONS,
  getFloorTableBackgroundAsset,
  type FloorTableBackgroundAsset,
} from "../../floorTableBackgroundAssets";

interface FloorTableBackgroundPickerProps {
  initialAssetKey?: string | null;
  onClose: () => void;
  onSelect: (asset: FloorTableBackgroundAsset) => void;
}

export function FloorTableBackgroundPicker({
  initialAssetKey,
  onClose,
  onSelect,
}: FloorTableBackgroundPickerProps) {
  const initialAsset =
    getFloorTableBackgroundAsset(initialAssetKey) ?? DEFAULT_TABLE_BACKGROUND_ASSET;
  const [selectedId, setSelectedId] = useState(initialAsset.id);
  const selectedAsset =
    FLOOR_TABLE_BACKGROUND_OPTIONS.find((asset) => asset.id === selectedId) ??
    DEFAULT_TABLE_BACKGROUND_ASSET;

  return (
    <PortalPopup
      placement="Centered"
      viewport="workspace"
      zIndex={60}
      testId="floor-table-background-picker"
      overlayClassName="bg-slate-900/55 p-3"
      onOutsideClick={onClose}
    >
      <section
        className="flex max-h-[min(680px,calc(100vh-32px))] w-[min(680px,calc(100vw-24px))] flex-col overflow-hidden rounded-pos border border-pos-line bg-pos-surface shadow-[0_24px_70px_rgb(15_23_42_/_28%)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pos-line px-4 py-3">
          <div className="min-w-0">
            <h3 className="m-0 text-base font-black text-pos-ink">Chọn nền bàn</h3>
            <p className="m-0 mt-0.5 text-xs text-pos-muted">
              Màu trắng mặc định hoặc 11 mẫu nền
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-pos-bg p-3">
          <div className="grid grid-cols-4 gap-2 max-[640px]:grid-cols-3 max-sm:grid-cols-2">
            {FLOOR_TABLE_BACKGROUND_OPTIONS.map((asset) => (
              <button
                key={asset.id}
                type="button"
                aria-label={asset.label}
                aria-pressed={selectedAsset.id === asset.id}
                data-testid={`table-background-asset-${asset.id}`}
                className={clsx(
                  "group grid cursor-pointer grid-rows-[96px_auto] overflow-hidden rounded-[8px] border bg-white p-1.5 text-left transition-[border-color,box-shadow]",
                  selectedAsset.id === asset.id
                    ? "border-pos-primary shadow-[0_0_0_2px_rgb(15_118_110_/_22%)]"
                    : "border-pos-line hover:border-pos-primaryLine",
                )}
                onClick={() => setSelectedId(asset.id)}
              >
                <span className="grid min-h-0 place-items-center overflow-hidden rounded-[5px] border border-slate-200 bg-white">
                  {asset.assetKey ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={asset.assetKey}
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-500">Trắng</span>
                  )}
                </span>
                <span className="truncate px-1 pb-0.5 pt-1.5 text-xs font-bold text-pos-muted">
                  {asset.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-pos-line px-4 py-3">
          <span className="min-w-0 truncate text-xs font-bold text-pos-muted">
            {selectedAsset.label}
          </span>
          <div className="flex gap-2">
            <Button variant="text" onClick={onClose}>Huỷ</Button>
            <Button
              variant="contained"
              startIcon={<ImagePlus size={15} />}
              data-testid="confirm-table-background"
              onClick={() => onSelect(selectedAsset)}
            >
              Áp dụng nền
            </Button>
          </div>
        </footer>
      </section>
    </PortalPopup>
  );
}
