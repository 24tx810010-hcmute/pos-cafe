# 02 - Store Pairing Screen

> Package gui ngoai: khong sua nhanh `docs`. Implement UI mock o code branch dung sau khi check branch.

## Preflight

- Chay `git status --short --branch`.
- Nhanh dung mac dinh: `ui-foundation` hoac branch UI user chi dinh.
- Neu sai nhanh va clean, switch giup user; neu dirty, dung lai bao user.

## Mock-only Scope

- Full screen nhap Store Key mock.
- Khong goi Supabase `signIn`, khong persist secret.
- Submit thanh cong chi chuyen sang Passcode.

## Layout

- Loai UI: full screen.
- Header co nut back ve Landing.
- Panel chinh gom:
  - Title: "Ghep thiet bi voi quan".
  - Input Store Key label: "Store Key".
  - Placeholder: `0001-X8F3QA`.
  - Helper text: "Nhap ma chu quan cung cap. Day la mock, khong ket noi backend."
  - Primary button: "Ghep thiet bi".
  - Secondary link: "Tao quan moi".
- Ben phai hoac duoi panel co note operational:
  - "Mot Store Key co the dung cho nhieu thiet bi."
  - "Sau khi ghep, moi ngay nhan vien chon ten va nhap PIN."

## Interactions

- Back: ve Landing.
- Tao quan moi: sang Create Store.
- Submit:
  - Validate format mock: co dau `-`, phan truoc/toi thieu 1 digit, phan sau/toi thieu 4 ky tu.
  - Neu valid: toast "Da ghep thiet bi (mock)" va sang Passcode.
  - Neu invalid: hien inline error, khong sang man.
- Khong luu raw key vao localStorage/sessionStorage trong mock.

## States

- Empty input.
- Invalid format.
- Loading mock 300-600ms.
- Success.

## Responsive

- Desktop: form 420-520px, note canh phai.
- Tablet/phone landscape: form va note nam trong mot grid compact, nut khong bi cat.
- Portrait: cho phep render form, nhung neu vao POS sau do phai rotate guidance.

## Acceptance Criteria

- Sai format co error ro.
- Valid format vao Passcode.
- Khong co route moi, khong backend call.
