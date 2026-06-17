# 07 - Order Drawer

Screenshots:

- [07-order-drawer-new-draft.png](../../../ui-audit/2026-06-16-desktop/screenshots/07-order-drawer-new-draft.png)
- [09-order-drawer-existing.png](../../../ui-audit/2026-06-16-desktop/screenshots/09-order-drawer-existing.png)
- [08-order-dirty-close-confirm.png](../../../ui-audit/2026-06-16-desktop/screenshots/08-order-dirty-close-confirm.png)

## Goal

Cashier must add items and submit/payment with minimal friction. Order drawer is core demo journey.

## Current Problems

- Three-pane layout is functional but visually dense.
- Cart is correct but could be more cashier-friendly.
- Category/menu grid/card hierarchy can be sharper.
- Dirty close confirm is acceptable but copy/buttons can be clearer.

## Redesign Requirements

### Header

- Title: "Ban B01 - Don moi" or "Mang di - Don #123".
- Status row:
  - order type chip: "Tai ban" or "Mang di"
  - "Chua gui", "Da gui", or "Da thanh toan"
  - online indicator
- Header actions:
  - Secondary: "Dong"
  - Primary: "In/Gui don" or "Thanh toan"
- If existing order has unsaved changes, payment button disabled with explanation near cart, not just disabled in header.

### Menu Area

- Category pane should be compact.
- Menu cards:
  - Name, price, availability.
  - Touch target large.
  - Avoid repetitive decorative swatches unless meaningful.
- Search should not shrink pane heading badly.

### Cart

- Cart needs strongest hierarchy:
  - Item name, qty controls, line total.
  - Options/note visible but compact.
  - Footer totals sticky.
  - Primary action repeated in footer is OK if header also has it, but avoid visual duplication confusion.

### Dirty Close Confirm

- Title: "Bo don chua gui?"
- Body: "Cac mon vua chon se khong duoc luu."
- Buttons:
  - Secondary: "Tiep tuc chinh sua"
  - Destructive: "Bo don"

## Layout Spec

- Desktop: three panes OK, but cart width should be at least 300px.
- Phone landscape: category can become horizontal tabs; cart may become right pane or bottom summary drawer.
- Header and cart footer sticky.

## Files To Touch

- `src/app/App.tsx`: `OrderDrawer`
- `src/styles.css`: `.pane`, `.category-*`, `.menu-*`, `.cart-*`, `.drawer-*`
- Tests:
  - `src/app/demoCopyPolish.test.tsx`
  - POS smoke if flow changes.

## Acceptance Checklist

- [ ] New order flow: add item -> submit works.
- [ ] Existing order flow: edit -> submit/payment state still correct.
- [ ] Dirty close confirm appears only when needed.
- [ ] No English/internal "Draft", "DB", "Dine-in".
- [ ] Cart totals always visible.

