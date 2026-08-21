# Đồng bộ đa thiết bị

## Purpose

Giữ cho nhiều thiết bị POS cùng làm việc trong một quán nhìn thấy cùng một sự thật về bàn, đơn và thực đơn, bằng tín hiệu thời gian thực kết hợp tải lại dữ liệu khi đang có kết nối mạng. Truy vết: FR-21, NFR-05.

## Requirements

### Requirement: Hệ thống chỉ hoạt động khi có kết nối mạng

Ứng dụng SHALL yêu cầu kết nối mạng tới backend để vận hành. Hệ thống MUST NOT tuyên bố hỗ trợ làm việc ngoại tuyến.

#### Scenario: Mất mạng khi đang bán

- **WHEN** thiết bị mất kết nối mạng trong lúc nhân viên đang thao tác
- **THEN** các thao tác cần ghi dữ liệu thất bại và không có hàng đợi ngoại tuyến nào lưu lại thao tác đó

### Requirement: Tín hiệu thời gian thực dùng để tải lại, không vá cache

Hệ thống SHALL nhận tín hiệu thay đổi theo cửa hàng cho đơn, thanh toán, bàn, thực đơn, sơ đồ và vật trang trí, và SHALL dùng tín hiệu đó để đánh dấu dữ liệu cần tải lại. Hệ thống MUST NOT vá trực tiếp dữ liệu cache từ nội dung tín hiệu.

#### Scenario: Thiết bị khác mở đơn tại bàn

- **WHEN** một thiết bị mở đơn mới tại một bàn
- **THEN** các thiết bị khác trong cùng cửa hàng tải lại và hiển thị bàn đó ở trạng thái đang phục vụ

### Requirement: Tải lại theo chu kỳ cho dữ liệu vận hành

Các truy vấn sơ đồ bàn, danh sách đơn đang mở và chi tiết đơn SHALL được tải lại theo chu kỳ khoảng 5 giây để bù cho trường hợp tín hiệu thời gian thực bị mất.

#### Scenario: Tín hiệu thời gian thực không tới

- **WHEN** tín hiệu thay đổi không tới được một thiết bị
- **THEN** thiết bị đó vẫn cập nhật trạng thái trong khoảng vài giây nhờ chu kỳ tải lại

### Requirement: Cập nhật sau thao tác không chờ tải lại

Sau khi gửi đơn hoặc thanh toán, giao diện trên thiết bị thực hiện thao tác SHALL cập nhật ngay từ dữ liệu trả về của lời gọi, không chờ tải lại. Các thiết bị khác SHALL bắt kịp trong khoảng vài giây.

#### Scenario: In hóa đơn ngay sau khi thanh toán

- **WHEN** thu ngân hoàn tất thanh toán
- **THEN** hóa đơn mở ngay từ dữ liệu trả về của lời gọi thanh toán mà không chờ tải lại danh sách đơn

### Requirement: Chống ghi đè bằng khóa lạc quan

Các thao tác cập nhật đơn SHALL dùng khóa lạc quan để từ chối thao tác dựa trên dữ liệu đã cũ.

#### Scenario: Hai thiết bị cùng sửa một đơn

- **WHEN** hai thiết bị cùng sửa một đơn và thiết bị thứ hai gửi thay đổi dựa trên phiên bản cũ
- **THEN** database từ chối thay đổi của thiết bị thứ hai và thiết bị đó phải tải lại trước khi gửi lại

### Requirement: Giới hạn đã biết của đồng bộ

Liên kết giữa món và nhóm tùy chọn hiện SHALL không được theo dõi bằng tín hiệu thời gian thực. Thao tác chỉ gắn hoặc bỏ nhóm khỏi món MUST cần tải lại thủ công hoặc kết nối lại để thiết bị khác nhìn thấy.

#### Scenario: Gắn nhóm tùy chọn vào món trên một thiết bị

- **WHEN** quản lý gắn thêm một nhóm tùy chọn cho món trên một thiết bị
- **THEN** thiết bị khác chưa thấy thay đổi cho tới khi tải lại hoặc kết nối lại
