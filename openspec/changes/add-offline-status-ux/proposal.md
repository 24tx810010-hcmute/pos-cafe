# Hiển thị trạng thái mạng và trạng thái đồng bộ

## Why

Chế độ ngoại tuyến chỉ dùng được nếu nhân viên biết mình đang ở chế độ nào. Nếu ứng dụng trông y hệt lúc online, thu ngân sẽ không biết đơn vừa bán đã lên máy chủ hay còn nằm trong hàng đợi trên máy, và sẽ không biết vì sao máy bên cạnh không thấy bàn đó.

Ngược lại, hiển thị quá nhiều cũng hỏng: màn bán hàng cần gọn và nhanh, không thể phủ đầy cảnh báo. Đây là lý do phần giao diện được tách thành change riêng thay vì làm kèm.

## What Changes

- Hiển thị trạng thái kết nối rõ ràng nhưng không xâm lấn trên vỏ ứng dụng.
- Hiển thị số thao tác đang chờ gửi, và trạng thái đang gửi lại khi mạng trở lại.
- Đánh dấu các đơn hoặc thao tác chưa được máy chủ xác nhận, để nhân viên biết cái gì chắc chắn và cái gì chưa.
- Thông báo rõ khi một thao tác bị từ chối hoặc rơi vào trạng thái xung đột cần xử lý.
- Vô hiệu hóa và giải thích các chức năng không dùng được khi ngoại tuyến, thay vì để người dùng bấm rồi gặp lỗi.
- Hướng dẫn ngắn gọn cho nhân viên về việc nên và không nên làm gì khi đang ngoại tuyến.

## Lát mỏng làm được trước, không cần kho dữ liệu cục bộ

Phần lớn change này phụ thuộc `add-offline-data-layer`, nhưng có một lát mỏng **làm được ngay và độc lập hoàn toàn**, ước lượng khoảng ba tới năm ngày:

- Phát hiện và hiển thị trạng thái mất kết nối.
- Giữ các màn hình đọc được từ dữ liệu đã tải, thay vì để trống hoặc quay vòng vô hạn.
- Chặn các thao tác ghi bằng một thông báo người dùng hiểu được, thay vì để họ bấm rồi nhận lỗi kỹ thuật.

Lát mỏng này không cho bán hàng khi mất mạng, nên nó không thay thế `add-offline-data-layer`. Nhưng nó xóa được trải nghiệm tệ nhất hiện nay là ứng dụng trông như hỏng mà không nói vì sao, và nó là thứ duy nhất trong cả nhóm ngoại tuyến vừa với một dự án đang kín lịch.

Ba mục còn lại của change này — đánh dấu thao tác chưa được xác nhận, hiển thị số việc đang chờ gửi, và thông báo xung đột — vẫn phải chờ hai change kia.

## Capabilities

### New Capabilities

- `offline-status-ux`: cách hệ thống truyền đạt trạng thái kết nối, trạng thái đồng bộ và mức độ chắc chắn của từng thao tác tới người dùng.

### Modified Capabilities

- `offline-data-layer`: bổ sung yêu cầu công khai trạng thái hàng đợi ra ngoài để giao diện hiển thị được.
- `order-management`: bổ sung dấu hiệu đơn chưa được xác nhận.
- `payment`: bổ sung dấu hiệu thanh toán chưa được xác nhận.
- `receipt-printing`: bổ sung hành vi khi hóa đơn được in cho một đơn chưa được xác nhận.

## Impact

- Chạm vào vỏ ứng dụng và các màn vận hành chính.
- Ảnh hưởng tới hóa đơn: cần chốt hóa đơn của đơn thanh toán ngoại tuyến có ghi dấu gì không.
- Cập nhật `docs/screens.md`, `docs/features.md`, `docs/ui-redesign-context.md`.

## Ngoài phạm vi

- Kho dữ liệu cục bộ và hàng đợi. Việc đó thuộc `add-offline-data-layer`.
- Chính sách hòa giải xung đột. Việc đó thuộc `add-offline-sync-conflict-resolution`.
- Màn quản trị xử lý xung đột chi tiết, nếu được chốt là cần thì thuộc change hòa giải.

## Phụ thuộc

- `add-offline-data-layer`: bắt buộc cho phần lớn change, **trừ lát mỏng** nêu ở mục trên.
- `add-offline-sync-conflict-resolution`: cần để hiển thị đúng trạng thái xung đột.

## Câu hỏi phải chốt trước khi làm

1. Trạng thái kết nối hiển thị ở đâu và ở mức nào? Vỏ ứng dụng hiện có thanh điều hướng trái rộng 176 hoặc 68 pixel và các module mở bằng ngăn kéo toàn màn hình che cả thanh này, nên chỗ đặt chỉ báo không hiển nhiên.
2. Có cần thông báo chủ động khi mất mạng và khi có mạng lại không, hay chỉ đổi chỉ báo im lặng? Thông báo giúp nhân viên biết ngay nhưng dễ gây phiền khi mạng chập chờn.
3. Đơn chưa được xác nhận đánh dấu thế nào trên sơ đồ bàn và trong danh sách đơn?
4. Hóa đơn in cho đơn thanh toán ngoại tuyến có ghi dấu gì không? Đây là hóa đơn đưa cho khách nên cần cân nhắc kỹ.
5. Chức năng nào bị vô hiệu hóa khi ngoại tuyến, và giải thích bằng cách nào cho gọn?
6. Ngưỡng nào thì cảnh báo mạnh hơn, ví dụ hàng đợi quá nhiều thao tác hoặc ngoại tuyến quá lâu?
7. Nhân viên cần được hướng dẫn gì khi ngoại tuyến, và hướng dẫn đó đặt trong ứng dụng hay chỉ trong tài liệu vận hành?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
