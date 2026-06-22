# Phase 05 - UI Redesign

## Mục Tiêu Phase

Rework thẩm mỹ và UX cho POS core: floor view, order drawer, payment drawer, takeaway và các drawer/admin surface thường gặp. Phase này giữ nguyên behavior nghiệp vụ, domain model và backend contract.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `origin/main` commit `4bf9764`.
- UI redesign context: `docs/ui-redesign-context.md`.
- Snapshot cũ đã archive: `docs/archive/superpowers/ui-redesign-handoff/2026-06-20-main-flow-snapshot.md`.

## Feature Đã Implement

- Tailwind-first visual pass cho app shell, POS floor, order/payment/takeaway và nhiều drawer admin.
- Two-column/three-zone drawer layout rõ hơn cho thao tác POS.
- Shared portal primitives: `PortalPopup` cho popup/modal và `PortalDrawer` cho drawer.
- Drawer hiện có overlay mặc định `rgba(0,0,0,0.2)`, click overlay để đóng và slide-in animation theo placement.
- Giữ stable `data-testid`, UI text chính và behavior nghiệp vụ.

## Test/Build/Smoke Đã Chạy

- `npm test` pass trên `origin/main@4bf9764`: 34 test files, 148 tests.
- `npm run build` pass; còn Vite chunk-size warning đã biết.
- `npm run smoke` pass: 13 passed, 7 skipped.
- `npm run smoke:supabase` pass: 2 passed, gồm case realtime hai browser.

## Quyết Định Kỹ Thuật Phát Sinh

- Popup/drawer là app UI primitives, đặt ở `src/app/components`.
- `createPortal` dùng nội bộ trong component, không export helper portal công khai.
- Drawer dùng workspace viewport sau `LeftNav` để không che left rail.
- Exit animation được để backlog vì hiện tại drawer unmount theo app state.

## Gap Còn Lại

- Exit animation khi đóng drawer/popup là polish optional.
- Một số drawer lớn có thể tiếp tục tách component/hook khi có boundary rõ hơn.
- Screenshot binary không còn lưu trên nhánh `docs`; nếu cần đưa vào báo cáo thì chụp/lưu ở artefact riêng.

## Link Liên Quan

- [../ui-redesign-context.md](../ui-redesign-context.md)
- [../screenshots/README.md](../screenshots/README.md)
- [../screens.md](../screens.md)
