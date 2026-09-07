# Bảo đảm không sinh trùng cho các lời gọi ghi

## Why

Khi người dùng bấm lại sau một lần mất phản hồi, ứng dụng hiện **dựng lại lệnh từ màn hình đang hiển thị** thay vì gửi lại chính lệnh đã xác nhận: `src/features/pos/orderFlow.ts` sinh định danh mới ở mỗi lần gọi (`orderFlow.ts:308`, `:418-428`), lấy `lock_version` mới nhất mà polling vừa kéo về, và kẹp lại lựa chọn theo dữ liệu mới. Nghĩa là một yêu cầu **đã chạy xong phía database nhưng bị timeout phía client**, rồi được gọi lại, có thể được máy chủ nhìn thành một thao tác hoàn toàn khác.

Hệ hiện có sẵn vài lớp chặn, và chúng **có tác dụng khi lần gửi lại giữ nguyên định danh cũ**: khóa chính của `order_items`, chỉ mục duy nhất một-đơn-mở-trên-một-bàn, và guard trạng thái cộng `lock_version` trong từng RPC. Nhưng không lớp nào trong số đó nhận diện được **cùng một ý định nghiệp vụ** khi định danh và ngữ cảnh đã đổi. Hai ca đã xác minh bằng đọc mã: bấm lại `pay_order_items` sau khi phiên bản đã tiến hợp lệ thì **ghi nhận thanh toán thêm lần nữa**; và tạo lại một đơn tại bàn sau khi máy khác đã thanh toán đơn đầu thì **qua được cả guard lẫn chỉ mục**, vì cả hai chỉ xét `status = 'open'`.

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

**Phần Why giữ nguyên. Một đính chính ghi ngày 2026-09-07 đã bị rút lại cùng ngày.**

Ngày 2026-09-07, sau khi rà mã, mục này từng ghi rằng phần Why "nói quá" vì đường dẫn tới bản ghi thanh toán trùng đã bị khóa lạc quan chặn. **Đính chính đó sai và đã được rút.**

Một AI độc lập rà lại cùng ngày và chỉ ra ca sau, đã kiểm chứng lại bằng mã:

1. Đơn có 5 ly, `lock_version = 5`. Thu ngân chọn trả 1 ly qua `pay_order_items`.
2. Máy chủ tách và ghi thanh toán. Đơn nguồn còn 4 ly, version thành 6. **Phản hồi bị mất.**
3. Polling 5 giây kéo về version 6.
4. Giao diện **giữ lại lựa chọn**: `src/app/drawers/pos/PaymentDrawer.tsx:51-60` kẹp lựa chọn về dữ liệu mới chứ không xóa.
5. Thu ngân bấm lại. `src/features/pos/orderFlow.ts:418-428` sinh **định danh mới** cho `paymentId`, `newOrderId` và `splitItemId`, gửi kèm **version 6 hiện tại**.
6. Version khớp, guard cho qua. Một ly nữa bị tách và thu tiền.

Kết quả: **hai bản ghi thanh toán trên hai đơn tách, cho một ý định thu tiền duy nhất.** Khóa lạc quan không hề bị vi phạm vì version đã tiến hợp lệ — đó chính là lý do nó không cứu được ca này.

Phát biểu gốc của phần Why vì vậy **đúng về bản chất**, chỉ mô tả sai đường dẫn tới hậu quả.

Phân tích đầy đủ, gồm tám lỗi khác đã xác nhận trong bản rà đầu tiên, nằm ở `docs/reviews/2026-09-07-idempotency/04-dinh-chinh-sau-danh-gia.md`.

**Hiện trạng đúng sau khi rà lại hai vòng:**

| Ca | Bị chặn chưa | Bằng chứng |
| --- | --- | --- |
| Gửi lại **nguyên yêu cầu cũ** | **Có** | `items[].id` giữ nguyên, vướng khóa chính `order_items` (`001_schema_enums.sql`) |
| Tạo đơn **tại bàn** | **Có, hai lớp** | Guard "bàn đã có đơn mở" trong `submit_order_changes` (012), cộng chỉ mục duy nhất `orders_store_table_open_idx` (`002_indexes_rls_triggers.sql:70`) |
| `pay_order` bấm lại | **Có** | `status <> 'open'` cộng `lock_version` |
| `void_order` bấm lại | **Có** | `status <> 'paid'` cộng `lock_version` (011:157) |
| **Tạo đơn mang đi, định danh mới sau khi tải lại trang** | **Không** | `table_id` là `null` nên cả guard lẫn chỉ mục đều không áp |
| **`pay_order_items` bấm lại sau khi version đã tiến hợp lệ** | **Không. Thu tiền hai lần** | Xem diễn biến sáu bước ở trên |
| **Gọi RPC trực tiếp với `p_expected_lock_version = NULL`** | **Không. Bỏ qua kiểm phiên bản** | So sánh `lock_version <> NULL` cho `NULL`, `IF` không chạy nhánh từ chối |

Phát biểu đúng, thay cho phát biểu cũ: **gửi lại nguyên yêu cầu cũ thường bị chặn; bấm lại sau khi dữ liệu và định danh đã thay đổi vẫn lặp được nghiệp vụ, và ca nặng nhất là tách đơn thanh toán hai lần.**

Lỗ hổng `NULL` ở dòng cuối bảng là **vấn đề độc lập với change này** và nên xử lý riêng, không gộp vào phần chống trùng.

**4. Áp khóa cho bốn lời gọi: `submit_order_changes`, `pay_order`, `pay_order_items`, `void_order`.** Chốt 2026-09-07.

Ba phương án đã cân nhắc:

| | Phạm vi | Lý do chọn hoặc loại |
| --- | --- | --- |
| a | Ba lời gọi tiền | **Loại.** Bỏ sót `void_order`, mà hủy đơn đã thanh toán cũng là thao tác đụng tiền |
| b | Bốn lời gọi trên | **Chọn.** Toàn bộ nhóm đụng tiền và đụng trạng thái đơn — ranh giới tự nhiên, không phải con số chọn bừa |
| c | Thêm cả thao tác quản trị | **Loại.** Thừa, xem lý do bên dưới |

Lý do loại c, **đã sửa ngày 2026-09-07 sau đánh giá độc lập**: giới hạn phạm vi change, **không phải** vì thao tác quản trị đã tự an toàn.

Lý do cũ ghi rằng chúng tự an toàn nhờ mọi kiểu `*Create` mang sẵn `id` do client sinh. **Điều đó không đủ.** `src/adapters/supabase/menuRepo.ts:51` cho thấy `saveMenuChanges` thực hiện **nhiều request nối tiếp**, không phải một giao dịch: tạo category xong mà tạo món hỏng, thì gửi lại nguyên changeset sẽ lỗi trùng khóa ở phần đã xong **trước khi** tới phần chưa xong.

Nguyên tắc phân loại, **đã sửa ngày 2026-09-07 sau đánh giá vòng hai**. Một thao tác cần khóa nếu thỏa **ít nhất một** trong hai điều kiện:

1. **Nó không bình thường hóa** — làm hai lần cho kết quả khác làm một lần. Đặt thực đơn thành trạng thái X thì làm mười lần vẫn ra X; tạo một đơn thì làm hai lần ra hai đơn.
2. **Caller cần xác nhận kết quả** — sau khi mất phản hồi, người dùng phải biết được lần gửi trước đã thành công hay chưa, và hệ phải trả lời được câu đó mà không thực hiện lại.

Lý do sửa: nguyên tắc cũ chỉ có điều kiện 1, nên nó **mâu thuẫn với chính lý do giữ `void_order`** ghi ngay dưới đây. Điều kiện 2 là thứ làm hai đoạn nhất quán, và nó cũng đúng với bản chất bài toán — khóa chống trùng sinh ra để trả lời "việc này xong chưa", không chỉ để chặn ghi thừa.

Riêng `void_order`: hủy một đơn đã hủy vẫn ra trạng thái đã hủy, nên **về mặt trạng thái nó đã bình thường hóa**. Nó vào phạm vi theo điều kiện 2, không theo điều kiện 1.

Lý do giữ nó trong phạm vi, **đã sửa ngày 2026-09-07**: sau khi mất phản hồi, caller **cần xác nhận thao tác hủy trước đã thành công hay chưa**.

Lý do cũ ghi rằng gọi hai lần sinh dấu vết kiểm toán rác. **Sai với mã**: lần gọi thứ hai bị guard trạng thái chặn **trước khi** cập nhật các trường kiểm toán (`011_void_paid_order.sql:157`).

**6. Không bật tự động thử lại. Giữ người dùng chủ động bấm lại.** Chốt 2026-09-07.

Hiện `src/app/AppProviders.tsx:31-36` đặt `retry: false` **trong khối `queries`**; không có khối `mutations`, nên các lời gọi ghi chạy theo mặc định của TanStack Query, vốn cũng không thử lại mutation. Quyết định này giữ nguyên trạng đó.

*(Sửa ngày 2026-09-07: bản cũ suy từ `queries.retry: false` ra "hệ đang không tự thử lại gì cả". Kết luận về hành vi vẫn đúng, nhưng nó đúng nhờ mặc định của thư viện chứ không nhờ dòng cấu hình đó — và nếu sau này có ai đặt `mutations.retry`, dòng cấu hình kia sẽ không cản.)*

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
