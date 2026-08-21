# Quản lý đơn hàng

## Purpose

Cho nhân viên tạo và chỉnh sửa đơn tại bàn hoặc đơn mang đi, chọn món kèm tùy chọn dùng chung, và gửi phiếu cho bếp, với giá được chốt phía database tại thời điểm gửi đơn. Truy vết: FR-07, FR-08, FR-09, FR-10.

## Requirements

### Requirement: Tạo đơn tại bàn và đơn mang đi

Hệ thống SHALL hỗ trợ hai loại đơn: đơn tại bàn gắn với một bàn cụ thể, và đơn mang đi không gắn bàn. Danh sách đơn mang đi SHALL chỉ liệt kê đơn đang mở.

#### Scenario: Tạo đơn mang đi

- **WHEN** nhân viên tạo một đơn mang đi mới
- **THEN** đơn được tạo mà không chiếm bàn nào, và xuất hiện trong danh sách đơn mang đi đang mở

#### Scenario: Đơn mang đi đã thanh toán

- **WHEN** một đơn mang đi được thanh toán
- **THEN** đơn rời khỏi danh sách đơn mang đi và chỉ còn xem được ở màn lịch sử đơn

### Requirement: Chọn món kèm nhóm tùy chọn dùng chung

Nhóm tùy chọn SHALL dùng chung giữa nhiều món theo quan hệ nhiều-nhiều. Nhóm loại chọn-một SHALL cho chọn đúng một giá trị; nhóm loại chọn-nhiều SHALL cho chọn nhiều giá trị, mỗi giá trị có số lượng riêng mặc định là 1. Nhóm bắt buộc MUST được chọn hợp lệ trước khi thêm món vào giỏ.

#### Scenario: Món không có nhóm tùy chọn

- **WHEN** nhân viên bấm vào một món không gắn nhóm tùy chọn nào
- **THEN** món được thêm thẳng vào giỏ, không mở hộp thoại chọn tùy chọn

#### Scenario: Nhóm bắt buộc chưa chọn

- **WHEN** món có nhóm bắt buộc và nhân viên chưa chọn giá trị hợp lệ
- **THEN** nút thêm vào đơn bị khóa

#### Scenario: Sửa nhóm dùng chung

- **WHEN** quản lý sửa một nhóm tùy chọn
- **THEN** thay đổi áp dụng cho mọi món đang gắn nhóm đó

### Requirement: Tính tiền dòng giỏ hàng

Giá của một dòng giỏ hàng SHALL bằng tổng của giá món và tổng giá các tùy chọn nhân với số lượng từng tùy chọn, rồi nhân với số lượng món.

#### Scenario: Dòng có tùy chọn số lượng lớn hơn một

- **WHEN** một dòng giỏ có món giá P, một tùy chọn giá A với số lượng 2, và số lượng món là 3
- **THEN** giá dòng bằng (P + A × 2) × 3, và dòng hiển thị tùy chọn kèm ký hiệu số lượng

### Requirement: Gửi đơn và chốt giá phía database

Khi gửi đơn, hệ thống SHALL gửi thay đổi lên database và database SHALL quyết định bản chụp tên và giá được lưu vào đơn. Một tùy chọn MUST chỉ hợp lệ khi nhóm chứa nó đang được gắn với đúng món tương ứng.

#### Scenario: Tùy chọn không thuộc món

- **WHEN** đơn được gửi kèm một tùy chọn thuộc nhóm không gắn với món đó
- **THEN** database từ chối thay đổi

#### Scenario: Giá đổi sau khi gửi đơn

- **WHEN** quản lý đổi giá món sau khi đơn đã được gửi
- **THEN** đơn đã gửi giữ nguyên giá đã chụp, giá mới chỉ áp dụng cho đơn gửi sau đó

### Requirement: Phiếu gửi bếp chỉ chứa món mới thêm

Khi gửi đơn, hệ thống SHALL tạo phiếu gửi bếp chỉ liệt kê các dòng mới thêm so với đơn hiện có, so khớp theo nội dung gồm món, tùy chọn và ghi chú. Phiếu gửi bếp MUST chỉ hiển thị tên món và số lượng, MUST NOT hiển thị giá.

#### Scenario: Thêm món vào đơn đang mở

- **WHEN** nhân viên mở lại một đơn đã có 3 món, thêm 1 món rồi gửi đơn
- **THEN** phiếu gửi bếp chỉ liệt kê 1 món vừa thêm

### Requirement: Bảo vệ chỉnh sửa đơn

Hệ thống SHALL yêu cầu xác nhận khi đóng đơn nháp hoặc đơn đang chỉnh sửa mà chưa lưu. Khi đơn đã bị đóng hoặc dữ liệu đã cũ, hệ thống SHALL hiển thị trạng thái không thể chỉnh sửa hay thanh toán như đơn đang mở.

#### Scenario: Đóng đơn khi còn thay đổi chưa lưu

- **WHEN** nhân viên đóng màn đơn trong lúc giỏ hàng có thay đổi chưa gửi
- **THEN** hệ thống yêu cầu xác nhận trước khi bỏ thay đổi

#### Scenario: Đơn đã bị máy khác đóng

- **WHEN** nhân viên đang mở một đơn đã được thiết bị khác thanh toán hoặc hủy
- **THEN** hệ thống hiển thị trạng thái đơn đã kết thúc và không cho chỉnh sửa hoặc thanh toán
