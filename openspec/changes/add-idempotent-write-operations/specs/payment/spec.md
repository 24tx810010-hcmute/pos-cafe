## MODIFIED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Thanh toán toàn bộ đơn bằng tiền mặt

Mã: **IDEM-28**. Truy vết: FR-11, NFR-01.

Đơn open không có draft chưa gửi SHALL được thanh toán toàn bộ bằng tiền mặt qua register/execute. DB SHALL kiểm version, tổng phần thanh toán >0 (rỗng hoặc tổng 0 trả INVALID_ORDER_ITEMS), receivedAmount >= total, ghi đúng một payment, đóng đơn, tăng version 1, trả bàn khi không còn đơn mở. Tiền thừa=receivedAmount-total. Giao thức chỉ xác nhận việc ghi giao dịch trên server, không kiểm tiền mặt vật lý. Receipt lấy snapshot R1; mất ACK SHALL khôi phục K cũ, không thanh toán lại.

#### Scenario: Đơn 150.000 nhận 200.000 rồi mất ACK

- **WHEN** Đơn 150.000 nhận 200.000 rồi mất ACK
- **THEN** đúng 1 payment 150.000, thừa 50.000, replay trả cùng receipt

#### Scenario: Khách đưa đủ tiền

- **WHEN** thu ngân nhập số tiền khách đưa lớn hơn hoặc bằng tổng đơn rồi hoàn tất
- **THEN** đơn chuyển sang đã thanh toán, hệ thống hiển thị tiền thối, và bàn trở về trống


#### Scenario: Khách đưa thiếu tiền

- **WHEN** số tiền khách đưa nhỏ hơn tổng phần đang chọn
- **THEN** hệ thống chặn hoàn tất thanh toán


#### Scenario: Chưa chọn món nào

- **WHEN** thu ngân bỏ chọn toàn bộ món rồi bấm hoàn tất
- **THEN** hệ thống chặn hoàn tất thanh toán

### Requirement: Thanh toán một phần bằng cách tách đơn độc lập

Mã: **IDEM-29**. Truy vết: FR-12, NFR-01.

Một tập con không rỗng, có tổng >0, nhưng chưa phải toàn bộ SHALL tách thành đơn mới và thanh toán trong cùng transaction. Child paid nhận số bill cũ của nguồn; nguồn open nhận max+1 trong store/businessDate, version+1 và giữ phần còn lại. Tách nguyên dòng SHALL move ID và options; tách một phần SHALL tạo splitItemId mới/copy snapshot options. Hai đơn độc lập về chỉnh sửa/trạng thái, có liên kết audit bất biến nguồn–child–payment–K để khôi phục; liên kết không kéo theo hủy/sửa đơn kia. Bàn còn occupied. Hủy child sau đó không đổi nguồn.

#### Scenario: Nguồn 5 × 30.000 số 12, max 20; trả 1 ly nhận 50.000

- **WHEN** Nguồn 5 × 30.000 số 12, max 20; trả 1 ly nhận 50.000
- **THEN** child #12 paid 30.000/version 0; nguồn #21 open 120.000/version 6; thừa 20.000; một payment

#### Scenario: Tách và thanh toán một phần

- **WHEN** thu ngân chọn một phần món của đơn đang mở rồi hoàn tất thanh toán
- **THEN** phần đã chọn trở thành đơn mới ở trạng thái đã thanh toán và vào ngay báo cáo cùng lịch sử, đơn gốc vẫn mở trên bàn với phần chưa trả


#### Scenario: Chỉnh sửa đơn gốc sau khi tách

- **WHEN** đơn gốc đã bị tách một phần và thu ngân thêm món, sửa món hoặc hủy đơn gốc
- **THEN** thao tác được chấp nhận và không ảnh hưởng tới các đơn đã tách đã thanh toán

### Requirement: Chọn món để thanh toán

Mã: **IDEM-30**. Truy vết: FR-11, FR-12.

Trước xác nhận, UI SHALL mặc định chọn toàn bộ, cho đổi số lượng trong giới hạn còn lại và clamp theo snapshot hiện tại. Khi xác nhận SHALL đóng băng loại lệnh/IDs/lượng/version; chọn toàn bộ gọi pay, tập con gọi split. Khi lệnh đang chờ/chưa rõ SHALL tách lựa chọn hiển thị hiện tại khỏi payload lệnh; clamp hoặc fallback fullSelection MUST NOT tạo/đổi/re-route lệnh cũ. Draft chưa gửi phải được xử lý trước thanh toán.

#### Scenario: Clamp từ lựa chọn 1 về rỗng sau polling trong lúc mất ACK

- **WHEN** Clamp từ lựa chọn 1 về rỗng sau polling trong lúc mất ACK
- **THEN** phục hồi vẫn đúng split cũ, không gọi pay cho toàn bộ phần còn lại

#### Scenario: Bỏ chọn rồi chọn lại từng dòng

- **WHEN** thu ngân bỏ chọn tất cả rồi tick một dòng
- **THEN** hệ thống chọn một sản phẩm của dòng đó


#### Scenario: Chọn đủ toàn bộ đơn

- **WHEN** thu ngân chỉnh số lượng chọn của mọi dòng lên mức tối đa
- **THEN** ô chọn tất cả tự bật lại


#### Scenario: Đơn bị máy khác cập nhật

- **WHEN** đơn bị thiết bị khác cập nhật khiến số lượng món giảm trong lúc thu ngân đang chọn
- **THEN** hệ thống giới hạn lại phần đang chọn theo dữ liệu mới nhất và không cho trả vượt số lượng thực có
