# Admin/Ops Two-Column Redesign Entrypoint

Give this file to the Admin/Ops implementer/Claude. It is the only entrypoint they need, but they must read the supporting files listed below before editing code.

## Required Reading Order

1. `shared-rules.md`
2. `tailwind-first-rules.md`
3. `two-column-layout-rules.md`
4. `visual-acceptance-checklist.md`
5. `admin/01-history-employees-kitchen.md`
6. `admin/02-menu-editor.md`
7. `admin/03-floor-editor.md`
8. `admin/04-report-settings-payment.md`
9. `admin/05-dialogs-copy-cleanup.md`

If you cannot access these files, stop and ask for them. Do not infer the redesign from memory.

## Scope

You own the admin and operations surfaces:

- Order history.
- Employees.
- Menu editor.
- Floor editor.
- Report.
- General settings.
- Clear sample data dialog and dirty confirm dialogs.
- Kitchen queue.
- Payment settings.

Do not edit core POS/order/payment screens except where shared styles make it unavoidable.

## Main Goal

Make admin/ops screens feel like finished POS management tools, not generic 3-pane debug forms. The visible layout must change materially from the old admin shell. No screen you touch may keep a visible 3-column/pane structure.

## Required Layout Outcomes

- List/detail screens become `list + detail`; filters and role/station selectors move into toolbar/tabs.
- Menu editor becomes `catalog/category area + item detail`; advanced fields are collapsed and category does not become a separate third pane.
- Floor editor becomes `canvas + inspector`; tools and area selector are toolbar controls, geometry/asset fields are collapsed.
- Report/settings/payment settings use section tabs plus content. Preview is embedded inside the selected section only when useful.
- Dialogs use focused confirmation layout and remove internal/dev copy.

## Files You Will Likely Touch

- `src/app/App.tsx`
- `src/tailwind.css`
- `tailwind.config.ts` / Tailwind plugin style layer, only when a legacy semantic selector cannot be safely inlined into TSX.
- Relevant UI tests only when visible text/selectors change.

Preserve existing hooks, ports, changesets, and save behavior.

## Required Verification

Run:

```powershell
npm run test
npm run build
npm run test -- demoCopyPolish
git diff --check
```

If touching order history or kitchen queue, also run smoke:

```powershell
$env:VITE_DATA_MODE='mock'; npm run smoke; Remove-Item Env:VITE_DATA_MODE
```

Also run these static checks and fix user-visible issues:

```powershell
rg -n "mock|Supabase|DB|MVP|placeholder|seed|tombstone|config|raw Store Key|paid order|void|Draft|Dine-in" src/app src/tailwind.css
rg -n "three-pane|payment-three-pane|menu-three-pane|rp-three-pane|fe-three-pane" src/app/App.tsx src/tailwind.css
rg -n "^[ \t]*(display|width|height|padding|margin|border|background|color|font|grid|flex|position|top|right|bottom|left|box-shadow|text-|line-height|overflow|opacity|cursor|transition|align|justify|gap|z-index|transform|outline|min-|max-|place-|white-space|vertical-align|border-radius|border-color|border-style|border-width|box-sizing|resize|pointer-events|object-fit|letter-spacing):" src/tailwind.css
rg -n "@apply" src/tailwind.css
Test-Path src/styles.css
Get-Content src/tailwind.css
```

A touched Admin/Ops screen must not remain on `.three-pane`, `.menu-three-pane`, `.rp-three-pane`, or `.fe-three-pane`.
A touched Admin/Ops screen must not add plain custom CSS declarations or expand `src/tailwind.css`. Use Tailwind utilities in JSX; if a legacy semantic selector cannot be safely inlined, keep it in the Tailwind plugin/config layer.
