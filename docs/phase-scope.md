# Phase Scope

File này khóa phạm vi phase tiểu luận để tránh nhầm giữa tính năng bắt buộc, tính năng làm nếu kịp và hướng mở rộng sau này.

## Phase Tiểu Luận Bắt Buộc

| Nhóm | Tính năng |
| --- | --- |
| Vào hệ thống | Landing, ghép Store Key, tạo store mới, seed dữ liệu mẫu, hiển thị Store Key/Admin PIN một lần, nhập PIN nhân viên |
| Quyền | Role `admin`, `cashier`, `kitchen`; quyền vào module tách khỏi quyền theo hành động; editor override per-employee (`grants`/`denies`); enforce `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid` ở flow/UI và RPC guardrail |
| POS core | Floor view, mở bàn, tạo/sửa order dine-in, tạo/sửa takeaway, trạng thái bàn trống/đang phục vụ |
| Order | Chọn món, option/topping, ghi chú, cập nhật order mở; hủy order mở bằng cách xóa hết item; người có quyền `order.voidPaid` hủy đơn đã thanh toán từ Lịch sử với lý do, ghi chú và audit |
| Payment | Thanh toán tiền mặt, nhập tiền khách đưa, tính tiền thối, hoàn tất order, set bàn trống, bill/receipt preview; instant pay: chọn món/số lượng tách thành đơn độc lập thanh toán ngay (bill trả trước mang số nhỏ hơn) |
| Admin | Quản lý nhân viên, menu editor có option/topping và upload ảnh món, floor editor có khu/tầng/decor cơ bản |
| Report | Doanh thu theo ngày, số đơn đã thanh toán, trung bình đơn, top món, biểu đồ giờ; số đơn và tổng tiền của đơn paid-rồi-hủy |
| Settings | Tên quán, địa chỉ, footer hóa đơn, timezone, clear dữ liệu mẫu có block khi còn order mở |
| Demo hardening | Loading/error/empty/blocked states cho flow quan trọng, smoke test cho demo |

## Scope Update 2026-06-22

- Upload ảnh món được đưa vào scope hiện tại cho Menu Editor và màn chọn món POS.
- Upload ảnh decor vẫn là mở rộng sau phase này.

## Scope Update 2026-06-23

- Menu Editor được polish thêm: ảnh card món dùng cover, món hết hàng có overlay `Đã bán hết`, selector danh mục chuyển sang select và sắp xếp món dùng switch swap vị trí.
- Giới hạn upload ảnh món theo bucket Supabase: JPG/PNG/WebP, tối đa 5MB.

## Scope Update 2026-07-16

- Hủy đơn đã thanh toán được đưa vào scope hiện tại: mặc định admin có quyền `order.voidPaid`; cashier chỉ thực hiện được khi có grant override và không bị deny.
- Đơn paid bị hủy giữ nguyên số tiền/payment để đối soát, ghi người hủy/thời điểm/lý do, bị loại khỏi doanh thu và được cộng vào `voidCount`/`voidAmount`.
- Phase 19 hoàn thành seam quyền theo hành động và consumer đầu tiên; phần editor/enforce rộng hơn được hoàn tất tiếp ở phase 20.

## Scope Update 2026-07-19

- Employees Drawer đã có editor checkbox theo quyền hiệu lực cho từng nhân viên; đổi role reset default, lưu diff grants/denies và chặn hạ role admin active cuối.
- 5 quyền runtime được enforce ở feature flow; Order/Payment UI có soft gate và migration 012 guardrail ba RPC `submit_order_changes`, `pay_order`, `pay_order_items`.
- Client nhận permission mới khi đăng nhập lại; server guardrail đọc override live. Migration 012 đã apply và Supabase E2E 5/5 pass ngày 2026-07-19.

## Làm Nếu Kịp

- Order history filter nâng cao.
- Tinh chỉnh editor nâng cao để demo dễ hiểu hơn.
- Report mở rộng về UI/visual insight.
- UI polish sâu cho POS core.

## Mở Rộng Sau Phase Này

- Gộp/chuyển bàn.
- Kitchen queue thật nối backend và trạng thái order item.
- QR/bank/e-wallet payment thật.
- Discount/voucher UI.
- Upload ảnh decor.
- Offline-first/local database.
- Native printer, driver, USB, ESC/POS hoặc service in thật.
- Quản lý kho nguyên liệu, loyalty, ca/chấm công.
- Super-admin nhiều quán/chuỗi chi nhánh.
- Custom role, audit log đổi quyền, module permission per-employee và các quyền tương lai như refund/discount/price override/mở két/ca làm việc.

## Ghi Chú Quan Trọng

- Một số màn optional có thể đang tồn tại dưới dạng UI scaffold để chứng minh seam, nhưng không được tính là thiếu nếu chưa có logic thật trong phase tiểu luận.
- Schema có chừa field/enum cho mở rộng sau như `payment_method`, `discount_type`, `order_item_status`, nhưng UI phase này chỉ cần phần đã khóa ở mục bắt buộc.
- Khi bảo vệ, nên nói rõ: dự án ưu tiên vận hành cafe nhỏ, realtime online, dữ liệu quan hệ và demo end-to-end thay vì mở rộng quá rộng.
