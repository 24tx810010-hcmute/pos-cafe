# Thanh toán

## Purpose

Cho thu ngân thu tiền mặt cho cả đơn hoặc cho một phần món theo mô hình instant pay tách đơn, tính tiền thối, và xuất phiếu tạm tính hoặc hóa đơn. Truy vết: FR-11, FR-12, FR-13.

## Requirements

### Requirement: Thanh toán toàn bộ đơn bằng tiền mặt

Hệ thống SHALL cho phép thu tiền mặt cho toàn bộ một đơn đang mở, tính phần còn thiếu hoặc tiền thối theo số tiền khách đưa, và trả bàn về trạng thái trống sau khi thanh toán.

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

Khi thu ngân chọn một phần món, hệ thống SHALL tách phần đó thành một đơn mới đã thanh toán ngay và giữ phần chưa trả lại trên đơn gốc. Hai đơn sau khi tách MUST độc lập với nhau, chỉ cùng nhãn bàn.

#### Scenario: Tách và thanh toán một phần

- **WHEN** thu ngân chọn một phần món của đơn đang mở rồi hoàn tất thanh toán
- **THEN** phần đã chọn trở thành đơn mới ở trạng thái đã thanh toán và vào ngay báo cáo cùng lịch sử, đơn gốc vẫn mở trên bàn với phần chưa trả

#### Scenario: Chỉnh sửa đơn gốc sau khi tách

- **WHEN** đơn gốc đã bị tách một phần và thu ngân thêm món, sửa món hoặc hủy đơn gốc
- **THEN** thao tác được chấp nhận và không ảnh hưởng tới các đơn đã tách đã thanh toán

### Requirement: Đánh số bill theo thứ tự thanh toán

Số bill SHALL tăng theo thứ tự thanh toán: bill trả trước mang số nhỏ hơn. Khi tách đơn, đơn tách MUST kế thừa số của đơn gốc và đơn gốc MUST nhận một số mới.

#### Scenario: Bàn trả làm hai lần

- **WHEN** một bàn có đơn số N được tách trả một phần, rồi phần còn lại được trả sau
- **THEN** đơn tách trả trước giữ số N, đơn gốc nhận số mới lớn hơn N, và thứ tự số bill khớp thứ tự thu tiền

### Requirement: Chọn món để thanh toán

Ô chọn tất cả SHALL bật mặc định để giữ thao tác trả nhanh cả bàn chỉ một chạm. Số lượng chọn của mỗi dòng SHALL điều chỉnh được và MUST NOT vượt quá số lượng còn lại của dòng đó.

#### Scenario: Bỏ chọn rồi chọn lại từng dòng

- **WHEN** thu ngân bỏ chọn tất cả rồi tick một dòng
- **THEN** hệ thống chọn một sản phẩm của dòng đó

#### Scenario: Chọn đủ toàn bộ đơn

- **WHEN** thu ngân chỉnh số lượng chọn của mọi dòng lên mức tối đa
- **THEN** ô chọn tất cả tự bật lại

#### Scenario: Đơn bị máy khác cập nhật

- **WHEN** đơn bị thiết bị khác cập nhật khiến số lượng món giảm trong lúc thu ngân đang chọn
- **THEN** hệ thống giới hạn lại phần đang chọn theo dữ liệu mới nhất và không cho trả vượt số lượng thực có

### Requirement: Phương thức thanh toán khả dụng

Hệ thống SHALL chỉ bật phương thức tiền mặt. Các phương thức thẻ, chuyển khoản và mã QR MUST hiển thị ở trạng thái vô hiệu hóa để tránh hiểu nhầm là đã xử lý thật.

#### Scenario: Chọn phương thức chưa hỗ trợ

- **WHEN** thu ngân bấm vào phương thức thẻ hoặc mã QR
- **THEN** phương thức không được chọn và thanh toán vẫn ở phương thức tiền mặt

### Requirement: Phiếu tạm tính và hóa đơn

Hệ thống SHALL in được phiếu tạm tính cho đơn chưa thanh toán, và SHALL mở hóa đơn sau khi thanh toán khi tùy chọn in hóa đơn đang bật, mặc định bật. Hóa đơn SHALL dựng từ dữ liệu trả về ngay trong lời gọi thanh toán, không chờ tải lại dữ liệu.

#### Scenario: Tắt tùy chọn in hóa đơn

- **WHEN** thu ngân tắt tùy chọn in hóa đơn rồi hoàn tất thanh toán
- **THEN** thanh toán vẫn thành công và hệ thống không mở hóa đơn

#### Scenario: In phiếu tạm tính

- **WHEN** thu ngân chọn in tạm tính trên một đơn chưa thanh toán
- **THEN** hệ thống mở phiếu tạm tính dựng từ đơn hiện tại

### Requirement: Giới hạn đã biết của việc in

Việc in hiện SHALL chỉ là bản xem trước trong ứng dụng kèm lệnh in của trình duyệt. Hệ thống MUST NOT tuyên bố có tích hợp máy in nhiệt hay giao thức máy in chuyên dụng.

#### Scenario: In hóa đơn trên thiết bị không có máy in

- **WHEN** thu ngân in hóa đơn trên thiết bị chưa nối máy in
- **THEN** hệ thống vẫn mở bản xem trước hóa đơn và không báo lỗi phần cứng
