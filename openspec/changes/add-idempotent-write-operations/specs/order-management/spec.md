## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Gửi đơn và chốt giá phía database

Mã: **IDEM-26**. Truy vết: FR-07, FR-09, NFR-01.

Gửi đơn SHALL register rồi execute một lệnh bất biến. DB SHALL chốt tên/base/option của phần mới từ catalog hiện hành sau so quote; phần retained giữ snapshot đã ghi, chỉ đổi lượng giảm/note. New line và retained line SHALL tách bằng source ID, không replace và tính lại mọi dòng. Hết nhóm bắt buộc, option không thuộc group gắn món, số lượng/cấu hình sai SHALL bị từ chối. Tạo/sửa không ghi payment; đơn chỉ tồn tại sau applied. Phiếu bếp hiện tại chỉ phát sinh trong lần gửi chủ động thành công, không tự phục hồi khi replay.

#### Scenario: Giữ A 2 × 30.000 rồi thêm A 1 × 40.000 option 0

- **WHEN** Giữ A 2 × 30.000 rồi thêm A 1 × 40.000 option 0
- **THEN** server lưu hai phần tổng 100.000; 0 payment và không định giá lại phần cũ

#### Scenario: Tùy chọn không thuộc món

- **WHEN** đơn được gửi kèm một tùy chọn thuộc nhóm không gắn với món đó
- **THEN** database từ chối thay đổi


#### Scenario: Giá đổi sau khi gửi đơn

- **WHEN** quản lý đổi giá món sau khi đơn đã được gửi
- **THEN** phần đã gửi giữ nguyên snapshot; phần gọi thêm sau đó nhận giá mới được xác nhận, kể cả trong cùng đơn

### Requirement: Bảo vệ chỉnh sửa đơn

Mã: **IDEM-27**. Truy vết: FR-07, NFR-01.

Hệ thống SHALL yêu cầu xác nhận trước khi bỏ draft chưa gửi khi đóng màn; đơn đã kết thúc phải chặn sửa/thanh toán mới, nhưng vẫn cho tra cứu K cũ. Chỉ đơn open với expectedVersion trùng SHALL được sửa hoặc void_open qua lệnh mới. Hệ thống SHALL nhận diện thay đổi theo source ID, số lượng, note và phần thêm; modifier của phần cũ không sửa được. Giảm phần cũ về 0 SHALL tombstone item; toàn bộ về 0 SHALL dùng void_open, total/subtotal 0, version+1, không payment, trả bàn nếu không có đơn mở khác. Replay dùng K cũ SHALL không lấy version mới để áp dụng lần nữa.

#### Scenario: Hai dòng khác giá đổi chỗ ghi chú

- **WHEN** Hai dòng khác giá đổi chỗ ghi chú
- **THEN** draft bẩn dù đa tập note không đổi; gửi đúng note theo ID, giá vẫn 30.000/35.000

#### Scenario: Đóng đơn khi còn thay đổi chưa lưu

- **WHEN** nhân viên đóng màn đơn trong lúc giỏ hàng có thay đổi chưa gửi
- **THEN** hệ thống yêu cầu xác nhận trước khi bỏ thay đổi


#### Scenario: Đơn đã bị máy khác đóng

- **WHEN** nhân viên đang mở một đơn đã được thiết bị khác thanh toán hoặc hủy
- **THEN** hệ thống hiển thị trạng thái đơn đã kết thúc và không cho chỉnh sửa hoặc thanh toán
