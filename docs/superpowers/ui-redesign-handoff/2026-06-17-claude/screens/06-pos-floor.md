# 06 - POS Floor View

Screenshot audit: [06-pos-floor.png](../../../ui-audit/2026-06-16-desktop/screenshots/06-pos-floor.png)

## Goal

This is the main cashier screen. It must immediately show table status, open orders, and next actions. It should feel like a real cafe POS, not an empty canvas demo.

## Current Problems

- Center floor feels too empty and toy-like.
- Right open-orders panel is operationally important but visually secondary.
- Area/filter controls duplicate concepts and consume space.
- Empty/open order cards do not provide enough useful details.

## Redesign Requirements

### Header

- Title: "So do ban".
- Subtitle: employee + online status + count summary.
- Header actions:
  - Mang di
  - Lam moi
  - Tao don nhanh only if it opens a real new order context; otherwise demote/remove.

### Left Summary

- Show areas as segmented control or compact list, not both left and top unless needed.
- Show counts:
  - Trong
  - Dang phuc vu
  - Mang di
- Legend should be compact and not consume prime space.

### Floor Stage

- Keep logical stage scale behavior.
- Tables should look like POS objects:
  - Clear table name.
  - Seat count smaller.
  - Status color/border.
  - If occupied, show total and maybe order number.
- Decor should be subtle, not distract from tables.
- Grid should be less dominant.

### Right Open Orders

- Make this panel more useful:
  - Order number.
  - Table or "Mang di".
  - Total.
  - Time/open age if available.
  - One obvious click target to reopen.
- If no open orders, show compact designed empty state.

## Layout Spec

- Desktop: 3 regions, but center should dominate.
- Recommended columns: left 220-260px, center flexible, right 260-320px.
- Tablet/phone landscape: left summary collapses into top filter; right orders can become bottom sheet/list tab if space tight.

## Files To Touch

- `src/app/App.tsx`: `FloorWorkspace`
- `src/styles.css`: `.floor-*`, `.table-node`, `.decor-node`
- Tests/smoke: POS flow smoke if interaction changes.

## Acceptance Checklist

- [ ] User can identify occupied vs empty tables instantly.
- [ ] Clicking table/order still opens correct `OrderDrawer`.
- [ ] Stage remains responsive and uses percentages/logical units.
- [ ] Right panel no longer feels like unused white space.
- [ ] 1440x900 and 844x390 screenshots have no overlap.

