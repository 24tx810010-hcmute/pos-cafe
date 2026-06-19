# Core 03 - Order Drawer

## Current Problem To Fix

The old order drawer is category pane + menu pane + cart pane. That is three panes and feels dense. Redesign it into menu/catalog plus cart.

## Required Layout

Use Pattern A from `two-column-layout-rules.md`:

- Header:
  - Title such as `Bàn B01 - Đơn mới` or `Mang đi - Đơn #123`.
  - Status chips: `Tại bàn`/`Mang đi`, `Đơn chưa gửi`/`Đã gửi`, online state if useful.
  - Primary action: `Gửi đơn` or `Thanh toán` depending on state.
  - Secondary action: `Đóng`.
- Top toolbar inside menu region:
  - Category tabs/segmented control.
  - Search.
  - Optional availability/filter chips.
- Left/main region: menu catalog cards.
- Right region: cart.

Do not keep category as a full-height third pane.

## Menu Catalog

- Menu cards need name, price, availability, and clear touch target.
- Avoid decorative repeated swatches/icons unless they communicate real category/product meaning.
- Sold-out/unavailable state should be obvious but not visually dominant.

## Cart

- Cart is the most important decision area.
- Show item name, quantity controls, line total, options, and note compactly.
- Footer total and primary action must be sticky or always easy to reach.
- If existing order has unsaved changes, payment must be disabled with a clear explanation near the cart.

## Dirty Close Confirm

Use focused dialog copy:

- Title: `Bỏ đơn chưa gửi?` or `Bỏ thay đổi trong đơn?` based on state.
- Body: `Các món vừa chọn sẽ không được lưu.`
- Buttons: `Tiếp tục chỉnh sửa` and `Bỏ đơn` / `Bỏ thay đổi`.

## Acceptance

- New order: add item -> submit works.
- Existing order: edit -> submit/payment state remains correct.
- Cart total is always visible.
- The drawer has only two primary regions: catalog and cart.