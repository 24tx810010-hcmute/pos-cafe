# Khởi tạo cửa hàng

## MODIFIED Requirements

### Requirement: Tạo cửa hàng mới

Việc tạo cửa hàng SHALL yêu cầu một phiên tài khoản chủ đã xác thực email. Hệ thống MUST NOT cho phép tạo cửa hàng từ một phiên ẩn danh.

Toàn bộ việc tạo cửa hàng SHALL thực hiện trong **một lời gọi phía server duy nhất**, chạy trọn vẹn hoặc không để lại gì. Lời gọi này SHALL kiểm tra phiên chủ, kiểm tra hạn mức số cửa hàng và giới hạn tần suất, tạo service account của cửa hàng, ghi bản ghi cửa hàng kèm trường chủ sở hữu và trường trạng thái, ghi cấu hình cửa hàng, tạo nhân viên vai trò `owner` với PIN do chủ đặt, rồi trả Store Key về đúng một lần.

Đầu vào SHALL gồm tên hiển thị bắt buộc, địa chỉ tùy chọn và PIN của vai trò chủ quán. Cửa hàng tạo ra MUST mặc định là cửa hàng trống, chỉ gồm bản ghi cửa hàng, cấu hình cửa hàng và một nhân viên vai trò `owner`.

Hệ thống MUST NOT thực hiện việc tạo cửa hàng bằng một chuỗi thao tác ghi rời nhau ở phía client.

#### Scenario: Tạo cửa hàng trống

- **WHEN** một chủ đã đăng nhập nhập tên hiển thị hợp lệ và PIN chủ quán rồi xác nhận tạo
- **THEN** hệ thống tạo cửa hàng mới trong một lời gọi, gắn cửa hàng với tài khoản chủ đó, sinh Store Key theo định dạng `STORE_NO-SECRET`, tạo nhân viên vai trò `owner` với PIN vừa nhập, và không tạo dữ liệu danh mục, món, khu hay bàn nào

#### Scenario: Không có phiên chủ thì không tạo được

- **WHEN** một người mở màn tạo cửa hàng mà chưa đăng nhập tài khoản chủ
- **THEN** hệ thống yêu cầu đăng nhập bằng email và mã một lần trước, và không cung cấp đường tạo cửa hàng nào bỏ qua bước này

#### Scenario: Lời gọi hỏng giữa chừng

- **WHEN** việc tạo cửa hàng thất bại ở bất kỳ bước nào bên trong lời gọi phía server
- **THEN** hệ thống không để lại service account mồ côi, không để lại bản ghi cửa hàng dở dang, và chủ thử lại được từ đầu

#### Scenario: Tùy chọn khởi tạo dữ liệu mẫu

- **WHEN** chủ bật tùy chọn khởi tạo dữ liệu mẫu (mặc định tắt) khi tạo cửa hàng
- **THEN** hệ thống seed thêm bộ dữ liệu demo gọn gồm danh mục, món, một khu với vài bàn và một tài khoản thu ngân demo

#### Scenario: Seed dữ liệu mẫu thất bại

- **WHEN** việc seed dữ liệu mẫu thất bại sau khi cửa hàng đã được tạo
- **THEN** cửa hàng vẫn tồn tại và vào được, hệ thống hiển thị cảnh báo kèm hành động thử lại, và chủ có thể seed lại từ màn Cài đặt

### Requirement: Bảo mật Store Key

Store Key SHALL gồm phần số cửa hàng công khai được sinh theo sequence và phần bí mật đóng vai trò credential. Hệ thống MUST NOT cho phép truy cập cửa hàng chỉ bằng số cửa hàng.

Phần bí mật SHALL được lưu ở **dạng mã hóa** trong database, với khóa giải mã giữ trong môi trường của hàm chạy phía server và MUST NOT nằm trong database. Hệ thống MUST NOT lưu phần bí mật ở dạng thô, và MUST NOT để khóa giải mã xuống trình duyệt.

Phát biểu này thay cho yêu cầu cũ là không lưu phần bí mật dưới mọi hình thức sau khi hoàn tất. Lý do đổi: Store Key là bí mật dùng chung của cửa hàng, vốn nằm trên nhiều thiết bị và thường được ghi ra giấy tại quầy, nên mất key phải khôi phục được thay vì buộc cả quán ghép lại toàn bộ thiết bị. Đánh đổi được chấp nhận có điều kiện: người lấy được bản dump database vẫn không đọc được key vì thiếu khóa giải mã.

Store Key và phần bí mật MUST NOT xuất hiện trong bất kỳ nhật ký nào của hệ thống.

#### Scenario: Đoán số cửa hàng không đủ để vào

- **WHEN** người dùng nhập một số cửa hàng có thật nhưng phần bí mật sai
- **THEN** hệ thống từ chối ghép thiết bị và không tiết lộ thông tin nào của cửa hàng đó

#### Scenario: Lộ bản sao database

- **WHEN** một người có được toàn bộ nội dung database nhưng không có khóa giải mã
- **THEN** người đó không khôi phục được phần bí mật của bất kỳ Store Key nào

#### Scenario: Store Key khôi phục lại được

- **WHEN** chủ quên Store Key và dùng luồng quên Store Key
- **THEN** hệ thống giải mã và gửi lại đúng key hiện tại, và các thiết bị đã ghép không bị ảnh hưởng
