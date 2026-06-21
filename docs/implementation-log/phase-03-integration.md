# Phase 03 - Integration

## Mục Tiêu Phase

Nối UI với logic/adapters thật, kiểm chứng Supabase mode, realtime invalidation và flow chính trên app tích hợp.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `main` commit `ef3ecdb`.
- Archive note chính: `docs/archive/superpowers/specs/2026-06-12-pos-cafe-integration-checklist.md`.
- Archive phase status: `docs/archive/superpowers/specs/2026-06-11-pos-cafe-parallel-task-phases.md`.

## Feature Đã Implement

- UI binding vào ports/hooks thay vì chỉ mock UI.
- Supabase adapter cho auth, employee, menu, floor, order, payment, report, settings, seed, print, realtime.
- Realtime invalidation cho menu/floor/orders/report.
- Supabase cloud setup và migration realtime publication.
- Smoke E2E cho Supabase/realtime theo checkpoint archive.

## Test/Build/Smoke Đã Chạy

- Archive ghi nhận phase integration đã hoàn tất với `npm run build`, `npm run test`, mock smoke và Supabase realtime smoke.
- Realtime E2E đã pass sau khi migration `004_realtime_publication.sql` được apply lên Supabase cloud.

## Quyết Định Kỹ Thuật Phát Sinh

- Realtime không patch state thủ công; chỉ invalidate/refetch.
- Supabase adapter giữ side-effect và mapper ở adapter layer.
- UI giữ stable `data-testid` để smoke tests bền hơn.

## Gap Còn Lại

- Live deploy cần wake/check trước demo vì Supabase free tier có thể pause.
- Offline-first không nằm trong phase này.
- Multi-device sync được chứng minh trong online-only scope, không claim offline behavior.

## Link Liên Quan

- [../architecture.md](../architecture.md)
- [../tech-stack.md](../tech-stack.md)
- [../demo-runbook.md](../demo-runbook.md)
