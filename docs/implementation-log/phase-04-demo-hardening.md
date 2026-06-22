# Phase 04 - Demo Hardening

## Mục Tiêu Phase

Làm app đủ ổn để demo: xử lý loading/error/empty/blocked states, stale payment, clear demo safety, copy polish và smoke checklist.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `origin/main` commit `4bf9764`.
- Archive status chính: `docs/archive/superpowers/specs/2026-06-11-pos-cafe-parallel-task-phases.md`.
- Demo runbook cũ: `docs/archive/superpowers/specs/2026-06-14-pos-cafe-demo-readiness-runbook.md`.

## Feature Đã Implement

- Payment stale/closed order state disable action.
- Active refetch/polling recovery cho floor/open orders/order detail trong stale cases.
- Clear demo dialog có loading/error/blocked/confirm states.
- Loading/error/empty states cho payment/order/floor/takeaway/settings/menu/floor editor/report/history.
- Copy cleanup để giảm từ nội bộ trong UI demo.
- PrintPort receipt layout phase được ghi nhận ở `2026-06-19-virtual-printer-receipt-layout.md`.

## Test/Build/Smoke Đã Chạy

- Archive ghi nhận các validation pass trước push: targeted tests, full `npm run test`, `npm run build`, Supabase build, mock smoke, Supabase realtime smoke và `git diff --check`.
- Code hiện tại có `demoHardening.test.tsx` và `demoCopyPolish.test.tsx` cho các states/copy quan trọng.

## Quyết Định Kỹ Thuật Phát Sinh

- Payment drawer phải phản ứng khi order đã paid ở máy khác.
- Clear demo phải block nếu còn open orders.
- Print receipt vẫn là browser HTML preview, không native printer.

## Gap Còn Lại

- UI tổng thể đã có redesign pass; còn lại là polish theo feedback demo.
- Một số optional/admin screen vẫn cần polish hoặc hide/reframe trong demo nếu chưa giải thích scope.
- Report cần dữ liệu live hoặc empty state tốt để không nhìn như chưa hoàn thiện.

## Link Liên Quan

- [../demo-runbook.md](../demo-runbook.md)
- [../ui-redesign-context.md](../ui-redesign-context.md)
- [../screens.md](../screens.md)
