# Quản lý nhân viên

## Purpose

Cho phép quản lý tạo, chỉnh sửa, tạm khóa nhân viên, đặt lại PIN và điều chỉnh quyền hành động của từng người, đồng thời bảo vệ cửa hàng khỏi việc mất quyền quản trị. Truy vết: FR-05.

## Requirements

### Requirement: Danh bạ và bộ lọc nhân viên

Module quản lý nhân viên SHALL hiển thị danh sách nhân viên kèm bộ lọc theo vai trò và trạng thái, trong đó nhân viên đã tạm khóa vẫn truy cập được để mở lại.

#### Scenario: Lọc nhân viên tạm khóa

- **WHEN** quản lý chọn bộ lọc trạng thái tạm khóa
- **THEN** danh sách hiển thị các nhân viên đang tạm khóa và cho phép mở hồ sơ để kích hoạt lại

### Requirement: Tạo và chỉnh sửa nhân viên

Hệ thống SHALL cho phép tạo nhân viên mới và chỉnh sửa tên, vai trò, trạng thái đăng nhập của nhân viên đã có, cùng với đặt lại PIN.

#### Scenario: Đặt lại PIN

- **WHEN** quản lý đặt lại PIN cho một nhân viên
- **THEN** nhân viên đó đăng nhập được bằng PIN mới và PIN cũ không còn hiệu lực

#### Scenario: Rời form khi chưa lưu

- **WHEN** quản lý chuyển sang nhân viên khác hoặc tạo mới trong lúc form đang có thay đổi chưa lưu
- **THEN** hệ thống yêu cầu xác nhận trước khi bỏ thay đổi

### Requirement: Bảo vệ quyền quản trị của cửa hàng

Hệ thống MUST luôn giữ ít nhất một tài khoản `admin` đang hoạt động, và MUST NOT cho phép nhân viên tự tạm khóa tài khoản đang đăng nhập.

#### Scenario: Hạ vai trò admin cuối cùng

- **WHEN** quản lý hạ vai trò của tài khoản `admin` đang hoạt động cuối cùng
- **THEN** hệ thống từ chối và nêu lý do cửa hàng phải còn ít nhất một quản lý

#### Scenario: Tự tạm khóa chính mình

- **WHEN** nhân viên đang đăng nhập tạm khóa chính tài khoản của mình
- **THEN** hệ thống từ chối thao tác

### Requirement: Cảnh báo khi tự sửa quyền của mình

Khi quản lý sửa vai trò hoặc quyền của chính tài khoản đang đăng nhập, hệ thống SHALL cảnh báo rằng thay đổi chỉ phản ánh đầy đủ trên thiết bị hiện tại sau khi đăng nhập lại.

#### Scenario: Admin tự đổi quyền của mình

- **WHEN** quản lý lưu thay đổi quyền cho chính mình
- **THEN** hệ thống hiển thị cảnh báo cần đăng nhập lại để nhận ảnh chụp quyền mới
