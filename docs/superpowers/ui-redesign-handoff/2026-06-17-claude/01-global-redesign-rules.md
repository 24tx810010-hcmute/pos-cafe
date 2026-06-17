# Global Redesign Rules

Áp dụng cho tất cả màn hình và popup.

## Product Positioning

POS Cafe là app vận hành cho quán cà phê: cashier cần tạo đơn nhanh, admin cần chỉnh menu/bàn/nhân viên, quản lý cần xem doanh thu. UI phải ưu tiên thao tác lặp lại, scan nhanh, ít giải thích nội bộ.

Không làm UI theo hướng landing marketing, dashboard trang trí, hay demo prototype. Mỗi screen cần có mục đích nghiệp vụ rõ ràng.

## Layout Principles

- Desktop 1440x900 là viewport demo chính.
- Phone landscape 844x390 và tablet landscape 1024x600 phải dùng được.
- Phone portrait chỉ hiện rotate guidance.
- App shell không nên page-scroll; từng pane/drawer tự scroll.
- Header của drawer sticky; CTA save/pay/submit nên nằm ở header hoặc footer sticky.
- Không lồng card trong card. Chỉ dùng card cho item lặp lại, dialog, hoặc form panel cần frame thật sự.
- Card radius tối đa 8px.
- Không dùng decorative gradient/orb/blob/background.
- Text không được tràn nút, card, row, badge.

## Visual Direction

- Professional POS, dense but readable.
- Surface nên ít viền hơn hiện tại; dùng divider và whitespace có chủ đích.
- Màu chính: teal `#0F766E`; dùng thêm neutral slate, green success, amber warning, red danger.
- Không để UI thành một màu teal/slate đơn điệu. Dùng màu phụ nhẹ cho status, station, payment, area.
- Typography: title screen rõ, pane heading nhỏ hơn, row labels gọn.
- Icon: dùng lucide-react nếu có icon phù hợp; icon-only button phải có `title`/tooltip.

## Copy Hygiene

Cấm user-facing text có các từ/cụm:

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
- `draft` nếu hiện bằng tiếng Anh
- `paid order`, `void`

Dùng tiếng Việt sản phẩm:

- "Đơn mới", "Đơn chưa gửi", "Đã thanh toán", "Đơn đã hủy".
- "Tại bàn" thay cho "Dine-in".
- "Nhân viên" thay cho "NV" nếu không gian cho phép.
- "Thanh toán" thay cho "TT/QR".
- "Dữ liệu mẫu" thay cho "Demo data" nếu screen dành cho admin.

## Read-Only Field Rules

Chỉ show read-only field khi nó giúp quyết định:

- Tốt: trạng thái bàn, tổng tiền, số món, nhân viên tạo đơn, payment status.
- Cần ẩn/bớt: timezone, currency, internal version, raw id, z-index, asset key, canvas size, status chỉ để debug.
- Nếu cần show advanced field trong editor, đưa vào "Nâng cao" collapsed section.

## Interaction Rules

- Primary CTA phải rõ: "In/Gửi đơn", "Thanh toán", "Hoàn tất thanh toán", "Lưu menu", "Lưu sơ đồ".
- Secondary action phải nhỏ hơn: "Hủy", "Đóng", "Thử lại".
- Dirty state phải có badge nhỏ và confirm dialog rõ.
- Empty state không chỉ là text trong vùng rộng; cần có CTA hoặc next action.
- Loading state không làm layout nhảy.
- Error state phải có retry action nếu có query.

## Responsive Rules

- Desktop: có thể dùng 3 pane nếu workflow cần.
- Tablet/phone landscape: giảm về 2 pane hoặc tabs, không ép 3 pane quá chật.
- Pane widths phải có `minmax`, `min-width: 0`, `overflow: auto`.
- Button text dài phải wrap hoặc đổi label ngắn hơn; không để cắt chữ.
- Floor plan vẫn giữ logical stage scale-to-fit, không lưu viewport pixel.

## Testing Rules

Sau mỗi nhóm UI polish:

```powershell
npm run test
npm run build
git diff --check
```

Nếu chạm POS/order/payment:

```powershell
VITE_DATA_MODE=mock npm run smoke
```

Nếu chạm copy:

```powershell
npm run test -- demoCopyPolish
```

