# In ấn phiếu và hóa đơn

## Purpose

Gom mọi việc in ấn của hệ thống về một chỗ: phiếu tạm tính và hóa đơn ở luồng thanh toán, in lại hóa đơn ở lịch sử đơn, và phiếu gửi bếp ở luồng gửi đơn. Cả ba dùng chung một cơ chế và chịu chung một giới hạn, nên được phát biểu một lần thay vì lặp ở từng năng lực. Truy vết: FR-10, FR-13.

## Requirements

### Requirement: Phiếu tạm tính và hóa đơn

Hệ thống SHALL in được phiếu tạm tính cho đơn chưa thanh toán, và SHALL mở hóa đơn sau khi thanh toán khi tùy chọn in hóa đơn đang bật, mặc định bật. Hóa đơn SHALL dựng từ dữ liệu trả về ngay trong lời gọi thanh toán, không chờ tải lại dữ liệu.

#### Scenario: Tắt tùy chọn in hóa đơn

- **WHEN** thu ngân tắt tùy chọn in hóa đơn rồi hoàn tất thanh toán
- **THEN** thanh toán vẫn thành công và hệ thống không mở hóa đơn

#### Scenario: In phiếu tạm tính

- **WHEN** thu ngân chọn in tạm tính trên một đơn chưa thanh toán
- **THEN** hệ thống mở phiếu tạm tính dựng từ đơn hiện tại

### Requirement: In lại hóa đơn

Hệ thống SHALL cho in lại hóa đơn của đơn đã thanh toán bằng cách dựng lại từ dữ liệu đơn đã lưu. Đơn chưa có thanh toán MUST báo không in được, và đơn đã hủy MUST NOT in lại được.

#### Scenario: In lại đơn đã hủy

- **WHEN** người dùng mở một đơn đã hủy trong lịch sử
- **THEN** nút in lại hóa đơn bị vô hiệu hóa

### Requirement: Phiếu gửi bếp chỉ chứa món mới thêm

Khi gửi đơn, hệ thống SHALL tạo phiếu gửi bếp chỉ liệt kê các dòng mới thêm so với đơn hiện có, so khớp theo nội dung gồm món, tùy chọn và ghi chú. Phiếu gửi bếp MUST chỉ hiển thị tên món và số lượng, MUST NOT hiển thị giá.

#### Scenario: Thêm món vào đơn đang mở

- **WHEN** nhân viên mở lại một đơn đã có 3 món, thêm 1 món rồi gửi đơn
- **THEN** phiếu gửi bếp chỉ liệt kê 1 món vừa thêm

### Requirement: Giới hạn đã biết của việc in

Việc in hiện SHALL chỉ là bản xem trước trong ứng dụng kèm lệnh in của trình duyệt. Hệ thống MUST NOT tuyên bố có tích hợp máy in nhiệt hay giao thức máy in chuyên dụng.

#### Scenario: In hóa đơn trên thiết bị không có máy in

- **WHEN** thu ngân in hóa đơn trên thiết bị chưa nối máy in
- **THEN** hệ thống vẫn mở bản xem trước hóa đơn và không báo lỗi phần cứng
