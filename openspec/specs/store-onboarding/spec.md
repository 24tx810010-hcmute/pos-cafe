# Khởi tạo và ghép cửa hàng

## Purpose

Cho phép người dùng tạo một cửa hàng mới hoặc ghép thiết bị vào cửa hàng đã có bằng Store Key, để mọi thiết bị POS cùng làm việc trên đúng một cửa hàng. Truy vết: FR-01, FR-02.

## Requirements

### Requirement: Tạo cửa hàng mới

Hệ thống SHALL cho phép tạo cửa hàng mới với tên hiển thị bắt buộc, địa chỉ tùy chọn và Admin PIN. Cửa hàng tạo ra MUST mặc định là cửa hàng trống, chỉ gồm bản ghi cửa hàng, cấu hình cửa hàng và một tài khoản admin.

#### Scenario: Tạo cửa hàng trống

- **WHEN** người dùng nhập tên hiển thị hợp lệ và Admin PIN rồi xác nhận tạo
- **THEN** hệ thống tạo cửa hàng mới, sinh Store Key theo định dạng `STORE_NO-SECRET`, tạo tài khoản admin với PIN vừa nhập, và không tạo dữ liệu danh mục, món, khu hay bàn nào

#### Scenario: Tùy chọn khởi tạo dữ liệu mẫu

- **WHEN** người dùng bật tùy chọn khởi tạo dữ liệu mẫu (mặc định tắt) khi tạo cửa hàng
- **THEN** hệ thống seed thêm bộ dữ liệu demo gọn gồm danh mục, món, một khu với vài bàn và một tài khoản thu ngân demo

#### Scenario: Seed dữ liệu mẫu thất bại

- **WHEN** việc seed dữ liệu mẫu thất bại sau khi cửa hàng đã được tạo
- **THEN** cửa hàng vẫn tồn tại và vào được, hệ thống hiển thị cảnh báo kèm hành động thử lại, và người dùng có thể seed lại từ màn Cài đặt

### Requirement: Bảo mật Store Key

Store Key SHALL gồm phần số cửa hàng công khai được sinh theo sequence và phần bí mật đóng vai trò credential. Hệ thống MUST NOT cho phép truy cập cửa hàng chỉ bằng số cửa hàng, và MUST NOT lưu Store Key hoặc phần bí mật ở dạng thô sau khi hoàn tất ghép thiết bị hoặc tạo cửa hàng.

#### Scenario: Đoán số cửa hàng không đủ để vào

- **WHEN** người dùng nhập một số cửa hàng có thật nhưng phần bí mật sai
- **THEN** hệ thống từ chối ghép thiết bị và không tiết lộ thông tin nào của cửa hàng đó

### Requirement: Ghép thiết bị bằng Store Key

Hệ thống SHALL cho phép ghép một thiết bị vào cửa hàng đã tồn tại bằng cách nhập Store Key, và SHALL lưu phiên cửa hàng ở phía client để lần mở app sau không phải nhập lại.

#### Scenario: Ghép thiết bị thành công

- **WHEN** người dùng nhập đúng Store Key trên màn ghép thiết bị
- **THEN** hệ thống lưu phiên cửa hàng ở client và chuyển sang bước chọn nhân viên

#### Scenario: Mở lại app sau khi đã ghép

- **WHEN** người dùng tải lại app trên thiết bị đã ghép trước đó
- **THEN** hệ thống bỏ qua màn ghép thiết bị và vào thẳng bước chọn nhân viên

#### Scenario: Màn ghép không gợi ý key thật

- **WHEN** người dùng mở màn ghép thiết bị
- **THEN** ô nhập Store Key trống, chỉ hiển thị định dạng mẫu ở dạng placeholder
