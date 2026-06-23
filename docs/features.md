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
- Màn thanh toán là console dành cho thu ngân, không phải màn đưa cho khách.
- Header hiển thị thu ngân đang đăng nhập, vị trí/order type và số lượng món; khách hàng hiện fallback là `Khách lẻ` vì `OrderDetail` chưa có customer field.
- Khu phương thức thanh toán dùng danh sách có thể mở rộng; hiện chỉ bật `Tiền mặt`, các phương thức thẻ/chuyển khoản/QR hiển thị disabled để tránh hiểu nhầm là đã xử lý thật.
- Khu nhập tiền đặt input `Tiền khách đưa` phía trên keypad custom, có quick cash buttons và hỗ trợ nhập số thủ công.
- Summary bên phải hiển thị danh sách món cuộn dọc, `Khách đưa`, `Tiền thối`/`Còn thiếu`, `Tổng đơn`, checkbox `In hóa đơn sau khi thanh toán` mặc định bật và nút hoàn tất ở cuối summary.
- Chặn hoàn tất khi tiền nhận chưa đủ.
- Complete payment gọi RPC transaction: tạo payment, set order paid, set bàn empty nếu dine-in.
- Render receipt bằng browser print preview khi checkbox in hóa đơn bật; nếu bỏ chọn thì vẫn thanh toán nhưng không gọi print receipt.

## Takeaway

- Xem danh sách order takeaway đang mở.
- Mở chi tiết takeaway, tiếp tục chỉnh order hoặc chuyển sang thanh toán.
- Tạo takeaway mới từ drawer.
- Phần paid takeaway hiện có dữ liệu UI-side sample; không phải lịch sử paid takeaway thật đầy đủ.

## Order History

- Xem danh sách đơn theo khoảng ngày; mặc định `Hôm nay`.
- Chỉ hiển thị đơn đã kết thúc (`Đã thanh toán`, `Đã hủy`); đơn đang mở thuộc màn Bàn/Mang đi.
- Bộ lọc ngày là một nút `Filter date`, mở popup chọn `Hôm nay`, `7 ngày`, `Tháng này` hoặc khoảng ngày tùy chọn.
- Danh sách đơn dùng phân trang để giữ payload ổn định; date/status/type/search được áp dụng ở repository trước khi cắt trang.
- Layout chính là 2 cột: cột trái hiển thị thông tin nhanh của đơn, cột phải hiển thị chi tiết dạng receipt.
- Cột phải hiển thị item snapshot/options/note/quantity, khách hàng fallback `Khách lẻ`, người thanh toán fallback `Khách lẻ`, thu ngân từ payment employee, phương thức thanh toán, paid time.
- Summary thanh toán cố định cuối cột phải theo thứ tự `Khách đưa`, `Tiền thừa`, `Tổng tiền`; `Tổng tiền` nổi bật hơn.
- `OrderDetail` đọc payment snapshot để lịch sử hiển thị đúng `receivedAmount` và `changeAmount`, không tính tạm ở UI.
- Dùng cho cashier và admin.

## Employees

- Xem nhân viên theo role/trạng thái.
- Tạo nhân viên.
- Sửa tên/role/trạng thái.
- Reset PIN.
- Bảo vệ rule còn ít nhất một admin hoạt động.

## Menu Editor

- Upload/lưu ảnh món JPG/PNG/WebP và hiển thị ảnh trong màn quản lý menu.
- Upload ảnh món có cảnh báo và chặn file quá 5MB trước khi lưu.
- Màn chọn món khi bán hàng hiển thị ảnh món nếu có, fallback bằng icon khi chưa có ảnh; card hết hàng có overlay `Đã bán hết`.
- Card món trong Menu Editor dùng ảnh cover, bỏ pill trạng thái bán khỏi card; trạng thái vẫn chỉnh ở panel chi tiết.
- Panel chi tiết món dùng select `Danh mục`, upload/preview ảnh, trạng thái bán và nhóm tùy chọn.
- Đổi thứ tự món bằng switch `Đổi vị trí`: chọn món gốc, bật switch, bấm món khác trong cùng danh mục để swap rồi tự tắt switch.

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
- Popup/modal dùng overlay full-screen để modal xác nhận che toàn bộ app shell khi cần.
- Drawer có overlay mờ `rgba(0,0,0,0.2)`, click overlay để đóng và slide-in theo placement khi mở.
- Drawer mặc định dùng workspace viewport sau `LeftNav` để không che left rail.
