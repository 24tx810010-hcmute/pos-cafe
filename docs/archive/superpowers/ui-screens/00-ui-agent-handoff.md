# UI Agent Handoff Package

> Ban dang nhan folder spec nay tu chu du an. Khong sua nhanh `docs`; chi dung cac file MD trong folder nay lam yeu cau UI. Khi implement, lam o code worktree `D:\Workspace\pos-cafe-code`.

## Preflight Bat Buoc

Truoc khi sua UI, chay:

```powershell
cd D:\Workspace\pos-cafe-code
git worktree list
git status --short --branch
git branch --show-current
git ls-tree -r --name-only HEAD | rg "^(docs/|pos-cafe-context\.md)"
```

- Nhanh dung mac dinh: `ui-foundation`, hoac branch UI duoc user chi dinh va phai duoc tach tu `ui-foundation`.
- Neu dang sai nhanh va worktree sach: switch ve nhanh dung giup user, vi du `git switch ui-foundation`.
- Neu dang sai nhanh nhung co thay doi chua commit: dung lai va bao user, khong discard, khong reset.
- Lenh `git ls-tree... | rg` khong duoc tra ket qua; neu co `docs/` hoac `pos-cafe-context.md` trong code branch thi bao user.

## Mock-only Scope

- Chi implement UI mock responsive de duyet giao dien.
- Khong implement business/core logic that.
- Khong viet Supabase adapters, RPC, migration, auth/backend that.
- Khong sua schema, migrations, hoac docs branch.
- Khong tao browser routes moi; app dung single URL va internal state/drawers.
- Co the dung mock ports/mock data hien co, hoac mock data local trong UI component neu can.
- Tat ca save/pay/create/pair/clear/retry la hanh vi gia lap: update state tam thoi, hien toast/dialog, khong goi backend that.

## Visual Direction

- Ngon ngu UI: tieng Viet.
- Style: POS van hanh, day du thong tin, de scan, khong lam landing marketing.
- Primary color: teal `#0F766E`; neutral surfaces, slate text, warning/error ro rang.
- Dung MUI controls cho Button/Input/Dialog/Tabs/Table neu phu hop; layout phai dung Tailwind-first. Khong sinh plain custom CSS cho layout UI; dung Tailwind utilities hoac `@apply`, chi giu CSS raw cho token/keyframes/viewport guard/MUI override/floor-stage runtime behavior.
- Dung lucide icons trong button neu co icon phu hop.
- Card radius toi da 8px; khong long card trong card.
- Khong dung gradient/orb/bokeh lam nen.
- Text phai fit trong nut/card tren desktop, tablet, phone landscape.

## Global Layout Rules

- Landscape-first: desktop, tablet landscape, phone landscape deu dung duoc.
- Phone portrait: hien rotate guidance, khong co render POS/admin day du.
- Shell/body khong scroll tu do; drawer/workspace fixed viewport, pane ben trong tu scroll.
- Drawer/workspace width:
  - Desktop lon: `80-90vw`, max khoang `1440px`.
  - Tablet/medium: `90-96vw`.
  - Small/phone landscape: `100vw`.
- Mental model toi da 2 pane chinh tren landscape. Navigation/filter/category/status phai nam trong toolbar, tabs, accordion, hoac inline summary thay vi pane thu ba.
- Header/action bar sticky trong drawer; footer hanh dong quan trong sticky neu co tong tien/save/pay.

## Interactions

- Moi interaction trong UI package la mock-only: click, open/close drawer, save/pay/clear/create chi update UI state tam thoi va toast/dialog.
- Neu mot screen yeu cau confirm dirty state, implement confirm UI mock; khong can luu draft vao backend.
- Neu can data moi sau click, dung local mock data hoac mock ports hien co.

## File Map

- `01-landing.md`: full screen mo dau.
- `02-store-pairing.md`: full screen nhap Store Key mock.
- `03-create-store.md`: full screen tao quan mock.
- `04-passcode.md`: full screen chon nhan vien + PIN.
- `05-app-shell-left-rail.md`: shell/rail/layout global.
- `06-pos-floor-view.md`: POS floor view.
- `07-order-drawer.md`: drawer tao/sua order.
- `08-payment-drawer.md`: drawer thanh toan cash.
- `09-takeaway-orders.md`: drawer/list mang di.
- `10-order-history-drawer.md`: drawer lich su don.
- `11-employees-drawer.md`: drawer quan ly nhan vien.
- `12-menu-editor-drawer.md`: drawer menu editor.
- `13-floor-plan-editor-drawer.md`: drawer floor-plan editor.
- `14-report-drawer.md`: drawer bao cao.
- `15-general-settings-drawer.md`: drawer cai dat chung.
- `16-clear-demo-dialog.md`: dialog clear demo.
- `17-kitchen-queue-optional.md`: optional drawer bep.
- `18-payment-settings-optional.md`: optional drawer thanh toan/QR.
- `99-flow-mock.md`: flow mock end-to-end cuoi cung.

## Acceptance Criteria

- `npm run build` pass.
- Neu cham UI mock flow: `npm run smoke` pass hoac update smoke theo UI moi.
- Khong co import `@supabase/*` trong UI components.
- Khong co `window.history.pushState`, React Router route moi, hoac URL workflow moi cho POS/admin.
- Tat ca screen trong folder nay co the mo bang internal state va mock data.
