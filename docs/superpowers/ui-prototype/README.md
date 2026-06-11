# POS Cafe UI Reference Prototype

> Static visual source for future React/Tailwind/MUI implementation.

## Files

- Source prototype: `docs/superpowers/ui-prototype/pos-cafe-ui-reference.html`
- Screenshot reference: `docs/superpowers/assets/pos-cafe-ui-overview.png`

## Direction

- Primary color: `#0F766E` (teal).
- Visual style: neutral modern, dense operational POS UI, not cafe-specific.
- Navigation: single URL + internal state; left rail shell; all modules open as overlay drawers.
- Drawer width:
  - Large desktop: `80-90vw`, max around `1440px`.
  - Tablet/medium desktop: `90-96vw`.
  - Small width: `100vw`.
- Drawer dirty state must confirm before switching module.
- Browser Back/Forward is not a business workflow.

## Covered Screens

- Passcode / employee + PIN.
- POS floor with area tabs, table states, and decor.
- Order drawer with menu/category grid and cart panel.
- Cash payment drawer.
- Menu editor split-pane.
- Floor-plan editor split-pane.
- Report/settings dashboard drawer.
- Responsive full-width drawer behavior.
