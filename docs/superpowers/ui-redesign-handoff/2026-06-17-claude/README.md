# POS Cafe UI Redesign Handoff - 2026-06-17

Folder nay la bo yeu cau de dua cho mot AI khac, vi du Claude, thuc hien phase polish/redesign UI. Day la docs-only branch; khong implement UI trong branch `docs`.

## Muc Tieu

Lam lai UI de demo POS Cafe trong tinh trang chuyen nghiep hon, de thao tac hon, va khong con cam giac prototype/debug/admin panel ghep lai. Scope la UI/UX polish tren code hien co, khong viet lai business logic.

## Cach Su Dung Folder Nay

1. Dua toan bo folder nay cho AI implementer.
2. Bat AI doc file nay truoc, sau do doc `00-claude-entrypoint.md`, `01-global-redesign-rules.md`, `02-implementation-map.md`, va file screen can lam.
3. Implement trong code worktree/branch rieng tu `main`, khong lam tren `docs`.
4. Sau moi nhom screen, chay test/build/smoke theo `implementation/02-testing-checklist.md`.
5. Khong squash merge neu user yeu cau giu lich su commit.

## Current Code Context

- Code branch da merge UI copy polish vao `main` ngay 2026-06-17.
- UI source chinh: `src/app/App.tsx`.
- CSS chinh: `src/styles.css`.
- App dung Vite + React + TypeScript + MUI + lucide-react + zustand + TanStack Query.
- Data mode co `mock` va `supabase`; UI polish khong duoc pha logic cua hai mode.
- Docs audit goc co screenshot: `docs/superpowers/ui-audit/2026-06-16-desktop/`.

## Screen Files

Lam theo thu tu uu tien neu khong co chi dinh khac:

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

- Khong sua schema, migrations, domain public types, Supabase repo logic, hay ports interface tru khi co yeu cau rieng.
- Khong them route/browser URL moi; app van la single-page POS with internal state/drawers.
- Khong de text user-facing co: `mock`, `Supabase`, `DB`, `MVP`, `placeholder`, `seed`, `tombstone`, `deactivate`, `raw Store Key`, `config`.
- Khong show field read-only neu field do khong giup cashier/admin ra quyet dinh.
- Khong lam landing page marketing. First screen phai phuc vu dang nhap/ghep thiet bi.
- Khong tao branch co chu `codex`.
- Khong commit docs vao `main`.

## Deliverable Mong Doi

- UI code polish tren code branch rieng.
- Tests/build pass.
- Playwright/browser screenshots cho desktop 1440x900 va phone landscape 844x390 cho cac flow demo chinh.
- PR hoac merge commit ro rang, khong squash neu user yeu cau giu commit history.

