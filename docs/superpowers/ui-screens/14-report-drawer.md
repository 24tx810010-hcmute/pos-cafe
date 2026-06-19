# 14 - Report Drawer

> Bao cao UI mock. Khong implement report query/backend.

## Preflight

- Check branch bang `git status --short --branch`.
- Sai branch + clean thi switch, dirty thi bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Charts/tables dung mock data.
- Filter chi thay doi mock dataset/local display.

## Layout

- Header sticky:
  - "Bao cao".
  - Date filter: Hom nay, 7 ngay, Thang nay, Tuy chon.
  - Export button disabled/mock.
- Body toi da 2 pane:
  - Main: section tabs plus charts and tables.
  - Side: insights/detail only when useful.
  - Report navigation/filter controls must not become a third pane.
- Main metrics:
  - Doanh thu.
  - So don paid.
  - Trung binh don.
  - Top mon.
- Charts:
  - Revenue by hour/day using recharts or mock bars.
  - Top items table.
- Detail pane:
  - Notes: "Chi tinh paid order, loai void".
  - Recent paid orders mock.

## Interactions

- Change date range: update mock data/chips.
- Click chart bar/top item: highlight detail.
- Export: toast "Xuat bao cao se lam sau (mock)".

## States

- No paid orders: metrics 0, empty chart.
- Loading skeleton.
- Error mock retry.
- Forbidden for cashier if product decides report admin-only.

## Responsive

- Desktop: metrics row, chart large, detail right.
- Tablet: charts stack, detail collapsible.
- Phone landscape: metrics compact 2x2, chart readable, table scrolls within pane.
- Portrait: rotate guidance.

## Acceptance Criteria

- Admin can open report drawer.
- Metrics/charts render without overflow on 740x360.
- No real report query required.

