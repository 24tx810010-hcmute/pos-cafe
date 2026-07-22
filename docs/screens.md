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
- **Important states:** new draft, existing open order, dirty close confirm, submit loading/error, closed/stale order, empty cart; action bị khóa kèm lý do khi thiếu `order.create`, `order.update`, `order.voidOpen` hoặc `payment.take`.

## 9. Payment Drawer

- **Purpose:** console thu ngân để thanh toán tiền mặt cho order mở — trả cả đơn một chạm, hoặc **instant pay**: chọn món/số lượng để tách thành đơn mới độc lập và thanh toán đơn đó ngay.
- **User:** cashier/admin.
- **Minimum data:** order detail, item snapshots, total, table/order type, cashier, customer name nếu có; hiện fallback `Khách lẻ`, received amount, change/remaining, expected lock version, selection (món/số lượng đang chọn).
- **Primary actions:** chọn phương thức thanh toán tiền mặt, chọn món để trả (`Chọn tất cả` mặc định bật; sau khi bỏ chọn, tick checkbox dòng khởi tạo `1/tổng`, nút `+` tăng và xoay vòng), nhập tiền khách đưa qua input/keypad (tự điền theo phần đang chọn), quick cash, bật/tắt in hóa đơn, complete payment, refresh stale order, close.
- **Layout contract:** hai vùng chính giữ nguyên cấu trúc trên desktop/tablet/phone landscape: console thu tiền bên trái và order/summary bên phải. Khi màn nhỏ chỉ giảm padding, gap, chiều cao và font; hạn chế đổi layout để phù hợp POS ngang.
- **Payment controls:** danh sách phương thức có thể mở rộng; hiện chỉ `Tiền mặt` active, thẻ/chuyển khoản/QR disabled. Input tiền nằm phía trên keypad custom.
- **Order summary:** danh sách món có checkbox chọn để trả, summary gồm `Khách đưa`, `Tiền thối`/`Còn thiếu`, `Tổng đơn`, dòng nổi bật `Thanh toán lần này`, checkbox in hóa đơn mặc định bật và nút hoàn tất (label đổi `Hoàn tất thanh toán`/`Thanh toán món đã chọn` theo selection).
- **Split behavior:** chọn một phần → món được chọn tách thành đơn mới paid ngay (bill riêng, kế thừa số đơn gốc); drawer mở tiếp trên đơn gốc còn lại (đơn gốc nhận số mới, header đổi số), selection reset về `Chọn tất cả`.
- **Important states:** loading, insufficient cash (so với phần đang chọn), chưa chọn món nào, payment error, stale/closed order, thiếu quyền `payment.take`, receipt/print preview only when print checkbox is enabled.

## 10. Takeaway Drawer

- **Purpose:** quản lý các order mang đi.
- **User:** cashier/admin.
- **Minimum data:** danh sách takeaway đang mở và detail của order được chọn.
- **Primary actions:** tạo takeaway, chọn/mở order đang mở, tiếp tục chỉnh món hoặc chuyển sang thanh toán.
- **Important states:** loading, empty list, detail loading/error, stale/closed order; takeaway đã thanh toán chỉ xem trong Lịch sử đơn.

## 11. Order History Drawer

- **Purpose:** tra cứu đơn đã kết thúc theo ngày và filter, không hiển thị đơn đang mở.
- **User:** cashier/admin.
- **Minimum data:** date range, order summaries, selected order detail, table/employee name map, payment snapshot gồm `employeeId` của nhân viên thực hiện thanh toán, metadata hủy và quyền `order.voidPaid` của nhân viên hiện tại.
- **Primary actions:** lọc ngày/status đã thanh toán/đã hủy/type/search, chọn order, xem detail, in lại hóa đơn paid; người có quyền được hủy đơn paid bằng lý do có sẵn + ghi chú.
- **Void contract:** popup phải cảnh báo số tiền/ngày doanh thu và tính không thể hoàn tác; `Lý do khác` bắt buộc ghi chú; trước khi gọi RPC phải refetch detail để lấy `lock_version` mới nhất.
- **Important states:** loading, empty, error, selected order not found, detail stale/version conflict, đang hủy; đơn void hiển thị người hủy/thời điểm/lý do và không cho in lại.

## 12. Employees Drawer

- **Purpose:** quản lý nhân viên, PIN và quyền thao tác theo từng người.
- **User:** admin.
- **Minimum data:** employee list, selected employee, role/status, permission overrides/effective permissions, PIN form khi tạo/reset.
- **Primary actions:** add employee, edit role/name/status, reset PIN; với nhân viên đã tồn tại, tick/bỏ quyền hiệu lực và save.
- **Permission contract:** đổi role reset checkbox về default role mới; diff so với default được lưu thành grants/denies, diff rỗng xóa override. Sửa quyền chính mình có cảnh báo cần đăng nhập lại.
- **Important states:** loading, validation error, save error, không thể deactivate hoặc hạ role admin active cuối.

## 13. Menu Editor Drawer

- **Purpose:** quản lý danh mục, món, ảnh món và thư viện modifier dùng chung (option group/value).
- **User:** admin.
- **Minimum data:** menu catalog, liên kết món–modifier group, selected category/item/group, image draft và changeset dirty state.
- **Primary actions:** add/edit/delete category, item, modifier group/value; gắn/bỏ group dùng chung cho món; upload/remove ảnh món; đổi trạng thái bán và thứ tự; save changes, discard/confirm close.
- **Important states:** loading, empty menu, dirty new item, dirty confirm, image preview/upload, ảnh sai MIME hoặc quá 5MB, validation/save error.

## 14. Floor Editor Drawer

- **Purpose:** quản lý khu/tầng, bàn và decor trên sơ đồ.
- **User:** admin.
- **Minimum data:** floor areas, tables, decor items, catalog 9 texture tường + 131 ảnh trang trí, selected object, changeset dirty state.
- **Primary actions:** add area/table; mở popup chọn mẫu tường hoặc ảnh theo nhóm Cây/Ghế/Thiết bị/Khác; đổi mẫu trong inspector; kéo để di chuyển; dùng handle dưới object để resize/xoay; chỉnh layout; delete soft, save, discard/confirm close.
- **Important states:** loading, empty floor, popup chưa chọn mẫu, dirty new table/decor, dirty confirm, object locked không cho transform trực tiếp, snap grid bật/tắt, asset key legacy dùng placeholder, save error.

## 15. Report Drawer

- **Purpose:** xem doanh thu, hiệu quả bán hàng và tác động của các đơn paid-rồi-hủy.
- **User:** admin.
- **Minimum data:** business date/range, revenue, paid orders, average ticket, top item, hourly revenue, `voidCount` và `voidAmount` từ CoreReport.
- **Primary actions:** đổi ngày/range, refresh, xem summary/chart.
- **Important states:** loading, empty report, error; doanh thu/số đơn có thể bằng 0 nhưng rail vẫn phải hiển thị số đơn hủy và tiền hủy để đối soát.

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
