# Trừ tồn kho tự động theo định lượng món

## Why

Có mô hình tồn kho mà không nối với việc bán hàng thì kho vẫn phải cập nhật thủ công, và số liệu sẽ lệch ngay ngày đầu. Giá trị thật của tồn kho chỉ xuất hiện khi bán một ly cà phê sữa thì hệ thống tự trừ đúng lượng cà phê và lượng sữa tương ứng.

Đây là phần khó nhất của nhóm tồn kho vì nó chạm vào luồng đơn hàng và thanh toán vốn đã có ràng buộc giao dịch và khóa lạc quan, đồng thời phải xử lý các trường hợp ngược như hủy đơn đã thanh toán vốn đã tồn tại trong hệ thống.

## What Changes

- Thêm khái niệm định lượng: mỗi món tiêu hao bao nhiêu của từng nguyên liệu.
- Định lượng phải tính được cả phần tùy chọn, vì thêm một shot cà phê hay đổi size đều thay đổi lượng tiêu hao.
- Trừ tồn tự động tại một thời điểm xác định trong vòng đời đơn hàng.
- Hoàn tồn khi đơn bị hủy, kể cả đơn đã thanh toán rồi bị hủy.
- Xử lý đúng khi đơn bị tách để thanh toán một phần theo mô hình instant pay.
- Cảnh báo hoặc chặn khi nguyên liệu không đủ, theo chính sách được chốt.
- Ghi mọi biến động do bán hàng vào sổ biến động tồn, truy được về đơn nào.

## Capabilities

### New Capabilities

- `recipe-management`: định lượng nguyên liệu cho từng món và từng giá trị tùy chọn.

### Modified Capabilities

- `inventory-core`: bổ sung loại biến động do bán hàng và do hoàn khi hủy đơn.
- `order-management`: bổ sung hành vi kiểm tra và trừ tồn trong luồng đơn hàng.
- `payment`: bổ sung hành vi trừ tồn khi tách đơn thanh toán một phần, nếu thời điểm trừ tồn được chốt là lúc thanh toán.
- `order-void`: bổ sung hành vi hoàn tồn khi hủy đơn đã thanh toán.
- `menu-management`: bổ sung phần khai báo định lượng cho món và cho giá trị tùy chọn.

## Impact

- Chạm vào các lời gọi phía database quan trọng nhất của hệ thống: gửi đơn, thanh toán, tách đơn thanh toán, hủy đơn.
- Rủi ro cao: sai sót ở đây làm sai tiền hoặc chặn bán hàng.
- Thêm bảng định lượng và migration tương ứng.
- Tăng thời gian xử lý của các lời gọi order và payment.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/architecture.md`.

## Ngoài phạm vi

- Màn hình quản lý kho và màn khai báo định lượng. Việc khai báo định lượng có thể nằm trong trình soạn thực đơn hoặc trong màn kho, cần chốt ở phần câu hỏi.
- Dự báo nhu cầu nhập hàng.
- Tính giá vốn theo đơn.

## Phụ thuộc

- `add-inventory-core`: bắt buộc, vì cần có nguyên liệu và sổ biến động trước.
- `expand-e2e-coverage`: rất nên có trước, vì change này sửa đúng những luồng dễ vỡ nhất.

## Câu hỏi phải chốt trước khi làm

1. Trừ tồn tại thời điểm nào: lúc gửi đơn cho bếp, hay lúc thanh toán? Trừ lúc gửi đơn phản ánh đúng thực tế pha chế nhưng phải hoàn lại khi hủy đơn mở. Trừ lúc thanh toán đơn giản hơn nhưng đồ đã pha mà khách bỏ về thì kho không biết.
2. Khi nguyên liệu không đủ thì chặn bán hay chỉ cảnh báo? Chặn bán làm số liệu kho đáng tin nhưng có thể làm quán không bán được hàng khi kho nhập liệu sai.
3. Định lượng khai báo ở đâu: trong trình soạn thực đơn cùng chỗ với món, hay trong màn quản lý kho? Chỗ thứ nhất tiện cho quản lý, chỗ thứ hai gom logic kho về một nơi.
4. Giá trị tùy chọn có định lượng riêng không? Ví dụ thêm một shot cà phê thì cộng thêm lượng cà phê. Nếu có thì phải khai định lượng cho từng giá trị tùy chọn chứ không chỉ cho món.
5. Món không cần quản lý kho xử lý thế nào? Không phải món nào cũng đáng khai định lượng. Có cho phép món không có định lượng và bỏ qua trừ tồn không?
6. Khi hủy đơn đã thanh toán thì hoàn tồn hay không? Thực tế đồ đã pha rồi thì nguyên liệu đã mất, hoàn tồn sẽ làm kho sai. Nhưng nếu hủy vì nhập nhầm đơn thì không hoàn sẽ cũng sai.
7. Với đơn bị tách để thanh toán một phần, tồn được trừ theo đơn nào và vào lúc nào?
8. Có cần cơ chế bù trừ khi kiểm kê thực tế lệch với sổ sách không, và ai được duyệt phần lệch đó?
9. Chấp nhận việc trừ tồn làm chậm thao tác thanh toán bao nhiêu? Thu ngân bấm thanh toán là lúc khách đang đứng chờ.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
