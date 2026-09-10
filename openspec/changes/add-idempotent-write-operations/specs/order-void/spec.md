## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Chống xung đột khi hủy đơn

Mã: **IDEM-31**. Truy vết: FR-15, NFR-01.

Hủy đơn paid SHALL yêu cầu phiên nhân viên có order.voidPaid, lý do trong enum hiện hành và note khi other, expectedVersion nguyên không NULL. Lệnh mới chỉ hợp lệ với paid và version trùng; cập nhật void/version+1/audit, giữ total/payment/paidAt và không đổi bàn hiện tại. Khi lệnh cũ applied, retry SHALL trả kết quả cũ mà không nạp version mới để hủy lần nữa.

#### Scenario: Đơn cũ paid đã trả bàn, khách mới có đơn open ở bàn ấy; hủy đơn cũ

- **WHEN** Đơn cũ paid đã trả bàn, khách mới có đơn open ở bàn ấy; hủy đơn cũ
- **THEN** đơn cũ void, khách mới/bàn occupied không đổi; replay không thêm số tiền hủy

#### Scenario: Hủy ngay sau khi thanh toán trên cùng thiết bị

- **WHEN** người dùng thanh toán một đơn rồi hủy ngay đơn đó trong cùng phiên
- **THEN** UI tải chi tiết sau thanh toán trước xác nhận hủy mới, dùng version mới để đăng ký K hủy; hủy thành công nếu không có ghi cạnh tranh sau xác nhận. Retry K hủy cũ không thay version
