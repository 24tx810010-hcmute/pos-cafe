# Kiểm soát truy cập theo vai trò và quyền

## Purpose

Giới hạn nhân viên chỉ thấy và làm được đúng phần công việc của mình, qua hai trục độc lập: quyền truy cập module theo vai trò, và quyền thực hiện hành động có thể ghi đè theo từng nhân viên. Truy vết: FR-04.

## Requirements

### Requirement: Hai trục kiểm soát truy cập độc lập

Hệ thống SHALL kiểm soát truy cập theo hai trục tách rời: quyền truy cập module quyết định nhân viên thấy gì trên điều hướng, và quyền hành động quyết định nhân viên được làm gì.

#### Scenario: Vai trò thu ngân

- **WHEN** một nhân viên vai trò `cashier` đăng nhập
- **THEN** điều hướng chỉ hiển thị sơ đồ bàn, đơn hàng, thanh toán và lịch sử đơn

#### Scenario: Vai trò quản lý

- **WHEN** một nhân viên vai trò `admin` đăng nhập
- **THEN** điều hướng hiển thị toàn bộ module vận hành và các module quản trị menu, sơ đồ, nhân viên, báo cáo, cài đặt

### Requirement: Bộ quyền hành động được enforce

Hệ thống SHALL enforce đúng năm quyền hành động: `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`. Mặc định theo vai trò: `admin` có cả năm; `cashier` có bốn quyền đầu và MUST NOT có `order.voidPaid`.

#### Scenario: Thu ngân hủy đơn đã thanh toán

- **WHEN** một nhân viên `cashier` không được cấp thêm quyền thử hủy một đơn đã thanh toán
- **THEN** hệ thống từ chối thao tác

#### Scenario: Nút bị vô hiệu hóa sớm

- **WHEN** nhân viên hiện hành thiếu quyền cho một hành động
- **THEN** giao diện vô hiệu hóa nút tương ứng trước khi người dùng bấm

### Requirement: Ghi đè quyền theo từng nhân viên

Quyền hành động SHALL có thể ghi đè cho từng nhân viên bằng danh sách cấp thêm và danh sách chặn, nên hai nhân viên cùng vai trò vẫn có thể có quyền khác nhau. Khi đổi vai trò của một nhân viên, các ghi đè MUST được đặt lại về mặc định của vai trò mới.

#### Scenario: Cấp thêm quyền cho một thu ngân

- **WHEN** quản lý cấp quyền `order.voidPaid` cho một nhân viên `cashier` cụ thể
- **THEN** chỉ nhân viên đó hủy được đơn đã thanh toán, các thu ngân khác vẫn bị từ chối

#### Scenario: Lưu đúng mặc định vai trò

- **WHEN** quản lý chỉnh quyền của một nhân viên về đúng bộ mặc định của vai trò rồi lưu
- **THEN** hệ thống xóa các ghi đè của nhân viên đó thay vì lưu lại bộ trùng mặc định

### Requirement: Chốt quyền ở luồng nghiệp vụ và guardrail phía database

Mọi luồng tạo đơn, sửa đơn, hủy đơn mở, thanh toán và hủy đơn đã thanh toán SHALL kiểm tra quyền ở tầng nghiệp vụ, và các lời gọi database tương ứng MUST kiểm tra lại quyền hiệu lực đọc trực tiếp từ database. Hệ thống MUST NOT coi việc ẩn hoặc vô hiệu hóa nút là biện pháp bảo vệ.

#### Scenario: Gọi thẳng vào database khi thiếu quyền

- **WHEN** một lời gọi thanh toán được gửi thẳng tới database bởi nhân viên không có quyền `payment.take`
- **THEN** database từ chối thao tác

### Requirement: Giới hạn đã biết của mô hình quyền hiện tại

Client SHALL giữ ảnh chụp vai trò và quyền của nhân viên hiện hành tại thời điểm đăng nhập. Vì vậy thay đổi quyền chỉ có hiệu lực đầy đủ trên thiết bị đó sau khi khóa phiên và đăng nhập lại.

#### Scenario: Đổi quyền khi nhân viên đang đăng nhập ở máy khác

- **WHEN** quản lý đổi quyền của một nhân viên đang đăng nhập trên thiết bị khác
- **THEN** thiết bị đó vẫn dùng ảnh chụp quyền cũ cho việc hiển thị cho tới khi đăng nhập lại, trong khi guardrail phía database đã áp dụng quyền mới ngay
