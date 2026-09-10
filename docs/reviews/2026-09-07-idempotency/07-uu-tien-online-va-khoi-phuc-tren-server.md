# 07 — Ưu tiên online và khôi phục thao tác trên server

Ngày ghi nhận: **08/09/2026**. Đây là quyết định phạm vi và hướng viết spec, **chưa phải tính năng đã triển khai hoặc spec đã được duyệt**.

## Quyết định của chủ dự án

Sau khi rà rủi ro mất dữ liệu local, nhiều thiết bị và tham khảo cách xử lý của các hệ thống thực tế, chủ dự án xác nhận:

> có vẻ ổn đấy, tôi nghĩ là dự án này nên chỉ ưu tiên online thôi, việc xử lý offline có vẻ quá khó

Phạm vi hiện tại tập trung **vận hành online**. Hoãn bán hàng offline, hàng đợi lệnh cục bộ và hòa giải dữ liệu sau khi thiết bị trở lại online. Giữ các proposal để tham khảo và phát triển sau; không coi chúng là cam kết phải hoàn thành trong đợt này.

Lý do: cần tập trung làm đúng luồng đơn và thanh toán khi nhiều máy cùng dùng, gồm mất phản hồi và khôi phục thao tác. Nhận thêm lệnh lúc offline còn kéo theo giá, số đơn, phiên bản dữ liệu và quyền đã thay đổi khi đồng bộ; phạm vi đó làm tăng số tình huống phải đặc tả và kiểm thử.

## Hướng của change chống trùng

Tiếp tục `add-idempotent-write-operations` theo **phương án B thu hẹp cho online**:

1. Chuẩn bị lệnh đã xác nhận một lần, giữ nguyên loại RPC, payload, version và toàn bộ UUID khi thử lại.
2. Đăng ký định danh và nội dung lệnh trên server trước khi cho thực hiện nghiệp vụ. Bước đăng ký cũng phải chống trùng.
3. Server thực hiện lệnh đã đăng ký; kết quả và thay đổi nghiệp vụ được ghi nguyên tử.
4. Có đường tìm thao tác từ máy khác theo cửa hàng/đơn và danh sách thao tác, không chỉ tra bằng khóa còn nằm trên máy cũ.
5. Sau khi đăng ký thành công, local không còn là nơi duy nhất giữ lệnh để khôi phục. Không hứa khôi phục được nội dung chưa từng tới server.

Đây là hướng đã được đón nhận trong trao đổi; **chi tiết giao thức, UX và quyền còn phải chốt trước khi viết bộ spec hoàn chỉnh**. Không suy từ việc ưu tiên online ra chấp thuận mọi đề xuất kỹ thuật trước đó.

## Online vẫn phải xử lý mất kết nối

| Tình huống | Ranh giới cần đưa vào spec |
| --- | --- |
| Chưa gửi lệnh, không liên lạc được server | Không nhận thành công một giao dịch offline để đồng bộ sau |
| Đã gửi nhưng mất phản hồi | Kết quả chưa xác định; không kết luận thất bại và cấp khóa mới chỉ vì timeout |
| Lệnh đã đăng ký, kết nối trở lại hoặc đổi máy | Tìm lại, xem kết quả hoặc tiếp tục đúng lệnh đó theo quyền được chốt |
| Hai máy dùng version cũ của cùng đơn | Vẫn cần kiểm tra version; online không loại bỏ xung đột |
| Hai người nhập hai đơn mới giống nhau | Không tự gộp theo món/tiền/thời gian; cần cùng chọn một thao tác đã có để phục hồi |

Giữ retry ghi **thủ công** theo quyết định trước. Phần báo mất kết nối và xử lý kết quả chưa rõ vẫn cần thiết; nó không đồng nghĩa hỗ trợ bán hàng offline. Không lấy cờ kết nối trên trình duyệt làm bằng chứng rằng server đã nhận hoặc chưa nhận lệnh.

## Các proposal và lịch bị ảnh hưởng

| Hạng mục | Trạng thái sau quyết định |
| --- | --- |
| `add-idempotent-write-operations` | Tiếp tục ưu tiên; bổ sung đăng ký, tra cứu và phục hồi trên server trong hướng spec |
| `add-offline-data-layer` | Hoãn |
| `add-offline-sync-conflict-resolution` | Hoãn |
| `add-offline-status-ux` | Hoãn phần hàng đợi/đồng bộ offline; phần báo mất kết nối và kết quả chưa rõ của bốn RPC thuộc spec chống trùng; UX kết nối toàn ứng dụng chưa được lên lịch mới |
| Tuần 11–13 trong roadmap cũ | Bỏ cam kết triển khai offline; chưa phân bổ lại cho tính năng khác |

Quyết định này thay thế việc kéo offline vào giai đoạn 1 ngày 30/08/2026. Không tự kéo nhóm ca làm việc hoặc một tính năng khác vào chỗ trống.

## Những điểm chưa được chốt thay người dùng

- Quy tắc tiếp tục xử lý một đơn khi thao tác trước đã áp dụng nhưng chưa có người đối chiếu kết quả; chặn ở phạm vi nào, tránh chặn nhầm việc mới hợp lệ.
- Ai được xem, tiếp tục, hủy hoặc đối chiếu thao tác của nhân viên khác; tách người khởi tạo khỏi người xử lý tiếp.
- Hủy lệnh và request đến muộn, lưu kết quả từ chối cuối cùng, thời hạn lưu và hành vi quá hạn. Không có mặc định 24 giờ đã được duyệt.
- Cách xử lý đăng ký mất phản hồi, bản đăng ký bỏ lại và tìm đúng thao tác tạo đơn mới khi mất cả dữ liệu client.
- Nội dung giao diện cụ thể, cách in lại kết quả lịch sử và các lỗi mới của hợp đồng RPC.

Testplan phải bao gồm: cùng khóa gửi từ hai máy; khác khóa với version cũ; mất phản hồi sau commit; mất local sau đăng ký; mất phản hồi đăng ký; hủy tranh chấp với thực hiện; request đến muộn; quyền và cô lập cửa hàng; version `NULL`; polling không làm thay đổi lệnh retry. Đây là danh sách yêu cầu kiểm thử, chưa phải kết quả test đã chạy.

## Tài liệu thực tế đã dùng để cân nhắc

- [Stripe Terminal](https://docs.stripe.com/terminal/payments/collect-card-payment?terminal-sdk-platform=js): khi timeout và chưa biết kết quả, tiếp tục PaymentIntent gốc; không tạo phiên mới chỉ vì mất phản hồi.
- [Stripe Payment Intents](https://docs.stripe.com/payments/payment-intents): liên kết ID phiên thanh toán với giỏ/phiên mua hàng để tìm lại; chống trùng cả bước tạo phiên.
- [Adyen](https://docs.adyen.com/point-of-sale/error-scenarios/): phân biệt request timeout với giao dịch bị hủy và tra trạng thái khi không có kết quả.
- [Square Open Tickets](https://squareup.com/help/us/en/article/5337-use-open-tickets-with-square): mở lại ticket từ thiết bị khác đăng nhập cùng tài khoản.
- [Square offline payments](https://squareup.com/help/us/en/article/8551-view-offline-payments): dữ liệu offline chưa tải lên có thể mất cùng dữ liệu thiết bị.

Các nguồn trên là tiền lệ về quản lý định danh và phục hồi, không chứng minh toàn bộ thiết kế đề xuất đã đúng. POS của dự án đang xét ghi nhận tiền mặt; không cần sao chép vòng đời xác thực/giữ tiền/thu tiền thẻ của nhà cung cấp.
