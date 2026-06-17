# Global Redesign Rules

Ap dung cho tat ca man hinh va popup.

## Product Positioning

POS Cafe la app van hanh cho quan ca phe: cashier can tao don nhanh, admin can chinh menu/ban/nhan vien, quan ly can xem doanh thu. UI phai uu tien thao tac lap lai, scan nhanh, it giai thich noi bo.

Khong lam UI theo huong landing marketing, dashboard trang tri, hay demo prototype. Moi screen can co muc dich nghiep vu ro rang.

## Layout Principles

- Desktop 1440x900 la viewport demo chinh.
- Phone landscape 844x390 va tablet landscape 1024x600 phai dung duoc.
- Phone portrait chi hien rotate guidance.
- App shell khong nen page-scroll; tung pane/drawer tu scroll.
- Header cua drawer sticky; CTA save/pay/submit nen nam o header hoac footer sticky.
- Khong long card trong card. Chi dung card cho item lap lai, dialog, hoac form panel can frame that su.
- Card radius toi da 8px.
- Khong dung decorative gradient/orb/blob/background.
- Text khong duoc tran nut, card, row, badge.

## Visual Direction

- Professional POS, dense but readable.
- Surface nen it vien hon hien tai; dung divider va whitespace co chu dich.
- Mau chinh: teal `#0F766E`; dung them neutral slate, green success, amber warning, red danger.
- Khong de UI thanh mot mau teal/slate don dieu. Dung mau phu nhe cho status, station, payment, area.
- Typography: title screen ro, pane heading nho hon, row labels gon.
- Icon: dung lucide-react neu co icon phu hop; icon-only button phai co `title`/tooltip.

## Copy Hygiene

Cam user-facing text co cac tu/cum:

- `mock`
- `Supabase`
- `DB`
- `MVP`
- `placeholder`
- `seed`
- `tombstone`
- `deactivate`
- `raw Store Key`
- `config`
- `draft` neu hien bang tieng Anh
- `paid order`, `void`

Dung tieng Viet san pham:

- "Don moi", "Don chua gui", "Da thanh toan", "Don da huy".
- "Tai ban" thay cho "Dine-in".
- "Nhan vien" thay cho "NV" neu khong gian cho phep.
- "Thanh toan" thay cho "TT/QR".
- "Du lieu mau" thay cho "Demo data" neu screen danh cho admin.

## Read-Only Field Rules

Chi show read-only field khi no giup quyet dinh:

- Tot: trang thai ban, tong tien, so mon, nhan vien tao don, payment status.
- Can an/bot: timezone, currency, internal version, raw id, z-index, asset key, canvas size, status chi de debug.
- Neu can show advanced field trong editor, dua vao "Nang cao" collapsed section.

## Interaction Rules

- Primary CTA phai ro: "In/Gui don", "Thanh toan", "Hoan tat thanh toan", "Luu menu", "Luu so do".
- Secondary action phai nho hon: "Huy", "Dong", "Thu lai".
- Dirty state phai co badge nho va confirm dialog ro.
- Empty state khong chi la text trong vung rong; can co CTA hoac next action.
- Loading state khong lam layout nhay.
- Error state phai co retry action neu co query.

## Responsive Rules

- Desktop: co the dung 3 pane neu workflow can.
- Tablet/phone landscape: giam ve 2 pane hoac tabs, khong ep 3 pane qua chat.
- Pane widths phai co `minmax`, `min-width: 0`, `overflow: auto`.
- Button text dai phai wrap hoac doi label ngan hon; khong de cat chu.
- Floor plan van giu logical stage scale-to-fit, khong luu viewport pixel.

## Testing Rules

Sau moi nhom UI polish:

```powershell
npm run test
npm run build
git diff --check
```

Neu cham POS/order/payment:

```powershell
VITE_DATA_MODE=mock npm run smoke
```

Neu cham copy:

```powershell
npm run test -- demoCopyPolish
```

