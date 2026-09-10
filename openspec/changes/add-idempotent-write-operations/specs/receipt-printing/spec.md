## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Phiếu tạm tính và hóa đơn

Mã: **IDEM-32**. Truy vết: FR-13.

Hệ thống SHALL mở phiếu tạm tính từ snapshot đơn, và mở hóa đơn từ R1 của lần thanh toán chủ động thành công khi tùy chọn in đang bật (mặc định bật). Tắt tùy chọn SHALL không mở hóa đơn. Receipt SHALL biểu diễn base, option quantity/delta, unitTotal inclusive option, lineTotal và tổng/nhận/thừa nhất quán. Replay/late ACK/khôi phục SHALL không tự mở hoặc gọi in. In trình duyệt chỉ khi người dùng bấm In; không tuyên bố máy in nhiệt.

#### Scenario: Hai ly base 30.000, option 2 × 5.000, trả 100.000

- **WHEN** Hai ly base 30.000, option 2 × 5.000, trả 100.000
- **THEN** phiếu hiện đơn giá 40.000 và thành tiền 80.000, option × 2, thừa 20.000

#### Scenario: Tắt tùy chọn in hóa đơn

- **WHEN** thu ngân tắt tùy chọn in hóa đơn rồi hoàn tất thanh toán
- **THEN** thanh toán vẫn thành công và hệ thống không mở hóa đơn


#### Scenario: In phiếu tạm tính

- **WHEN** thu ngân chọn in tạm tính trên một đơn chưa thanh toán
- **THEN** hệ thống mở phiếu tạm tính dựng từ đơn hiện tại

### Requirement: In lại hóa đơn

Mã: **IDEM-33**. Truy vết: FR-13, FR-14.

Hệ thống SHALL cho in lại đơn paid từ snapshot đã lưu và dùng cùng schema receipt như lần đầu; menu đổi không ảnh hưởng. Đơn chưa có payment báo RECEIPT_UNAVAILABLE, đơn void không được in lại. R1 của payment đã applied SHALL vẫn đọc được như lịch sử giao dịch khi đơn về sau void nhưng không được dùng để vượt quy tắc in lại; nút In luôn kiểm trạng thái đơn hiện tại.

#### Scenario: Menu đổi cả tên và giá sau payment

- **WHEN** Menu đổi cả tên và giá sau payment
- **THEN** in lại giữ tên, giá và quantity option lúc thanh toán, không lấy catalog mới

#### Scenario: In lại đơn đã hủy

- **WHEN** người dùng mở một đơn đã hủy trong lịch sử
- **THEN** nút in lại hóa đơn bị vô hiệu hóa
