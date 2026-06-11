# 01 - Landing Screen

> Package gui ngoai: khong sua nhanh `docs`. Implement UI mock o `D:\Workspace\pos-cafe-code` sau khi doc `00-ui-agent-handoff.md`.

## Preflight

- Chay `git status --short --branch` trong `D:\Workspace\pos-cafe-code`.
- Nhanh dung: `codex/code-foundation` hoac branch UI user chi dinh tach tu no.
- Neu sai nhanh va worktree sach, switch ve nhanh dung; neu co thay doi chua commit, bao user va khong discard.

## Mock-only Scope

- Full screen UI mock, khong auth/backend.
- Hai hanh dong chi doi internal screen state: `Da co quan` -> Store Pairing; `Tao quan moi` -> Create Store.
- Khong luu Store Key, khong goi Supabase.

## Layout

- Loai UI: full screen.
- Nen: neutral light, khong gradient/orb; co header thu gon voi ten san pham "POS Cafe".
- Vung chinh can co:
  - H1: "POS quan ca phe".
  - Subtitle ngan: "Quan ly order, ban, menu va thanh toan tren nhieu thiet bi."
  - Hai card action cung cap:
    - "Da co quan" voi icon key/log-in, mo nhap Store Key.
    - "Tao quan moi" voi icon store/plus, mo tao store mock.
  - Note nho: "Day la ban UI mock, thao tac chi gia lap."
- Khong lam landing marketing dai; first viewport phai thay hai action chinh.

## Interactions

- Click "Da co quan": chuyen sang `02-store-pairing`.
- Click "Tao quan moi": chuyen sang `03-create-store`.
- Keyboard: Enter tren card dang focus cung kich hoat.
- Toast optional: khong can neu chuyen man ro rang.

## States

- Default: hai action card.
- Loading: chi dung skeleton neu dang gia lap delay, toi da 600ms.
- Error: neu muon demo, hien alert inline "Khong the mo mock flow" nhung khong block UI.

## Responsive

- Desktop/tablet landscape: content centered, max width 960-1100px, hai card nam ngang.
- Phone landscape: hai card van nam ngang neu du, giam spacing va font; khong cat nut.
- Phone portrait: hien rotate guidance hoac landing compact duoc phep, nhung POS/admin sau do phai yeu cau xoay ngang.

## Acceptance Criteria

- Co the vao Store Pairing va Create Store tu landing.
- Khong tao route moi, URL khong doi.
- Text khong tran tren width 740x360.

