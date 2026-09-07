# 04 — Đính chính sau đánh giá độc lập

Lập ngày 07/09/2026, sau khi một AI độc lập rà tập tài liệu này đối chiếu `main@7183b31`.

**Kết luận: người đánh giá đúng ở mọi khẳng định kiểm chứng được. Tài liệu `01` có tám lỗi, trong đó ba lỗi làm sai kết luận trung tâm.** Mỗi mục dưới đây đã được kiểm lại độc lập bằng cách đọc mã, không nhận báo cáo suông.

Tài liệu này giữ lại **cả cái sai lẫn cái đúng** thay vì lặng lẽ sửa, vì bản thân việc rà soát bắt được lỗi là một phần đáng ghi của quá trình làm đồ án.

---

## Lỗi 1 — Kết luận "sai dữ liệu chỉ ở tạo đơn mới" là sai

Tài liệu `01` kết luận: đơn tại bàn tạo mới sẽ sinh đơn thứ hai khi bấm lại, vì không có `lock_version` để đối chiếu và `orderId` do adapter sinh mới mỗi lần.

**Sai. Có hai lớp chặn mà tài liệu bỏ sót.**

`supabase/migrations/012_action_permission_guardrails.sql`, trong `submit_order_changes`:

```sql
    if p_table_id is not null and exists (
      select 1
      from public.orders o
      where o.store_id = v_store_id
        and o.table_id = p_table_id
        and o.status = 'open'::public.order_status
    ) then
      raise exception 'ORDER_VERSION_CONFLICT'
        using errcode = 'P0001',
              hint = 'Table already has an open order.';
    end if;
```

`supabase/migrations/002_indexes_rls_triggers.sql` dòng 70:

```sql
create unique index orders_store_table_open_idx on public.orders (store_id, table_id)
  where status = 'open' and table_id is not null;
```

Nguyên nhân sai: khi rà, chỉ tìm `unique` trong `001_schema_enums.sql` và đọc nhầm đoạn trong thân RPC. Chỉ mục nằm ở file `002`, và guard nằm ở nhánh xử lý đơn mới chứ không nằm cạnh phần đối chiếu version.

**Lớp chặn thứ ba, cũng bị bỏ sót:** nếu gửi lại **nguyên giỏ hàng cũ**, các `items[].id` vẫn giữ nguyên. `order_items.id` là khóa chính (`001_schema_enums.sql`: `create table public.order_items ( id uuid primary key, ...)`), nên lần chèn thứ hai vướng trùng khóa và cả giao dịch bị rollback.

### Ca thủng thật sự còn lại

| Ca | Bị chặn chưa | Vì sao |
| --- | --- | --- |
| Gửi lại nguyên yêu cầu cũ | **Có** | `items[].id` trùng khóa chính |
| Đơn **tại bàn** tạo mới, **đơn đầu vẫn mở** | **Có, hai lớp** | Guard trong RPC cộng chỉ mục duy nhất |
| Đơn **tại bàn** tạo mới, **đơn đầu đã đóng** | **Không** | Cả guard lẫn chỉ mục chỉ xét `status = 'open'` — xem tài liệu `06` mục 2.1 |
| Đơn **mang đi** tạo mới, định danh mới | **Không** | `table_id` là `null` nên **cả guard lẫn chỉ mục đều không áp**; định danh mới nên không vướng khóa chính |

Ca thủng thu hẹp lại còn: **tải lại trang rồi nhập lại một đơn mang đi**, vì lúc đó cả UUID đơn lẫn UUID món đều được sinh lại.

> **CÂU TRÊN VẪN QUÁ HẸP — sửa ngày 07/09/2026 sau vòng hai.** Đơn **tại bàn** cũng thủng khi đơn đầu đã đóng: máy A tạo đơn rồi mất phản hồi, máy B thanh toán xong nên bàn được giải phóng, máy A nhập lại thì cả guard lẫn chỉ mục đều không áp vì cả hai chỉ xét `status = 'open'`. Xem [06-ket-qua-vong-hai.md](06-ket-qua-vong-hai.md) mục 2.1.

---

## Lỗi 2 — Bỏ sót một ca lặp nghiệp vụ ở `pay_order_items`, và đây là ca nguy hiểm nhất

Tài liệu `01` kết luận `pay_order_items` "bị chặn" và chỉ còn rủi ro trải nghiệm. **Sai, và sai theo hướng nguy hiểm nhất: nó là ca thu tiền hai lần.**

Diễn biến, đã kiểm từng bước bằng mã:

1. Đơn có 5 ly, `lock_version = 5`. Thu ngân chọn trả 1 ly.
2. Máy chủ tách và ghi thanh toán. Đơn nguồn còn 4 ly, version thành 6. **Phản hồi bị mất.**
3. Polling 5 giây kéo về version 6 (`src/features/pos/usePosData.ts:6`).
4. Giao diện **giữ lại lựa chọn**. `src/app/drawers/pos/PaymentDrawer.tsx:51-60` khi version đổi thì **kẹp** lựa chọn về dữ liệu mới chứ không xóa:

```tsx
const next = sameOrder ? clampSelection(payableLines, previous) : fullSelection(payableLines);
```

5. Thu ngân tưởng lần trước hỏng, bấm lại. `src/features/pos/orderFlow.ts:418-428` sinh **định danh mới** cho cả ba thứ và gửi kèm **version hiện tại**:

```ts
const items: PayOrderItemLine[] = Object.entries(selection).map(([orderItemId, quantity]) => ({
  orderItemId,
  quantity,
  splitItemId: createClientId(),
}));

const result = await ports.payment.payOrderItems({
  paymentId: input.paymentId ?? createClientId(),
  orderId: input.order.id,
  newOrderId: createClientId(),
  ...
  expectedVersion: input.order.lockVersion,
```

6. Version 6 **khớp**, guard cho qua. Một ly nữa bị tách ra và thu tiền.

Kết quả: **hai bản ghi thanh toán trên hai đơn tách, cho một ý định thu tiền duy nhất.**

Điểm quan trọng: khóa lạc quan **không hề bị vi phạm** — version đã tiến một cách hợp lệ. Đây là lý do cơ chế đó không cứu được ca này.

---

## Lỗi 3 — Cách phân biệt "nhiều máy" với "một máy" là sai khung

Tài liệu `01` mục 6 phát biểu: khóa lạc quan chặn nhiều máy, khóa chống trùng chặn một máy gửi lại.

**Khung này sai.** Khung đúng:

| Cơ chế | Nó kiểm cái gì |
| --- | --- |
| Khóa lạc quan | Trạng thái **hiện tại** còn khớp với phiên bản mà thao tác dựa vào không? |
| Khóa chống trùng | Thao tác mang **định danh này** đã được áp dụng chưa? |

Cả hai đều có tác dụng dù có một máy hay nhiều máy. Và ca ở lỗi 2 chứng minh: hai yêu cầu mang **khóa mới và version mới đều hợp lệ** vượt qua cả hai cơ chế, dù con người coi chúng là **cùng một việc**.

---

## Lỗi 4 — Khóa lạc quan có lỗ hổng với `NULL`

Phát hiện mới của người đánh giá, tài liệu gốc không nêu.

Guard thực tế của `pay_order_items` (`012`, dòng 145):

```sql
  if not found
    or v_source.status <> 'open'::public.order_status
    or v_source.lock_version <> p_expected_lock_version then
```

Không có kiểm `NULL` tường minh. Nếu đơn tồn tại, đang mở, và caller truyền `p_expected_lock_version = NULL` thì:

- `not found` cho `false`
- `status <> 'open'` cho `false`
- `lock_version <> NULL` cho **`NULL`**

`false OR false OR NULL` cho `NULL`, và `IF` trong PL/pgSQL **không chạy nhánh khi điều kiện là `NULL`**. Tức **kiểm tra phiên bản bị bỏ qua hoàn toàn**.

Giao diện hiện luôn truyền số, nên ca này không xảy ra qua ứng dụng. Nhưng **gọi RPC trực tiếp thì vượt được**, và kiểu TypeScript không bảo vệ đầu vào database. `submit_order_changes` dùng cách so sánh tương tự.

Hướng xử lý cần xét: kiểm `NULL` tường minh, hoặc dùng `IS DISTINCT FROM` ở những nhánh bắt buộc có version.

**Đây là lỗ hổng độc lập với change đang bàn** và nên được xử lý riêng, không gộp vào phần chống trùng.

---

## Lỗi 5 — "Adapter luôn sinh `paymentId` dự phòng" là sai

Tài liệu `01` mục 3 viết: giao diện chưa bao giờ truyền `paymentId`, nên nhánh `crypto.randomUUID()` trong adapter là nhánh luôn chạy.

**Sai.** `src/features/pos/orderFlow.ts:308`:

```ts
const result = await ports.payment.payOrder({
  paymentId: input.paymentId ?? createClientId(),
```

Tầng nghiệp vụ **có** sinh và truyền `paymentId` xuống. Nhánh dự phòng trong adapter hiếm khi chạy.

Vấn đề thật không phải "adapter tự sinh" mà là **flow sinh một định danh mới ở mỗi lần gọi**. Sai lầm khi rà: chỉ tìm `paymentId` trong `useOrderPaymentFlow.ts` và các thành phần giao diện, không tìm trong `orderFlow.ts`.

---

## Lỗi 6 — "Cả bốn RPC đều có khóa tư vấn theo cửa hàng" là sai

`supabase/migrations/011_void_paid_order.sql` có **0** lần xuất hiện `pg_advisory`. `void_order` dùng khóa hàng:

```sql
  select *
  into v_order
  from public.orders o
  where o.store_id = v_store_id
    and o.id = p_order_id
  for update;
```

Ba hàm kia có khóa tư vấn, `void_order` thì không.

---

## Lỗi 7 — Trích đoạn chứng minh "tạo đơn mới" bị cắt sai chỗ

Tài liệu `01` mục 5 trích nhánh `if p_order_id is null then` để chứng minh máy chủ tạo đơn. Đoạn trích **dừng trước** phần quan trọng: nếu có món mà `p_order_id` là `null` thì máy chủ **từ chối**:

```sql
    raise exception 'INVALID_ORDER_ID'
      using errcode = 'P0001',
            hint = 'New orders must pass a client-generated p_order_id UUID.';
```

Nghĩa là máy chủ **không bao giờ tự sinh định danh đơn**; nó bắt buộc client phải cấp. Đoạn trích như cũ gợi ý điều ngược lại.

---

## Lỗi 8 — Hai khẳng định phụ dùng bằng chứng sai phạm vi

**"Giỏ hàng sống qua việc đóng mở ngăn kéo."** Kho zustand thì còn, nhưng `src/app/drawers/pos/OrderDrawer.tsx:59-64` có effect ghi đè khi mở:

```tsx
useEffect(() => {
  if (context?.orderId && orderQuery.data) {
    setDraftItems(orderDetailToDraft(orderQuery.data));
  }
  if (context && !context.orderId) setDraftItems([]);
}, [context, orderQuery.data, setDraftItems]);
```

Mở đơn mới thì **xóa giỏ**; mở đơn có sẵn thì dựng lại từ dữ liệu máy chủ.

**"Hệ không tự thử lại."** Bằng chứng đưa ra là `queries: { retry: false }` trong `AppProviders.tsx`. Cấu hình đó áp cho **truy vấn**, không áp cho **mutation**. Kết luận tình cờ đúng vì mutation mặc định không thử lại, nhưng bằng chứng sai phạm vi.

---

## Ba điểm về lập luận, không phải về mã

**Câu B — phép loại suy không đủ chặt.** Lập luận "phương án B bắt N chỗ gọi phải nhớ xử lý" **không phải thuộc tính bắt buộc của B**: tín hiệu `already_applied` xử lý tập trung ở adapter được. Người đánh giá đúng.

Lý do tốt hơn để chọn A: **khôi phục kết quả của đúng thao tác đã hoàn tất** — định danh đơn tách, số tiền, biên lai tại thời điểm đó. Trạng thái hiện tại của đơn nguồn có thể đã đổi, nên tải lại không tái dựng được kết quả cũ.

Và khẳng định "refetch đã giải quyết ảnh chụp cũ" **quá mạnh**:

- Invalidation chạy nền và **nuốt lỗi**: `useOrderPaymentFlow.ts:51` — `void invalidateAfterOrderMutation(queryClient, sourceOrderId).catch(() => {})`
- Giao diện dùng **trực tiếp** kết quả trả về, không chờ refetch: `PaymentDrawer.tsx:187` — `openReceiptPreview({ variant: "receipt", doc: result.receipt })`, kèm chú thích trong mã "In bill từ payload trả về ngay trong mutation (không chờ refetch)"

Nên phương án A cần **hợp đồng rõ**: kết quả phát lại mô tả **thao tác lịch sử**, trạng thái hiện tại lấy bằng truy vấn riêng. Nên có dấu hiệu `replayed` và thời điểm áp dụng để giao diện diễn đạt đúng. **Không được hứa "client không phải đổi gì".**

**Câu A — chỉ lưu chuỗi khóa là chưa đủ.** Sau khi tải lại trang, giỏ hàng và ngữ cảnh đều mất. Còn mỗi chuỗi `K` thì ứng dụng **không có cách nào biết** đơn vừa nhập lại có phải thao tác của `K` hay là một đơn mới trùng nội dung.

Cần giữ đủ **thông tin khôi phục thao tác đang chờ**: khóa, cửa hàng, loại thao tác, payload cùng các UUID đã sinh, version gốc, trạng thái xử lý. Hoặc thiết kế một luồng tra cứu kết quả theo khóa.

Thêm một ràng buộc mà tài liệu gốc bỏ sót: **thao tác gửi lại phải giữ nguyên thao tác đã xác nhận.** Flow hiện tính lại lựa chọn và có thể rẽ giữa `pay_order_items` và `pay_order` theo dữ liệu mới.

Và: **timeout chưa phải thất bại vĩnh viễn.** Không được dọn khóa chỉ vì giao diện nhận lỗi mạng.

**Quyết định 4 — tiêu chí không nhất quán.** Lý do loại thao tác quản trị là "đã tự an toàn nhờ id client sinh". **Không đúng.** `src/adapters/supabase/menuRepo.ts:51` cho thấy `saveMenuChanges` thực hiện **nhiều request nối tiếp**, không phải một giao dịch. Tạo category xong mà tạo món hỏng, gửi lại nguyên changeset sẽ lỗi trùng category **trước khi** tới phần chưa hoàn tất.

Vẫn để quản trị ngoài phạm vi được, nhưng lý do đúng là **ưu tiên và giới hạn phạm vi change**, không phải "đã tự an toàn".

Còn `void_order`: lý do "gọi hai lần sinh dấu vết kiểm toán rác" **sai với mã** — lần hai bị guard trạng thái chặn **trước khi** cập nhật các trường kiểm toán (`011:157`). Lý do đủ để giữ nó trong phạm vi là: **sau khi mất phản hồi, caller cần xác nhận thao tác hủy trước đã thành công hay chưa.**

---

## Hiện trạng sau đính chính

| Ca | Bị chặn chưa |
| --- | --- |
| Gửi lại nguyên yêu cầu cũ | **Có** — trùng khóa chính `order_items` |
| Tạo đơn tại bàn, **đơn đầu vẫn mở** | **Có** — guard RPC cộng chỉ mục duy nhất |
| **Tạo đơn tại bàn, đơn đầu đã đóng** | **Không.** Cả hai lớp chỉ xét `status = 'open'` |
| `pay_order` bấm lại | **Có** — `status` không còn `open` |
| `void_order` bấm lại | **Có** — `status` không còn `paid` |
| **Tạo đơn mang đi, định danh mới sau tải lại trang** | **Không** |
| **`pay_order_items` bấm lại sau khi version đã tiến hợp lệ** | **Không. Thu tiền hai lần** |
| **Gọi RPC trực tiếp với `p_expected_lock_version = NULL`** | **Không. Bỏ qua kiểm phiên bản** |

Phát biểu đính chính đúng, thay cho phát biểu cũ:

> Gửi lại **nguyên yêu cầu cũ** thường bị chặn. Bấm lại **sau khi dữ liệu và định danh đã thay đổi** vẫn lặp được nghiệp vụ, và ca nặng nhất là tách đơn thanh toán hai lần.

---

## Bốn điều kiện phải ghi vào thiết kế trước khi triển khai

Do người đánh giá nêu, đã tiếp thu:

1. Khóa gắn với **cửa hàng** và với **đúng payload**.
2. Cùng khóa nhưng **khác payload** thì bị từ chối.
3. Kết quả và thay đổi nghiệp vụ **commit trong cùng một giao dịch**.
4. Việc phát lại được tra **trước** guard version và trạng thái, nhưng **sau** kiểm tra quyền truy cập.

## Hai điểm về câu C

- Lô 10.000 dòng **không bảo vệ được gì** khi ước lượng toàn bảng chỉ 2.800 dòng. Job sai vẫn xóa sạch trong một lượt.
- Không có cron **không phá bảo đảm chống trùng**; nó chỉ làm bảng lớn hơn. **Xóa nhầm khóa mới** là thứ phá bảo đảm. Ràng buộc đề xuất ban đầu đã đặt trọng tâm sai chỗ.
- Cần quy định rõ: thao tác **quá hạn khóa** thì bị từ chối, hay đối chiếu, hay xử lý thế nào. Chỉ so sánh với thời gian ngoại tuyến dự kiến là chưa đủ.

## Ảnh hưởng lan sang quyết định khác

Quyết định số 1 trong trang chọn của change `add-offline-data-layer` — *"Hai máy cùng ngoại tuyến, cùng tạo đơn mới cho bàn 5"* — đã được trả lời dựa trên kết luận **sai** rằng không có ràng buộc duy nhất trên "một bàn một đơn mở".

Thực tế có **chỉ mục duy nhất** `orders_store_table_open_idx`. Nên phương án "cả hai đơn cùng lên" **không khả thi như đã mô tả**: đơn thứ hai sẽ vướng chỉ mục. Quyết định đó phải xét lại trước khi viết spec cho nhóm ngoại tuyến.
