# 11 - Employees Drawer

> Admin drawer mock quan ly nhan vien. Khong implement PIN hash/backend.

## Preflight

- Chay `git status --short --branch` trong code worktree.
- Neu khong dung branch code UI va worktree clean, switch; neu dirty, bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- CRUD nhan vien chi la mock state/local data.
- Khong goi RPC hash PIN, khong luu DB.

## Layout

- Header sticky:
  - "Quan ly nhan vien".
  - Button "Them nhan vien".
- Body toi da 2 pane:
  - Main: employee table/cards with role filters in toolbar tabs.
  - Side: form detail/properties.
  - Role filters must not become a third pane.
- Employee row/card:
  - Avatar initials, name, role, active status, last unlock mock.
  - Actions: edit, reset PIN, lock/unlock.
- Detail form:
  - Name, role select, active toggle.
  - Reset PIN section with new PIN/confirm PIN.

## Interactions

- Them: clear detail form, focus name.
- Save: validate required name/PIN mock, toast "Da luu nhan vien (mock)".
- Reset PIN: confirm dialog mock, toast.
- Lock/unlock: toggle visual status.
- Dirty switch: confirm if detail form changed.

## States

- Loading employees.
- Empty: "Chua co nhan vien".
- Validation errors: name required, PIN 4-6 digits, confirm mismatch.
- Forbidden for cashier: rail hidden/disabled; if opened directly, show "Khong co quyen".

## Responsive

- Desktop: toi da 2 pane ro; filter/status/category khong thanh pane thu ba.
- Tablet: filters narrow, form right 320px.
- Phone landscape: form can become right drawer tab; save button sticky visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- Admin mock can add/edit/reset/toggle visually.
- Cashier cannot access.
- No real PIN hash/RPC.

