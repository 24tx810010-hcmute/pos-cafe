# Phase Scope

File này khóa phạm vi phase tiểu luận để tránh nhầm giữa tính năng bắt buộc, tính năng làm nếu kịp và hướng mở rộng sau này.

## Phase Tiểu Luận Bắt Buộc

| Nhóm | Tính năng |
| --- | --- |
| Vào hệ thống | Landing, ghép Store Key, tạo store mới, seed dữ liệu mẫu, hiển thị Store Key/Admin PIN một lần, nhập PIN nhân viên |
| Quyền | Role `admin`, `cashier`, `kitchen`; admin dùng toàn bộ, cashier dùng POS core, kitchen giữ seam |
| POS core | Floor view, mở bàn, tạo/sửa order dine-in, tạo/sửa takeaway, trạng thái bàn trống/đang phục vụ |
| Order | Chọn món, option/topping, ghi chú, cập nhật order mở, hủy order mở bằng cách xóa hết item |
| Payment | Thanh toán tiền mặt, nhập tiền khách đưa, tính tiền thối, hoàn tất order, set bàn trống, bill/receipt preview |
| Admin | Quản lý nhân viên, menu editor có option/topping, floor editor có khu/tầng/decor cơ bản |
| Report | Doanh thu theo ngày, số đơn đã thanh toán, trung bình đơn, top món, biểu đồ giờ |
| Settings | Tên quán, địa chỉ, footer hóa đơn, timezone, clear dữ liệu mẫu có block khi còn order mở |
| Demo hardening | Loading/error/empty/blocked states cho flow quan trọng, smoke test cho demo |

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
- Upload ảnh món/decor.
- Offline-first/local database.
- Native printer, driver, USB, ESC/POS hoặc service in thật.
- Quản lý kho nguyên liệu, loyalty, ca/chấm công.
- Super-admin nhiều quán/chuỗi chi nhánh.

## Ghi Chú Quan Trọng

- Một số màn optional có thể đang tồn tại dưới dạng UI scaffold để chứng minh seam, nhưng không được tính là thiếu nếu chưa có logic thật trong phase tiểu luận.
- Schema có chừa field/enum cho mở rộng sau như `payment_method`, `discount_type`, `order_item_status`, nhưng UI phase này chỉ cần phần đã khóa ở mục bắt buộc.
- Khi bảo vệ, nên nói rõ: dự án ưu tiên vận hành cafe nhỏ, realtime online, dữ liệu quan hệ và demo end-to-end thay vì mở rộng quá rộng.
