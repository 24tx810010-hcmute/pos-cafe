# Admin 04 - Report, General Settings, Payment Settings

## Shared Layout Rule

These screens should not use persistent three panes. Use Pattern C from `two-column-layout-rules.md`: section tabs plus content. If a preview is useful, embed it in the selected section instead of keeping it as a third pane.

## Report

Required layout:

- Header: `Báo cáo`, date range, refresh, export only if useful.
- Top section tabs or segmented control: overview, revenue, top items, orders.
- Main content: selected report section.
- Optional detail appears inside the selected section or as a right detail only when there is one main list.

Requirements:

- Metric cards: revenue, paid orders, average order, top item.
- Empty state: `Chưa có đơn đã thanh toán trong khoảng này.` with `Xem hôm nay` or `Làm mới`.
- No huge empty chart.
- Payment method labels are Vietnamese.

## General Settings

Required layout:

- Header: `Cài đặt chung`, dirty badge, `Hủy`, `Lưu cài đặt`.
- Section tabs: `Thông tin quán`, `Hóa đơn`, `Bảo trì dữ liệu`.
- Content: selected section form.
- Receipt preview appears only in the receipt section and should not consume a permanent third pane.

Requirements:

- Hide timezone/currency/internal status unless needed for a real user decision.
- Maintenance/destructive action is lower priority and danger-styled.

## Payment Settings

Required layout:

- Header: `Cài đặt thanh toán`, `Hủy`, `Lưu cài đặt`.
- Method tabs/list inside content: `Tiền mặt`, `QR`, `Chuyển khoản` only if useful.
- Detail content for selected method.

Requirements:

- Cash is always available and cannot be disabled accidentally.
- QR/bank methods that are not real must be shown as `Chưa kích hoạt` or hidden.
- No fake JSON, mock, MVP, placeholder, or future-roadmap wording.
- Receipt preview only if settings affect receipt output.

## Acceptance

- Report/settings/payment settings do not use three visible panes.
- Section tabs replace nav panes.
- Empty/unavailable states look intentional and product-ready.