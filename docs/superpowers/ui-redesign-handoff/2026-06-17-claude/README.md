# POS Cafe UI Redesign Handoff - 2026-06-17

Folder này là bộ yêu cầu để đưa cho một AI khác, ví dụ Claude, thực hiện phase polish/redesign UI. Đây là docs-only branch; không implement UI trong branch `docs`.

## Mục Tiêu

Làm lại UI để demo POS Cafe trong tình trạng chuyên nghiệp hơn, dễ thao tác hơn, và không còn cảm giác prototype/debug/admin panel ghép lại. Scope là UI/UX polish trên code hiện có, không viết lại business logic.

## Cách Sử Dụng Folder Này

1. Đưa toàn bộ folder này cho AI implementer.
2. Bắt AI đọc file này trước, sau đó đọc `00-claude-entrypoint.md`, `01-global-redesign-rules.md`, `02-implementation-map.md`, và file screen cần làm.
3. Implement trong code worktree/branch riêng được tạo từ `main`, không làm trên `docs`.
4. Không merge branch UI vào `main`; chủ dự án sẽ tự review và merge sau.
5. Sau mỗi nhóm screen, chạy test/build/smoke theo `implementation/02-testing-checklist.md`.
6. Không squash merge nếu user yêu cầu giữ lịch sử commit.

## Branch Policy Cho Implementer

Implementer phải tạo branch riêng từ `main` trước khi sửa UI:

```powershell
cd D:\Workspace\pos-cafe
git switch main
git pull --ff-only origin main
git switch -c ui-redesign-<scope>
```

Quy tắc:

- Không dùng branch `main` để sửa trực tiếp.
- Không dùng branch `docs` để implement UI.
- Không tạo branch có chữ `codex`.
- Không merge vào `main` sau khi làm xong; chỉ push branch UI và báo lại cho chủ dự án.
- Nếu worktree đang dirty với thay đổi không phải của implementer, dừng lại và báo user.

## Current Code Context

- Code branch đã merge UI copy polish vào `main` ngày 2026-06-17.
- UI source chính: `src/app/App.tsx`.
- CSS chính: `src/styles.css`.
- App dùng Vite + React + TypeScript + MUI + lucide-react + zustand + TanStack Query.
- Data mode có `mock` và `supabase`; UI polish không được phá logic của hai mode.
- Docs audit gốc có screenshot: `docs/superpowers/ui-audit/2026-06-16-desktop/`.

## Screen Files

Làm theo thứ tự ưu tiên nếu không có chỉ định khác:

1. [Global rules](01-global-redesign-rules.md)
2. [Implementation map](02-implementation-map.md)
3. [POS floor](screens/06-pos-floor.md)
4. [Order drawer](screens/07-order-drawer.md)
5. [Payment drawer](screens/08-payment-drawer.md)
6. [App shell / left rail](screens/05-app-shell-left-rail.md)
7. [Menu editor](screens/12-menu-editor.md)
8. [Floor editor](screens/13-floor-editor.md)
9. [Report](screens/14-report.md)
10. [Remaining screens](screens/)

## Non-Negotiables

- Không sửa schema, migrations, domain public types, Supabase repo logic, hay ports interface trừ khi có yêu cầu riêng.
- Không thêm route/browser URL mới; app vẫn là single-page POS with internal state/drawers.
- Không để text user-facing có: `mock`, `Supabase`, `DB`, `MVP`, `placeholder`, `seed`, `tombstone`, `deactivate`, `raw Store Key`, `config`.
- Không show field read-only nếu field đó không giúp cashier/admin ra quyết định.
- Không làm landing page marketing. First screen phải phục vụ đăng nhập/ghép thiết bị.
- Không commit docs vào `main`.

## Deliverable Mong Đợi

- UI code polish trên branch riêng tạo từ `main`.
- Tests/build pass.
- Playwright/browser screenshots cho desktop 1440x900 và phone landscape 844x390 cho các flow demo chính.
- Push branch UI để chủ dự án tự review/merge.

