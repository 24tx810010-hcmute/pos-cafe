# POS Cafe UI Reference Prototype

> Static visual source for future React/Tailwind/MUI implementation.

## Files

- Source prototype: `docs/superpowers/ui-prototype/pos-cafe-ui-reference.html`
- Responsive shell prototype: `docs/superpowers/ui-prototype/pos-cafe-responsive-shell.html`
- Screenshot reference: `docs/superpowers/assets/pos-cafe-ui-overview.png`
- Tablet landscape reference: `docs/superpowers/assets/pos-cafe-ui-tablet-1024x600.png`
- Phone landscape reference: `docs/superpowers/assets/pos-cafe-ui-phone-844x390.png`
- Small landscape reference: `docs/superpowers/assets/pos-cafe-ui-phone-740x360.png`

## Direction

- Primary color: `#0F766E` (teal).
- Visual style: neutral modern, dense operational POS UI, not cafe-specific.
- Navigation: single URL + internal state; left rail shell; all modules open as overlay drawers.
- Full responsive on landscape screens: phone landscape must keep access to POS, payment, report, settings, menu editor, and floor editor.
- Body/shell should not scroll freely. Keep shell/drawer fixed to viewport; use controlled scroll per pane.
- Module layout keeps the same 3-zone mental model on large and small landscape:
  - Left: category/filter/navigation, vertical scroll.
  - Center: main content such as menu grid, floor canvas, report chart/table.
  - Right: selected item/cart/payment summary/properties, vertical scroll.
- Drawer width:
  - Large desktop: `80-90vw`, max around `1440px`.
  - Tablet/medium desktop: `90-96vw`.
  - Small width: `100vw`.
- Drawer dirty state must confirm before switching module.
- Browser Back/Forward is not a business workflow.
- Phone portrait shows rotate guidance instead of rendering the full POS.

## Covered Screens

- Passcode / employee + PIN.
- POS floor with area tabs, table states, and decor.
- Order drawer with menu/category grid and cart panel.
- Cash payment drawer.
- Menu editor split-pane.
- Floor-plan editor split-pane.
- Report/settings dashboard drawer.
- Responsive full-width drawer behavior.
- Responsive landscape shell with controlled pane scrolling.
