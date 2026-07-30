# Phase 22 - Redesign Employees Drawer, ẩn kitchen và đồng bộ current truth

## Mục tiêu

- Chốt kitchen role/queue là tính năng tương lai, không phải một phần UI vận hành hiện tại.
- Ẩn toàn bộ entry point kitchen nhưng giữ enum/schema/core/component scaffold để phát triển sau.
- Redesign màn quản lý nhân viên thành danh bạ–chi tiết hai pane, phù hợp desktop và landscape nhỏ.
- Audit và sửa root docs theo code thật ở `main@1b0098b` cùng thay đổi scope này.

## Trạng thái

- Code commit: `1b0098b` (`feat(employees): redesign management settings`).
- Đã push lên `origin/main` trước khi hoàn tất log này.
- Không có database migration.
- Không xóa dữ liệu `kitchen` hiện hữu; UI chỉ lọc và không cho tạo/chọn role này.

## Code đã thay đổi

- Employees Drawer dùng split layout: pane trái danh bạ/filter/count, pane phải hồ sơ, quyền, PIN và action save.
- Tự chọn nhân viên đầu tiên; filter gồm Tất cả/Quản lý/Thu ngân/Tạm khoá; row inactive vẫn có thể mở để kích hoạt lại.
- Trạng thái đăng nhập dùng switch trong form; quyền dùng switch và action trở về mặc định vai trò; reset PIN inline.
- Dirty confirm khi đổi nhân viên/tạo mới; không cho tự tạm khoá tài khoản đang đăng nhập hoặc hạ role/khóa admin active cuối.
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

## Verification ghi nhận khi docs sync 2026-07-27

- Targeted role/nav/UI tests: 4 files, 26/26 pass.
- `npm test -- --maxWorkers=1`: **48 files, 252/252 tests pass**.
- `npm run build`: pass; còn chunk-size warning đã biết.
- `npm run smoke`: **34 passed, 31 skipped**; admin module smoke xác nhận không còn `nav-kitchen`.

## Giới hạn và hướng tiếp

- Chưa xóa row kitchen cũ khỏi database; khi feature quay lại cần quyết định migration/data activation riêng.
- Kitchen component chưa nối backend và không được tính là màn hình đã implement.
- Realtime link món–modifier vẫn là gap code cần xử lý riêng; phase này chỉ làm docs nói đúng hiện trạng.
