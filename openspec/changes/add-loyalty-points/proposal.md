# Tích điểm và đổi điểm cho khách hàng thân thiết

## Why

Chương trình khách hàng thân thiết là công cụ giữ khách quay lại, và với quán cà phê thì đây là loại khách quyết định doanh thu. Có hồ sơ khách rồi thì bước tiếp theo là ghi nhận mỗi lần mua thành điểm, và cho khách dùng điểm để được giảm giá.

Điểm là một dạng nghĩa vụ tài chính của quán với khách, nên sổ điểm phải chặt chẽ như sổ tiền: mọi thay đổi số dư đều phải truy được nguồn gốc, và không được cộng hay trừ hai lần.

## What Changes

- Thêm khái niệm số dư điểm của khách và sổ ghi biến động điểm.
- Quy tắc tích điểm: bao nhiêu tiền được bao nhiêu điểm, và tính trên tổng trước hay sau giảm giá.
- Quy tắc đổi điểm: bao nhiêu điểm quy ra bao nhiêu tiền giảm, và giới hạn mỗi đơn.
- Luồng tích điểm tự động khi đơn được thanh toán.
- Luồng đổi điểm tại màn thanh toán, sinh khoản giảm qua cơ chế giảm giá chung.
- Xử lý ngược khi hủy đơn đã thanh toán: thu hồi điểm đã tích và hoàn lại điểm đã tiêu.
- Cân nhắc hạn sử dụng điểm và hạng thành viên.

## Capabilities

### New Capabilities

- `loyalty-points`: số dư điểm, sổ biến động điểm, quy tắc tích và đổi điểm, và các quy tắc xử lý ngược khi đơn bị hủy.

### Modified Capabilities

- `customer-registry`: bổ sung số dư điểm vào hồ sơ khách.
- `discount-engine`: bổ sung đổi điểm làm một nguồn sinh khoản giảm.
- `payment`: bổ sung luồng đổi điểm trong màn thanh toán.
- `order-history`: bổ sung hiển thị điểm tích và điểm tiêu trên chi tiết đơn, và hành vi thu hồi điểm khi hủy đơn.
- `reporting`: bổ sung số liệu điểm đã phát hành và điểm đã tiêu, vì đây là nghĩa vụ của quán.

## Impact

- Thêm bảng số dư điểm và sổ biến động điểm; kéo theo migration.
- Chạm vào luồng thanh toán và luồng hủy đơn đã thanh toán, là hai luồng nhạy cảm nhất.
- Tương tác phức tạp với mô hình instant pay tách đơn: một bàn trả làm hai lần thì điểm tích vào đơn nào.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/architecture.md`.

## Ngoài phạm vi

- Hồ sơ khách hàng. Việc đó thuộc `add-customer-registry`.
- Màn quản lý chương trình khách hàng thân thiết. Việc đó thuộc `add-loyalty-management-screen`.
- Thẻ thành viên vật lý và ứng dụng riêng cho khách.
- Gửi thông báo điểm cho khách.

## Phụ thuộc

- `add-customer-registry`: bắt buộc.
- `add-discount-engine`: bắt buộc, vì đổi điểm phải sinh khoản giảm qua cơ chế chung thay vì tự tính riêng.

## Câu hỏi phải chốt trước khi làm

1. Tỷ lệ tích điểm và tỷ lệ đổi điểm là bao nhiêu, và có cấu hình được theo cửa hàng không?
2. Điểm tích trên tổng trước giảm giá hay sau giảm giá? Tích trên tổng trước hào phóng hơn nhưng khách dùng mã giảm giá vẫn được điểm đầy đủ.
3. Đơn dùng điểm để giảm giá có được tích điểm không?
4. Với đơn bị tách để thanh toán một phần, điểm tích vào đâu và khách được gắn vào đơn nào? Đây là câu hỏi bắt buộc vì instant pay là mô hình cốt lõi.
5. Hủy đơn đã thanh toán thì thu hồi điểm đã tích, đúng không? Và nếu khách đã tiêu mất phần điểm đó rồi thì xử lý thế nào, cho số dư âm hay chặn hủy?
6. Điểm có hạn sử dụng không? Nếu có thì trừ theo thứ tự nào khi khách đổi điểm.
7. Có hạng thành viên không, ví dụ khách chi nhiều thì tích với tỷ lệ cao hơn? Nếu có thì phạm vi tăng đáng kể.
8. Giới hạn mỗi đơn được đổi tối đa bao nhiêu điểm hoặc bao nhiêu phần trăm giá trị?
9. Ai được điều chỉnh điểm thủ công, và có cần lý do kèm dấu vết không?
10. Điểm có dùng chung giữa các cửa hàng không, nếu sau này làm nhiều cửa hàng?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
