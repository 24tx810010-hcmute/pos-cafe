# 12 - Menu Editor Drawer

> Flagship UI mock. Chi implement editor visual/draft mock, khong save backend.

## Preflight

- Check `git status --short --branch`.
- Dung branch code UI. Neu sai branch + clean, switch; neu dirty, bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Menu changeset mock local only.
- Khong goi Supabase, khong logic pricing/core beyond UI totals.
- Phai responsive day du, vi day la flagship.

## Layout

- Header sticky:
  - Title "Menu Editor".
  - Dirty badge "Chua luu" khi co thay doi.
  - Buttons: "Huy", "Xem truoc", "Luu mock".
- Body toi da 2 pane:
  - Main: category tabs/toolbar plus menu item grid/list.
  - Side: properties panel for selected category/item/option.
  - Category management must not become a third pane.
- Category list:
  - Add category, rename, sort order, delete/tombstone visual.
- Item grid:
  - Item card: name, price, availability, option count, placeholder image.
  - Quick toggle "Tam het".
  - Add item card.
- Properties panel:
  - Item name, price, category, sort order, availability.
  - Option groups section: size, da, duong, topping, them shot.
  - Option group fields: name, single/multi, required, min/max.
  - Option values: name, price delta, sort order.

## Interactions

- Add/edit/delete category/item/option: update local draft mock.
- Delete means mark visually deleted/tombstone; do not hard delete from mock list unless hidden with undo.
- Save mock: toast "Da luu menu (mock)", clear dirty.
- Huy dirty: confirm "Bo thay doi?".
- Preview: optional right/center preview as POS menu cards.
- Availability toggle: immediate draft dirty.

## States

- No category.
- Category selected but no items.
- Validation: item name required, price >= 0, maxSelect >= minSelect.
- Conflict mock: toast "Menu da thay doi o thiet bi khac (mock)".

## Responsive

- Desktop: drawer 90vw max 1440px; 3 panes.
- Tablet: categories 180px, properties 320px.
- Phone landscape: 100vw, panes can become segmented tabs (Danh muc / Mon / Thuoc tinh) but Save remains visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- Admin can visually manage categories, items, option groups/values.
- Save mock button visible on 740x360.
- No backend call; all changes local/mock.

