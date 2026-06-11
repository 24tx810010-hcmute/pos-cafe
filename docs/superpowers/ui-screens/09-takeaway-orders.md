# 09 - Takeaway Orders Drawer

> Drawer/list don mang di mock. Khong backend, khong order logic that.

## Preflight

- Check branch: `git status --short --branch`.
- Neu sai branch va clean, switch ve branch code UI dung; neu dirty, bao user.

## Mock-only Scope

- Loai UI: drawer hoac compact workspace tu rail "Mang di".
- Hien danh sach takeaway open mock.
- Tao/sua/thanh toan chi mo drawer khac bang state mock.

## Layout

- Header:
  - Title "Don mang di".
  - Button "Tao don mang di".
  - Filter chips: Dang mo, Da thanh toan, Hom nay.
- Body 3 vung:
  - Trai: filters/time buckets.
  - Giua: list/table order cards.
  - Phai: selected takeaway detail.
- Order card:
  - Order no, time, item count, total, status.
  - Actions: "Mo don", "Thanh toan".
- Detail:
  - Snapshot items, note, employee, total.

## Interactions

- Tao don mang di: mo Order Drawer voi orderType `takeaway`, draft moi.
- Mo don: mo Order Drawer existing mock.
- Thanh toan: mo Payment Drawer.
- Filter changes visual only.

## States

- Empty: "Chua co don mang di dang mo".
- Loading list skeleton.
- Error mock retry.

## Responsive

- Desktop: list center, detail right.
- Tablet/phone landscape: detail can slide/collapse, actions remain visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- User can start takeaway flow without table.
- Order cards fit on 740x360.
- No URL change.

