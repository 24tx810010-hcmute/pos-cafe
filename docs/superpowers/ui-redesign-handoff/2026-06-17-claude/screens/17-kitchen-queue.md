# 17 - Kitchen Queue Drawer

Screenshot audit: [24-kitchen-queue-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/24-kitchen-queue-drawer.png)

## Goal

Kitchen/Barista queue should look like an optional but real workflow, not a mock/future warning.

## Current Problems

- Audit version had "realtime mock" and optional/seam wording; copy polish removed major issues.
- Queue uses static tickets and can still feel disconnected from real order flow.
- Three-pane layout may be too heavy for kitchen work.

## Redesign Requirements

- Header:
  - Title: "Bep / Pha che"
  - Waiting count + online indicator.
  - Status chips: Dang cho, Da xong, Tat ca.
- Station filter:
  - "Tat ca", "Pha che", "Banh".
  - Keep count badges.
- Queue:
  - Tickets should show:
    - Order number/table.
    - Age/time.
    - Items grouped by station.
    - Notes/options.
    - CTA: "Danh dau xong".
- Detail:
  - Auto-select first waiting ticket.
  - If detail pane empty, show next action.
- Remove any warning that implies local-only/prototype.

## Layout Spec

- Kitchen usually needs fast scanning:
  - Consider two columns: filters + ticket board.
  - Detail can be drawer/expanded ticket instead of permanent pane.
- Large touch targets.
- Status color:
  - Waiting amber/neutral.
  - Done green/quiet.

## Files To Touch

- `src/app/App.tsx`: `KitchenQueueDrawer`
- `src/styles.css`: `.kq-*`
- Tests: add UI test if behavior changes beyond copy.

## Acceptance Checklist

- [ ] No mock/optional/seam/future wording.
- [ ] Tickets are readable at 1440x900 and 844x390.
- [ ] Mark done/undo still updates local UI state.
- [ ] Empty filtered state looks intentional.

