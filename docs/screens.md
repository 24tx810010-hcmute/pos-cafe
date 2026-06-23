# Screens

Danh sách này mô tả các màn/drawer hiện có theo contract: màn làm gì, cần dữ liệu tối thiểu nào và action chính là gì.

## 1. Landing

- **Purpose:** điểm bắt đầu để ghép cửa hàng hoặc tạo cửa hàng mới.
- **User:** pre-login user.
- **Minimum data:** không cần server data ngoài trạng thái session.
- **Primary actions:** ghép cửa hàng, tạo cửa hàng.
- **Important states:** loading session, already paired redirect, unpaired.

## 2. Store Pairing

- **Purpose:** nhập Store Key để ghép thiết bị vào store hiện có.
- **User:** pre-login user.
- **Minimum data:** Store Key.
- **Primary actions:** nhập key, xác nhận ghép, quay lại.
- **Important states:** invalid key, network/backend error, success chuyển passcode.

## 3. Create Store Form & Success

- **Purpose:** tạo store mới và nhận Store Key/Admin PIN ban đầu.
- **User:** chủ quán/quản lý.
- **Minimum data:** tên quán tùy chọn; kết quả gồm Store Key, Admin PIN, seed status.
- **Primary actions:** tạo store, retry seed nếu cần, tiếp tục vào passcode.
- **Important states:** creating, seed failed, success credential display.

## 4. Passcode

- **Purpose:** chọn nhân viên và nhập PIN để vào app shell.
- **User:** admin, cashier, kitchen.
- **Minimum data:** danh sách active employees, selected employee, PIN input.
- **Primary actions:** chọn nhân viên, nhập PIN, xóa PIN, unlock.
- **Important states:** loading employees, wrong PIN, inactive employee, seed pending/failed.

## 5. Rotate Guidance

- **Purpose:** hướng dẫn xoay ngang khi thiết bị ở portrait.
- **User:** mọi user.
- **Minimum data:** orientation.
- **Primary actions:** không có action nghiệp vụ.
- **Important states:** portrait only; landscape app ẩn/hiện đúng.

## 6. App Shell / Left Rail

- **Purpose:** giữ context nhân viên/role, module navigation theo nhóm và lock session.
- **User:** logged-in user.
- **Minimum data:** current employee, role, permission map, active drawer.
- **Primary actions:** mở module, khóa phiên nhân viên.
- **Important states:** permission disabled, active module, desktop rail có nhãn/session card, compact rail chỉ còn icon/avatar.

## 7. POS Floor View

- **Purpose:** xem trạng thái bàn, mở order tại bàn và theo dõi order đang mở.
- **User:** cashier/admin.
- **Minimum data:** floor areas, tables, decor, open orders.
- **Primary actions:** đổi khu, lọc bàn, refresh inline trong toolbar sơ đồ, mở order bàn.
- **Important states:** floor loading/error/empty, no open orders, occupied/empty tables.

## 8. Order Drawer

- **Purpose:** tạo hoặc chỉnh order dine-in/takeaway.
- **User:** cashier/admin.
- **Minimum data:** menu catalog, selected table/order type, current order detail nếu có, draft cart, employee.
- **Primary actions:** chọn category/món, chọn option, đổi quantity, ghi chú, submit/send order, chuyển thanh toán, đóng drawer.
- **Important states:** new draft, existing open order, dirty close confirm, submit loading/error, closed/stale order, empty cart.

## 9. Payment Drawer

- **Purpose:** console thu ngân để hoàn tất thanh toán tiền mặt cho order mở và tùy chọn render receipt.
- **User:** cashier/admin.
- **Minimum data:** order detail, item snapshots, total, table/order type, cashier, customer name nếu có; hiện fallback `Khách lẻ`, received amount, change/remaining, expected lock version.
- **Primary actions:** chọn phương thức thanh toán tiền mặt, nhập tiền khách đưa qua input/keypad, quick cash, bật/tắt in hóa đơn, complete payment, refresh stale order, close.
- **Layout contract:** hai vùng chính giữ nguyên cấu trúc trên desktop/tablet/phone landscape: console thu tiền bên trái và order/summary bên phải. Khi màn nhỏ chỉ giảm padding, gap, chiều cao và font; hạn chế đổi layout để phù hợp POS ngang.
- **Payment controls:** danh sách phương thức có thể mở rộng; hiện chỉ `Tiền mặt` active, thẻ/chuyển khoản/QR disabled. Input tiền nằm phía trên keypad custom.
- **Order summary:** danh sách món cuộn dọc, summary gồm `Khách đưa`, `Tiền thối`/`Còn thiếu`, `Tổng đơn`, checkbox in hóa đơn mặc định bật và nút `Hoàn tất thanh toán` nằm dưới checkbox.
- **Important states:** loading, insufficient cash, payment error, stale/closed order, receipt/print preview only when print checkbox is enabled.

## 10. Takeaway Drawer

- **Purpose:** quản lý các order mang đi.
- **User:** cashier/admin.
- **Minimum data:** open takeaway orders, selected order detail, paid sample/current list.
- **Primary actions:** tạo takeaway, chọn order, mở order, thanh toán, reprint-like action cho đơn đã thanh toán.
- **Important states:** loading, empty list, detail loading/error, paid filter sample data.

## 11. Order History Drawer

- **Purpose:** tra cứu đơn đã kết thúc theo ngày và filter, không hiển thị đơn đang mở.
- **User:** cashier/admin.
- **Minimum data:** date range, order summaries, selected order detail, table name map.
- **Primary actions:** lọc ngày/status đã thanh toán/đã hủy/type/search, chọn order, xem detail.
- **Important states:** loading, empty, error, selected order not found.

## 12. Employees Drawer

- **Purpose:** quản lý nhân viên và PIN.
- **User:** admin.
- **Minimum data:** employee list, selected employee, role/status, PIN form khi tạo/reset.
- **Primary actions:** add employee, edit role/name/status, reset PIN, save.
- **Important states:** loading, validation error, save error, cannot deactivate last admin.

## 13. Menu Editor Drawer

- **Purpose:** quản lý danh mục, món, option group và option value.
- **User:** admin.
- **Minimum data:** menu catalog, selected category/item/option group, changeset dirty state.
- **Primary actions:** add/edit/delete category, item, option group/value, save changes, discard/confirm close.
- **Important states:** loading, empty menu, dirty new item, dirty confirm, validation/save error.

## 14. Floor Editor Drawer

- **Purpose:** quản lý khu/tầng, bàn và decor trên sơ đồ.
- **User:** admin.
- **Minimum data:** floor areas, tables, decor items, selected object, changeset dirty state.
- **Primary actions:** add area/table/decor, edit layout, delete soft, save, discard/confirm close.
- **Important states:** loading, empty floor, dirty new table, dirty confirm, save error.

## 15. Report Drawer

- **Purpose:** xem doanh thu và hiệu quả bán hàng cơ bản.
- **User:** admin.
- **Minimum data:** business date/range, revenue, paid orders, average ticket, top item, hourly revenue.
- **Primary actions:** đổi ngày/range, refresh, xem summary/chart.
- **Important states:** loading, empty report, error, zero-data demo risk.

## 16. General Settings Drawer

- **Purpose:** cấu hình thông tin quán và bảo trì dữ liệu mẫu.
- **User:** admin.
- **Minimum data:** display name, address, bill footer, timezone, current settings.
- **Primary actions:** edit settings, save, mở maintenance/clear demo.
- **Important states:** loading, dirty form, save error, receipt preview.

## 17. Clear Demo Dialog

- **Purpose:** xóa dữ liệu mẫu có kiểm soát để chuyển store về slate sạch.
- **User:** admin.
- **Minimum data:** open order count/check result, confirm input if allowed.
- **Primary actions:** kiểm tra điều kiện, confirm clear, cancel.
- **Important states:** loading, blocked by open orders, error, confirm ready, success.

## 18. Kitchen Queue Drawer

- **Purpose:** minh họa seam cho bếp, xem ticket và mark done cục bộ.
- **User:** kitchen/admin.
- **Minimum data:** ticket sample/local state, selected ticket, station filter.
- **Primary actions:** chọn ticket, mark done/undo local.
- **Important states:** empty/done local state.
- **Scope note:** chưa phải kitchen queue backend thật trong phase tiểu luận.

## 19. Payment Settings / QR Drawer

- **Purpose:** preview thông tin thanh toán QR/bank trên hóa đơn.
- **User:** admin.
- **Minimum data:** local bank/QR form fields, receipt preview; schema có `store_settings.qr_info` seam nhưng app chưa persist qua `settingsRepo`.
- **Primary actions:** xem/chỉnh preview local, preview receipt.
- **Important states:** disabled/unavailable non-cash payment processing.
- **Scope note:** chưa phải payment processing QR/bank/e-wallet thật.

## Drawer/Popup Contract

- Drawer render qua shared portal layer trong workspace viewport sau `LeftNav`, không che left rail.
- Confirm popup dùng overlay full-screen; click overlay vẫn theo callback được truyền vào.
- Overlay click đóng drawer theo callback của từng drawer.
- Drawer có slide-in khi mở; exit animation hiện là polish optional/backlog.
