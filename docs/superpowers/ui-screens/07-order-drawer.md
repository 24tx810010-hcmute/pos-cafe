# 07 - Order Drawer

> Drawer mock tao/sua order. Khong implement submit RPC/core pricing that.

## Preflight

- Kiem tra branch hien tai bang `git status --short --branch`.
- Dung branch code UI, khong sua `docs`.
- Sai branch + clean: switch; sai branch + dirty: dung va bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Data menu/cart/order la mock.
- Submit/In chi update mock state/toast va dong drawer neu can.

## Layout

- Header sticky:
  - Title: "Ban B01 - Don #..." hoac "Mang di - Draft moi".
  - Chips: dine-in/takeaway, lock version mock, sync status.
  - Actions: "Dong", "Thanh toan" neu existing no dirty, "In/Gui don".
- Body 3 vung:
  - Trai: vertical categories (Ca phe, Tra, Da xay, Banh).
  - Giua: menu grid cards.
  - Phai: cart summary.
- Menu item card:
  - Ten mon, gia, category, availability.
  - Placeholder image/icon hoac color swatch.
  - Click add item.
- Cart panel:
  - Item rows with qty stepper, options summary, note.
  - Item edit affordance for size/da/duong/topping.
  - Total sticky footer + primary action.

## Interactions

- Add item: them vao cart mock.
- Qty + / -: update mock; qty 0 remove visually.
- Edit options: co the mo inline popover/dialog mock.
- Note: text input mock.
- In/Gui don:
  - Neu cart co item: toast "Da gui don (mock)", set table occupied mock, dong drawer hoac giu drawer tuy flow.
  - Neu existing order va cart empty: toast "Da huy don (mock)".
- Thanh toan: mo Payment Drawer cho existing order.
- Close dirty: confirm dialog "Bo thay doi?".

## States

- New draft empty cart.
- Existing order with items.
- Item unavailable visual: disabled card + label "Tam het".
- Conflict mock: toast "Du lieu da thay doi, vui long tai lai".
- Loading menu/order skeleton.

## Responsive

- Desktop: drawer 80-90vw, 3 columns.
- Tablet: categories 160px, cart 280-340px.
- Phone landscape 740x360: drawer 100vw; categories compact icons/text, menu grid 2-3 columns, cart still visible or accessible via right tab. Primary action visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- `In/Gui don` visible on 740x360.
- Cart total sticky.
- No backend call, no real pricing logic beyond mock totals.

