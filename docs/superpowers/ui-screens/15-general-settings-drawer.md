# 15 - General Settings Drawer

> Cai dat chung UI mock. Khong save backend.

## Preflight

- Chay `git status --short --branch`.
- Neu sai branch va clean, switch ve branch dung; neu dirty, bao user.

## Mock-only Scope

- Loai UI: drawer/workspace overlay.
- Form update settings chi local/mock.
- Clear demo mo dialog mock rieng (`16-clear-demo-dialog.md`).

## Layout

- Header sticky:
  - "Cai dat chung".
  - Dirty badge.
  - Buttons: "Huy", "Luu cai dat mock".
- Body 3 vung:
  - Trai: settings nav (Thong tin, Hoa don, He thong, Demo).
  - Giua: form sections.
  - Phai: preview.
- Form fields:
  - Ten hien thi quan.
  - Dia chi.
  - Timezone disabled/default `Asia/Saigon`.
  - Currency disabled `VND`.
  - Bill footer multiline.
  - Realtime/mock status.
- Demo section:
  - Button danger/outlined "Clear demo data".
  - Explain "Chi clear data seed demo, khong xoa data user tu tao" trong mock text.

## Interactions

- Edit fields: dirty.
- Save mock: toast, clear dirty.
- Cancel dirty: confirm.
- Clear demo: open Clear Demo Dialog.

## States

- Loading settings.
- Validation: display name required.
- Save success/error mock.
- Forbidden for cashier.

## Responsive

- Desktop: 3 vung.
- Tablet: preview right narrower.
- Phone landscape: nav compact tabs, preview collapsible, save visible.
- Portrait: rotate guidance.

## Acceptance Criteria

- Admin can edit settings visually and save mock.
- Clear demo opens dialog.
- No backend persistence.

