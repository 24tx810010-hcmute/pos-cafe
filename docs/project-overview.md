# Project Overview

POS Cafe là web app POS cho quán cà phê nhỏ, tập trung vào vận hành tại quầy và tại bàn: tạo quán, đăng nhập nhân viên, quản lý sơ đồ bàn, tạo đơn, thanh toán tiền mặt, xem lịch sử và hủy đơn đã thanh toán có audit, quản lý menu/nhân viên/sơ đồ, xem báo cáo doanh thu và chuẩn bị demo cho tiểu luận cuối kì.

## Bài Toán

- Quán cần một hệ thống POS dễ mở trên nhiều thiết bị mà không phải cài app native.
- Nhân viên cần thao tác nhanh với bàn, đơn, món, thanh toán và đơn mang đi.
- Quản lý cần sửa menu, sơ đồ bàn, nhân viên, thông tin hóa đơn và xem doanh thu cơ bản.
- Dự án cần đủ chiều sâu kỹ thuật để trình bày: data model quan hệ, quyền, RPC transaction, realtime multi-device, UI state, testing và deployment miễn phí.

## Người Dùng Chính

- **Thu ngân:** mở bàn, tạo/sửa đơn, thanh toán, xem lịch sử đơn.
- **Quản lý:** toàn quyền POS và admin: nhân viên, menu, sơ đồ, báo cáo, hủy đơn đã thanh toán, cài đặt, bảo trì dữ liệu mẫu.
- **Bếp:** role được chừa sẵn; kitchen queue thật là mở rộng sau phase tiểu luận.
- **Pre-login user:** ghép cửa hàng, tạo cửa hàng mới, nhập mã PIN nhân viên.

## Phạm Vi Hiện Tại

Phase tiểu luận ưu tiên demo end-to-end:

1. Tạo hoặc ghép cửa hàng.
2. Đăng nhập nhân viên bằng PIN.
3. Vận hành floor/table, order dine-in và takeaway.
4. Thanh toán tiền mặt và in/preview hóa đơn — cả bàn một chạm, hoặc instant pay tách món thành đơn riêng cho từng khách.
5. Quản lý nhân viên và quyền thao tác per-employee; menu có option/topping; sơ đồ bàn có khu/tầng/decor.
6. Xem lịch sử đơn; hủy đơn đã thanh toán theo quyền hành động, lý do và audit; theo dõi doanh thu, số đơn hủy và tiền hủy trong báo cáo.
7. Cài đặt thông tin quán và reset dữ liệu mẫu có kiểm soát.

## Ràng Buộc

- Single URL app: không dùng route riêng cho từng màn, navigation bằng internal state/drawer.
- Landscape-first: desktop, tablet landscape và phone landscape phải dùng được; phone portrait hiển thị hướng dẫn xoay ngang.
- Online-only trong phase này; offline-first là hướng mở rộng.
- Payment thật trong phase này là cash-only; QR/bank/e-wallet là hướng mở rộng.
- Không tích hợp máy in native/ESC/POS trong phase này; dùng browser print preview.

## Trạng Thái Gần Nhất

- App truth được đối chiếu ngày 2026-07-20 từ `main` commit `de35d10`; migration 012 đã áp cloud.
- Nhánh `docs` là nhánh tài liệu độc lập, chỉ giữ file `.md` để đọc nhanh; không merge vào `main` và không chứa source app/binary artifact.
- Core flow đã chạy end-to-end với mock và Supabase: tạo/ghép store, PIN, floor/order/payment, instant pay, history/report, hủy đơn đã thanh toán và admin modules.
- Kiến trúc hiện có boundary guard bằng TypeScript import scanner, ports/adapters rõ layer, split Supabase/mock adapters, browser print adapter, portal popup/drawer primitives và quyền theo hành động per-employee (`permission_overrides`, `hasPermission`/`requirePermission`) đã enforce ở 5 action runtime.
- UI đã qua pass Tailwind-first/two-column drawer; `LeftNav` là left rail chính của app shell, drawer dùng overlay chung trong workspace sau rail, click overlay để đóng và slide-in animation theo placement.
- Validation phase 20 ngày 2026-07-19: 243/243 unit/component/feature tests pass, production build pass, mock Playwright smoke 27 pass/18 skipped theo viewport và Supabase E2E 5/5 pass, gồm direct RPC `FORBIDDEN` cho cashier bị deny `payment.take`.
