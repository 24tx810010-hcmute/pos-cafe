import type { IPermissionMenuImagePort, PermissionMenuImageStageInput, PermissionMenuImageStageResult } from "@/ports/permissionImages";
import { AppError } from "@/core/appError";
import type { MockPermissionState } from "./permissionState";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Staged = { itemId: string; blob: Blob };

export class MockPermissionMenuImagePort implements IPermissionMenuImagePort {
  private readonly staging = new Map<string, Staged>();
  private readonly published = new Map<string, { blob: Blob; url: string }>();
  constructor(private readonly authorize: () => void = () => undefined, _state?: MockPermissionState) {}
  async stageMenuItemImage(input: PermissionMenuImageStageInput): Promise<PermissionMenuImageStageResult> {
    this.authorize();
    // Draft item IDs can be staged before the menu transaction creates the row.
    // The transaction must resolve the same item/handle before publishing it.
    if (!uuid.test(input.itemId)) throw new AppError("INVALID_WRITE_REQUEST", "Thông tin ảnh món không hợp lệ.");
    if (!allowed.has(input.file.type) || input.file.size < 1 || input.file.size > 5 * 1024 * 1024) throw new AppError("INVALID_WRITE_REQUEST", "Ảnh món không hợp lệ.");
    const uploadHandle = crypto.randomUUID(); this.staging.set(uploadHandle, { itemId: input.itemId, blob: input.file }); return { uploadHandle };
  }
  async readStagedMenuItemImage(uploadHandle: string): Promise<Blob> {
    this.authorize(); const value = this.staging.get(uploadHandle); if (!value) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập."); return value.blob;
  }
  async discardStagedMenuItemImage(uploadHandle: string): Promise<void> { this.authorize(); this.staging.delete(uploadHandle); }
  resolve(uploadHandle: string, itemId: string): Blob {
    const value = this.staging.get(uploadHandle);
    if (!value || value.itemId !== itemId) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu được phép truy cập.");
    return value.blob;
  }
  publish(uploadHandle: string, blob: Blob): string {
    const prior = this.published.get(uploadHandle); if (prior) return uploadHandle;
    const url = typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : `data:${blob.type};base64,`;
    this.published.set(uploadHandle, { blob, url }); this.staging.delete(uploadHandle); return uploadHandle;
  }
  unpublish(assetKey: string): void {
    const asset = this.published.get(assetKey);
    if (asset?.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
    this.published.delete(assetKey);
  }
  getImageUrl(assetKey: string | null | undefined): string | null { return assetKey ? this.published.get(assetKey)?.url ?? null : null; }
}
