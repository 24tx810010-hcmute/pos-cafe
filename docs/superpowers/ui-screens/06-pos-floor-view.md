# 06 - POS Floor View

> UI mock POS floor. Chi render/truong tac responsive, khong core logic that.

## Preflight

- Check branch bang `git status --short --branch`.
- Neu sai branch va clean, switch ve branch UI dung; neu dirty, bao user.

## Mock-only Scope

- Full workspace trong App Shell.
- Ban/decor/order status dung mock data.
- Click ban chi mo Order Drawer mock.

## Layout

- Loai UI: main workspace, khong drawer.
- Header sticky:
  - Ten quan, employee, sync status.
  - Nut "Mang di", "Tao nhanh" optional.
- Subheader/filter:
  - Area tabs: Tang tret, Lau 1, San vuon optional.
  - Status chips: Tat ca, Trong, Dang phuc vu.
- Body 3 vung:
  - Trai: danh sach khu/legend/table summary.
  - Giua: floor canvas logical 1600x900 scale-to-fit.
  - Phai: open orders / takeaway summary / recent activity.
- Canvas:
  - Ban co shape round/square/rectangle, ten ban, seats, status.
  - Decor: plant/wall/counter/door render nhe, khong click order.
  - Status color: empty neutral/green subtle, occupied teal/amber.

## Interactions

- Click ban trong: mo Order Drawer voi draft moi.
- Click ban occupied: mo Order Drawer voi order existing.
- Click area tab: doi area mock.
- Pan/zoom optional trong mock; neu lam, phai khong scroll page.
- "Mang di": mo Takeaway Orders hoac Order Drawer takeaway.

## States

- Loading floor skeleton.
- Empty floor: "Chua co ban, vao So do de tao ban".
- Error mock: retry button.
- Realtime toast mock: "So do da cap nhat".

## Responsive

- Desktop: 3 vung ro.
- Tablet: left compact, right narrower.
- Phone landscape: canvas chiem trung tam, side panes co the collapse thanh tabs/rail nho nhung van truy cap du.
- Portrait: rotate guidance.

## Acceptance Criteria

- Tren 1024x600, 844x390, 740x360 van thay table canvas va action "Mang di".
- Click ban mo Order Drawer.
- Body khong scroll tu do; canvas/panes scroll rieng.

