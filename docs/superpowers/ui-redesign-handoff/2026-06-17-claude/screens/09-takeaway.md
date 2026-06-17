# 09 - Takeaway Drawer

Screenshot audit: [12-takeaway-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/12-takeaway-drawer.png)

## Goal

Manage takeaway orders without feeling like a secondary/debug screen.

## Current Problems

- List/detail structure is correct but sparse.
- Empty detail pane wastes space until an order is selected.
- Paid/open status could be easier to scan.

## Redesign Requirements

- Header:
  - Title: "Đơn mang đi"
  - Summary: open count + paid count if useful.
  - Primary CTA: "Tạo đơn mang đi".
- Left/list:
  - Open orders first.
  - Paid orders visually quieter.
  - Cards show order number, time, item count, total, status.
- Detail:
  - Auto-select first order when list has items.
  - If no selection, show useful empty state with CTA.
  - For open order: actions "Mở đơn", "Thanh toán".
  - For paid order: action "In lại" if implemented; otherwise hide.

## Layout Spec

- Desktop: list 360-420px, detail flexible.
- Small landscape: list and detail can become tabs.
- Do not leave a huge blank right pane.

## Files To Touch

- `src/app/App.tsx`: `TakeawayDrawer`
- `src/styles.css`: `.tw-*`, shared pane styles.

## Acceptance Checklist

- [ ] First order auto-selected or clear next action shown.
- [ ] Open vs paid visually distinct.
- [ ] Buttons fit and are not too narrow.
- [ ] No "Đã TT" abbreviation.
