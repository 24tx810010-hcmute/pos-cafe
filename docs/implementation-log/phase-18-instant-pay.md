# Phase 18 - Instant Pay (tách đơn thanh toán riêng theo món)

## Mục tiêu

- Cho phép thanh toán **từng phần theo món/số lượng** trong một bàn (bàn có 2 A + 3 B → trả 1 A + 1 B trước, trả dần cho tới khi hết) — phù hợp quán cafe: mỗi khách trong bàn trả riêng.
- Mặc định vẫn nhanh như cũ: checkbox `Chọn tất cả` bật sẵn khi vào màn thanh toán → một chạm trả cả bàn.
- **Mỗi lần thanh toán là một bill riêng và một ĐƠN riêng** trong lịch sử/report.

## Branch/Commit

- Branch code: `main` (chưa commit tại thời điểm ghi log — cập nhật hash sau khi commit).
- Migrations: `009_partial_payment.sql` (mô hình bản đầu, đã áp lên cloud) → **`010_split_payment.sql`** (mô hình chốt, dọn toàn bộ 009; cần áp sau 009).

## Lịch sử quyết định (pivot giữa phase)

1. **Bản đầu — partial payment trên cùng một đơn** (migration 009): nhiều `payments`/đơn, `order_items.payment_id` đánh dấu món đã trả, `orders.paid_amount` cộng dồn, view `history_entries` cho lịch sử "Lần x/y". Đã implement + verify đầy đủ (mock, UI, Supabase E2E).
2. **Người dùng bác các trade-off** của mô hình đó: report lệch két trong ngày (đơn trả dở còn `open` nên chưa vào report), phải ẩn/đóng băng món đã trả, lịch sử phải chế khái niệm "Lần x/y". Kỳ vọng thật: **hai lần trả trên một bàn là hai đơn hoàn toàn độc lập, không liên quan gì nhau**.
3. **Bản chốt — split-order** (migration 010): thanh toán một phần = tách các món được chọn ra một đơn mới độc lập và pay đơn đó ngay trong cùng transaction. Toàn bộ artifact của 009 (cột, view, error code `ORDER_PARTIALLY_PAID`, logic đóng băng) bị gỡ.

## Mô hình chốt

- **Tách đơn**: `pay_order_items` nhận `newOrderId` (UUID client cấp) + `items: {orderItemId, quantity, splitItemId}`. Món chọn nguyên dòng thì move dòng sang đơn mới; chọn một phần số lượng thì tách dòng (dòng tách thuộc đơn mới, options snapshot copy). Đơn mới `paid` ngay, có payment/thu ngân/giờ riêng; đơn gốc còn lại trên bàn là đơn `open` bình thường, tổng giảm tương ứng, `lock_version` bump.
- **Quy tắc đánh số (yêu cầu cứng của người dùng, có test cover)**: bill trả TRƯỚC mang `order_no` NHỎ hơn — đơn tách **kế thừa** số của đơn gốc, đơn gốc nhận số mới (max+1 theo `business_date`). Bàn #12 trả 2 lần → bill #12, phần còn lại thành #13, bill #13. Hệ quả chấp nhận: phiếu bếp in trước đó mang số cũ trong khi đơn trên bàn đã đổi số; số liền mạch chỉ đảm bảo trong một phiên bàn.
- Chọn đủ 100% đơn → flow đi `pay_order` như cũ (không tách); RPC `pay_order_items` từ chối selection phủ 100%.
- Đơn gốc sau tách sửa/void như mọi đơn (tiền đã thu nằm an toàn ở đơn tách).
- Report/lịch sử không phải đổi gì: đơn tách là đơn `paid` bình thường → **doanh thu vào report ngay từng lần thu**; lịch sử order-centric nguyên bản.

## Đã implement (bản chốt)

### Domain/Ports
- `PayOrderItemsInput` (+`newOrderId`), `PayOrderItemsResult` (đơn tách + `sourceOrderId/sourceOrderNo/sourceTotal/sourceLockVersion`); `OrderDetail.payment` giữ nguyên dạng đơn lẻ; không còn `HistoryEntry`/`paymentId`/`paidAmount`.
- `IPaymentRepo.payOrderItems`; `listOrderHistory` giữ nguyên cho cả Lịch sử lẫn Báo cáo.

### Flow (features/pos)
- `orderFlow.ts`: `buildPayableLines`, `fullSelection`, `clampSelection`, `selectionAmount`, `isFullSelection`; `payOrderItemsAndPrint` trả union `{mode:"full"}|{mode:"split"}` — full → `pay_order`, partial → `pay_order_items`.

### UI
- `PaymentSummaryPane`: danh sách chọn món (`Chọn tất cả` mặc định + checkbox dòng + chip `n/tổng` + nút `+` xoay vòng), summary có `Thanh toán lần này`.
- `PaymentDrawer`: partial success → toast `Đã tách và thanh toán đơn #N (X). Bàn còn Y.`, drawer mở tiếp, selection reset về `Chọn tất cả`; header tự đổi sang số mới của đơn gốc sau refetch. Selection clamp theo lock_version khi máy khác sửa đơn.
- Giỏ hàng/Lịch sử: không đổi so với trước phase (đơn gốc và đơn tách đều là đơn thường).

### Adapters + DB
- Mock: `payOrderItems` tách đơn + swap orderNo (`nextOrderNo`); orderRepo/mockData như nguyên bản.
- Supabase: `payOrderItems` gọi RPC `pay_order_items` (010) với `p_new_order_id`; mappers/selects nguyên bản.
- Migration `010_split_payment.sql`: drop view `history_entries` + cột `payment_id`/`paid_amount`; `submit_order_changes`/`pay_order` trở về đúng bản 008; RPC `pay_order_items` mới (2 lượt validate/mutate, swap order_no trước khi insert đơn tách để thoả unique `(store, business_date, order_no)`).

### Tests
- Mock adapter: tách đơn độc lập (đơn tách paid + payment riêng, đơn gốc mở với phần còn lại, bàn vẫn occupied); **test đánh số**: 3 lần trả → bill #24 → #30 → #31 tăng đúng thứ tự thanh toán; đơn tách vào history/report NGAY; đơn gốc void được sau tách; validate (over-qty/dup/empty/full-selection/low-cash/version-conflict).
- Flow: rẽ nhánh full/split; draft đơn gốc hoạt động như đơn thường.
- Component `instantPay.test.tsx`: select-all → payOrder + đóng drawer; partial → payOrderItems (có `newOrderId`) + drawer mở + selection reset.
- Đã verify trực quan trên mock: bill 1 mang #24, đơn gốc thành #30, bill 2 mang #30; lịch sử 2 đơn độc lập.
- Supabase E2E có scenario split (kèm assert số bill #1 → #2) — **cần áp `010_split_payment.sql` lên cloud trước khi chạy**.

## Lưu ý vận hành

- **Phải áp `010_split_payment.sql`** (sau 009) lên Supabase: đổi chữ ký RPC `pay_order_items`, drop view/cột 009. Mock mode đầy đủ tính năng không cần migration.
- Realtime không cần đổi: đơn tách insert vào `orders` (đã publish), đơn gốc bump `lock_version`.
- Muốn biết cả phiên bàn tiêu bao nhiêu phải cộng nhiều đơn — hệ quả chủ đích của "hai đơn không liên quan".
