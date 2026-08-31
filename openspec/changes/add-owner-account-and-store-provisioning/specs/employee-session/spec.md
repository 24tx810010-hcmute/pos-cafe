# Phiên làm việc của nhân viên

## ADDED Requirements

### Requirement: Ba tầng danh tính tách bạch

Hệ thống SHALL phân biệt rõ ba tầng danh tính, mỗi tầng có cơ chế xác thực riêng và không tầng nào thay thế được tầng nào:

| Tầng | Là ai | Xác thực bằng | Dùng ở đâu |
| --- | --- | --- | --- |
| Chủ cửa hàng | Người sở hữu cửa hàng | Email thật, mã một lần, không mật khẩu | Mặt web của chủ |
| Thiết bị đã ghép | Một máy đặt tại quán | Phần bí mật trong Store Key | Ứng dụng POS |
| Nhân viên | Người đang trực máy | PIN | Ứng dụng POS, sau khi thiết bị đã ghép |

Thiết bị tại quán MUST NOT giữ credential của tài khoản chủ. Việc đăng nhập tài khoản chủ trên một thiết bị MUST NOT tự cấp cho thiết bị đó phiên cửa hàng, và ngược lại việc thiết bị đã ghép MUST NOT tự cấp phiên chủ.

Một người có thể đồng thời là chủ cửa hàng và là nhân viên vai trò `owner` của cửa hàng đó. Hai vai trò này SHALL được xác thực riêng: chủ dùng email và mã một lần trên mặt web, nhân viên vai trò `owner` dùng PIN trên thiết bị đã ghép.

#### Scenario: Chủ thao tác nghiệp vụ tại quán

- **WHEN** chủ muốn xem báo cáo và sửa thực đơn
- **THEN** chủ ghép thiết bị của mình bằng Store Key rồi đăng nhập bằng PIN của vai trò `owner`, chứ không dùng phiên tài khoản chủ để thao tác nghiệp vụ

#### Scenario: Đăng nhập chủ không mở khóa thiết bị

- **WHEN** một người đăng nhập tài khoản chủ trên một thiết bị chưa ghép
- **THEN** thiết bị đó vẫn chưa có phiên cửa hàng và vẫn phải nhập Store Key để ghép

#### Scenario: Thiết bị đã ghép không có quyền của chủ

- **WHEN** một thiết bị đã ghép và có nhân viên vai trò `owner` đang đăng nhập
- **THEN** thiết bị đó vẫn không thực hiện được các thao tác thuộc mặt web của chủ, gồm tạo cửa hàng, cấp lại Store Key, đổi email chủ và chuyển quyền sở hữu

### Requirement: Bản ghi nhân viên vai trò chủ quán gắn với tài khoản chủ

Mỗi cửa hàng SHALL có đúng một nhân viên vai trò `owner`, và bản ghi đó MUST gắn với tài khoản chủ sở hữu cửa hàng. Hệ thống MUST NOT cho phép ủy quyền vai trò `owner` cho một người khác, và MUST NOT cho phép xóa hoặc vô hiệu hóa bản ghi nhân viên vai trò `owner`.

PIN của nhân viên vai trò `owner` SHALL chỉ đặt lại được từ phiên tài khoản chủ. Các vai trò khác, kể cả vai trò có quyền `employee.manage`, MUST NOT tác động lên bản ghi này.

Khi cửa hàng được chuyển sang chủ mới, ràng buộc gắn kết này MUST chuyển theo trong cùng một giao dịch.

#### Scenario: Không xóa được nhân viên chủ quán

- **WHEN** một nhân viên vai trò `manager` có quyền `employee.manage` thử xóa hoặc vô hiệu hóa nhân viên vai trò `owner`
- **THEN** hệ thống từ chối và nêu rõ bản ghi này gắn với tài khoản chủ của cửa hàng

#### Scenario: Cửa hàng luôn có đúng một chủ quán

- **WHEN** kiểm tra danh sách nhân viên của một cửa hàng bất kỳ
- **THEN** có đúng một nhân viên vai trò `owner`, và bản ghi đó trỏ tới tài khoản chủ sở hữu cửa hàng

#### Scenario: Chuyển quyền sở hữu kéo theo bản ghi chủ quán

- **WHEN** một cửa hàng được chuyển sang chủ mới
- **THEN** nhân viên vai trò `owner` của cửa hàng đó gắn với tài khoản chủ mới ngay trong cùng giao dịch, không có khoảnh khắc nào cửa hàng thuộc chủ này còn bản ghi chủ quán thuộc chủ kia
