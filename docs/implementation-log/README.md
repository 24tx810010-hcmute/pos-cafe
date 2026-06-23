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
