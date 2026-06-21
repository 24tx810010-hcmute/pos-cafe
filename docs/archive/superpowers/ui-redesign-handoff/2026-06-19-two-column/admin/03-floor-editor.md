# Admin 03 - Floor Editor

## Current Problem To Fix

The old floor editor uses tools + canvas + properties as three panes and feels like design software. Redesign it into canvas plus inspector, with tools in a toolbar.

## Required Layout

Use Pattern A from `two-column-layout-rules.md`:

- Header:
  - Title: `Quản lý sơ đồ bàn`.
  - Dirty badge: `Chưa lưu`.
  - Area selector if compact.
  - Actions: `Hủy`, primary `Lưu sơ đồ`.
- Top toolbar:
  - Add table/decor controls.
  - View controls: zoom out, zoom %, zoom in, 100%, snap toggle.
  - Area/status summary if useful.
- Left/main region: canvas/stage.
- Right region: inspector for selected table/decor/area.

Do not keep tools, canvas, and inspector as three full-height panes.

## Scale Rules

Preserve current model:

- Logical stage stays 1600x900.
- Render nodes as percentages relative to logical stage.
- Save `posX`, `posY`, `width`, `height` in logical units only.
- Do not save viewport pixels, pane size, or zoom-derived values.

## Canvas Region

- Label as `Khu vực thiết kế`.
- Grid must be subtle.
- Selected table/decor has clear outline.
- Empty area CTA: `Thêm bàn đầu tiên`.
- Table status can be visible but should read as operational state, not editable layout data.

## Inspector Region

Default visible table fields:

- Table name.
- Seats.
- Shape.
- Area.
- Status read-only only if helpful, with copy `Trạng thái lấy từ đơn đang mở.`
- Delete/restore action.

Advanced collapsed section:

- X/Y.
- Width/height.
- Rotation.
- Layer.
- Decor asset fields.

## Acceptance

- Existing floor changeset tests still pass.
- New table save uses UUID and no `status` in created payload.
- Existing table update does not include viewport pixels.
- Deleted table/decor tombstones remain in payload but `tombstone` is not visible in UI.
- The editor has only two primary regions: canvas and inspector.