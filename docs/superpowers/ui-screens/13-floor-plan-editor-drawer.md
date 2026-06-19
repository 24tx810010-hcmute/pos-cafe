# 13 - Floor-Plan Editor Drawer

> Flagship UI mock. Chi lam layout editor responsive, khong save backend/status logic.

## Preflight

- Chay `git status --short --branch`.
- Neu sai branch va clean, switch ve branch UI dung; neu dirty, bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Drag/resize mock neu lam duoc; khong can persistence that.
- Khong ghi de table status, khong backend.

## Layout

- Header sticky:
  - "Floor-Plan Editor".
  - Area tabs: Tang tret, Lau 1, Them khu.
  - Dirty badge.
  - Buttons: "Huy", "Luu layout mock".
- Body toi da 2 pane:
  - Main: toolbar plus canvas stage 1600x900 scale-to-fit.
  - Side: inspector/properties panel.
  - Tools/library must live in toolbar or collapsed sections, not a third pane.
- Tools/library:
  - Select, Pan, Table, Decor.
  - Table shapes: round, square, rectangle.
  - Decor assets: plant, wall, counter, door, decor.
  - Zoom controls, snap toggle mock.
- Canvas:
  - Render tables absolute, status color visible but locked from editor.
  - Render decor below/above based z-index.
  - Selection outline, handles resize, rotate handle optional.
- Properties:
  - For table: name, seats, shape, x/y/w/h/rotation, area.
  - For decor: kind, asset, label, x/y/w/h/rotation, z-index, locked.

## Interactions

- Add table/decor: place center of canvas or click-to-place mock.
- Select object: show properties.
- Drag/resize: update visual draft; if complex, simple x/y stepper is acceptable but visual should move.
- Delete: mark tombstone visual with undo or remove from active draft.
- Save mock: toast, clear dirty.
- Dirty close/switch: confirm.

## States

- Empty area: CTA "Them ban dau tien".
- Selected locked decor: disable movement controls.
- Conflict mock: toast "Layout da cap nhat o thiet bi khac (mock)".
- Loading floor skeleton.

## Responsive

- Desktop/tablet: canvas central, tools and properties visible.
- Phone landscape: 100vw; tools compact icons, properties collapsible but accessible; Save visible.
- Canvas must not overflow/cut tables; use scale-to-fit.
- Portrait: rotate guidance.

## Acceptance Criteria

- Admin can visually add/select/move/edit table/decor in mock.
- Save mock visible on 740x360.
- No status overwrite behavior; table status is display-only in editor.

