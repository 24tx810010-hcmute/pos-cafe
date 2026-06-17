# 12 - Menu Editor

Screenshots:

- [15-menu-editor-drawer.png](../../../ui-audit/2026-06-16-desktop/screenshots/15-menu-editor-drawer.png)
- [16-menu-editor-dirty-new-item.png](../../../ui-audit/2026-06-16-desktop/screenshots/16-menu-editor-dirty-new-item.png)
- [17-menu-editor-dirty-confirm.png](../../../ui-audit/2026-06-16-desktop/screenshots/17-menu-editor-dirty-confirm.png)

## Goal

Make menu management feel like a finished admin tool. Admin should understand category -> item -> options without being overwhelmed.

## Current Problems

- Three-pane editor exposes too much at once.
- Repetitive icon blocks make items look like placeholders.
- Advanced option group fields compete with basic item fields.
- Delete/restore state is functional but visually technical.

## Redesign Requirements

### Header

- Title: "Quản lý menu".
- Dirty badge: "Chưa lưu".
- Summary: active category count + active item count.
- Actions:
  - "Hủy"
  - "Xem trước"
  - Primary: "Lưu menu"

### Navigation / Categories

- Category list should show:
  - Category name.
  - Item count.
  - Add category button.
  - Reorder controls only visible on hover or in compact action menu.
- Deleted category:
  - Use "Đang chờ xóa" user-facing label.
  - Restore action clear.

### Items

- Item cards should be denser:
  - Name, price, availability badge, option group count.
  - Avoid giant repeated coffee icons unless real image/icon helps.
  - Add item card should be obvious but not oversized.
- Auto-select first item in selected category when none selected and category has items.

### Properties

Split into sections:

- Basic:
  - Name
  - Price
  - Category
  - Availability
- Advanced:
  - Sort order
  - Option groups
  - Min/max selection

Advanced can be collapsed by default if screen is cramped.

### Dirty Confirm

- Title: "Bỏ thay đổi menu?"
- Body: "Các chỉnh sửa chưa lưu sẽ bị hủy."
- Buttons: "Ở lại" and "Bỏ thay đổi".

## Layout Spec

- Desktop: 3 pane OK, but props pane should not look like a long debug form.
- Tablet/phone landscape: use tabs "Danh mục", "Món", "Chi tiết".
- Sticky save actions.

## Files To Touch

- `src/app/App.tsx`: `MenuEditorDrawer`
- `src/styles.css`: `.menu-*`
- Tests: `src/app/menuEditorDrawer.test.tsx`, `src/app/demoCopyPolish.test.tsx`

## Acceptance Checklist

- [ ] New item/create/update/delete/restore still saves through existing changeset logic.
- [ ] No word "tombstone" visible.
- [ ] Basic item editing is understandable without reading docs.
- [ ] Option groups are accessible but not visually dominant.
- [ ] Dirty confirm still works.

