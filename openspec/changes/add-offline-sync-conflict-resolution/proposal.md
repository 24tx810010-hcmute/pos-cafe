# Đồng bộ và hòa giải xung đột sau khi ngoại tuyến

## Why

Có kho dữ liệu cục bộ và hàng đợi thao tác thì bài toán khó nhất vẫn chưa được giải: khi mạng trở lại, thao tác đã xếp hàng có thể mâu thuẫn với những gì đã xảy ra trên máy chủ. Hai thiết bị cùng ngoại tuyến, cùng sửa một bàn, cùng thanh toán một đơn, hoặc một thiết bị ngoại tuyến trong khi thiết bị khác vẫn online và đã đóng đơn đó rồi.

Hiện hệ thống chống ghi đè bằng khóa lạc quan: thao tác dựa trên dữ liệu cũ bị từ chối và người dùng phải tải lại. Cách này hợp lý khi online vì người dùng đang ngồi trước máy và sửa lại được ngay. Nhưng với thao tác đã xếp hàng từ hai giờ trước thì không còn ai để hỏi, nên cần chính sách hòa giải rõ ràng.

## What Changes

- Định nghĩa chính sách hòa giải cho từng loại thao tác trong hàng đợi.
- Phát hiện xung đột khi gửi lại: dữ liệu trên máy chủ đã đổi so với lúc thao tác được tạo cục bộ.
- Xử lý xung đột không tự giải được: đưa vào hàng chờ người xử lý thay vì âm thầm bỏ hoặc âm thầm ghi đè.
- Bảo đảm gửi lại không sinh trùng, kể cả khi mạng chập chờn và một thao tác được gửi hai lần.
- Xử lý các bất biến bị phá khi ngoại tuyến, đặc biệt là số bill sinh theo thứ tự thanh toán.
- Ghi dấu vết đầy đủ cho mọi xung đột và mọi quyết định hòa giải, vì đây là chỗ tiền có thể sai.

## Capabilities

### New Capabilities

- `offline-conflict-resolution`: phát hiện xung đột khi đồng bộ lại, chính sách hòa giải theo loại thao tác, bảo đảm không sinh trùng, và hàng chờ xung đột cần người xử lý.

### Modified Capabilities

- `offline-data-layer`: bổ sung quy tắc gửi lại và xử lý kết quả từ chối.
- `multi-device-sync`: đổi mô hình chống ghi đè, vì khóa lạc quan hiện tại giả định người dùng đang ngồi trước máy để tải lại.
- `payment`: đổi quy tắc sinh số bill nếu thanh toán được phép làm ngoại tuyến.
- `order-history`: bổ sung hiển thị đơn có xung đột đang chờ xử lý, nếu được chốt là cần.

## Impact

- Đây là phần rủi ro cao nhất trong toàn bộ danh sách mở rộng, vì sai sót ở đây làm mất tiền hoặc ghi nhận sai doanh thu.
- Chạm vào các lời gọi phía database quan trọng nhất và vào quy tắc đánh số bill.
- Cần bộ kiểm thử riêng cho các tình huống xung đột, và các tình huống này khó dựng lại.
- Cập nhật `docs/architecture.md`, `docs/limitations.md`, `pos-cafe-context.md`.

## Ngoài phạm vi

- Kho dữ liệu cục bộ và hàng đợi. Việc đó thuộc `add-offline-data-layer`.
- Hiển thị trạng thái đồng bộ cho người dùng. Việc đó thuộc `add-offline-status-ux`.
- Hòa giải tự động bằng cách hợp nhất nội dung ở mức từng trường.

## Phụ thuộc

- `add-offline-data-layer`: bắt buộc.

## Câu hỏi phải chốt trước khi làm

1. Nguyên tắc chung khi xung đột là gì: máy chủ luôn thắng, thiết bị luôn thắng, hay tùy loại thao tác? Nguyên tắc máy chủ luôn thắng an toàn nhất nhưng sẽ vứt bỏ đơn đã bán ngoại tuyến.
2. Đơn đã thanh toán ngoại tuyến mà máy chủ báo đơn đó đã bị thiết bị khác thanh toán hoặc hủy thì xử lý thế nào? Đây là tình huống mất tiền thật, cần chính sách rõ ràng.
3. Số bill xử lý ra sao? Nếu ngoại tuyến sinh số tạm thì lúc đồng bộ có đánh số lại không? Đánh số lại sẽ làm hóa đơn đã đưa cho khách không khớp với hệ thống.
4. Xung đột không tự giải được thì ai xử lý và xử lý ở đâu? Cần một màn hình riêng, hay đưa vào màn lịch sử đơn?
5. Thao tác trong hàng đợi có hạn dùng không? Ví dụ thao tác quá 24 giờ thì không gửi nữa mà chuyển thẳng sang chờ người xử lý.
6. Có chấp nhận việc một số thao tác ngoại tuyến bị mất hẳn không, và nếu có thì người dùng được thông báo thế nào?
7. Mức độ chi tiết của dấu vết xung đột cần tới đâu, và giữ bao lâu?
8. Kiểm thử các tình huống xung đột bằng cách nào? Cần dựng được kịch bản hai thiết bị cùng ngoại tuyến rồi cùng online lại.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
