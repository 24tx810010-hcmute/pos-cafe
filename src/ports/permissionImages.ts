export type PermissionMenuImageStageInput = { itemId: string; file: File };
export type PermissionMenuImageStageResult = { uploadHandle: string };

export interface IPermissionMenuImagePort {
  stageMenuItemImage(input: PermissionMenuImageStageInput): Promise<PermissionMenuImageStageResult>;
  readStagedMenuItemImage(uploadHandle: string): Promise<Blob>;
  discardStagedMenuItemImage(uploadHandle: string): Promise<void>;
  getImageUrl(assetKey: string | null | undefined): string | null;
}

