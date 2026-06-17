# 13 - Floor Editor

Screenshots:

- [18-floor-editor-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/18-floor-editor-drawer.png)
- [19-floor-editor-dirty-new-table.png](../../../ui-audit/2026-06-16-desktop/screenshots/19-floor-editor-dirty-new-table.png)
- [20-floor-editor-dirty-confirm.png](../../../ui-audit/2026-06-16-desktop/screenshots/20-floor-editor-dirty-confirm.png)

## Goal

Let admin edit areas, tables, and decor without exposing canvas/debug tooling. Preserve logical 1600x900 model and responsive scale behavior.

## Current Problems

- Tool-heavy layout looks like design software prototype.
- Fields such as X/Y/width/height/z-index are useful but too prominent.
- Technical labels like canvas/asset/z-index must be hidden or reframed.
- Canvas grid and controls can dominate instead of table layout.

## Redesign Requirements

### Non-Negotiable Scale Rule

- Keep logical stage model.
- Render nodes as percentages relative to logical stage.
- Save `posX`, `posY`, `width`, `height` in logical units only.
- Do not save viewport pixels, pane size, or zoom-derived values.

### Header

- Title: "Quản lý sơ đồ bàn".
- Dirty badge: "Chưa lưu".
- Area selector in header can stay if compact.
- Actions:
  - "Hủy"
  - Primary: "Lưu sơ đồ"

### Tool Pane

Group tools:

- Add:
  - Bàn tròn
  - Bàn vuông
  - Bàn chữ nhật
  - Trang trí
- View:
  - Zoom out
  - Zoom percentage
  - Zoom in
  - 100%
  - Snap toggle

Avoid showing "Pan". Use "Di chuyển khung nhìn".

### Stage

- Header label: "Khu vực thiết kế".
- Grid should be subtle.
- Selected table has clear outline/handles if possible.
- Empty area CTA: "Thêm bàn đầu tiên".

### Properties Pane

Default visible:

- Table name
- Seats
- Shape
- Area
- Status read-only if useful
- Delete/restore

Advanced collapsed:

- X, Y, width, height
- Rotation
- Layer/decor asset fields

Read-only table status copy:

- "Trạng thái lấy từ đơn đang mở."

### Dirty Confirm

- Title: "Bỏ thay đổi sơ đồ?"
- Body: "Các thay đổi chưa lưu sẽ bị hủy."
- Buttons: "Ở lại" and "Bỏ thay đổi".

## Files To Touch

- `src/app/App.tsx`: `FloorEditorDrawer`
- `src/styles.css`: `.fe-*`, `.floor-stage`, `.table-node`, `.decor-node`
- Tests: `src/app/floorEditorDrawer.test.tsx`

## Acceptance Checklist

- [ ] Floor changeset tests still pass.
- [ ] New table save uses UUID and no `status` in created payload.
- [ ] Existing table update does not include viewport pixels.
- [ ] Deleted table/decor tombstones remain in payload but word is not visible.
- [ ] Stage responsive scale still verified by `%` style in tests.
