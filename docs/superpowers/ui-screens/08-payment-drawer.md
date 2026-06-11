# 08 - Payment Drawer

> Drawer thanh toan cash mock. Khong implement `pay_order` that.

## Preflight

- Chay `git status --short --branch` trong code worktree.
- Dam bao dung branch; neu sai clean thi switch, neu dirty thi bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Payment cash mock, khong tao payment DB.
- Complete chi toast, update mock status/table empty neu co.

## Layout

- Header sticky:
  - "Thanh toan - Don #..."
  - Close, optional print preview.
  - Primary button "Hoan tat".
- Body 3 vung:
  - Trai: order info/table/customer type.
  - Giua: item snapshot/list bill.
  - Phai: payment panel.
- Payment panel:
  - Tong tien large.
  - Input "Tien khach dua".
  - Quick cash buttons: exact, +10k, +20k, +50k, +100k.
  - Tien thoi lai.
  - Payment method segmented, cash active only; QR/bank disabled "Sau".
  - Final receipt preview optional.

## Interactions

- Enter received amount: update change mock.
- If received < total: disable "Hoan tat" hoac error inline.
- Complete:
  - If valid: toast "Da thanh toan (mock)", set order paid/table empty in mock, close to floor.
  - Render receipt preview mock optional.
- Close dirty not critical, but if amount changed can close without confirm.

## States

- Loading order.
- Insufficient amount.
- Success paid.
- Empty/missing order: show "Khong tim thay don mock" + close.

## Responsive

- Desktop/tablet: 3 vung, payment panel right sticky.
- Phone landscape: right panel visible, amount buttons wrap without overflow; Hoan tat visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- `Hoan tat` visible on 740x360.
- Received/change calculations can be UI-only mock.
- Paid success returns to floor or order history mock.

