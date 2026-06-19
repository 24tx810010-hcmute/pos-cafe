# Admin 02 - Menu Editor

## Current Problem To Fix

The old menu editor uses category pane + item pane + properties pane. That exposes too much at once and looks like a debug editor. Redesign it into catalog/category area plus item detail.

## Required Layout

Use Pattern A from `two-column-layout-rules.md`:

- Header:
  - Title: `Quản lý menu`.
  - Dirty badge: `Chưa lưu`.
  - Summary: active category count and active item count.
  - Actions: `Hủy`, optional `Xem trước`, primary `Lưu menu`.
- Top toolbar inside catalog region:
  - Category tabs/segmented control or compact category dropdown/list.
  - Search.
  - Add category / add item action.
- Left/main region: catalog/category area with item list/cards.
- Right region: selected item/category detail editor.

Do not keep category, items, and properties as three full-height panes.

## Catalog Region

- Category must not be a separate third pane. It can be a horizontal tab row, compact sidebar inside the left region, or dropdown if space is tight.
- Item cards should be dense: name, price, availability, option count.
- Avoid large repeated placeholder-like image/icon blocks.
- Deleted/pending state uses `Đang chờ xóa`, with restore action.

## Detail Editor Region

Default visible fields:

- Name.
- Price.
- Category.
- Availability.

Advanced collapsed section:

- Sort order.
- Option groups.
- Min/max selection.
- Any technical fields that are not needed for common edits.

## Dirty Confirm

- Title: `Bỏ thay đổi menu?`
- Body: `Các chỉnh sửa chưa lưu sẽ bị hủy.`
- Buttons: `Ở lại` and `Bỏ thay đổi`.

## Acceptance

- Create/update/delete/restore still saves through existing menu changeset logic.
- The word `tombstone` is not visible.
- Basic item editing is understandable without reading docs.
- The editor has only two primary regions: catalog and detail editor.