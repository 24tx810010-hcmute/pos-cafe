# Lịch sử đơn hàng

## Purpose

Cho nhân viên tra cứu các đơn đã kết thúc theo khoảng ngày và bộ lọc, xem lại chi tiết đã chụp của từng đơn, in lại hóa đơn, và cho người có quyền hủy một đơn đã thanh toán kèm lý do và dấu vết kiểm toán. Truy vết: FR-14, FR-15.

## Requirements

### Requirement: Danh sách đơn đã kết thúc

Màn lịch sử SHALL chỉ liệt kê đơn đã kết thúc, gồm đơn đã thanh toán và đơn đã hủy. Đơn đang mở MUST NOT xuất hiện ở đây mà thuộc màn sơ đồ bàn hoặc màn mang đi.

#### Scenario: Đơn đang mở không nằm trong lịch sử

- **WHEN** một bàn đang có đơn mở
- **THEN** đơn đó không xuất hiện trong danh sách lịch sử

#### Scenario: Đơn tách hiện ngay sau khi thu tiền

- **WHEN** thu ngân tách và thanh toán một phần của đơn tại bàn
- **THEN** đơn tách xuất hiện ngay trong lịch sử như một dòng độc lập, không cần chờ bàn đóng

### Requirement: Bộ lọc, tìm kiếm và phân trang

Lịch sử SHALL lọc được theo khoảng ngày với mặc định là hôm nay, và hỗ trợ các lựa chọn nhanh hôm nay, 7 ngày, tháng này và khoảng ngày tùy chọn. Lọc theo trạng thái, loại đơn và từ khóa tìm kiếm MUST được áp dụng ở tầng dữ liệu trước khi cắt trang.

#### Scenario: Chọn khoảng ngày tùy chọn

- **WHEN** người dùng chọn khoảng ngày tùy chọn từ ngày A đến ngày B
- **THEN** danh sách chỉ chứa đơn có ngày kinh doanh nằm trong khoảng đó

#### Scenario: Phân trang giữ payload ổn định

- **WHEN** khoảng ngày chứa nhiều đơn hơn một trang
- **THEN** hệ thống trả về từng trang thay vì toàn bộ danh sách

### Requirement: Chi tiết đơn dựng từ dữ liệu đã chụp

Chi tiết đơn SHALL hiển thị tên món, tùy chọn, ghi chú và số lượng theo bản chụp tại thời điểm đặt, cùng nhân viên đã thu tiền, phương thức thanh toán và thời điểm thanh toán. Số tiền khách đưa và tiền thối MUST đọc từ bản chụp thanh toán, MUST NOT tính lại ở giao diện.

#### Scenario: Đổi giá món sau khi đơn đã thanh toán

- **WHEN** quản lý đổi giá một món sau khi đơn chứa món đó đã thanh toán
- **THEN** chi tiết đơn trong lịch sử vẫn hiển thị giá cũ đã chụp

#### Scenario: Đơn chưa gắn khách hàng

- **WHEN** đơn không có thông tin khách hàng
- **THEN** chi tiết hiển thị khách lẻ

### Requirement: In lại hóa đơn

Hệ thống SHALL cho in lại hóa đơn của đơn đã thanh toán bằng cách dựng lại từ dữ liệu đơn đã lưu. Đơn chưa có thanh toán MUST báo không in được, và đơn đã hủy MUST NOT in lại được.

#### Scenario: In lại đơn đã hủy

- **WHEN** người dùng mở một đơn đã hủy trong lịch sử
- **THEN** nút in lại hóa đơn bị vô hiệu hóa

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
