# Admin 01 - History, Employees, Kitchen Queue

## Shared Layout Rule

These are list/detail operational screens. Use Pattern B from `two-column-layout-rules.md`: one list region and one detail/action region. Filters, roles, and station selectors belong in a toolbar or tabs, not a third pane.

## Order History

Required layout:

- Top toolbar: title `Lịch sử đơn`, date range, search/filter controls, refresh.
- Left/main region: order table/list.
- Right region: selected order detail.

Requirements:

- Auto-select the first order when data exists.
- Empty state should explain no paid orders in range and offer `Xem hôm nay` or `Làm mới`.
- Do not use English/internal status like `paid order` or `void`.

## Employees

Required layout:

- Top toolbar: title `Nhân viên`, role tabs/chips, add employee action.
- Left/main region: employee list grouped or filtered by role.
- Right region: selected employee detail/edit form.

Requirements:

- Role labels: `Quản lý`, `Thu ngân`, `Bếp`.
- Guard against locking/removing the last active manager remains intact.
- Icon-only actions need tooltips or clear labels.

## Kitchen Queue

Required layout:

- Top toolbar: title `Bếp`, station tabs/chips, status filters.
- Left/main region: ticket queue.
- Right region: selected ticket detail/actions.

Requirements:

- Auto-select first waiting ticket when data exists.
- No `realtime mock` or prototype language.
- Ticket cards must be readable at desktop and landscape phone.

## Acceptance

- No visible 3-pane layout remains for these screens.
- Filter/role/station controls are toolbar/tabs.
- List/detail actions still call existing behavior.