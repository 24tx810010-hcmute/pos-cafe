# Features

## Store & Session

- Tạo store mới với tên hiển thị, Store Key và Admin PIN.
- Ghép store bằng Store Key.
- Lưu session store ở client adapter.
- Nhập PIN nhân viên để mở app shell.
- Khóa phiên nhân viên để quay lại passcode.

## Role & Permission

- `admin`: dùng toàn bộ POS và admin modules.
- `cashier`: dùng floor, order, payment, order history.
- `kitchen`: role được chừa sẵn cho kitchen queue; không phải feature bắt buộc của phase này.
- UI disable/guard module không có quyền; core guard vẫn kiểm tra ở action quan trọng.

## POS Floor

- Xem sơ đồ bàn theo khu/tầng.
- Lọc bàn theo trạng thái.
- Xem bàn trống/đang phục vụ, order number và tổng tiền khi có order mở.
- Mở order tại bàn.
- Refresh floor/open orders từ toolbar sơ đồ khi cần.

## Order

- Tạo order dine-in hoặc takeaway.
- Chọn món theo danh mục.
- Chọn option/topping, số lượng và ghi chú.
- Submit order lên backend qua RPC; backend quyết định snapshot tên/giá.
- Mở lại order đang mở để chỉnh sửa.
- Dirty close confirm cho draft/chỉnh sửa chưa lưu.
- Nếu order đã đóng/stale, UI hiển thị trạng thái không thể thanh toán/chỉnh như order mở.

## Payment

- Thanh toán tiền mặt cho order mở.
- Nhập tiền khách đưa, dùng quick cash buttons, tính tiền thối/thiếu.
- Chặn hoàn tất khi tiền nhận chưa đủ.
- Complete payment gọi RPC transaction: tạo payment, set order paid, set bàn empty nếu dine-in.
- Render receipt bằng browser print preview.

## Takeaway

- Xem danh sách order takeaway đang mở.
- Mở chi tiết takeaway, tiếp tục chỉnh order hoặc chuyển sang thanh toán.
- Tạo takeaway mới từ drawer.
- Phần paid takeaway hiện có dữ liệu UI-side sample; không phải lịch sử paid takeaway thật đầy đủ.

## Order History

- Xem danh sách đơn theo khoảng ngày.
- Lọc theo trạng thái/order type/search ở UI.
- Xem detail đơn, item snapshot, option, total, paid time.
- Dùng cho cashier và admin.

## Employees

- Xem nhân viên theo role/trạng thái.
- Tạo nhân viên.
- Sửa tên/role/trạng thái.
- Reset PIN.
- Bảo vệ rule còn ít nhất một admin hoạt động.

## Menu Editor

- Quản lý category.
- Quản lý món: tên, giá, danh mục, trạng thái bán.
- Quản lý option group và option value cho size/topping.
- Lưu theo changeset create/update/delete, không hard-delete dữ liệu editor.

## Floor Editor

- Quản lý khu/tầng.
- Tạo/sửa/xóa mềm bàn.
- Tạo/sửa/xóa mềm decor cơ bản: tường, cây, quầy, cửa, decor/image asset.
- Lưu layout không ghi đè `table.status`.

## Report

- Core report theo `business_date`.
- Doanh thu, số đơn đã thanh toán, average ticket, top item.
- Biểu đồ doanh thu theo giờ.
- Report chỉ tính order đã thanh toán và loại order hủy.

## Settings & Maintenance

- Sửa tên hiển thị, địa chỉ, footer hóa đơn, timezone.
- Preview thông tin hóa đơn.
- Clear dữ liệu mẫu theo seed bundle, chỉ admin dùng.
- Clear demo bị block khi còn order mở để tránh mất dữ liệu đang bán.

## Optional/Future UI

- Kitchen drawer hiện là UI-side ticket state, chưa phải kitchen workflow thật.
- Payment settings/QR hiện là preview UI local, chưa persist qua `settingsRepo` và chưa phải QR payment processing thật.

## Shared UI Behavior

- Popup/modal dùng `PortalPopup`; drawer dùng `PortalDrawer`.
- Drawer có overlay mờ `rgba(0,0,0,0.2)`, click overlay để đóng và slide-in theo placement khi mở.
- Drawer mặc định dùng workspace viewport sau `LeftNav` để không che left rail.
