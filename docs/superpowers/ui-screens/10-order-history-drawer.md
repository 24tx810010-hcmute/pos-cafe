# 10 - Order History Drawer

> UI mock drawer lich su don. Folder nay la spec gui ngoai; khong sua nhanh `docs`.

## Preflight

- Trong `D:\Workspace\pos-cafe-code`, chay `git status --short --branch`.
- Nhanh dung la `codex/code-foundation` hoac branch UI user chi dinh.
- Sai branch + clean: switch ve nhanh dung. Sai branch + dirty: dung lai va bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Hien lich su don bang mock data, khong query backend/report.
- Filter/pagination chi la UI state mock.

## Layout

- Header sticky:
  - Title "Lich su don".
  - Date range compact: Hom nay, 7 ngay, Thang nay, Tuy chon.
  - Search input "Tim ma don / ban".
- Body 3 vung:
  - Trai: filters status/payment type/order type.
  - Giua: table/list orders.
  - Phai: selected order detail.
- Table columns:
  - Gio, Ma don, Ban/Mang di, Tong tien, Trang thai, Nhan vien.
- Detail:
  - Items snapshot, options, total, paid time, payment method.
  - Buttons mock: "In lai", "Dong".

## Interactions

- Select row: update detail panel.
- Filter chips: update mock list.
- Search: filter client-side mock.
- Print again: toast "Da mo preview hoa don (mock)".
- Paid/void/open status are visual only; no mutation.

## States

- Empty today: "Hom nay chua co don nao".
- Loading skeleton table.
- Error mock: retry.
- Long list: pagination footer or virtual scroll mock.

## Responsive

- Desktop: table center and detail right.
- Tablet: detail drawer inside drawer acceptable.
- Phone landscape: table cards instead of dense table; selected detail can open as right pane/bottom sheet, no text overflow.
- Portrait: rotate guidance.

## Acceptance Criteria

- Cashier and admin can view history mock.
- Filters/search visually work with mock data.
- No backend query beyond existing mock ports if used.

