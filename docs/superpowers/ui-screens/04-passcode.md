# 04 - Passcode Screen

> UI mock screen. Nguoi implement chi sua code branch, khong sua `docs`.

## Preflight

- Kiem tra `git status --short --branch`.
- Branch dung: `ui-foundation` hoac branch UI user chi dinh.
- Sai branch + clean thi switch; sai branch + dirty thi bao user.

## Mock-only Scope

- Full screen chon nhan vien + PIN.
- Verify PIN bang mock data/ports; khong auth/backend.
- Current employee co the giu memory-only trong mock state.

## Layout

- Loai UI: full screen.
- Trai: brand/summary:
  - Ten quan mock, ngay gio, trang thai "Realtime online mock".
  - Note nho "Nhan vien chon ten va nhap PIN".
- Phai: passcode panel:
  - Employee selector cards: Admin, Thu ngan, Bep optional.
  - Moi card co name, role pill, status active.
  - PIN display 6 dot.
  - Numeric keypad 0-9, clear/backspace.
  - Primary button "Mo khoa".
  - Link nho: "Doi quan / Go ghep".
- UI tieng Viet, button/icon ro.

## Interactions

- Select employee: set selected card.
- Keypad click: append PIN toi da 6.
- Backspace/clear: update PIN.
- Unlock:
  - Admin PIN mock `123456`.
  - Cashier PIN mock `111111`.
  - Bep optional `222222`.
  - Valid -> toast "Xin chao ..." va vao POS Floor.
  - Invalid -> error "PIN khong dung", shake nhe panel optional.
- Doi quan -> ve Landing hoac Store Pairing mock.

## States

- Loading employees.
- No employees: empty state "Chua co nhan vien mock".
- Invalid PIN.
- Disabled unlock khi PIN rong.

## Responsive

- Desktop/tablet landscape: two-column.
- Phone landscape 740x360: compact density, keypad va unlock visible without page scroll.
- Portrait: rotate guidance acceptable.

## Acceptance Criteria

- Admin/cashier mock login vao POS Floor.
- Current employee khong can persist sau refresh.
- Khong route moi.
