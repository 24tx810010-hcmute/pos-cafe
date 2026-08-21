# Phiên làm việc của nhân viên

## Purpose

Xác định nhân viên nào đang vận hành thiết bị POS tại mỗi thời điểm, bằng cách chọn nhân viên và xác minh PIN, để mọi thao tác nghiệp vụ đều gắn được với một người cụ thể. Truy vết: FR-03.

## Requirements

### Requirement: Chọn nhân viên và xác minh PIN

Sau khi thiết bị đã ghép cửa hàng, hệ thống SHALL yêu cầu chọn một nhân viên đang hoạt động và nhập đúng PIN trước khi mở app shell.

#### Scenario: Nhập PIN đúng

- **WHEN** người dùng chọn một nhân viên đang hoạt động và nhập đúng PIN
- **THEN** hệ thống mở app shell với nhân viên đó là nhân viên hiện hành

#### Scenario: Nhập PIN sai

- **WHEN** người dùng nhập sai PIN
- **THEN** hệ thống từ chối mở app shell và giữ nguyên màn nhập PIN

#### Scenario: Nhân viên bị tạm khóa

- **WHEN** một nhân viên đang ở trạng thái tạm khóa đăng nhập
- **THEN** nhân viên đó không xuất hiện trong danh sách chọn ở màn nhập PIN

### Requirement: Bảo vệ PIN

Việc xác minh PIN SHALL được thực hiện phía database. Client MUST NOT đọc được giá trị băm của PIN.

#### Scenario: Client không truy cập được hash PIN

- **WHEN** client truy vấn dữ liệu nhân viên
- **THEN** dữ liệu trả về không chứa trường băm PIN, và việc so khớp PIN chỉ diễn ra qua lời gọi phía database

### Requirement: Khóa phiên nhân viên

Hệ thống SHALL cho phép khóa phiên nhân viên hiện hành để quay lại màn nhập PIN mà không hủy phiên ghép cửa hàng của thiết bị.

#### Scenario: Khóa phiên

- **WHEN** nhân viên hiện hành chọn khóa phiên
- **THEN** hệ thống quay về màn chọn nhân viên và nhập PIN, thiết bị vẫn giữ nguyên phiên cửa hàng

#### Scenario: Tải lại trang khi đang đăng nhập

- **WHEN** người dùng tải lại trang trong lúc đã đăng nhập nhân viên
- **THEN** hệ thống quay về màn nhập PIN vì nhân viên hiện hành chỉ tồn tại trong bộ nhớ phiên chạy
