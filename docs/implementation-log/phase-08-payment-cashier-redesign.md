# Phase 08 - Payment Cashier Redesign

## Mục Tiêu

- Redesign Payment Drawer theo đúng ngữ cảnh POS: màn dành cho thu ngân, không phải màn hiển thị cho khách.
- Giữ layout ổn trên desktop, tablet landscape và phone landscape bằng cách giảm padding/gap/font/height ở màn nhỏ thay vì đổi cấu trúc UI.
- Thêm điều khiển in hóa đơn để thu ngân có thể thanh toán mà không mở print preview.

## Branch / Commit

- Branch code: `ui-payment-cashier-responsive`
- Merge vào `main`: `ef194c2 feat(payment): redesign cashier checkout`

## Đã Implement

- Payment Drawer chia thành hai vùng chính:
  - Console thu ngân bên trái: danh sách phương thức thanh toán, input `Tiền khách đưa`, quick amount buttons và keypad custom.
  - Order/summary bên phải: khách hàng fallback `Khách lẻ`, danh sách món cuộn dọc, `Khách đưa`, `Tiền thối`/`Còn thiếu`, `Tổng đơn`, checkbox in hóa đơn và nút `Hoàn tất thanh toán`.
- `Khách đưa` và `Tiền thối` dùng cùng hierarchy/font để tránh lệch mức nhấn thị giác.
- Header hiển thị thu ngân đang đăng nhập, bàn/order type và số lượng món.
- Phone landscape giữ layout hai cột; ở breakpoint nhỏ chỉ giảm spacing/typography và ẩn CTA phụ trên header, giữ CTA chính ở cuối summary.
- Payment method list chuẩn bị cho nhiều loại thanh toán, nhưng chỉ `Tiền mặt` active. Thẻ/chuyển khoản/QR disabled để không hiểu nhầm là đã xử lý thật.
- Flow thanh toán thêm `printReceipt?: boolean`; mặc định vẫn in hóa đơn, nhưng nếu checkbox bị bỏ chọn thì không gọi `renderReceipt`.
- Smoke/Supabase E2E chuyển sang target footer CTA `pay-button-footer`, vì đây là CTA chính của màn payment mới.

## Test / Build / Smoke

- `npm run test`: 35 files, 154 tests passed.
- `npm run build`: passed.
- `npm run smoke`: 17 passed, 8 skipped.
- `git diff --check`: passed, chỉ có warning CRLF do Git trên Windows.
- Browser responsive check:
  - 844x390 phone landscape.
  - 1180x820 tablet landscape.
  - 1024x640.
  - 1280x720.
  - 1440x900.
- Các viewport trên đều xác nhận footer CTA visible, checkbox nằm trên CTA, keypad đủ nút, không phát hiện text overflow trong Payment Drawer.

## Quyết Định Kỹ Thuật

- Giữ thanh toán thật ở method `cash`; không thêm processing cho thẻ/chuyển khoản/QR trong phase này.
- Không thêm customer field vào domain trong phase này; UI dùng fallback `Khách lẻ`.
- Không đưa mockup/screenshot prototype vào `main`; ảnh verify chỉ là artifact cục bộ của quá trình kiểm tra.

## Gap Còn Lại

- Customer name thật cần field/model/backend riêng nếu muốn hiển thị khách hàng cụ thể.
- Non-cash payment processing vẫn là future scope.
- Nếu báo cáo cần hình ảnh minh họa chính thức, nên chụp lại screenshot từ bản `main` đã merge và lưu theo quy ước `docs/screenshots`.
