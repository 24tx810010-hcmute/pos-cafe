# Shared Rules For POS Cafe UI Redesign

Use this file for both implementers. Read it before any screen-specific file.

## Branch And Git Policy

- Work in `D:\Workspace\pos-cafe`, not the docs worktree.
- Start from latest `main` and create a dedicated branch.
- Do not create any branch containing `codex`.
- Recommended branch names: `ui-core-pos-two-column` or `ui-admin-ops-two-column`.
- Do not edit `main` directly.
- Do not edit the docs branch.
- Do not merge into `main`; push the feature branch and report commit/test results.
- If the worktree is dirty with changes you did not make, stop and report it. Do not reset, force checkout, or discard another person's work.

## Architecture Boundaries

- This is UI/UX work only.
- Do not change schema, migrations, RLS, Supabase RPCs, domain public types, or port interfaces.
- Keep UI/features calling existing hooks and ports.
- Do not import Supabase client, Supabase row shapes, store keys, or adapter internals into UI code.
- Main UI files are `src/app/App.tsx` and `src/styles.css`.
- Read `tailwind-first-rules.md` before changing any UI file.
- Styling must be Tailwind-first across all production UI code. Use JSX Tailwind utilities or Tailwind `@apply` for shared legacy selectors.
- Do not add new plain custom CSS for normal layout, spacing, borders, colors, cards, drawers, lists, tables, or buttons.
- Do not add static React inline `style={{ ... }}` or MUI `sx={{ ... }}` for normal layout or visual styling. Remaining inline style must be runtime/data-driven and explained in the final report.
- You may split components only when it reduces real complexity and keeps behavior unchanged.
- Preserve existing business behavior: store pairing, PIN login, order submit, payment, editor save, report, and admin mutations.

## Copy And Product Language

User-facing UI must be Vietnamese product copy. Do not show internal/dev words:

- `mock`
- `Supabase`
- `DB`
- `MVP`
- `placeholder`
- `seed`
- `tombstone`
- `config`
- `raw Store Key`
- `paid order`
- `void`
- English labels like `Draft`, `Dine-in`, `Floor-Plan Editor`, `Menu Editor`, `Clear demo data`

Use product words instead:

- `Đơn mới`, `Đơn chưa gửi`, `Đã gửi`, `Đã thanh toán`, `Đơn đã hủy`
- `Tại bàn`, `Mang đi`
- `Sơ đồ bàn`, `Quản lý menu`, `Báo cáo`, `Cài đặt chung`
- `Dữ liệu mẫu` only in admin maintenance context, never as debug/demo explanation.

## Interaction And Visual Rules

- Primary action must be obvious and stable: `Gửi đơn`, `Thanh toán`, `Hoàn tất thanh toán`, `Lưu menu`, `Lưu sơ đồ`, `Lưu cài đặt`.
- Secondary/destructive actions must be visually lower priority unless destructive confirmation is active.
- Empty states need a next action where possible; avoid a large blank panel with only explanatory text.
- Loading/error states must not make the layout jump.
- No text may be clipped inside buttons, cards, badges, or table rows.
- Cards are for repeated items, dialogs, and true form panels. Avoid nested cards and repeated bordered boxes.

## Required Verification Before Reporting Done

Run these before claiming work is complete:

```powershell
npm run test
npm run build
git diff --check
```

If touching POS floor, order drawer, payment drawer, takeaway, history, or app shell, also run:

```powershell
$env:VITE_DATA_MODE='mock'; npm run smoke; Remove-Item Env:VITE_DATA_MODE
```

If touching visible copy, also run:

```powershell
npm run test -- demoCopyPolish
```

Static checks before reporting:

```powershell
rg -n "mock|Supabase|DB|MVP|placeholder|seed|tombstone|config|raw Store Key|paid order|void|Draft|Dine-in" src/app src/styles.css
rg -n "three-pane|payment-three-pane|menu-three-pane|rp-three-pane|fe-three-pane" src/app/App.tsx src/styles.css
rg -n "^[ \t]*(display|width|height|padding|margin|border|background|color|font|grid|flex|position|top|right|bottom|left|box-shadow|text-|line-height|overflow|opacity|cursor|transition|align|justify|gap|z-index|transform|outline|min-|max-|place-|white-space|vertical-align|border-radius|border-color|border-style|border-width|box-sizing|resize|pointer-events|object-fit|letter-spacing):" src/styles.css
rg -n "@apply" src/styles.css
rg -n "style=\{\{|sx=\{\{" src/app src/features src/components
```

The second command may find legacy CSS/classes only if they are unused by touched screens. Do not keep a touched screen on a 3-pane layout.
The third command should only find approved CSS exception areas, usually `:root` or documented floor-stage/runtime styling. Normal screen styling must be Tailwind utilities or `@apply`.
The inline style command should only find runtime/data-driven values such as floor coordinates, zoom, dynamic swatch color, or chart bar width.
