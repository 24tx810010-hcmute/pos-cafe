# Hồ sơ khách hàng

## Why

Hệ thống hiện không có khái niệm khách hàng. Màn thanh toán và màn lịch sử đều hiển thị khách lẻ như một giá trị mặc định cứng vì cấu trúc chi tiết đơn không có trường khách hàng. Không có hồ sơ khách thì không làm được tích điểm, không giới hạn được số lần dùng mã giảm giá theo từng người, và không biết khách nào quay lại.

Đây là nền bắt buộc cho chương trình khách hàng thân thiết, nên tách riêng để làm trước và làm gọn.

## What Changes

- Thêm khái niệm khách hàng gồm tên, số điện thoại và các thông tin liên hệ tối thiểu.
- Gắn khách hàng vào đơn hàng, thay cho giá trị khách lẻ cố định hiện nay.
- Luồng tìm và chọn khách nhanh tại màn đơn hàng hoặc màn thanh toán, và luồng tạo khách mới ngay tại quầy.
- Hiển thị khách hàng trong chi tiết đơn, lịch sử đơn và trên hóa đơn.
- Xem lịch sử mua hàng của một khách.
- Xử lý quyền riêng tư: dữ liệu khách là dữ liệu cá nhân, cần rõ ai được xem và được sửa.

## Capabilities

### New Capabilities

- `customer-registry`: hồ sơ khách hàng, luồng tìm và tạo khách tại quầy, và quan hệ giữa khách hàng với đơn hàng.

### Modified Capabilities

- `order-management`: bổ sung khả năng gắn khách hàng vào đơn.
- `payment`: đổi hiển thị khách hàng, vốn đang cố định là khách lẻ.
- `order-history`: đổi hiển thị khách hàng trong chi tiết đơn, và bổ sung tìm kiếm theo khách.
- `access-control`: bổ sung quyền xem và sửa dữ liệu khách hàng.

## Impact

- Thêm bảng khách hàng và trường tham chiếu trên bảng đơn hàng; kéo theo migration.
- Chạm vào cấu trúc chi tiết đơn, vốn được nhiều màn dùng chung.
- Thêm thao tác vào màn thanh toán, là màn cần nhanh nhất khi khách đang đứng chờ.
- Dữ liệu cá nhân xuất hiện lần đầu trong hệ thống, cần cân nhắc về bảo mật và quyền truy cập.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/screens.md`.

## Ngoài phạm vi

- Tích điểm và đổi điểm. Việc đó thuộc `add-loyalty-points`.
- Màn quản lý khách hàng thân thiết. Việc đó thuộc `add-loyalty-management-screen`.
- Gửi tin nhắn tiếp thị cho khách.
- Phân nhóm khách và phân tích hành vi.

## Phụ thuộc

- Không phụ thuộc change nào khác, nhưng là điều kiện cần cho `add-loyalty-points` và cho phần giới hạn số lần dùng theo khách của `add-promo-codes-and-vouchers`.

## Câu hỏi phải chốt trước khi làm

1. Thông tin gì là bắt buộc khi tạo khách? Số điện thoại là định danh tự nhiên nhất ở Việt Nam, nhưng cần xác nhận có bắt buộc không và có cho trùng không.
2. Gắn khách vào đơn ở bước nào: lúc mở đơn, hay lúc thanh toán? Lúc thanh toán tự nhiên hơn với quán cà phê nhưng nếu tính khuyến mãi theo khách thì phải gắn sớm hơn.
3. Thao tác tìm khách ở quầy làm thế nào cho đủ nhanh? Gõ số điện thoại là cách phổ biến, nhưng cần chốt có tìm theo tên không và có quét mã không.
4. Đơn không gắn khách vẫn phải hoạt động bình thường, đúng không? Phần lớn đơn ở quán cà phê là khách vãng lai.
5. Ai được xem danh sách khách và số điện thoại của họ? Đây là dữ liệu cá nhân, thu ngân có nên thấy toàn bộ danh sách không?
6. Có cần trộn hai hồ sơ khách trùng nhau không, và ai được làm việc đó?
7. Khách có được xóa hồ sơ không? Nếu có thì các đơn cũ đã gắn khách xử lý thế nào.
8. Có cần lưu ngày sinh hoặc thông tin khác phục vụ khuyến mãi sinh nhật không?
9. Hóa đơn có in tên khách không? Nếu có thì cần cân nhắc quyền riêng tư khi hóa đơn để trên quầy.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
