import { AppError } from "@/core/appError";
import type { AppErrorCode } from "@/core/appError";
import type { IPermissionMenuImagePort, PermissionMenuImageStageInput, PermissionMenuImageStageResult } from "@/ports/permissionImages";
import { employeeCredential } from "./employeeCredential";
import type { SupabaseAnyClient } from "./repoShared";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messages: Partial<Record<AppErrorCode, string>> = {
  AUTH_REQUIRED: "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.",
  EMPLOYEE_SESSION_REQUIRED: "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được phép truy cập.",
};

const validateFile = (file: File): void => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new AppError("UNKNOWN", "Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("UNKNOWN", "Ảnh món tối đa 5MB.");
  if (file.size < 1) throw new AppError("UNKNOWN", "Ảnh món không hợp lệ.");
};
const validateUuid = (value: string): string => {
  if (!UUID.test(value)) throw new AppError("INVALID_WRITE_REQUEST", "Thông tin ảnh món không hợp lệ.");
  return value.toLowerCase();
};
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const gatewayFailure = (value: unknown): AppError => {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.code === "string") {
    const code = value.error.code as AppErrorCode;
    return new AppError(code, messages[code] ?? "Không thể xử lý ảnh món.");
  }
  return new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
};
const gatewayHttpFailure = async (error: unknown): Promise<AppError> => {
  const response = isRecord(error) && error.context instanceof Response ? error.context : null;
  if (!response) return gatewayFailure(null);
  try { return gatewayFailure(await response.clone().json()); } catch { return gatewayFailure(null); }
};

export class SupabasePermissionMenuImagePort implements IPermissionMenuImagePort {
  private readonly publicBaseUrl: string;
  private readonly legacyPublicBaseUrl: string;
  constructor(private readonly client: SupabaseAnyClient, supabaseUrl: string) {
    this.publicBaseUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/menu-image-public`;
    this.legacyPublicBaseUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/menu-item-images`;
  }

  private credential(): { token: string; generation: number } {
    const value = employeeCredential(this.client);
    if (!value.token) throw new AppError("EMPLOYEE_SESSION_REQUIRED", messages.EMPLOYEE_SESSION_REQUIRED!);
    return { token: value.token, generation: value.generation };
  }
  private assertGeneration(generation: number): void {
    if (generation !== employeeCredential(this.client).generation) throw new AppError("EMPLOYEE_SESSION_REQUIRED", messages.EMPLOYEE_SESSION_REQUIRED!);
  }

  async stageMenuItemImage(input: PermissionMenuImageStageInput): Promise<PermissionMenuImageStageResult> {
    validateUuid(input.itemId); validateFile(input.file);
    const { token, generation } = this.credential();
    const body = new FormData(); body.set("itemId", input.itemId); body.set("file", input.file);
    const { data, error } = await this.client.functions.invoke("menu-image-gateway", {
      method: "POST", body, headers: { "x-pos-employee-token": token },
    });
    this.assertGeneration(generation);
    if (error) throw await gatewayHttpFailure(error);
    if (!isRecord(data) || data.ok !== true || !isRecord(data.data) || typeof data.data.uploadHandle !== "string") throw gatewayFailure(data);
    return { uploadHandle: validateUuid(data.data.uploadHandle) };
  }

  async readStagedMenuItemImage(uploadHandle: string): Promise<Blob> {
    const handle = validateUuid(uploadHandle); const { token, generation } = this.credential();
    const { data, error } = await this.client.functions.invoke(`menu-image-gateway/staging/${handle}`, {
      method: "GET", headers: { "x-pos-employee-token": token },
    });
    this.assertGeneration(generation);
    if (error) throw await gatewayHttpFailure(error);
    if (!(data instanceof Blob)) throw gatewayFailure(data);
    return data;
  }

  async discardStagedMenuItemImage(uploadHandle: string): Promise<void> {
    const handle = validateUuid(uploadHandle); const { token, generation } = this.credential();
    const { data, error } = await this.client.functions.invoke(`menu-image-gateway/staging/${handle}`, {
      method: "DELETE", headers: { "x-pos-employee-token": token },
    });
    this.assertGeneration(generation);
    if (error) throw await gatewayHttpFailure(error);
    if (!isRecord(data) || data.ok !== true) throw gatewayFailure(data);
  }

  getImageUrl(assetKey: string | null | undefined): string | null {
    if (!assetKey) return null;
    if (UUID.test(assetKey)) return `${this.publicBaseUrl}/${validateUuid(assetKey)}`;
    // Existing public objects remain readable after activation. This is URL
    // resolution only: all new writes still require private staging/finalization.
    const path = assetKey.replace(/^menu-item-images\//, "");
    const [storeId, folder, itemId, filename, extra] = path.split("/");
    const file = filename?.match(/^(.+)\.(jpg|png|webp)$/);
    if (extra === undefined && folder === "menu-items" && UUID.test(storeId ?? "") && UUID.test(itemId ?? "") && file && UUID.test(file[1])) {
      return `${this.legacyPublicBaseUrl}/${path}`;
    }
    // A malformed historic reference must not crash the whole menu render.
    return null;
  }
}
