import { AppError, type AppErrorCode, isAppError } from "@/core/appError";

const appErrorMessages: Record<AppErrorCode, string> = {
  AUTH_REQUIRED: "Phiên cửa hàng không hợp lệ.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  INVALID_PIN: "PIN không đúng.",
  ORDER_VERSION_CONFLICT: "Dữ liệu đã thay đổi, vui lòng tải lại.",
  MENU_ITEM_UNAVAILABLE: "Món đã bị xoá hoặc tạm hết.",
  OPTION_VALUE_UNAVAILABLE: "Tuỳ chọn món không còn hợp lệ.",
  PAYMENT_AMOUNT_TOO_LOW: "Tiền khách đưa nhỏ hơn tổng tiền.",
  OPEN_ORDERS_BLOCK_CLEAR_DEMO: "Còn đơn đang mở, không thể xoá demo data.",
  INVALID_ORDER_ITEMS: "Dữ liệu món trong đơn không hợp lệ.",
  INVALID_ORDER_ID: "Mã đơn hàng không hợp lệ.",
  INVALID_PAYMENT_ID: "Mã thanh toán không hợp lệ.",
  VOID_REASON_REQUIRED: "Vui lòng nhập lý do hủy.",
  TABLE_NOT_FOUND: "Không tìm thấy bàn.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  UNKNOWN: "Có lỗi xảy ra.",
};

const knownCodes = new Set<AppErrorCode>(Object.keys(appErrorMessages) as AppErrorCode[]);

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const mapSupabaseError = (error: unknown, fallbackCode: AppErrorCode = "UNKNOWN"): AppError => {
  if (isAppError(error)) {
    return error;
  }

  const supabaseError = (error ?? {}) as SupabaseLikeError;
  const haystack = [
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
    supabaseError.code,
  ]
    .filter(Boolean)
    .join(" ");

  if (supabaseError.code === "PGRST116") {
    return new AppError("NOT_FOUND", appErrorMessages.NOT_FOUND, error);
  }

  for (const code of knownCodes) {
    if (code !== "UNKNOWN" && haystack.includes(code)) {
      return new AppError(code, appErrorMessages[code], error);
    }
  }

  return new AppError(fallbackCode, appErrorMessages[fallbackCode], error);
};

export const throwIfError = (error: unknown, fallbackCode: AppErrorCode = "UNKNOWN"): void => {
  if (error) {
    throw mapSupabaseError(error, fallbackCode);
  }
};

export const requireData = <T>(data: T | null | undefined, error: unknown, fallbackCode: AppErrorCode = "UNKNOWN"): T => {
  throwIfError(error, fallbackCode);

  if (data == null) {
    throw new AppError("NOT_FOUND", appErrorMessages.NOT_FOUND);
  }

  return data;
};
