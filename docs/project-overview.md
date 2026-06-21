# Project Overview

POS Cafe là web app POS cho quán cà phê nhỏ, tập trung vào vận hành tại quầy và tại bàn: tạo quán, đăng nhập nhân viên, quản lý sơ đồ bàn, tạo đơn, thanh toán tiền mặt, xem lịch sử đơn, quản lý menu/nhân viên/sơ đồ, xem báo cáo cơ bản và chuẩn bị demo cho tiểu luận cuối kì.

## Bài Toán

- Quán cần một hệ thống POS dễ mở trên nhiều thiết bị mà không phải cài app native.
- Nhân viên cần thao tác nhanh với bàn, đơn, món, thanh toán và đơn mang đi.
- Quản lý cần sửa menu, sơ đồ bàn, nhân viên, thông tin hóa đơn và xem doanh thu cơ bản.
- Dự án cần đủ chiều sâu kỹ thuật để trình bày: data model quan hệ, quyền, RPC transaction, realtime multi-device, UI state, testing và deployment miễn phí.

## Người Dùng Chính

- **Thu ngân:** mở bàn, tạo/sửa đơn, thanh toán, xem lịch sử đơn.
- **Quản lý:** toàn quyền POS và admin: nhân viên, menu, sơ đồ, báo cáo, cài đặt, bảo trì dữ liệu mẫu.
- **Bếp:** role được chừa sẵn; kitchen queue thật là mở rộng sau phase tiểu luận.
- **Pre-login user:** ghép cửa hàng, tạo cửa hàng mới, nhập mã PIN nhân viên.

## Phạm Vi Hiện Tại

Phase tiểu luận ưu tiên demo end-to-end:

1. Tạo hoặc ghép cửa hàng.
2. Đăng nhập nhân viên bằng PIN.
3. Vận hành floor/table, order dine-in và takeaway.
4. Thanh toán tiền mặt và in/preview hóa đơn.
5. Quản lý nhân viên, menu có option/topping, sơ đồ bàn có khu/tầng/decor.
6. Xem lịch sử đơn, báo cáo doanh thu cơ bản.
7. Cài đặt thông tin quán và reset dữ liệu mẫu có kiểm soát.

## Ràng Buộc

- Single URL app: không dùng route riêng cho từng màn, navigation bằng internal state/drawer.
- Landscape-first: desktop, tablet landscape và phone landscape phải dùng được; phone portrait hiển thị hướng dẫn xoay ngang.
- Online-only trong phase này; offline-first là hướng mở rộng.
- Payment thật trong phase này là cash-only; QR/bank/e-wallet là hướng mở rộng.
- Không tích hợp máy in native/ESC/POS trong phase này; dùng browser print preview.

## Trạng Thái Gần Nhất

- App truth được đối chiếu từ `main` commit `ef3ecdb`.
- Docs branch đang ở commit `1334372` trước lần refactor knowledge base này.
- Core flow đã có nền chức năng; UI hiện tại còn cần redesign để đẹp và thân thiện hơn cho POS core.
