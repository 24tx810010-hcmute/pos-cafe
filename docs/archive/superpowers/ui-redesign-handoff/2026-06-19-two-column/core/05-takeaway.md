# Core 05 - Takeaway Drawer

## Current Problem To Fix

Takeaway can feel sparse when there are few orders. It should behave like an operational order list, not a reused admin shell.

## Required Layout

Use Pattern B from `two-column-layout-rules.md`:

- Top toolbar:
  - Title: `Mang đi`.
  - Tabs/chips for open/paid states.
  - Search/filter if useful.
  - Clear action to create a new takeaway order.
- Left/main region: order list.
- Right region: selected order detail and actions.

Do not add a third filter/nav pane.

## Order List

- Show order number, status, item count, total, and time if available.
- Auto-select the first useful order when data exists.
- Empty state should provide a next action such as creating a takeaway order or clearing filter.

## Detail Panel

- Show customer/order summary only if data exists.
- Show action to reopen/edit/pay depending on order state.
- Avoid blank detail state when the list has orders.

## Acceptance

- Open takeaway order can be selected and reopened.
- Paid/detail state is readable.
- The drawer has only two primary regions: list and detail.