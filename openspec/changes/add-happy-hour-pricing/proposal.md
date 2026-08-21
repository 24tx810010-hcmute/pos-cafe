# Giờ vàng giảm giá

## Why

Quán cà phê thường giảm giá vào khung giờ vắng để kéo khách, ví dụ buổi chiều giữa tuần. Khác với mã giảm giá cần thao tác nhập, giờ vàng phải tự động áp khi đơn rơi vào khung giờ cấu hình, không phụ thuộc việc thu ngân có nhớ hay không.

Điểm khó là hệ thống hiện chụp giá phía database lúc gửi đơn, và một đơn có thể mở lúc chưa tới giờ vàng nhưng thanh toán khi đã vào giờ vàng, hoặc ngược lại. Cần chốt rõ mốc thời gian nào quyết định.

## What Changes

- Thêm khái niệm chương trình giảm giá theo khung thời gian, gồm khung giờ trong ngày và các ngày trong tuần áp dụng.
- Thêm phạm vi áp dụng: toàn bộ thực đơn, một danh mục, hay một tập món cụ thể.
- Tự động áp khoản giảm khi đơn thỏa điều kiện thời gian, không cần thao tác của nhân viên.
- Hiển thị rõ trên màn đơn hàng và trên hóa đơn rằng khoản giảm đến từ chương trình giờ vàng nào.
- Xử lý ranh giới thời gian cho đơn mở vắt qua đầu và cuối khung giờ.

## Capabilities

### New Capabilities

- `scheduled-promotions`: chương trình khuyến mãi tự động theo khung thời gian, gồm lịch áp dụng, phạm vi món và quy tắc xác định thời điểm chốt giá.

### Modified Capabilities

- `discount-engine`: bổ sung chương trình theo lịch làm nguồn sinh khoản giảm tự động.
- `order-management`: bổ sung hành vi tự áp và hiển thị khoản giảm theo giờ.

## Impact

- Thêm bảng chương trình khuyến mãi theo lịch và migration.
- Phụ thuộc múi giờ của cửa hàng, vốn đã có trong cài đặt và đang dùng để xác định ngày kinh doanh.
- Cần cẩn thận với đồng hồ của thiết bị: nếu lấy giờ từ thiết bị thì hai máy lệch giờ sẽ tính khác nhau.
- Ảnh hưởng tới mẫu hóa đơn.
- Cập nhật `docs/data-model.md`, `docs/features.md`.

## Ngoài phạm vi

- Cơ chế tính giảm giá. Việc đó thuộc `add-discount-engine`.
- Màn quản lý chương trình. Việc đó thuộc `add-promotion-management-screen`.
- Khuyến mãi theo điều kiện phi thời gian, ví dụ mua đủ số lượng thì giảm.

## Phụ thuộc

- `add-discount-engine`: bắt buộc.

## Câu hỏi phải chốt trước khi làm

1. Thời điểm nào quyết định đơn có được giờ vàng: lúc mở đơn, lúc gửi đơn, hay lúc thanh toán? Đây là câu hỏi quan trọng nhất của change này.
2. Đơn mở lúc 16 giờ 50, giờ vàng kết thúc lúc 17 giờ, khách thanh toán lúc 17 giờ 10 thì xử lý thế nào?
3. Món thêm vào đơn sau khi giờ vàng kết thúc có được giảm không, nếu đơn được mở trong giờ vàng?
4. Giờ vàng áp cho toàn thực đơn hay cho tập món chọn trước? Nếu chọn tập món thì chọn theo danh mục hay theo từng món?
5. Có cho phép nhiều chương trình giờ vàng chồng nhau không? Nếu có thì áp cái nào, hay cộng dồn?
6. Giờ vàng có cộng dồn với mã giảm giá không?
7. Nguồn thời gian lấy từ đâu: đồng hồ thiết bị hay đồng hồ phía database? Lấy phía database an toàn hơn nhưng giao diện phải hỏi để hiển thị trước.
8. Quán có ngày nghỉ hoặc ngày lễ cần loại trừ khỏi lịch giờ vàng không?
9. Thu ngân có được gỡ khoản giảm giờ vàng khỏi một đơn không, và nếu có thì cần quyền gì?
10. Khung giờ có vắt qua nửa đêm không, ví dụ 22 giờ tới 1 giờ sáng? Nếu có thì ngày kinh doanh xử lý thế nào.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
