## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Chốt quyền ở luồng nghiệp vụ và guardrail phía database

Mã: **IDEM-24**. Truy vết: FR-04, NFR-02.

Luồng nghiệp vụ SHALL kiểm quyền để báo lỗi sớm. Với giao thức ghi đơn/thanh toán/hủy và truy cập lệnh, DB SHALL xác minh phiên nhân viên và quyền hiện hành, không tin employeeId trong payload. Role mặc định và override (deny ưu tiên) giữ nguyên; không cần nhân viên khởi tạo còn online để tiếp quản. Nguồn employee/PIN/quyền và đường ghi vượt giao thức SHALL bị khóa theo design.

#### Scenario: Cashier không có order.voidPaid gọi thẳng DB để hủy

- **WHEN** Cashier không có order.voidPaid gọi thẳng DB để hủy
- **THEN** FORBIDDEN, không thay đơn/payment/ledger

#### Scenario: Gọi thẳng vào database khi thiếu quyền

- **WHEN** một lời gọi thanh toán được gửi thẳng tới database bởi nhân viên không có quyền `payment.take`
- **THEN** database từ chối thao tác

### Requirement: Giới hạn đã biết của mô hình quyền hiện tại

Mã: **IDEM-25**. Truy vết: FR-04, NFR-02.

Hệ thống SHALL mô tả đúng ranh giới: Store JWT tiếp tục cách ly cửa hàng; phiên nhân viên bảo vệ giao thức ghi nhạy cảm và nguồn quyền. UI có thể còn snapshot quyền cũ nhưng DB SHALL dùng quyền hiện hành tại checkpoint. Change này MUST NOT tuyên bố mọi truy vấn menu/lịch sử/báo cáo đã có phân quyền nhân viên hoàn chỉnh; đó là phạm vi enforce-permissions-at-database còn lại.

#### Scenario: Admin thu hồi payment.take trong khi máy thu ngân còn UI cũ

- **WHEN** Admin thu hồi payment.take trong khi máy thu ngân còn UI cũ
- **THEN** execute đến checkpoint sau commit thu hồi bị FORBIDDEN; K vẫn pending cho người có quyền

#### Scenario: Đổi quyền khi nhân viên đang đăng nhập ở máy khác

- **WHEN** quản lý đổi quyền của một nhân viên đang đăng nhập trên thiết bị khác
- **THEN** thiết bị đó vẫn dùng ảnh chụp quyền cũ cho việc hiển thị cho tới khi đăng nhập lại, trong khi guardrail phía database đã áp dụng quyền mới ngay
