## ADDED Requirements

### Requirement: Bất biến của bản ghi chủ quán

Mỗi cửa hàng MUST luôn có đúng một nhân viên vai trò `owner` đang hoạt động. Bản ghi của nhân viên đó SHALL bất biến với mọi thao tác quản trị của người khác: MUST NOT xóa được, MUST NOT tạm khóa được, MUST NOT đổi sang vai trò khác được, và MUST NOT bị người khác đặt lại PIN. Quyền `employee.manage` MUST NOT tác động lên bản ghi này ở bất kỳ thao tác nào.

#### Scenario: Quản lý thử đặt lại PIN của chủ quán

- **WHEN** một nhân viên `manager` mở hồ sơ chủ quán và thử đặt lại PIN
- **THEN** hệ thống từ chối, và bản ghi chủ quán không có thao tác sửa nào khả dụng với nhân viên đó

#### Scenario: Thử đổi vai trò của chủ quán

- **WHEN** một nhân viên thử đổi vai trò của bản ghi chủ quán sang vai trò khác
- **THEN** hệ thống từ chối và nêu lý do cửa hàng phải luôn có một chủ quán

#### Scenario: Thử tạm khóa chủ quán

- **WHEN** một nhân viên thử tạm khóa bản ghi chủ quán
- **THEN** hệ thống từ chối thao tác

### Requirement: Không tự khóa tài khoản đang đăng nhập

Hệ thống MUST NOT cho phép nhân viên tự tạm khóa tài khoản đang đăng nhập của chính mình.

#### Scenario: Tự tạm khóa chính mình

- **WHEN** nhân viên đang đăng nhập tạm khóa chính tài khoản của mình
- **THEN** hệ thống từ chối thao tác

### Requirement: Danh bạ hiển thị quyền hiệu lực của từng nhân viên

Màn quản lý nhân viên SHALL hiển thị được quyền hiệu lực hiện tại của từng nhân viên, phân biệt rõ phần đến từ mặc định của vai trò và phần đến từ ghi đè. Yêu cầu này bù cho việc giao diện vận hành ẩn hẳn phần tử điều khiển khi thiếu quyền, nên người quản lý cần một chỗ tra được vì sao một nhân viên không thấy chức năng nào đó.

#### Scenario: Tra vì sao nhân viên không thấy một chức năng

- **WHEN** quản lý mở hồ sơ của một nhân viên báo là không thấy một chức năng
- **THEN** màn hình hiển thị quyền hiệu lực của nhân viên đó, và chỉ rõ quyền tương ứng đang thiếu

#### Scenario: Phân biệt mặc định và ghi đè

- **WHEN** một nhân viên có quyền được cấp thêm ngoài mặc định của vai trò
- **THEN** màn hình đánh dấu quyền đó là ghi đè, không lẫn với các quyền mặc định của vai trò

## MODIFIED Requirements

### Requirement: Tạo và chỉnh sửa nhân viên

Hệ thống SHALL cho phép tạo nhân viên mới và chỉnh sửa tên, vai trò, trạng thái đăng nhập của nhân viên đã có, cùng với đặt lại PIN. Vai trò SHALL chỉ chọn được trong các vai trò dựng sẵn đang bật trên giao diện, và MUST NOT bao gồm `owner`. Việc chỉnh quyền ghi đè của một nhân viên SHALL yêu cầu quyền `employee.permission.edit`, tách khỏi quyền `employee.manage` dùng cho các thao tác còn lại.

#### Scenario: Đặt lại PIN

- **WHEN** quản lý đặt lại PIN cho một nhân viên
- **THEN** nhân viên đó đăng nhập được bằng PIN mới và PIN cũ không còn hiệu lực

#### Scenario: Rời form khi chưa lưu

- **WHEN** quản lý chuyển sang nhân viên khác hoặc tạo mới trong lúc form đang có thay đổi chưa lưu
- **THEN** hệ thống yêu cầu xác nhận trước khi bỏ thay đổi

#### Scenario: Quản lý không chỉnh được quyền

- **WHEN** một nhân viên `manager` mở hồ sơ của một nhân viên khác
- **THEN** phần chỉnh quyền ghi đè không xuất hiện, trong khi vẫn sửa được tên, vai trò, trạng thái và đặt lại PIN

### Requirement: Cảnh báo khi tự sửa quyền của mình

Khi một nhân viên sửa vai trò hoặc quyền của chính tài khoản đang đăng nhập theo hướng thu hẹp quyền, hệ thống SHALL cảnh báo rằng thay đổi có hiệu lực ngay trên thiết bị đang dùng và có thể làm mất quyền truy cập màn hình hiện tại.

#### Scenario: Admin tự đổi quyền của mình

- **WHEN** một nhân viên có quyền chỉnh quyền lưu thay đổi thu hẹp quyền cho chính mình
- **THEN** hệ thống cảnh báo trước khi lưu rằng thay đổi có hiệu lực ngay, và sau khi lưu thì giao diện cập nhật lập tức theo quyền mới

#### Scenario: Mở rộng quyền của chính mình

- **WHEN** một nhân viên tự cấp thêm quyền cho chính mình và lưu
- **THEN** hệ thống không hiển thị cảnh báo thu hẹp quyền và quyền mới có hiệu lực ngay

## REMOVED Requirements

### Requirement: Bảo vệ quyền quản trị của cửa hàng

**Reason**: Requirement này dựa trên vai trò `admin`, vốn được tách thành `owner` và `manager`. Quy tắc giữ ít nhất một `admin` hoạt động không còn diễn đạt đúng ràng buộc mới, vì cửa hàng phải có đúng một chủ quán chứ không phải ít nhất một.

**Migration**: Thay bằng hai requirement tách bạch: "Bất biến của bản ghi chủ quán" cho phần bảo vệ quyền sở hữu, và "Không tự khóa tài khoản đang đăng nhập" cho phần chống tự khóa. Dữ liệu hiện có chuyển đổi theo quyết định số 6 trong proposal: bản ghi admin đầu tiên của mỗi cửa hàng thành `owner`, các admin còn lại thành `manager`.
