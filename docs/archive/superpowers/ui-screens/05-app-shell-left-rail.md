# 05 - App Shell + Left Rail

> Day la UI shell mock. Khong sua docs branch khi implement.

## Preflight

- Trong `D:\Workspace\pos-cafe-code`, chay `git status --short --branch`.
- Dam bao branch dung; neu sai va clean thi switch, neu dirty thi bao user.

## Mock-only Scope

- Shell/drawer navigation UI, khong logic role that.
- Role guard co the la mock hide/disable theo currentEmployee.role.
- Khong browser routing.

## Layout

- Loai UI: persistent app shell.
- Rail trai width 72-96px desktop, compact 56-72px small landscape.
- Rail item:
  - Ban
  - Mang di
  - Lich su
  - Nhan vien
  - Menu
  - So do
  - Bao cao
  - Cai dat
  - Bep optional
  - Thanh toan/QR optional
- Moi item co icon lucide + label ngan.
- Main surface: POS Floor mac dinh.
- Drawer/workspace overlay mo tu rail, khong doi URL.
- Top area trong POS co ten quan, current employee, status sync mock, quick actions.

## Interactions

- Click Ban: dong drawer, ve POS Floor.
- Click item drawer: mo drawer tuong ung.
- Neu drawer dirty: hien confirm mock truoc khi chuyen.
- Logout employee: ve Passcode.
- Rail item khong co quyen: hide hoac disabled co tooltip "Khong co quyen".

## States

- Admin role: thay tat ca MVP modules.
- Cashier role: thay Ban, Mang di, Order/Payment qua flow, Lich su; admin modules hidden/disabled.
- Kitchen role optional: chi thay Bep.
- Offline mock banner optional.

## Responsive

- Desktop/tablet/phone landscape: rail luon nam trai.
- Phone landscape: label co the rut gon, icon van ro.
- Portrait: rotate guidance.
- Shell khong scroll body; only panes scroll.

## Acceptance Criteria

- Moi drawer mo/close bang internal state.
- URL giu nguyen.
- Rail khong lam mat nut chinh tren 740x360.

