## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Chọn nhân viên và xác minh PIN

Mã: **IDEM-23**. Truy vết: FR-03.

Sau khi ghép cửa hàng, hệ thống SHALL yêu cầu chọn nhân viên active và nhập PIN đúng 6 chữ số trước khi mở app shell. Server SHALL cấp phiên nhân viên opaque có hạn 12 giờ, gắn cửa hàng/nhân viên; client giữ trong bộ nhớ và quay về màn PIN khi reload hoặc khóa phiên. PIN sai trả INVALID_PIN; người inactive không có trong danh sách và không được đăng nhập trực tiếp. Khóa chủ động SHALL thu hồi token khi còn online, xóa ngay bộ nhớ; mất ACK thu hồi không được coi là bằng chứng server đã thu hồi.

#### Scenario: Nhập đúng PIN rồi reload

- **WHEN** Nhập đúng PIN rồi reload
- **THEN** app quay về PIN; đăng nhập lại cùng hoặc khác nhân viên có quyền vẫn tra cứu lệnh server được

#### Scenario: Nhập PIN đúng

- **WHEN** người dùng chọn một nhân viên đang hoạt động và nhập đúng PIN
- **THEN** hệ thống mở app shell với nhân viên đó là nhân viên hiện hành


#### Scenario: Nhập PIN sai

- **WHEN** người dùng nhập sai PIN
- **THEN** hệ thống từ chối mở app shell và giữ nguyên màn nhập PIN


#### Scenario: Nhân viên bị tạm khóa

- **WHEN** một nhân viên đang ở trạng thái tạm khóa đăng nhập
- **THEN** nhân viên đó không xuất hiện trong danh sách chọn ở màn nhập PIN
