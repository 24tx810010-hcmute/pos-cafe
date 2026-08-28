# Hủy đơn đã thanh toán

## Purpose

Cho người có quyền hủy một đơn đã thanh toán kèm lý do bắt buộc và dấu vết kiểm toán, và loại đơn đó khỏi doanh thu. Đây là thao tác ghi đụng tiền, tách khỏi việc tra cứu lịch sử vì có quyền riêng, có xác nhận riêng và có cơ chế chống xung đột riêng. Truy vết: FR-15.

## Requirements

### Requirement: Hủy đơn đã thanh toán

Hủy đơn đã thanh toán SHALL chỉ khả dụng với người có quyền `order.voidPaid` và chỉ áp dụng cho đơn đang ở trạng thái đã thanh toán. Thao tác MUST yêu cầu xác nhận có cảnh báo rõ số tiền bị loại khỏi doanh thu và ngày bị ảnh hưởng, MUST yêu cầu chọn một lý do, và MUST bắt buộc nhập ghi chú khi chọn lý do khác. Quyền MUST được kiểm tra lại ở phía database.

#### Scenario: Hủy đơn thành công

- **WHEN** người có quyền xác nhận hủy một đơn đã thanh toán kèm lý do hợp lệ
- **THEN** đơn chuyển sang đã hủy, chi tiết hiển thị người hủy, thời điểm và lý do, và đơn bị loại khỏi doanh thu

#### Scenario: Chọn lý do khác nhưng bỏ trống ghi chú

- **WHEN** người dùng chọn lý do khác và không nhập ghi chú
- **THEN** hệ thống chặn xác nhận hủy

#### Scenario: Đơn đã đổi trạng thái ở máy khác

- **WHEN** đơn không còn ở trạng thái đã thanh toán tại thời điểm xác nhận hủy
- **THEN** hệ thống yêu cầu tải lại thay vì thực hiện hủy

### Requirement: Chống xung đột khi hủy đơn

Trước khi gửi yêu cầu hủy, hệ thống SHALL tải lại chi tiết đơn để lấy phiên bản khóa lạc quan mới nhất, tránh xung đột giả do dữ liệu cache còn cũ sau thanh toán.

#### Scenario: Hủy ngay sau khi thanh toán trên cùng thiết bị

- **WHEN** người dùng thanh toán một đơn rồi hủy ngay đơn đó trong cùng phiên
- **THEN** hệ thống hủy thành công mà không báo lỗi xung đột phiên bản
