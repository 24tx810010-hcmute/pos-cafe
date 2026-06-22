# Phase 07 - Shell & Floor Cleanup

## Mục Tiêu Phase

Đơn giản hóa app shell và POS floor để UI đúng với thực tế vận hành: left navigation dễ đọc hơn, drawer overlay không che rail và floor view bỏ phần top chrome ít giá trị.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `origin/main` commit `4bf9764` (`refactor(ui): simplify app shell`).
- Nhánh `docs` độc lập, chỉ lưu Markdown knowledge base.

## Feature Đã Implement

- Tách app shell navigation thành `src/app/shell/LeftNav.tsx`.
- Redesign left rail dạng sáng, desktop rộng 176px và compact 68px.
- Left rail hiển thị session card nhân viên/role, module navigation theo nhóm và nút khóa session; bỏ brand/logo copy không cần thiết trong rail.
- Cập nhật `RailButton` để active/disabled/label rõ hơn và có test riêng.
- Cập nhật `PortalDrawer` và `PortalPopup` để workspace viewport bắt đầu sau `LeftNav`, tránh overlay/drawer che navigation.
- POS floor workspace bỏ header/action bar riêng phía trên; nút `Làm mới` chuyển vào toolbar sơ đồ, còn thao tác takeaway đi qua left rail/takeaway drawer.
- Floor status chips chuyển sang class token có thật để tránh Tailwind class không hoạt động.

## Test/Build/Smoke Đã Chạy

- `npm test`: pass 34 files/148 tests.
- `npm run build`: pass; còn Vite chunk-size warning đã biết.
- `npm run smoke`: pass 13 tests, 7 skipped theo smoke config.

## Quyết Định Kỹ Thuật Phát Sinh

- `AppShell` chỉ giữ layout/composition; điều hướng module nằm trong `LeftNav` để dễ đọc và test.
- Drawer/popup dùng offset theo rail thay vì phủ toàn viewport, vì navigation vẫn là anchor thao tác chính khi drawer mở.
- Floor view không giữ nút tạo takeaway nhanh ở top chrome; tạo/quản lý takeaway thuộc `TakeawayDrawer`.

## Gap Còn Lại

- Supabase smoke không chạy lại trong phase này vì thay đổi chỉ nằm ở UI shell/floor, không đổi backend/realtime contract.
- Nếu cần ảnh minh họa Word, tạo screenshot artefact riêng ngoài nhánh `docs`, không commit binary vào docs branch.

## Link Liên Quan

- [../architecture.md](../architecture.md)
- [../features.md](../features.md)
- [../screens.md](../screens.md)
