import type { BusinessError, WriteErrorCode } from "@/domain";
import { AppError } from "./appError";

export const writeErrorMessages: Record<WriteErrorCode, string> = {
  AUTH_REQUIRED: "Chưa ghép cửa hàng. Vui lòng đăng nhập lại.",
  EMPLOYEE_SESSION_REQUIRED: "Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN.",
  INVALID_PIN: "PIN không đúng hoặc nhân viên không còn hoạt động.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  INVALID_WRITE_REQUEST: "Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra.",
  IDEMPOTENCY_KEY_REUSED: "Mã thao tác đã gắn với nội dung khác. Hãy mở lại thao tác đã lưu.",
  OPERATION_NOT_FOUND: "Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy.",
  OPERATION_EXPIRED: "Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới.",
  OPERATION_CANCELLED: "Lệnh đã được hủy trước khi thực hiện.",
  ORDER_VERSION_CONFLICT: "Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới.",
  TABLE_OCCUPIED: "Bàn đã có đơn mở. Hãy mở đơn hiện tại của bàn.",
  NOT_FOUND: "Không tìm thấy đơn trong cửa hàng này.",
  TABLE_NOT_FOUND: "Bàn không còn khả dụng. Vui lòng chọn lại bàn.",
  ENTITY_ID_CONFLICT: "Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới.",
  MENU_ITEM_UNAVAILABLE: "Món không còn khả dụng. Vui lòng chọn lại.",
  OPTION_VALUE_UNAVAILABLE: "Tùy chọn không còn phù hợp với món. Vui lòng chọn lại.",
  INVALID_ORDER_ITEMS: "Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn.",
  PAYMENT_AMOUNT_TOO_LOW: "Tiền nhận chưa đủ để thanh toán phần đã chọn.",
  VOID_REASON_REQUIRED: "Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác.",
  PRICE_CHANGED: "Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại.",
  WRITE_RESULT_UNKNOWN: "Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục.",
  WRITE_TEMPORARILY_UNAVAILABLE: "Chưa thể hoàn tất yêu cầu. Hãy tra cứu và chỉ thử lại cùng thao tác.",
  WRITE_PROTOCOL_UNSUPPORTED: "Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng.",
  RECEIPT_UNAVAILABLE: "Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn.",
};
export const businessError = (code: WriteErrorCode, details: Record<string, unknown> | null = null): BusinessError => ({ code, message: writeErrorMessages[code], details });
export const writeError = (code: WriteErrorCode, details: Record<string, unknown> | null = null): AppError => new AppError(code, writeErrorMessages[code], details);
