# Bảo đảm không sinh trùng cho các lời gọi ghi

## Why

Adapter thanh toán hiện sinh định danh mới mỗi lần gọi nếu tầng trên không truyền xuống, và adapter đơn hàng cũng vậy với định danh đơn. Nghĩa là một yêu cầu **đã chạy xong phía database nhưng bị timeout phía client**, rồi được gọi lại, sẽ tạo ra bản ghi thứ hai thay vì bị chặn.

Định danh do client sinh vốn là điểm mạnh của thiết kế hiện tại: đơn, dòng món và thanh toán đều mang khóa chính dạng UUID do client tạo, nên về nguyên tắc chống trùng được bằng chính khóa chính. Nhưng hiện việc đó **phụ thuộc vào việc tầng gọi có nhớ truyền định danh ổn định xuống hay không**, chứ không phải một bảo đảm của hệ thống. Một chỗ quên là mất bảo đảm.

Môi trường vận hành làm chuyện này dễ xảy ra hơn bình thường: mạng ở quán chập chờn, thiết bị đặt cố định chạy liên tục nhiều giờ, và nhân viên có thói quen bấm lại khi màn hình có vẻ treo. Hậu quả không phải lỗi hiển thị mà là **hai bản ghi thanh toán cho một lần thu tiền**, kéo theo doanh thu sai.

Change này **không phụ thuộc chế độ ngoại tuyến** và đáng làm ngay cả khi không bao giờ làm ngoại tuyến. Nhưng nó cũng là nền bắt buộc cho toàn bộ nhóm ngoại tuyến, vì gửi lại hàng đợi chính là gửi trùng có chủ ý: nếu máy chủ không phân biệt được "lần gửi lại của cùng một việc" với "một việc mới", thì mọi cơ chế hàng đợi đều không an toàn.

## What Changes

- Mọi lời gọi ghi nghiệp vụ nhận một **khóa chống trùng** do client sinh đúng một lần cho mỗi ý định của người dùng, và giữ nguyên qua mọi lần gửi lại.
- Phía database ghi nhận khóa đã áp dụng và **trả về kết quả của lần áp dụng đầu tiên** thay vì thực hiện lại, để lần gọi lặp không sinh thêm dữ liệu và cũng không báo lỗi cho người dùng.
- Tầng nghiệp vụ sinh khóa tại thời điểm người dùng xác nhận thao tác, không sinh lại khi thử lại. Việc này chuyển bảo đảm từ "nhớ thì đúng" thành "không nhớ cũng đúng".
- Rà lại các adapter hiện có để bỏ hẳn mẫu sinh định danh dự phòng ngay tại chỗ gọi.
- Kiểm chứng trên dữ liệu thật xem đã từng phát sinh bản ghi trùng chưa, trước khi kết luận mức độ nghiêm trọng.
- Bổ sung kiểm thử khẳng định gọi hai lần với cùng khóa cho kết quả giống hệt gọi một lần, ở cả tầng adapter lẫn tầng database.

## Capabilities

### New Capabilities

- `write-idempotency`: quy tắc khóa chống trùng cho các lời gọi ghi nghiệp vụ, cách máy chủ nhận biết và xử lý lần gửi lặp, và phạm vi áp dụng.

### Modified Capabilities

- `order-management`: luồng gửi đơn nhận thêm khóa chống trùng, và lần gửi lặp không tạo thêm đơn hay dòng món.
- `payment`: luồng thanh toán toàn bộ và luồng tách đơn thanh toán nhận thêm khóa chống trùng; lần gửi lặp không tạo thêm bản ghi thanh toán và không cấp thêm số đơn.
- `order-void`: luồng hủy đơn đã thanh toán nhận thêm khóa chống trùng.

## Impact

- Thêm bảng lưu khóa đã áp dụng cùng kết quả tương ứng, kéo theo migration.
- Đổi chữ ký các lời gọi ghi chính, nên chạm vào cả ports, adapter và tầng nghiệp vụ.
- Cần chính sách dọn bảng khóa, vì bảng này chỉ lớn thêm.
- Rủi ro thấp so với các change khác trong nhóm: nó cộng thêm một lớp kiểm tra chứ không đổi ngữ nghĩa nghiệp vụ nào.
- Cập nhật `docs/architecture.md`, `docs/data-model.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Hàng đợi thao tác khi ngoại tuyến. Việc đó thuộc `add-offline-data-layer`.
- Tự động thử lại khi lỗi mạng. Change này chỉ bảo đảm thử lại là an toàn, không quyết định khi nào thử lại.
- Chống trùng cho các thao tác quản trị như sửa thực đơn hay sửa sơ đồ, trừ khi được chốt ở câu hỏi số 4.

## Phụ thuộc

- Không phụ thuộc change nào.
- Nên làm **trước** `add-offline-data-layer`. Hàng đợi ngoại tuyến gửi lại thao tác theo đúng nghĩa đen, nên nếu chưa có bảo đảm này thì mọi lần gửi lại đều có nguy cơ sinh trùng.
- Nên làm **trước** `enforce-permissions-at-database` nếu cả hai cùng đụng vào các lời gọi ghi, để chỉ sửa chữ ký một lần.

## Câu hỏi phải chốt trước khi làm

1. Khóa chống trùng sinh ở tầng nào? Sinh ở tầng nghiệp vụ khi người dùng xác nhận là đúng nhất về mặt ngữ nghĩa, nhưng phải bảo đảm nó sống sót qua việc thành phần giao diện bị dựng lại.
2. Khi gặp khóa đã áp dụng, máy chủ trả về nguyên văn kết quả lần đầu, hay chỉ báo đã áp dụng và để client tự tải lại? Trả nguyên văn thì client không phải xử lý thêm nhánh nào, nhưng phải lưu kết quả.
3. Giữ khóa đã áp dụng bao lâu? Đủ dài để phủ mọi lần thử lại hợp lý, đủ ngắn để bảng không phình. Nếu sau này làm ngoại tuyến thì thời hạn này phải dài hơn thời gian một thiết bị có thể ngoại tuyến.
4. Áp cho những lời gọi nào? Tối thiểu là ba lời gọi đụng tiền là gửi đơn, thanh toán và hủy đơn. Có mở rộng sang các thao tác quản trị không?
5. Đã từng phát sinh bản ghi trùng trên dữ liệu thật chưa? Cần một truy vấn kiểm tra trước khi làm, vì kết quả đổi mức ưu tiên của change này.
6. Sau khi có bảo đảm này, có bật tự động thử lại cho các lời gọi ghi không, hay vẫn để người dùng chủ động bấm lại?
7. Lần gửi lặp có ghi vào nhật ký không? Ghi thì phát hiện được vấn đề mạng, nhưng thêm ghi cho một việc vốn không có tác dụng gì.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
