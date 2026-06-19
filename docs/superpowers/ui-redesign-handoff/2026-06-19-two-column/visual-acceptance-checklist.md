# Visual Acceptance Checklist

No screenshot artifact is required. The implementer must still run the app and inspect the UI directly before reporting done.

## How To Inspect

Run local app in mock mode:

```powershell
$env:VITE_DATA_MODE='mock'; npm run dev -- --host 127.0.0.1 --port 5173
```

Inspect these viewports:

- Desktop: 1440x900.
- Tablet landscape: 1024x600.
- Phone landscape: 844x390.
- Phone portrait: rotate guidance only.

## Layout Checklist

For every touched screen:

- There are no more than two primary content regions.
- Header has the screen title, important status, and primary action when relevant.
- Filters/categories/sections are toolbar tabs, segmented controls, accordions, or inline chips; they are not a full third pane.
- Primary action is visible without hunting.
- Empty/detail areas do not look like unused white boxes.
- Read-only/internal fields are hidden unless they help the cashier/admin decide what to do.
- Text does not overlap or clip in buttons, badges, cards, tables, drawer headers, or sticky footers.
- Sticky header/footer actions do not cover content.
- The UI looks intentionally designed for a cafe POS, not like a generic admin/debug dashboard.

## Copy Checklist

- No internal/dev words from `shared-rules.md` appear in user-visible UI.
- Vietnamese labels are consistent for order type, payment, employee role, report status, and admin actions.
- Disabled/future functionality is hidden or clearly framed as unavailable without prototype language.

## Reporting Checklist

When reporting done, include:

- Branch name and commit hash.
- Screens changed.
- Files changed.
- Commands run and result.
- Any screen that still has a known layout compromise, with reason.

Do not claim done if a touched screen still uses a visible 3-pane layout.