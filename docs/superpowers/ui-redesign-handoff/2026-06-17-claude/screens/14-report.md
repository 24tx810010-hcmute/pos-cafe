# 14 - Report Drawer

Screenshot audit: [21-report-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/21-report-drawer.png)

## Goal

Make reporting look credible even with small or empty data. Manager should see revenue, paid orders, average ticket, top items, and detail.

## Current Problems

- Empty/zero states make the product look unfinished.
- Three-pane layout can feel like reused admin shell.
- "Only paid order, void" type language has been cleaned, but keep watching copy.
- Charts need better hierarchy and meaningful empty state.

## Redesign Requirements

- Header:
  - Title: "Báo cáo"
  - Range selector.
  - Export button only if useful; if not implemented, hide or disable with user-facing "Chưa hỗ trợ".
- Overview:
  - Metric cards: revenue, paid orders, average order, top item.
  - Use stronger metric hierarchy.
- Chart:
  - If no data, show designed empty state:
    - "Chưa có đơn đã thanh toán trong khoảng này."
    - CTA: maybe "Xem hôm nay" or "Làm mới".
  - Do not show a huge empty chart.
- Top items:
  - Show ranked list with revenue/quantity.
- Orders:
  - Paid orders table only.
  - Payment method labels in Vietnamese.
- Detail pane:
  - If no selection, show "Chọn mốc thời gian hoặc món để xem chi tiết."

## Layout Spec

- Desktop can use section nav + main + detail, but overview should not feel cramped.
- Consider dashboard-like 2 column inside main instead of identical panes.
- Small landscape: tabs for section/main/detail.

## Files To Touch

- `src/app/App.tsx`: `ReportSettingsDrawer`
- `src/styles.css`: `.rp-*`, metric/card styles.
- Tests: `src/app/reportHistoryDrawer.test.tsx`

## Acceptance Checklist

- [ ] Empty report state looks intentional.
- [ ] No "paid order", "void", "Đã TT" visible.
- [ ] Date range changes update state without visual break.
- [ ] Metric cards fit and are readable.
