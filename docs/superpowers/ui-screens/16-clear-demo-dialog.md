# 16 - Clear Demo Dialog

> Dialog mock cho clear demo data. Khong xoa backend/data that.

## Preflight

- Check branch dung trong code worktree.
- Sai branch clean thi switch; dirty thi bao user.

## Mock-only Scope

- Loai UI: modal dialog.
- Chi gia lap clear demo.
- Khong goi `clear_demo_data`, khong xoa records.

## Layout

- Dialog title: "Clear demo data".
- Severity: warning, khong qua dramatic.
- Body can neu ro:
  - "Thao tac mock nay chi minh hoa clear du lieu seed demo."
  - "Trong ban that: block neu con don dang mo, tombstone menu/floor/decor demo, deactive cashier demo, giu 1 admin."
- Summary checklist:
  - Menu demo.
  - So do ban demo.
  - Decor demo.
  - Cashier demo.
  - Admin giu lai.
- Confirmation input optional: type `CLEAR`.
- Footer:
  - Secondary "Huy".
  - Danger primary "Clear demo (mock)".

## Interactions

- Open from Settings.
- If mock open orders exist: show blocked state and disable primary, CTA "Dong don dang mo truoc".
- If no open orders: enable after confirm input or checkbox.
- Confirm: toast "Da clear demo data (mock)", close dialog, show empty menu/floor placeholders optional.

## States

- Blocked by open orders.
- Confirm ready.
- Processing mock.
- Success.

## Responsive

- Desktop/tablet: modal max width 560-640px.
- Phone landscape: modal fits height, body scrolls, footer sticky.
- Portrait: modal can show, but if from POS/admin portrait generally rotate guidance.

## Acceptance Criteria

- User cannot accidentally trigger without confirm affordance.
- Copy says mock-only and seed-data-only.
- No backend call.

