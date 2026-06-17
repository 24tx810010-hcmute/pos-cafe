# 11 - Employees Drawer

Screenshot audit: [14-employees-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/14-employees-drawer.png)

## Goal

Let admin manage staff names, roles, PINs, and active status clearly.

## Current Problems

- Overall screen is usable but icon buttons can be unclear.
- Role/status labels may mix product language and internal enum words.
- Empty/detail selection states can be improved.

## Redesign Requirements

- Header:
  - Title: "Nhân viên"
  - Summary: active count + admin/cashier count if useful.
  - Primary CTA: "Thêm nhân viên".
- List:
  - Staff name.
  - Role in Vietnamese.
  - Active/inactive status.
  - Search/filter if list grows; not required for small mock list.
- Detail/form:
  - Fields grouped:
    - Thông tin: name, role.
    - Đăng nhập: PIN reset/change.
    - Trạng thái: active/inactive.
  - Hide raw IDs.
  - Icon-only actions need tooltip/title.
- Destructive actions:
  - Deactivate instead of delete if that is current behavior.
  - Confirm if action affects current account/admin.

## Layout Spec

- Desktop: list + detail, 2 panes enough.
- Avoid 3 panes unless needed.
- Phone landscape: list/detail tabs.

## Files To Touch

- `src/app/App.tsx`: `EmployeesDrawer`
- `src/styles.css`: `.emp-*`
- Tests: `src/app/employeeDrawer.test.tsx`

## Acceptance Checklist

- [ ] Role names are user-facing Vietnamese.
- [ ] Admin cannot accidentally remove last admin.
- [ ] Current employee constraints remain visible and safe.
- [ ] Buttons have readable labels or titles.

