import type { AppErrorCode } from "@/core/appError";
import { AppError, isAppError } from "@/core/appError";

export type UiErrorSeverity = "info" | "warning" | "error";

export type UiErrorAction =
  | "collectMoreCash"
  | "closeOpenOrders"
  | "pairStore"
  | "refreshMenu"
  | "reloadOrder"
  | "requestAdmin"
  | "retry";

export type UiError = {
  code: AppErrorCode;
  title: string;
  message: string;
  severity: UiErrorSeverity;
  blocking: boolean;
  action: UiErrorAction;
};

const UI_ERROR_BY_CODE: Record<AppErrorCode, UiError> = {
  AUTH_REQUIRED: {
    code: "AUTH_REQUIRED",
    title: "Cần kết nối cửa hàng",
    message: "Thiết bị chưa có phiên cửa hàng hợp lệ. Hãy kết nối lại bằng Store Key.",
    severity: "error",
    blocking: true,
    action: "pairStore",
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    title: "Không đủ quyền",
    message: "Tài khoản hiện tại không có quyền thực hiện thao tác này.",
    severity: "warning",
    blocking: true,
    action: "requestAdmin",
  },
  INVALID_PIN: {
    code: "INVALID_PIN",
    title: "PIN không đúng",
    message: "Kiểm tra lại nhân viên và nhập lại mã PIN.",
    severity: "warning",
    blocking: false,
    action: "retry",
  },
  ORDER_VERSION_CONFLICT: {
    code: "ORDER_VERSION_CONFLICT",
    title: "Đơn đã thay đổi",
    message: "Dữ liệu đơn vừa được cập nhật từ thiết bị khác. Tải lại đơn trước khi tiếp tục.",
    severity: "warning",
    blocking: true,
    action: "reloadOrder",
  },
  MENU_ITEM_UNAVAILABLE: {
    code: "MENU_ITEM_UNAVAILABLE",
    title: "Món không còn bán",
    message: "Một món trong đơn đã bị tắt hoặc xoá. Tải lại menu và chọn món thay thế.",
    severity: "warning",
    blocking: true,
    action: "refreshMenu",
  },
  OPTION_VALUE_UNAVAILABLE: {
    code: "OPTION_VALUE_UNAVAILABLE",
    title: "Tuỳ chọn không còn bán",
    message: "Một tuỳ chọn trong đơn đã bị tắt hoặc xoá. Tải lại menu và chọn lại tuỳ chọn.",
    severity: "warning",
    blocking: true,
    action: "refreshMenu",
  },
  PAYMENT_AMOUNT_TOO_LOW: {
    code: "PAYMENT_AMOUNT_TOO_LOW",
    title: "Chưa đủ tiền thanh toán",
    message: "Số tiền khách đưa nhỏ hơn tổng tiền của đơn.",
    severity: "warning",
    blocking: true,
    action: "collectMoreCash",
  },
  OPEN_ORDERS_BLOCK_CLEAR_DEMO: {
    code: "OPEN_ORDERS_BLOCK_CLEAR_DEMO",
    title: "Còn đơn đang mở",
    message: "Cần thanh toán hoặc huỷ toàn bộ đơn đang mở trước khi xoá dữ liệu demo.",
    severity: "warning",
    blocking: true,
    action: "closeOpenOrders",
  },
  INVALID_ORDER_ITEMS: {
    code: "INVALID_ORDER_ITEMS",
    title: "Đơn chưa hợp lệ",
    message: "Danh sách món trong đơn chưa hợp lệ. Kiểm tra lại số lượng và tuỳ chọn.",
    severity: "warning",
    blocking: true,
    action: "retry",
  },
  INVALID_ORDER_ID: {
    code: "INVALID_ORDER_ID",
    title: "Mã đơn không hợp lệ",
    message: "Không thể xác định đơn cần xử lý. Hãy tải lại màn hình đơn.",
    severity: "error",
    blocking: true,
    action: "reloadOrder",
  },
  INVALID_PAYMENT_ID: {
    code: "INVALID_PAYMENT_ID",
    title: "Mã thanh toán không hợp lệ",
    message: "Không thể tạo giao dịch thanh toán. Hãy thử lại.",
    severity: "error",
    blocking: true,
    action: "retry",
  },
  VOID_REASON_REQUIRED: {
    code: "VOID_REASON_REQUIRED",
    title: "Thiếu lý do hủy",
    message: "Chọn lý do hủy; nếu chọn \"Lý do khác\" thì phải nhập nội dung.",
    severity: "warning",
    blocking: false,
    action: "retry",
  },
  TABLE_NOT_FOUND: {
    code: "TABLE_NOT_FOUND",
    title: "Không tìm thấy bàn",
    message: "Bàn đã bị xoá hoặc thay đổi từ thiết bị khác. Tải lại sơ đồ bàn.",
    severity: "warning",
    blocking: true,
    action: "reloadOrder",
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    title: "Không tìm thấy dữ liệu",
    message: "Dữ liệu cần xử lý không còn tồn tại. Hãy tải lại màn hình.",
    severity: "warning",
    blocking: true,
    action: "retry",
  },
  UNKNOWN: {
    code: "UNKNOWN",
    title: "Có lỗi xảy ra",
    message: "Thao tác chưa hoàn tất. Hãy thử lại hoặc kiểm tra kết nối.",
    severity: "error",
    blocking: true,
    action: "retry",
  },
};

export const mapAppErrorToUiError = (error: AppError): UiError => ({
  ...UI_ERROR_BY_CODE[error.code],
  message: error.message || UI_ERROR_BY_CODE[error.code].message,
});

export const mapUnknownErrorToUiError = (error: unknown): UiError => {
  if (isAppError(error)) {
    return mapAppErrorToUiError(error);
  }

  return {
    ...UI_ERROR_BY_CODE.UNKNOWN,
    message: error instanceof Error && error.message ? error.message : UI_ERROR_BY_CODE.UNKNOWN.message,
  };
};

export const getUiErrorTemplate = (code: AppErrorCode): UiError => ({ ...UI_ERROR_BY_CODE[code] });

export const formatUiErrorForToast = (error: UiError): string => `${error.title}: ${error.message}`;
