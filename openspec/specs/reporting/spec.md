# Báo cáo kinh doanh

## Purpose

Cho quản lý xem doanh thu, sản lượng và các chỉ số vận hành theo ngày kinh doanh, đủ để biết quán bán được bao nhiêu, giờ nào đông và món nào chạy. Truy vết: FR-19.

## Requirements

### Requirement: Chỉ số cốt lõi theo ngày kinh doanh

Báo cáo SHALL tổng hợp theo ngày kinh doanh và SHALL cung cấp doanh thu, số đơn đã thanh toán, giá trị trung bình mỗi đơn, món bán chạy và doanh thu theo giờ.

#### Scenario: Xem báo cáo trong ngày

- **WHEN** quản lý mở báo cáo với khoảng mặc định hôm nay
- **THEN** hệ thống hiển thị doanh thu, số đơn đã thanh toán, giá trị trung bình mỗi đơn, biểu đồ theo giờ và danh sách món bán chạy của ngày đó

### Requirement: Chỉ tính đơn đã thanh toán

Báo cáo MUST chỉ tính đơn ở trạng thái đã thanh toán và MUST loại trừ đơn đã hủy. Số liệu SHALL được tính trực tiếp từ dữ liệu đơn, không dựa vào bảng tổng hợp lưu sẵn.

#### Scenario: Hủy một đơn đã thanh toán

- **WHEN** một đơn đã thanh toán bị hủy
- **THEN** doanh thu và số đơn của ngày tương ứng giảm đi tương ứng ở lần xem báo cáo kế tiếp mà không cần thao tác tính lại thủ công

### Requirement: Tổng hợp đơn hủy

Báo cáo SHALL cung cấp số lượng và tổng tiền của các đơn đã thanh toán rồi bị hủy theo ngày kinh doanh, lấy từ nguồn tổng hợp chứ MUST NOT đếm từ danh sách đơn đã phân trang.

#### Scenario: Đơn hủy nằm ngoài trang đầu

- **WHEN** ngày kinh doanh có đơn hủy không nằm trong trang đầu của danh sách đơn
- **THEN** số đơn hủy và tiền hủy vẫn hiển thị đúng tổng của cả ngày

### Requirement: Bộ lọc khoảng thời gian

Báo cáo SHALL hỗ trợ các khoảng hôm nay, 7 ngày, tháng này và khoảng tùy chọn từ ngày tới ngày.

#### Scenario: Chọn khoảng 7 ngày

- **WHEN** quản lý chọn khoảng 7 ngày
- **THEN** mọi chỉ số và biểu đồ được tính lại cho khoảng đó

### Requirement: Giới hạn đã biết của báo cáo

Chức năng xuất báo cáo ra tệp SHALL hiển thị ở trạng thái vô hiệu hóa cho tới khi được triển khai.

#### Scenario: Bấm nút xuất báo cáo

- **WHEN** quản lý bấm nút xuất báo cáo
- **THEN** nút ở trạng thái vô hiệu hóa và không sinh tệp nào
