# Core POS Two-Column Redesign Entrypoint

Give this file to the Core POS implementer/Claude. It is the only entrypoint they need, but they must read the supporting files listed below before editing code.

## Required Reading Order

0. `../2026-06-20-main-flow-snapshot.md`

1. `shared-rules.md`
2. `tailwind-first-rules.md`
3. `two-column-layout-rules.md`
4. `visual-acceptance-checklist.md`
5. `core/01-preauth-shell.md`
6. `core/02-pos-floor.md`
7. `core/03-order-drawer.md`
8. `core/04-payment-drawer.md`
9. `core/05-takeaway.md`

If you cannot access these files, stop and ask for them. Do not infer the redesign from memory.

## Scope

You own only the Core POS/demo journey:

- Landing / start screen.
- Store pairing.
- Create store form and success state.
- Passcode.
- App shell / left rail.
- POS floor.
- Order drawer.
- Payment drawer.
- Takeaway drawer.

Do not edit admin-only screens except where shared shell styles make it unavoidable.

## Main Goal

Make the cashier journey look and feel like a real cafe POS. The visible layout must change materially from the old multi-pane prototype. The most important rule is: no screen you touch may keep a visible 3-column/pane structure.

## Required Layout Outcomes

- POS floor becomes `floor canvas + order queue`; area/status/legend move into compact top toolbar or inline summary, not a full left pane.
- Order drawer becomes `menu/catalog + cart`; categories move to top tabs/segments or compact toolbar, not a full left pane.
- Payment drawer becomes `bill summary + payment controls`; order metadata is folded into header/summary, not a separate info pane.
- Takeaway becomes `order list + detail/action`; filters are tabs/toolbar.
- Preauth screens use focused cards/action choices, not marketing hero and not admin panes.

## Files You Will Likely Touch

- `src/app/App.tsx`
- `src/tailwind.css`
- `tailwind.config.ts` / Tailwind plugin style layer, only when a legacy semantic selector cannot be safely inlined into TSX.
- UI tests only when visible text/selectors change.

Preserve existing hooks, ports, and business flow.

## Required Verification

Run:

```powershell
npm run test
npm run build
npm run test -- demoCopyPolish
$env:VITE_DATA_MODE='mock'; npm run smoke; Remove-Item Env:VITE_DATA_MODE
git diff --check
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

A touched Core POS screen must not remain on `.three-pane` or `.payment-three-pane`.
A touched Core POS screen must not add plain custom CSS declarations or expand `src/tailwind.css`. Use Tailwind utilities in JSX; if a legacy semantic selector cannot be safely inlined, keep it in the Tailwind plugin/config layer.
