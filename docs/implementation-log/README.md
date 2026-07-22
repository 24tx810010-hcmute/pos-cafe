# Implementation Log

## Folder Này Chứa Gì

Folder này ghi nhật ký implement theo phase. Mục tiêu là track nhanh nhánh/commit/tính năng/test/gap mà không phải đọc code hoặc lần lại toàn bộ lịch sử Git trước.

## Khi Nào Nên Đọc

- Khi cần biết phase nào đã xong, phase nào còn gap.
- Khi viết báo cáo tiểu luận và cần timeline implement.
- Khi chuẩn bị làm tiếp một phase mới.
- Khi cần đối chiếu docs với `main`.

## Cách Đọc

1. Đọc [../phase-scope.md](../phase-scope.md) để biết scope.
2. Đọc phase log tương ứng bên dưới.
3. Nếu cần kiểm chứng sâu, mở commit/branch trong Git hoặc đọc archive spec được link.

## Phase Logs

- [phase-01-foundation.md](phase-01-foundation.md): nền schema, session, ports/adapters, seed.
- [phase-02-product-tracks.md](phase-02-product-tracks.md): POS/admin product tracks.
- [phase-03-integration.md](phase-03-integration.md): nối UI với logic/adapters, Supabase/realtime.
- [phase-04-demo-hardening.md](phase-04-demo-hardening.md): hardening demo, loading/error/empty/stale states.
- [phase-05-ui-redesign.md](phase-05-ui-redesign.md): Tailwind-first UI rework và shared portal primitives.
- [phase-06-architecture-ui-hardening.md](phase-06-architecture-ui-hardening.md): architecture boundary guard, adapter split và drawer overlay/motion.
- [phase-07-shell-floor-cleanup.md](phase-07-shell-floor-cleanup.md): `LeftNav` extraction/redesign, workspace overlay offsets và floor toolbar cleanup.
- [phase-08-payment-cashier-redesign.md](phase-08-payment-cashier-redesign.md): Payment Drawer redesign cho thu ngân, responsive landscape và tùy chọn in hóa đơn.
- [phase-09-menu-image-upload.md](phase-09-menu-image-upload.md): Menu Editor redesign và upload ảnh món qua Supabase Storage.
- [phase-10-order-history-responsive.md](phase-10-order-history-responsive.md): Order History redesign 2 cột responsive và payment snapshot cho tiền khách đưa/tiền thừa.
- [phase-11-blank-store-optional-seed.md](phase-11-blank-store-optional-seed.md): store trống mặc định, seed dữ liệu mẫu tùy chọn (checkbox lúc tạo + Settings) và dọn dữ liệu giả hardcode.
- [phase-12-report-redesign.md](phase-12-report-redesign.md): Report redesign sang dashboard master/detail (rail trái doanh thu + nav, pane phải chi tiết), look Tremor dựng bằng Tailwind/Recharts.
- [phase-13-receipt-print-popup.md](phase-13-receipt-print-popup.md): giả lập in đơn bằng popup (phiếu tạm tính + hoá đơn, template 80mm dùng chung), in lại từ Lịch sử; UI-only, giữ seam IPrintPort.
- [phase-14-kitchen-ticket-optimistic-print.md](phase-14-kitchen-ticket-optimistic-print.md): "Gửi đơn" in phiếu gửi bếp các món mới thêm (diff theo nội dung), bỏ window.open, in từ dữ liệu local + invalidate fire-and-forget.
- [phase-15-realtime-hardening.md](phase-15-realtime-hardening.md): chốt accuracy-first online-only/refetch-only (ADR), realtime tự lành khi reconnect (resync on SUBSCRIBED), SLA hội tụ ≤5s.
- [phase-16-shared-modifiers.md](phase-16-shared-modifiers.md): modifier (size/topping) dùng chung nhiều-nhiều + popup chọn ở màn order + số lượng modifier; bảng nối `menu_item_option_groups`, `order_item_options.quantity`, migration wipe + rework.
- [phase-17-floor-editor-transform-handles.md](phase-17-floor-editor-transform-handles.md): Floor Editor thêm handle kéo trực tiếp để resize/xoay object đang chọn (bàn + decor); handle nằm ngang dưới object, không xoay theo object, giữ changeset layout hiện có.
- [phase-18-instant-pay.md](phase-18-instant-pay.md): instant pay — chọn món/số lượng để TÁCH thành đơn mới độc lập và thanh toán ngay (`Chọn tất cả` mặc định = trả cả bàn); bill trả trước mang số nhỏ hơn (đơn tách kế thừa order_no, đơn gốc nhận số mới); RPC `pay_order_items` (migration 010, thay mô hình partial-cùng-đơn của 009).
- [phase-19-void-paid-order.md](phase-19-void-paid-order.md): hủy đơn đã thanh toán từ Lịch sử với quyền `order.voidPaid`, lý do/audit, optimistic lock; đơn void bị loại khỏi doanh thu nhưng giữ payment để đối soát, Report có `voidCount`/`voidAmount` (migration 011).
- [phase-20-employee-permissions.md](phase-20-employee-permissions.md): editor quyền hiệu lực theo từng nhân viên; enforce 5 quyền tạo/sửa/hủy đơn mở, thanh toán và hủy đơn paid ở flow/UI/RPC guardrail (migration 012).
- [phase-21-floor-decor-assets.md](phase-21-floor-decor-assets.md): đưa catalog 9 texture tường + 131 ảnh trang trí vào Floor Editor/POS, có popup chọn/đổi mẫu và fallback cho asset key legacy.

## Template Duy Trì

Mỗi phase log dùng cùng cấu trúc:

- Mục tiêu phase.
- Branch/commit liên quan.
- Feature đã implement.
- Test/build/smoke đã chạy.
- Quyết định kỹ thuật phát sinh.
- Gap còn lại.
- Link docs/spec liên quan.

## Quy Tắc Duy Trì

- Cập nhật log khi merge/pull một phase lớn vào `main`.
- Không ghi phỏng đoán; nếu chưa kiểm chứng thì ghi là gap/rủi ro.
- Code là source-of-truth cuối cùng; log giúp định hướng và truy vết.
