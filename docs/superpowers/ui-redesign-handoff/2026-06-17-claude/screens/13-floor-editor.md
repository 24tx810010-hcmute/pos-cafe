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

- Title: "Quan ly so do ban".
- Dirty badge: "Chua luu".
- Area selector in header can stay if compact.
- Actions:
  - "Huy"
  - Primary: "Luu so do"

### Tool Pane

Group tools:

- Add:
  - Ban tron
  - Ban vuong
  - Ban chu nhat
  - Trang tri
- View:
  - Zoom out
  - Zoom percentage
  - Zoom in
  - 100%
  - Snap toggle

Avoid showing "Pan". Use "Di chuyen khung nhin".

### Stage

- Header label: "Khu vuc thiet ke".
- Grid should be subtle.
- Selected table has clear outline/handles if possible.
- Empty area CTA: "Them ban dau tien".

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

- "Trang thai lay tu don dang mo."

### Dirty Confirm

- Title: "Bo thay doi so do?"
- Body: "Cac thay doi chua luu se bi huy."
- Buttons: "O lai" and "Bo thay doi".

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

