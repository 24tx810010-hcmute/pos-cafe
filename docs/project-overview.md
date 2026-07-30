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
- **Bếp:** chưa phải người dùng hiện hành. Enum/schema và UI scaffold được giữ làm seam tương lai, nhưng role/module kitchen đã ẩn khỏi nav, màn PIN và quản lý nhân viên.
- **Pre-login user:** ghép cửa hàng, tạo cửa hàng mới, nhập mã PIN nhân viên.

## Phạm Vi Hiện Tại

Phase tiểu luận ưu tiên demo end-to-end:

1. Tạo hoặc ghép cửa hàng.
2. Đăng nhập nhân viên bằng PIN.
3. Vận hành floor/table, order dine-in và takeaway.
4. Thanh toán tiền mặt và in/preview hóa đơn — cả bàn một chạm, hoặc instant pay tách món thành đơn riêng cho từng khách.
5. Quản lý nhân viên thuộc hai role hiện hành `admin`/`cashier` và quyền thao tác per-employee; menu có option/topping; sơ đồ bàn có khu/tầng/decor và nền bàn tùy chọn.
6. Xem lịch sử đơn; hủy đơn đã thanh toán theo quyền hành động, lý do và audit; theo dõi doanh thu, số đơn hủy và tiền hủy trong báo cáo.
7. Cài đặt thông tin quán và reset dữ liệu mẫu có kiểm soát.

## Ràng Buộc

- Single URL app: không dùng route riêng cho từng màn, navigation bằng internal state/drawer.
- Landscape-first: desktop, tablet landscape và phone landscape phải dùng được; phone portrait hiển thị hướng dẫn xoay ngang.
- Online-only trong phase này; offline-first là hướng mở rộng.
- Payment thật trong phase này là cash-only; QR/bank/e-wallet là hướng mở rộng.
- Không tích hợp máy in native/ESC/POS trong phase này; dùng browser print preview.

## Trạng Thái Gần Nhất

- App truth được đối chiếu lại ngày **2026-07-30** từ baseline `main@b7b7262`; chuỗi migration hiện hành là 001–013. Migration 013 đã được apply/verify trước lần audit. Kitchen đã được chốt future-only và loại khỏi các entry point UI hiện hành.
- Nhánh `docs` là nhánh tài liệu độc lập, chỉ giữ file `.md` để đọc nhanh; không merge vào `main` và không chứa source app/binary artifact.
- Mock mode và local test cover core flow cùng các admin module. Cloud E2E gần nhất cover một tập 5 flow integration gồm tạo/pay/history/report, instant pay, hủy đơn paid, realtime và deny-permission; không suy rộng thành toàn bộ admin UI đã chạy E2E trên cloud.
- Kiến trúc hiện có boundary guard bằng TypeScript import scanner, ports/adapters rõ layer, split Supabase/mock adapters, device print port no-op + receipt preview UI, portal popup/drawer primitives và quyền theo hành động per-employee (`permission_overrides`, `hasPermission`/`requirePermission`) đã enforce ở 5 action runtime.
- UI đã qua pass Tailwind-first; `LeftNav` là rail chính, drawer mặc định full-screen, click overlay để đóng và slide-in theo placement. Employees Drawer dùng layout danh sách–chi tiết hai pane; Floor stage scale-to-fit; catalog có 9 texture tường + 131 ảnh decor và nền trắng + 11 ảnh nền bàn.
- Validation local ngày 2026-07-30: **257/257** unit/component/feature tests pass, production build pass, mock Playwright smoke **34 pass/31 skipped/0 failed**. Supabase suite gần nhất **5/5 pass** ngày 2026-07-19; PostgREST migration 013 verify HTTP 200 ngày 2026-07-27. Xem [testing.md](testing.md).
- Giới hạn đồng bộ đã biết: realtime adapter chưa subscribe `menu_item_option_groups`, nên thay đổi chỉ gắn/bỏ modifier khỏi món cần refresh/reconnect ở thiết bị khác.
- Các giới hạn bảo mật, realtime, thanh toán, in, hiệu năng và deployment được phân loại tại [limitations.md](limitations.md); không claim employee PIN là DB identity, offline, QR processing hoặc máy in POS thật.
