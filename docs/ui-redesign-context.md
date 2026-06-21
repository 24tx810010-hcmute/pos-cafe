# UI Redesign Context

File này là context gọn để đưa cho Gemini/Stitch hoặc agent UI trước khi tạo ảnh/mockup/code UI mới. Mục tiêu là redesign thẩm mỹ và UX, không đổi backend trước.

## Mục Tiêu

- Làm POS Cafe nhìn chuyên nghiệp hơn, thân thiện thao tác hơn và hợp môi trường quán cà phê.
- Ưu tiên POS core trước vì người dùng nhìn nhiều nhất: floor view, order drawer, payment drawer, takeaway.
- Giữ workflow hiện có; không redesign bằng cách đổi logic/backend trước.

## Nguyên Tắc UI

- Ngôn ngữ UI: tiếng Việt.
- Single URL app; navigation là internal state/drawers.
- Landscape-first: desktop, tablet landscape, phone landscape usable; portrait hiện rotate guidance.
- Tối đa hai vùng nội dung chính trên mỗi màn.
- POS/admin nên dense, operational, scan-friendly; không làm landing/marketing style cho màn vận hành.
- Không đưa từ nội bộ vào UI người dùng: mock, seed, DB, MVP, Draft, tombstone, Supabase, void.
- Không thêm dashboard top nav hoặc category rail kiểu mock ngoài nếu không khớp workflow hiện tại.

## Màn Ưu Tiên

1. **POS Floor View:** giúp staff scan bàn nhanh, thấy bàn trống/đang phục vụ, order mở và takeaway.
2. **Order Drawer:** chọn món/option nhanh, cart rõ, dirty/closed states rõ nhưng không nặng.
3. **Payment Drawer:** touch-first, tổng tiền và hành động hoàn tất luôn nổi bật, nhập tiền nhanh, receipt compact.
4. **Takeaway Drawer:** list/detail/action rõ, dễ tạo order mới và tiếp tục thanh toán.

## Dữ Liệu Contract Tối Thiểu

- Current employee và role.
- Floor areas, tables, decor, table status.
- Open orders, order number, order type, total, table mapping.
- Menu categories, items, option groups, option values.
- Cart lines, quantity, note, subtotal/total.
- Payment amount, received amount, change/remaining, payment status.
- Loading/error/empty/blocked/dirty states.

## Screenshot Checklist

Nhánh `docs` không giữ ảnh binary. Khi cần artefact/mockup mới, chụp lại các màn được liệt kê ở [screenshots/current/](screenshots/current/) và ưu tiên:

- `07-pos-floor-view.png`
- `08-order-drawer-new-draft.png`
- `10-order-drawer-existing-order.png`
- `11-payment-drawer-normal-cash.png`
- `12-payment-drawer-insufficient-cash.png`
- `13-takeaway-drawer.png`

Các màn còn lại dùng để hiểu pre-login, admin drawer, settings và optional/future screens.

## Điều Không Cần Làm Trong Redesign Ảnh

- Không thiết kế QR/e-wallet processing như đã hoàn chỉnh.
- Không thiết kế kitchen queue như tính năng production bắt buộc.
- Không thêm discount/voucher nếu không có yêu cầu mới.
- Không đổi data model hoặc flow transaction.
- Không che mất thông tin POS quan trọng bằng hero/illustration lớn.
