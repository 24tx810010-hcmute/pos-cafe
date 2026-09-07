# 06 — Kết quả đánh giá vòng hai

Nhận ngày 07/09/2026, ngay sau khi gửi [05-nho-danh-gia-vong-hai.md](05-nho-danh-gia-vong-hai.md).

Người đánh giá đã đọc `04` và `05` tại `2ce590a`, đối chiếu mã tại `main@7183b31`, và **chạy ba phép kiểm trên các hàm flow thật với adapter giả ghi nhận lời gọi**. Phần SQL và effect React được kiểm bằng đọc mã, chưa phải kiểm thử toàn luồng trên Supabase.

Toàn bộ kết quả dưới đây đã được kiểm lại độc lập bằng cách đọc mã trước khi ghi vào tài liệu này.

---

## 1. Ba khẳng định của bản sửa: đều đúng

### 1a — Đúng

Nhánh tách một phần số lượng trong `pay_order_items` giảm số lượng **trên chính dòng nguồn**:

```sql
update public.order_items oi
set quantity = oi.quantity - v_line.quantity
where oi.store_id = v_store_id
  and oi.id = v_order_item.id;
```

*(`supabase/migrations/012_action_permission_guardrails.sql:315-319`)*

UUID mới chỉ dành cho dòng chuyển sang đơn tách. Dòng nguồn giữ nguyên `orderItemId`, nên `clampSelection` cho `min(1, 4) = 1` và lựa chọn sống nguyên vẹn. Kịch bản ghi nhận thanh toán hai lần ở tài liệu `04` đứng vững.

### 1b — Đúng, và có thêm một chi tiết chưa được nêu

Khi trả **hết** một dòng, SQL chuyển dòng đó sang đơn tách bằng cách đổi `order_id` (`012:311-314`), nên dòng biến mất khỏi đơn nguồn và clamp cho rỗng.

Chi tiết mới: giao diện còn chạy

```tsx
useEffect(() => {
  setReceivedAmountInput(String(amountDue));
}, [order?.id, amountDue]);
```

*(`src/app/drawers/pos/PaymentDrawer.tsx:66-68`)*

Nghĩa là ô **"tiền khách đưa" tự đổi theo số tiền mới**, dù nhân viên chưa nhập thêm tiền. Vì vậy kiểm tra thiếu tiền (`PAYMENT_AMOUNT_TOO_LOW`) **không cứu được ca này** — nó không bao giờ kích hoạt.

Ba phép kiểm của người đánh giá cho kết quả:

| Trạng thái sau cập nhật | Lựa chọn gửi tiếp | RPC được gọi |
| --- | --- | --- |
| Dòng A từ 5 còn 4, trước chọn 1 | A: 1 | `pay_order_items` |
| Dòng A đã chuyển đi, còn dòng B: 4 | B: 4 | `pay_order` |
| Dòng A từ 2 còn 1, trước chọn 1 | A: 1 | `pay_order` |

**Dòng cuối là biến thể chưa được nghĩ tới:** clamp **không cần rỗng** vẫn có thể chuyển sang thanh toán toàn bộ, khi lựa chọn cũ tình cờ vừa bằng toàn bộ phần còn lại. Nhánh quyết định ở `src/features/pos/orderFlow.ts:403` (`isFullSelection`).

**Điều kiện đầy đủ của kịch bản**, phải ghi vào test case:

1. Request đầu kết thúc bằng lỗi phía client, để `isPending` trở về `false` — nếu request còn treo thì nút vẫn bị khóa (`PaymentDrawer.tsx:80`, `paymentDisabled` gồm `payMutation.isPending`).
2. Polling cập nhật thành công.
3. Đơn nguồn vẫn mở.

**Về cách diễn đạt:** phải viết **"ghi nhận thanh toán thêm lần nữa"**, không viết "thu tiền hai lần". Mã chứng minh hệ có thể ghi thêm một bản ghi thanh toán; nó không chứng minh nhân viên đã thực sự nhận thêm tiền mặt. Đây là ranh giới giữa điều mã chứng minh được và điều suy đoán về hành vi con người — cần giữ đúng trong báo cáo khóa luận.

### 1c — Đúng có điều kiện, không đúng nếu phát biểu rộng

Phát biểu **"đơn mang đi không được bảo vệ"** là quá rộng. Đơn mang đi vẫn có khóa chính của đơn, dòng món và tùy chọn; gửi lại **cùng định danh** vẫn vướng các ràng buộc đó.

Phát biểu đúng: **khi toàn bộ định danh được sinh mới**, không có ràng buộc nào trong các migration hiện có nhận ra đây là cùng một ý định đặt hàng.

Số đơn cũng không giúp nhận diện: RPC cấp `max(order_no) + 1` cho mỗi đơn mới (`012:761-765`), nên hai lần gửi được hai số khác nhau.

---

## 2. Hai chỗ bản sửa vẫn sai

### 2.1 — Bảng "tạo đơn tại bàn: đã chặn" thiếu điều kiện "đơn đầu vẫn mở"

Guard trong RPC (`012:733-743`) và chỉ mục `orders_store_table_open_idx` (`002_indexes_rls_triggers.sql:70`) **đều chỉ xét `status = 'open'`**. Chúng bảo đảm **một đơn mở trên một bàn tại một thời điểm**; chúng **không** nhận diện một thao tác cũ sau khi đơn đã đóng.

Diễn biến vẫn được phép:

1. Máy A tạo đơn tại bàn, mất phản hồi.
2. Máy B thấy đơn và thanh toán toàn bộ. Đơn chuyển `paid`, bàn được giải phóng.
3. Máy A nhập lại đơn với các UUID mới.
4. Bàn hiện không còn đơn mở, nên yêu cầu tạo mới **qua được cả guard lẫn chỉ mục**.

Kết quả: một đơn trùng nội dung, chưa thanh toán, nằm lại trên bàn.

Đã kiểm lại độc lập bằng cách đọc cả hai điều kiện. **Xác nhận đúng.**

Vì vậy câu ở `04` rằng ca thủng "thu hẹp lại còn tải lại trang rồi nhập lại đơn mang đi" **vẫn quá hẹp**. Kết luận vòng một cũng phải được hiểu kèm điều kiện này.

### 2.2 — `proposal.md` còn giữ ba lập luận đã bị bác

Giữ bản sai **có chú thích** trong hồ sơ review là hợp lý — đó là dấu vết của quá trình. Nhưng `proposal.md` là tài liệu **dùng để triển khai**, nên nó cần một lập luận hiện hành thống nhất, không để đoạn mới và đoạn cũ phủ định nhau.

| Chỗ | Sai gì |
| --- | --- |
| Phần Why | Suy thẳng từ "adapter sinh định danh mới" sang "gọi lại tạo bản ghi thứ hai", bỏ qua các lớp chặn đã xác nhận |
| Nguyên tắc phân loại | Giữ "chỉ thao tác không bình thường hóa mới cần khóa", trong khi lý do giữ `void_order` ngay dưới đó lại dùng **nhu cầu xác nhận kết quả** — hai luật mâu thuẫn |
| Quyết định 6 | Suy từ `queries.retry: false` ra "hệ đang không tự thử lại gì cả" |

Chỗ thứ ba đã kiểm lại: `src/app/AppProviders.tsx:31-36` đặt `retry: false` **chỉ trong khối `queries`**, không có khối `mutations`. Kết luận về hành vi tình cờ vẫn đúng vì TanStack Query mặc định không thử lại mutation, nhưng **suy luận thì sai** — và lập luận là thứ sẽ bị hỏi khi bảo vệ khóa luận.

Cả ba đã được sửa trong `proposal.md` ngày 07/09/2026.

---

## 3. "Cùng một thao tác" là gì — đã có định nghĩa

Đây là câu quan trọng nhất của vòng hai, và nó đã được trả lời.

> **Một thao tác là một lần người dùng xác nhận một lệnh nghiệp vụ cụ thể. Hệ thống cấp định danh cho lần xác nhận ấy và lưu nội dung lệnh trước khi gửi. Mọi lần thử lại của thao tác sử dụng cùng định danh và cùng nội dung đã lưu.**

Ba thành phần có vai trò riêng, không thay thế nhau:

| Thành phần | Vai trò |
| --- | --- |
| Khóa `K` | Nhận diện **lần xác nhận cụ thể** |
| Payload đã chốt | Ghi rõ lần xác nhận đó yêu cầu làm gì |
| So sánh payload | Phát hiện việc dùng nhầm `K` cho nội dung khác |

**Không dùng hash nội dung làm định danh thao tác.** Hai lần xác nhận giống hệt nhau vẫn có thể là hai thao tác hợp lệ — khách gọi thêm đúng món cũ. AWS cũng phân biệt định danh do caller cấp với việc suy đoán thao tác trùng từ tham số.

### Mâu thuẫn ở tài liệu `05` được giải như thế nào

Mâu thuẫn không nằm ở điều kiện 2. Nó nằm ở **bước dựng lại payload từ màn hình hiện tại**:

| Thành phần | Trước polling | Sau polling |
| --- | --- | --- |
| Dữ liệu đơn để hiển thị | 5 ly, version 5 | 4 ly, version 6 |
| Lệnh đang chờ mang khóa `K` | Trả 1 ly, version 5, các UUID đã cấp | **Giữ nguyên** |

Lệnh không đổi. Chỉ có màn hình đổi. Việc dựng lại payload từ màn hình chính là **hành vi cần thay đổi trong change này**.

**"Thử lại" phải lấy lệnh đã lưu.** Nó không được chạy lại bước chọn RPC, không clamp lựa chọn, không lấy version mới, không sinh UUID mới.

Điều kiện "cùng khóa khác payload thì từ chối" **vẫn đúng và vẫn cần giữ**. Nó chính là thứ phát hiện khi phần mềm vô tình biến "trả lại 1 ly đã xác nhận" thành "trả toàn bộ phần còn lại". Cơ chế này cũng là cách Stripe kiểm tham số cùng khóa.

### Hệ quả về mặt tổ chức mã

Flow phải tách làm hai bước: **chuẩn bị lệnh một lần**, và **gửi lệnh đã chuẩn bị**. Đây là phần cốt lõi của chống trùng, độc lập với việc có làm ngoại tuyến hay không.

---

## 4. Máy chủ xử lý thế nào khi nhận version cũ

Trong thời hạn bảo đảm lưu khóa, sau khi đồng bộ các request cùng khóa:

| Tình trạng tại server | Xử lý lệnh `K` với payload gốc |
| --- | --- |
| `K` đã áp dụng | **Trả kết quả đã lưu, trước khi xét version hiện tại** |
| `K` chưa áp dụng, version gốc còn khớp | Thực hiện và lưu kết quả trong cùng giao dịch |
| `K` chưa áp dụng, máy khác đã đổi version | Trả xung đột; **không tự sửa lệnh** để áp dụng trên dữ liệu mới |
| `K` đi kèm nội dung khác | Từ chối lần gửi sai nội dung |

Nhờ dòng đầu, nếu lần đầu đã thanh toán thành công thì **version 5 gửi lại vẫn lấy được kết quả cũ**; nó không rơi vào guard version 6. Đây chính là điều kiện 4 của vòng một: tra phát lại **trước** guard version, **sau** kiểm tra quyền.

Hai quy tắc kèm theo:

- Gặp lỗi khác payload thì **đừng xóa thao tác `K` và đừng cấp khóa mới**. Giữ bản gốc để gửi lại đúng, hoặc tra kết quả theo `K`. Lỗi của một lần gửi sai nội dung **không chứng minh** thao tác ban đầu thất bại.
- Một lần tra chưa thấy khóa **chưa đủ** để kết luận "chưa áp dụng" — request đầu có thể vẫn đang chạy. Đây là lý do việc đồng bộ các request cùng khóa và commit nguyên tử vẫn bắt buộc.

---

## 5. Câu A, B, C: trạng thái sau vòng hai

### Câu A — lưu bền cái gì, ở đâu

Bản tối thiểu lưu **lệnh đã chuẩn bị để gửi**:

- Khóa thao tác và cửa hàng.
- Loại thao tác đã chọn: `pay_order`, `pay_order_items`, `submit_order_changes`, `void_order`.
- Payload nghiệp vụ thực sự gửi xuống: ID đơn, nhân viên, version gốc, tiền khách đưa, các dòng được chọn, **cùng toàn bộ UUID đã sinh**.
- Phiên bản định dạng bản lưu và thời điểm tạo, để nhận biết bản cũ khi nâng cấp ứng dụng.

**Không** lưu toàn bộ query cache hoặc nguyên `OrderDetail`. Có thể lưu thêm phần tóm tắt để người dùng nhận ra thao tác đang chờ, nhưng **không dùng nó để dựng lại request**.

Nơi lưu: **`localStorage`**, phân biệt bằng cửa hàng và khóa thao tác, chỉ vài bản ghi chờ. Vẫn phải xử lý trường hợp trình duyệt chặn lưu trữ.

`sessionStorage` — đề xuất cũ ở tài liệu `03` — chỉ đủ nếu chốt phạm vi là **chỉ khôi phục qua reload trong cùng tab**. Nó **không** đáp ứng thêm yêu cầu đóng rồi mở lại trình duyệt. Việc xác định cần lưu payload **chưa tự quyết định** thời gian lưu phía client; đó là hai câu tách rời.

Giao diện: giữ retry thủ công. Khi kết quả chưa rõ, hiển thị thao tác đang chờ kèm nút **"Thử lại thao tác đã xác nhận"**, và **chặn tạo thao tác mới trên cùng đơn từ luồng đó** cho tới khi xử lý xong.

Ngoài phạm vi: hàng đợi ngoại tuyến tổng quát, worker đồng bộ, cơ chế phối hợp nhiều thiết bị.

### Câu B — đã chốt

Phương án A (phát lại kết quả), với hợp đồng: kết quả phát lại mô tả **thao tác lịch sử**; trạng thái hiện tại lấy bằng truy vấn riêng. Bảng ở mục 4 là hợp đồng đầy đủ.

### Câu C — hoãn có chủ ý

**Chưa làm job xóa.** Việc phải làm trước là định nghĩa **thao tác quá hạn khóa thì xử lý ra sao**. Trong giai đoạn chưa vận hành thật, hoãn dọn có theo dõi dung lượng là cách giảm phạm vi hợp lý; không cần thêm cron chỉ để chốt đủ ba câu.

Việc này cũng gỡ luôn nỗi lo ở tài liệu `03` về `pg_cron` — không cần biết nó có bật hay không mới ra được quyết định.

---

## 6. Lỗ hổng `NULL`: sửa trong đợt này

Vòng một đề nghị tách change riêng. **Vòng hai rút lại đề nghị đó** với lý do: độc lập về logic không bắt buộc phải trở thành một đợt công việc riêng.

Lý lẽ: đây là lỗi của điều kiện kiểm tra **tại database**. Giao diện gọi chính các RPC ấy qua Supabase (`src/adapters/supabase/paymentRepo.ts:24`), nên "chưa mở cho ai gọi trực tiếp" **không phải một lớp bảo vệ riêng**.

Phạm vi kiểm phải gồm cả bốn RPC:

| Nhánh | Yêu cầu |
| --- | --- |
| `submit_order_changes`, đơn có sẵn (`012:638`) | Từ chối version `NULL` |
| `pay_order` (`012:1070`) | Từ chối version `NULL` |
| `pay_order_items` (`012:147`) | Từ chối version `NULL` |
| `void_order` (`011:158`) | Từ chối version `NULL` |
| `submit_order_changes`, **đơn mới** (`012:714`) | **Vẫn phải chấp nhận `NULL`** — hợp đồng hiện tại bắt buộc `NULL`, và đã raise nếu khác `NULL` |

Cách làm: commit và kiểm thử riêng, nhưng **làm ngay trong đợt này**, trước khi coi luồng order/payment đã đạt kiểm tra tính đúng đắn. Không cần xử lý như sự cố production vì hệ chưa vận hành thật.

---

## 7. Danh sách phép kiểm ưu tiên

Do người đánh giá đề xuất, đủ sát rủi ro hiện tại để làm trước khi mở rộng sang ngoại tuyến:

1. Mất phản hồi rồi polling đổi lựa chọn — cả ba biến thể ở mục 1b.
2. Reload rồi gửi lại **đúng lệnh đã lưu**.
3. Hai request đồng thời cùng khóa.
4. Cùng khóa, khác payload.
5. Version `NULL` ở từng nhánh yêu cầu version.

Cộng ca mới phát hiện ở mục 2.1: tạo đơn tại bàn, mất phản hồi, máy khác thanh toán xong, rồi nhập lại.

---

## 8. Còn lại gì chưa chốt

| Việc | Trạng thái |
| --- | --- |
| Định nghĩa "một thao tác" | **Chốt** — mục 3 |
| Hợp đồng máy chủ khi gặp khóa cũ | **Chốt** — mục 4 |
| Câu A: lưu gì, lưu đâu | **Chốt** — mục 5 |
| Câu B | **Chốt** — phương án A kèm hợp đồng |
| Câu C: thời hạn và dọn | **Hoãn có chủ ý**, cần định nghĩa thao tác quá hạn trước |
| Lỗ hổng `NULL` | **Chốt** — làm trong đợt này |
| Quyết định 1 của trang chọn ngoại tuyến | **Chưa xét lại.** Tiền đề đã đổi hai lần: có chỉ mục duy nhất, nhưng chỉ áp khi đơn còn mở |
