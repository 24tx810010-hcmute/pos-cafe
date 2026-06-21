# Core 02 - POS Floor

## Current Problem To Fix

The old POS floor uses a left summary pane, center floor canvas, and right open-order pane. That is visually busy and makes the floor feel like one panel among many. Redesign it into two primary regions.

## Required Layout

Use Pattern A from `two-column-layout-rules.md`:

- Top toolbar:
  - Screen title `Sơ đồ bàn`.
  - Employee/online status.
  - Area selector as compact tabs/segmented control.
  - Counts: `Trống`, `Đang phục vụ`, `Mang đi`.
  - Actions: `Mang đi`, `Làm mới`, `Tạo đơn nhanh` only if it opens a real order context.
- Left/main region: floor canvas.
- Right region: open order queue.

Do not keep a full-height left summary/filter pane.

## Floor Canvas Requirements

- Preserve logical stage scale behavior and percentage-based node rendering.
- Tables should show table name, status, seat count, and occupied order number/total when available.
- Occupied and empty status must be recognizable instantly by color/border and text.
- Decor must be subtle and not compete with tables.
- Grid should be light; the stage should not feel like design software.

## Open Orders Queue

Each order card should show:

- Order number.
- Table or `Mang đi`.
- Total.
- Item count if available.
- Clear click target to reopen.

If empty, show a compact empty state with the next useful action.

## Acceptance

- There are only two primary regions under the toolbar: floor and open orders.
- Area/status/legend are not full-height panes.
- Clicking a table/order still opens the correct order drawer.
- Desktop and phone landscape do not overlap or clip text.