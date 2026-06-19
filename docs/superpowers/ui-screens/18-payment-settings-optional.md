# 18 - Payment Settings Optional Drawer

> Optional UI mock cho QR/bank settings. Khong cau hinh payment backend.

## Preflight

- Kiem tra branch bang `git status --short --branch`.
- Neu sai branch clean thi switch, dirty thi bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Khong tao QR payment that, khong Supabase Storage.
- Chi form mock va preview.

## Layout

- Header:
  - "Cai dat thanh toan".
  - Buttons "Huy", "Luu mock".
- Body toi da 2 pane:
  - Main: payment method tabs plus config form.
  - Side: bill/payment preview only when useful.
  - Method navigation must not become a third pane.
- Form fields:
  - Cash enabled toggle (on/disabled).
  - Bank name, account no, account holder.
  - QR info textarea JSON-like mock.
  - Toggle "Hien QR tren hoa don" mock.
- Preview:
  - Receipt with QR placeholder, bank info.

## Interactions

- Edit form: dirty.
- Save mock: toast.
- Toggle QR: update preview.
- Invalid account no: inline validation mock.

## States

- Cash-only default.
- QR configured mock.
- Validation errors.
- Disabled methods with "Sau MVP".

## Responsive

- Desktop/tablet: 3 panes.
- Phone landscape: nav segmented, preview collapsible, save visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- Optional drawer can be displayed without payment backend.
- Preview updates from mock form.
- No real QR/payment integration.

