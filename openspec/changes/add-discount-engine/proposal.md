# Xây dựng cơ chế tính giảm giá

## Why

Hệ thống hiện không có bất kỳ khái niệm giảm giá nào. Tổng tiền đơn bằng đúng tổng các dòng, giá được chụp phía database lúc gửi đơn, và thanh toán so tiền khách đưa với tổng đơn. Mọi hình thức khuyến mãi mà quán muốn làm, gồm mã giảm giá, voucher và giờ vàng, đều cần chung một cơ chế tính: xác định phần giảm áp vào đâu, tính theo thứ tự nào, và tổng cuối cùng là bao nhiêu.

Làm ba tính năng khuyến mãi mà mỗi cái tự tính giảm giá theo cách riêng thì sẽ mâu thuẫn ngay khi hai khuyến mãi cùng áp lên một đơn. Vì vậy cần dựng cơ chế tính trước, rồi các nguồn khuyến mãi cắm vào sau.

Change này lật lại phần ngoài phạm vi của `docs/requirements.md` vốn ghi giảm giá và voucher là chưa làm.

## What Changes

- Thêm khái niệm khoản giảm giá áp lên một đơn hoặc lên một dòng của đơn.
- Định nghĩa cách tính tổng đơn khi có giảm giá, gồm thứ tự áp dụng và cách làm tròn.
- Định nghĩa cách xử lý khi nhiều khoản giảm giá cùng áp lên một đơn.
- Lưu bản chụp khoản giảm giá vào đơn, để hóa đơn in lại và báo cáo về sau vẫn đúng.
- Bổ sung giảm giá thủ công do nhân viên áp trực tiếp, làm nguồn khuyến mãi đầu tiên cắm vào cơ chế và cũng là cách chứng minh cơ chế chạy đúng.
- Bổ sung quyền áp giảm giá, vốn đã nằm sẵn trong danh mục quyền chưa dùng của `docs/features.md`.
- Đưa số tiền giảm vào báo cáo, để doanh thu và mức giảm tách bạch được.

## Capabilities

### New Capabilities

- `discount-engine`: quy tắc tính khoản giảm giá trên đơn hàng, gồm phạm vi áp dụng, thứ tự áp dụng, làm tròn, và bản chụp lưu vào đơn.

### Modified Capabilities

- `order-management`: tổng đơn không còn bằng tổng các dòng; bổ sung hành vi áp và gỡ giảm giá trên đơn.
- `payment`: số tiền phải thu tính theo tổng sau giảm; ảnh hưởng tới cả luồng tách đơn thanh toán một phần.
- `order-history`: chi tiết đơn phải hiển thị khoản giảm đã áp.
- `receipt-printing`: phiếu tạm tính, hóa đơn và hóa đơn in lại phải hiển thị khoản giảm đã áp.
- `reporting`: bổ sung số liệu tổng giảm giá và tách bạch với doanh thu.
- `access-control`: bổ sung quyền áp giảm giá.

## Impact

- Chạm vào phần tính tiền, là phần nhạy cảm nhất của hệ thống.
- Ảnh hưởng trực tiếp tới mô hình instant pay tách đơn: khi một đơn có giảm giá bị tách đôi, phần giảm phải được phân bổ theo quy tắc rõ ràng.
- Thêm bảng lưu khoản giảm của đơn và migration tương ứng.
- Ảnh hưởng tới mẫu hóa đơn dùng chung.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/requirements.md`, `docs/architecture.md`.

## Ngoài phạm vi

- Mã giảm giá và voucher. Việc đó thuộc `add-promo-codes-and-vouchers`.
- Khuyến mãi theo khung giờ. Việc đó thuộc `add-happy-hour-pricing`.
- Màn quản lý chương trình khuyến mãi. Việc đó thuộc `add-promotion-management-screen`.
- Giảm giá dựa trên điểm tích lũy của khách. Việc đó thuộc `add-loyalty-points`.
- Thuế và phí dịch vụ.

## Phụ thuộc

- `redesign-permission-model`: nên chốt trước để quyền áp giảm giá khai báo đúng cách.

## Câu hỏi phải chốt trước khi làm

1. Giảm giá áp ở cấp nào: cả đơn, từng dòng, hay cả hai? Cả hai là linh hoạt nhất nhưng phức tạp nhất khi tính.
2. Hình thức giảm gồm những gì: giảm theo số tiền cố định, giảm theo phần trăm, hay còn hình thức khác như mua một tặng một?
3. Khi một đơn có giảm giá bị tách để thanh toán một phần, phần giảm phân bổ thế nào? Theo tỷ lệ giá trị món được tách, hay dồn hết vào đơn trả trước? Đây là câu hỏi bắt buộc phải trả lời vì instant pay là mô hình cốt lõi của hệ thống.
4. Nhiều khuyến mãi cùng áp lên một đơn thì cộng dồn hay chỉ lấy khuyến mãi có lợi nhất? Nếu cộng dồn thì theo thứ tự nào, vì áp phần trăm trước hay sau khi trừ số tiền cố định cho kết quả khác nhau.
5. Có cho phép giảm giá vượt quá tổng đơn không, tức tổng phải thu về 0 hoặc âm?
6. Làm tròn theo quy tắc nào? Tiền Việt thường làm tròn tới đơn vị nghìn, nhưng phần trăm sẽ ra số lẻ.
7. Giảm giá có ảnh hưởng tới việc trừ tồn kho không, nếu `add-recipe-based-stock-deduction` được làm?
8. Trong báo cáo, doanh thu hiểu là số tiền thực thu hay tổng trước giảm? Con số nào là con số chính hiển thị trên thẻ doanh thu?
9. Ai được áp giảm giá thủ công, và có cần giới hạn mức tối đa mỗi người được giảm không?
10. Hủy một đơn đã thanh toán có giảm giá thì báo cáo trừ đi con số nào?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
