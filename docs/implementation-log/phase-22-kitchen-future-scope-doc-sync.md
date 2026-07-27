# Phase 22 - Ẩn kitchen khỏi UI và đồng bộ current-truth docs

## Mục tiêu

- Chốt kitchen role/queue là tính năng tương lai, không phải một phần UI vận hành hiện tại.
- Ẩn toàn bộ entry point kitchen nhưng giữ enum/schema/core/component scaffold để phát triển sau.
- Audit và sửa root docs theo code thật ở `main@1b0098b` cùng thay đổi scope này.

## Trạng thái

- Code commit: `1b0098b` (`feat(employees): redesign management settings`).
- Đã push lên `origin/main` trước khi hoàn tất log này.
- Không có database migration.
- Không xóa dữ liệu `kitchen` hiện hữu; UI chỉ lọc và không cho tạo/chọn role này.

## Code đã thay đổi

- `DrawerModule` và `DRAWER_REGISTRY` không còn key kitchen; LeftNav không còn nút Bếp.
- Màn PIN chỉ liệt kê role `admin`/`cashier`.
- Employees Drawer chỉ liệt kê, tạo và sửa hai role hiện hành; employee kitchen cũ bị ẩn.
- Thêm `enabledEmployeeRoles`/`isEmployeeRoleEnabledInUi` làm source of truth cho role UI hiện hành.
- Giữ `employee_role.kitchen`, default permission rỗng, SQL enum và `KitchenQueueDrawer` scaffold cho hướng mở rộng.

## Docs đã đồng bộ

- Kitchen được ghi rõ future-only trong overview, scope, features, screens, architecture, data model, demo và UI context.
- Cập nhật drawer thực tế là full-screen; floor stage là scale-to-fit, chưa có pan/zoom thủ công.
- Cập nhật data model thành 15 bảng, có `menu_item_option_groups` và menu image upload.
- Cập nhật print flow: `BrowserPrintPort` no-op; popup/iframe UI thực hiện preview/browser print.
- Ghi đúng hành vi store trống mặc định trên Supabase và mock seeded fallback khi thiếu env.
- Ghi giới hạn realtime hiện tại: adapter chưa subscribe `menu_item_option_groups`.
- Loại RHF/Zod khỏi danh sách công nghệ đã áp dụng; dependency còn tồn tại nhưng `src` chưa dùng.

## Verification 2026-07-22

- Targeted role/nav/UI tests: 4 files, 26/26 pass.
- `npm test -- --maxWorkers=1`: **48 files, 252/252 tests pass**.
- `npm run build`: pass; còn chunk-size warning đã biết.
- `npm run smoke`: **34 passed, 31 skipped**; admin module smoke xác nhận không còn `nav-kitchen`.

## Giới hạn và hướng tiếp

- Chưa xóa row kitchen cũ khỏi database; khi feature quay lại cần quyết định migration/data activation riêng.
- Kitchen component chưa nối backend và không được tính là màn hình đã implement.
- Realtime link món–modifier vẫn là gap code cần xử lý riêng; phase này chỉ làm docs nói đúng hiện trạng.
