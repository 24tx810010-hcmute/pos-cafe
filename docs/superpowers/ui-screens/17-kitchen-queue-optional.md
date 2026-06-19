# 17 - Kitchen Queue Optional Drawer

> Optional UI mock. Khong nam trong MVP bat buoc nhung co the render de demo seam.

## Preflight

- Chay `git status --short --branch`.
- Dam bao branch code UI dung; neu sai clean thi switch, dirty thi bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Khong implement kitchen workflow real-time that.
- Status waiting/done chi update local mock.

## Layout

- Header:
  - "Bep / Pha che".
  - Filters: Dang cho, Da xong, Tat ca.
  - Sync status mock.
- Body toi da 2 pane:
  - Main: station/filter tabs plus queue cards by order.
  - Side: selected ticket detail.
  - Station filters must not become a third pane.
- Ticket card:
  - Order no, table/takeaway, elapsed time, items count.
  - Item lines with options and notes.
  - Button "Danh dau xong" mock.

## Interactions

- Mark done: move item/ticket to done mock.
- Undo done optional.
- Filter by station/status.
- Click ticket: detail right.

## States

- Empty waiting: "Khong co mon dang cho".
- Long queue: scroll center pane.
- Offline mock warning.

## Responsive

- Desktop: toi da 2 pane; filter/status/category khong thanh pane thu ba.
- Tablet/phone landscape: queue cards central, detail collapsible.
- Portrait: rotate guidance.

## Acceptance Criteria

- Optional rail item can open if user wants.
- UI communicates optional/future seam.
- No backend/realtime real logic.

