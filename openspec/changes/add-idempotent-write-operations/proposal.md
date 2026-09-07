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

Ghi ngày 2026-09-07. Đánh số theo câu hỏi ở mục trên. Câu 1, 2, 3 còn đang trao đổi thêm.

**Đính chính phần Why, ghi trước mọi quyết định.** Phần Why viết rằng hậu quả là "hai bản ghi thanh toán cho một lần thu tiền, kéo theo doanh thu sai". Rà mã ngày 2026-09-07 cho thấy **điều đó đã bị chặn sẵn**:

| Lời gọi | Guard đang có | Gọi lại thì sao |
| --- | --- | --- |
| `pay_order` | `status <> 'open'` cộng `lock_version` (012) | `ORDER_VERSION_CONFLICT`, không sinh bản ghi thứ hai |
| `pay_order_items` | như trên, trên đơn nguồn (012:110–112) | Bị chặn |
| `void_order` | `status <> 'paid'` cộng `lock_version` (011:157–158) | Bị chặn |
| `submit_order_changes`, đơn đã có | `lock_version` | Bị chặn |
| **`submit_order_changes`, đơn mới** | **không có** | **Tạo đơn thứ hai** |

Đơn mới thủng vì đơn chưa tồn tại nên không có `lock_version` để đối chiếu, và `orderId` do adapter tự sinh ở `src/adapters/supabase/orderRepo.ts:91` — mỗi lần gọi một UUID khác.

Hại thật hiện nay vì vậy là: **sai dữ liệu chỉ ở luồng tạo đơn mới**; ba luồng còn lại là **trải nghiệm tệ** — thu ngân bấm lại, nhận lỗi khó hiểu, không biết tiền đã vào chưa. Change vẫn đáng làm, nhưng phải mô tả đúng mức thay vì nói quá.

**4. Áp khóa cho bốn lời gọi: `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`.** Chốt 2026-09-07.

Ba phương án đã cân nhắc:

| | Phạm vi | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Ba lời gọi tiền | **Loại.** Bỏ sót `void_order`, mà hủy đơn đã thanh toán cũng là thao tác đụng tiền |
| b | Bốn lời gọi trên | **Chọn.** Toàn bộ nhóm đụng tiền và đụng trạng thái đơn — ranh giới tự nhiên, không phải con số chọn bừa |
| c | Thêm cả thao tác quản trị | **Loại.** Thừa, xem lý do bên dưới |

Lý do loại c: mọi kiểu `*Create` trong `src/domain/changes.ts` đều **mang sẵn `id` do client sinh** — `CategoryCreate`, `MenuItemCreate`, `OptionGroupCreate` và các kiểu còn lại. Gửi lại cùng một changeset là gửi lại cùng khóa chính, nên không sinh bản ghi trùng. Chúng đã **bình thường hóa sẵn**: làm hai lần bằng làm một lần.

Nguyên tắc phân loại, ghi lại để dùng cho change sau: chỉ thao tác **không bình thường hóa** mới cần khóa. Đặt thực đơn thành trạng thái X thì làm mười lần vẫn ra X; tạo một đơn thì làm hai lần ra hai đơn.

Riêng `void_order`: hủy một đơn đã hủy vẫn ra trạng thái đã hủy, nên **về mặt trạng thái nó đã bình thường hóa**. Nó vẫn nằm trong phạm vi vì hai lý do khác: nó ghi dấu vết kiểm toán gồm người hủy, thời điểm và lý do — gọi hai lần thì dấu vết thứ hai là rác; và nó đụng số liệu tiền hủy trong báo cáo.

**6. Không bật tự động thử lại. Giữ người dùng chủ động bấm lại.** Chốt 2026-09-07.

Hiện `src/app/AppProviders.tsx` đặt `retry: false` cho toàn bộ truy vấn, tức hệ đang không tự thử lại gì cả. Quyết định này giữ nguyên trạng đó.

| | Phương án | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Không tự động, người dùng bấm lại | **Chọn** |
| b | Tự động thử lại vài lần cho lỗi mạng | **Loại.** Phải phân biệt được lỗi mạng với lỗi nghiệp vụ; thử lại một `PAYMENT_AMOUNT_TOO_LOW` là vô nghĩa và làm chậm phản hồi |
| c | Đẩy sang change riêng | **Loại.** Không cần một change để nói "giữ nguyên hiện trạng" |

Lý do chọn a: bật tự động thử lại là thêm một hành vi **chạy ngầm vào đúng luồng tiền**, trong tuần đang trễ lịch. Và vấn đề gốc đã được giải rồi — có khóa chống trùng thì việc bấm lại thủ công không còn nguy hiểm nữa; phần còn lại chỉ là tiện lợi, không phải đúng sai.

Ranh giới giữ nguyên như mục "Ngoài phạm vi" đang ghi: change này bảo đảm **thử lại là an toàn**, không quyết định **khi nào thử lại**.

**7. Có ghi nhật ký lần gửi lặp, nhưng chỉ đếm.** Chốt 2026-09-07.

Một cột đếm số lần lặp trên chính hàng khóa, không sinh bản ghi riêng cho mỗi lần lặp. Đủ để biết mạng có vấn đề mà không đẻ thêm bảng, và không biến một việc vốn không có tác dụng gì thành một dòng ghi mới.

**5. Chưa từng phát sinh bản ghi trùng trên dữ liệu thật.** Chốt 2026-09-07.

Chủ dự án xác nhận: hệ chưa được dùng thật và chưa có kiểm thử tải, nên chưa có cơ hội phát sinh. Kết luận này **không làm giảm mức ưu tiên**: change vẫn là nền bắt buộc cho nhóm ngoại tuyến ở tuần 11–13, vì gửi lại hàng đợi chính là gửi trùng có chủ ý.
