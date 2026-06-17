# 10 - Order History Drawer

Screenshot audit: [13-order-history-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/13-order-history-drawer.png)

## Goal

Help cashier/manager find past orders quickly. The screen should feel like an operational history tool, not a generic table demo.

## Current Problems

- Filter/list/detail layout is logical but sparse.
- Detail pane empty until selection.
- Metrics are small and not strongly tied to current filters.
- Table can feel too light/unfinished with few rows.

## Redesign Requirements

- Header:
  - Title: "Lich su don"
  - Date filter chips in header or top filter bar.
  - Search field with clear placeholder.
- Filter pane:
  - Status counts.
  - Order type counts.
  - Revenue/paid orders summary for current page/range.
- List/table:
  - Auto-select first row if available.
  - Status badges: "Da thanh toan", "Dang mo", "Da huy".
  - Type: "Tai ban" or "Mang di".
  - Employee column only if data is meaningful; hide or de-emphasize if always empty.
- Detail pane:
  - Show selected order metadata and items.
  - Actions: print/reopen only if supported.

## Layout Spec

- Desktop: filter 220-260px, list flexible, detail 300-360px.
- Small landscape: filter becomes top/horizontal chips; detail can be tab.

## Files To Touch

- `src/app/App.tsx`: `OrderHistoryDrawer`
- `src/styles.css`: `.hx-*`, pane/table styles.
- Tests: `src/app/reportHistoryDrawer.test.tsx` if row labels or filters change.

## Acceptance Checklist

- [ ] First available order is selected or empty state gives next action.
- [ ] No abbreviations like "TT" or English "Dine-in".
- [ ] Filter changes do not leave stale selected detail.
- [ ] Dense enough to scan in 3-5 seconds.

