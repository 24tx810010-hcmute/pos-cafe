import { AppError } from "./appError";
import type { PermissionErrorCode, PermissionErrorDetails } from "@/domain/permissions";

export const permissionErrorMessages: Record<PermissionErrorCode, string> = {
  INVALID_EMPLOYEE_REQUEST: "Thông tin nhân viên không hợp lệ. Kiểm tra các trường được đánh dấu.",
  EMPLOYEE_ROLE_UNAVAILABLE: "Vai trò này chưa được hỗ trợ trên ứng dụng.",
  OWNER_PROTECTED: "Không thể thay đổi chủ quán bằng thao tác này.",
  SELF_DISABLE_FORBIDDEN: "Bạn không thể tự tạm khóa tài khoản đang dùng.",
  SELF_PERMISSION_EDIT_FORBIDDEN: "Bạn không thể tự sửa vai trò hoặc quyền của mình.",
  OWNER_ONLY_PERMISSION: "Quyền này chỉ dành cho chủ quán.",
  PERMISSION_BASELINE_REQUIRED: "Quyền xem sơ đồ bàn luôn được cấp và không thể tắt.",
  PERMISSION_CEILING_EXCEEDED: "Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: {danh sách tên quyền}.",
  EMPLOYEE_VERSION_CONFLICT: "Thông tin nhân viên đã thay đổi. Tải lại trước khi lưu.",
  PERMISSION_CATALOG_STALE: "Danh mục quyền đã thay đổi. Tải lại trước khi lưu.",
  ADMIN_REQUEST_REUSED: "Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới.",
  PERMISSION_UPDATE_UNAVAILABLE: "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.",
  PERMISSION_REFRESH_UNAVAILABLE: "Chưa xác minh được quyền. Kiểm tra kết nối và thử lại.",
  OWNER_MIGRATION_REVIEW_REQUIRED: "Chưa xác định được chủ quán. Cần xác minh ánh xạ trước khi chuyển đổi.",
  OWNER_RECOVERY_REVIEW_REQUIRED: "Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ.",
  BOOTSTRAP_CONFLICT: "Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán.",
  PIN_CHANGE_REQUIRED: "Bạn cần đổi PIN tạm trước khi sử dụng quán.",
  PIN_REUSE_NOT_ALLOWED: "PIN mới phải khác PIN tạm đang dùng.",
  PIN_CONFIRMATION_MISMATCH: "Hai lần nhập PIN mới chưa khớp.",
  INITIAL_SEED_ATTEMPT_STALE: "Tiến trình dữ liệu mẫu đã thay đổi. Kiểm tra trạng thái trước khi thử lại.",
};

export const permissionError = (code: PermissionErrorCode, details?: PermissionErrorDetails): AppError =>
  new AppError(code, permissionErrorMessages[code], details);
