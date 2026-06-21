# 03 - Create Store Screen

> Package gui ngoai: day la UI mock spec. Khong sua nhanh `docs`; implement trong code worktree/branch dung.

## Preflight

- Chay `git status --short --branch` va xac nhan branch dung.
- Neu sai branch va clean: `git switch ui-foundation` hoac branch UI user chi dinh.
- Neu co thay doi chua commit: dung lai, khong reset.

## Mock-only Scope

- Full screen tao quan mock.
- Khong goi `get_next_store_no`, Supabase signUp, seed that.
- Tao store thanh cong chi sinh mock Store Key va admin PIN tren UI.

## Layout

- Loai UI: full screen.
- Header co back ve Landing.
- Form tao quan:
  - "Ten quan" input, default/placeholder "Cafe Demo".
  - "Dia chi" optional.
  - "Timezone" select disabled/default `Asia/Saigon`.
  - Checkbox optional: "Seed du lieu demo" checked/disabled trong mock.
  - Button: "Tao quan moi".
- Sau success, hien success panel:
  - Store Key mock: `0001-X8F3QA`, co copy button.
  - Admin PIN: `123456`, co copy button.
  - Warning nho: "Chi hien mot lan trong flow that; trong mock co the hien lai de demo."
  - Button: "Vao man hinh PIN".

## Interactions

- Submit khi ten quan trong: inline error.
- Submit valid: mock loading, sau do success panel.
- Copy buttons: copy clipboard neu de lam; neu khong thi toast "Da copy (mock)".
- "Vao man hinh PIN": sang Passcode.
- "Da co quan": sang Store Pairing.

## States

- Form idle.
- Form validation error.
- Creating mock loading.
- Seed failed mock optional: hien `seed_status=failed`, button "Thu lai seed"; click retry -> success.
- Success.

## Responsive

- Desktop: split layout form + preview seed summary.
- Tablet/phone landscape: two columns compact hoac stacked trong viewport, primary button visible.
- Phone portrait: render compact hoac rotate guidance; khong yeu cau POS render portrait.

## Acceptance Criteria

- User co the tao store mock va sang Passcode.
- Store Key chi nam trong success result, khong persist vao session UI.
- Khong backend/auth/schema call.
