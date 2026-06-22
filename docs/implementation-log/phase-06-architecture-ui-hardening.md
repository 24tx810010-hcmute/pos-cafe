# Phase 06 - Architecture & UI Hardening

## Mục Tiêu Phase

Khóa boundary kiến trúc, tách adapter/repo theo concern, chuẩn hóa portal overlay/drawer và cập nhật verification sau khi merge về `main`.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `origin/main` commit `4bf9764` (`refactor(ui): simplify app shell`).
- Các nhánh đã tích hợp vào `main`: `refactor-folder-architecture`, `refactor-portal-overlays`, `fix-drawer-overlay-close`.
- Nhánh `docs` độc lập, chỉ lưu Markdown knowledge base.

## Feature Đã Implement

- Architecture boundary guard dùng TypeScript AST scanner, bắt `import`, `export ... from` và dynamic `import(...)`.
- Layer contract rõ cho `domain`, `core`, `ports`, `features`, `adapters`, `app` và `seed`.
- `PortsContext` chuyển khỏi `src/ports` sang `src/features/shared/portsContext.tsx`; `src/ports` giữ interface/type-only.
- Browser print adapter tách khỏi Supabase adapter.
- Supabase adapter/repo và mock adapter được tách theo concern gần với port shape.
- Generic draft helpers được đưa về `src/features/admin/draftUtils.ts`.
- `PortalPopup` và `PortalDrawer` được thêm làm shared app UI primitives.
- Drawer overlay/click-close/slide-in đã áp dụng cho các drawer đã migrate trong pass đầu.

## Test/Build/Smoke Đã Chạy

- `npm test`: pass 34 files/148 tests.
- `npm run build`: pass; chỉ còn Vite chunk-size warning đã biết.
- `npm run smoke`: pass 13 tests, 7 skipped theo smoke config.
- `npm run smoke:supabase`: pass 2 tests, gồm flow Supabase realtime hai browser cùng một store.

## Quyết Định Kỹ Thuật Phát Sinh

- Architecture violations do scanner bắt được phải sửa bằng refactor, không allowlist bừa.
- Chỉ `src/app/runtimePorts.ts` compose concrete adapters.
- `src/seed` được xem là shared fixture layer, không phải mock-only implementation.
- Portal component tự quản lý `createPortal`; consumer chỉ biết `PortalPopup`/`PortalDrawer`.

## Gap Còn Lại

- Kitchen queue backend thật vẫn là backlog khi có yêu cầu dữ liệu bếp thật.
- Bundle-size warning sau build là backlog tối ưu bundle/code-splitting.
- Exit animation khi đóng drawer/popup là polish optional.
- Nếu cần ảnh cho tiểu luận, tạo screenshot artefact riêng thay vì commit binary vào nhánh `docs`.

## Link Liên Quan

- [../architecture.md](../architecture.md)
- [../tech-stack.md](../tech-stack.md)
- [../screens.md](../screens.md)
