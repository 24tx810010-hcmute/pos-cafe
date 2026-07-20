# Features

## Store & Session

- Tạo store mới với tên hiển thị, địa chỉ (tùy chọn), Store Key và Admin PIN.
- Mặc định store tạo ra là **trống** (chỉ store/settings + 1 admin). Màn tạo store có checkbox "Khởi tạo sẵn dữ liệu mẫu" (mặc định tắt); chỉ khi tick mới seed bộ demo gọn (vài category/món, 1 khu + vài bàn, 1 cashier demo).
- Nếu seed demo lỗi, store vẫn vào được app; màn kết quả hiện cảnh báo + nút thử lại (cũng seed lại được trong Cài đặt).
- Ghép store bằng Store Key (màn pairing không prefill key mẫu, chỉ dùng làm placeholder).
- Lưu session store ở client adapter.
- Nhập PIN nhân viên để mở app shell.
- Khóa phiên nhân viên để quay lại passcode.

## Role & Permission

- `admin`: dùng toàn bộ POS và admin modules.
- `cashier`: dùng floor, order, payment, order history.
- `kitchen`: role được chừa sẵn cho kitchen queue; không phải feature bắt buộc của phase này.
- UI disable/guard module không có quyền; core guard vẫn kiểm tra ở action quan trọng.
- Có 2 trục quyền độc lập trong `core/guards.ts`: **module** (`canAccessModule` — thấy gì trên nav) và **hành động** (`hasPermission`/`requirePermission` — được làm gì). Quyền hành động mặc định suy từ role, có thể ghi đè per-employee qua `Employee.permissionOverrides` (grants/denies) — nên hai nhân viên cùng role vẫn có thể khác quyền.
- 5 quyền runtime đang được enforce:

  | Quyền | Admin | Cashier | Kitchen |
  | --- | --- | --- | --- |
  | `order.create` | Có | Có | Không |
  | `order.update` | Có | Có | Không |
  | `order.voidOpen` | Có | Có | Không |
  | `payment.take` | Có | Có | Không |
  | `order.voidPaid` | Có | Không | Không |

- Employees Drawer cho admin tick/bỏ quyền hiệu lực từng người. Đổi role reset checkbox về default role; lưu quyền đúng default sẽ xóa override. Client nhận quyền mới sau khi khóa/đăng nhập lại, còn RPC đọc quyền live.
- Flow tạo/sửa/hủy đơn mở, full/split payment và hủy đơn paid đều gọi `requirePermission`; Order/Payment Drawer disable nút sớm khi thiếu quyền; migration 012 guardrail lại ba RPC order/payment chính.
- **Catalog production, chưa phải quyền runtime:** chuyển/gộp bàn; refund; `discount.apply`; `price.override`; `drawer.open`; mở/chốt ca và kiểm két (`shift.*`). Các mã này chỉ là hướng mở rộng, chưa nằm trong `EmployeePermission` và không xuất hiện trong editor vì chưa có tính năng đứng sau. Quản trị menu/sơ đồ/nhân viên/cài đặt/report hiện vẫn theo module + role, chưa chỉnh per-employee.

## POS Floor

- Xem sơ đồ bàn theo khu/tầng.
- Lọc bàn theo trạng thái.
- Xem bàn trống/đang phục vụ, order number và tổng tiền khi có order mở.
- Mở order tại bàn.
- Refresh floor/open orders từ toolbar sơ đồ khi cần.

## Order

- Tạo order dine-in hoặc takeaway.
- Chọn món theo danh mục.
- Món **có nhóm tuỳ chọn** → bấm vào hiện popup `ModifierPickerPopup` để chọn modifier (size/topping...); món **không có** nhóm thì thêm thẳng vào giỏ như cũ. Nhóm `single` chọn 1 (radio); nhóm `multi` tick nhiều giá trị, mỗi giá trị có stepper số lượng (mặc định 1). Nhóm bắt buộc thì nút `Thêm vào đơn` khoá đến khi chọn hợp lệ (`validateModifierSelection`).
- Số lượng món và ghi chú chỉnh ở giỏ; dòng giỏ hiển thị option kèm `×N` khi số lượng > 1. Giá dòng = (giá món + Σ giá_modifier × số_lượng) × số_lượng_món.
- Submit order lên backend qua RPC; backend quyết định snapshot tên/giá. Tuỳ chọn chỉ hợp lệ khi nhóm của nó được gắn với đúng món.
- Khi `Gửi đơn`, mở popup `Phiếu gửi bếp` (variant `kitchen`) chỉ liệt kê các món **mới thêm** so với đơn hiện tại — so khớp theo nội dung (món + option + ghi chú) vì draft sinh id mới mỗi lần; chỉ hiện tên + số lượng, không giá. Tính từ dữ liệu local lúc bấm (`diffAddedPrintLines`).
- Cập nhật query sau submit/pay theo kiểu fire-and-forget (UI/popup hiện ngay, không chờ refetch); máy khác nhận trễ tối đa ~5s qua realtime/poll.
- Mở lại order đang mở để chỉnh sửa.
- Dirty close confirm cho draft/chỉnh sửa chưa lưu.
- Nếu order đã đóng/stale, UI hiển thị trạng thái không thể thanh toán/chỉnh như order mở.

## Payment

- Thanh toán tiền mặt cho order mở, theo mô hình **instant pay (split-order)**: trả cả đơn một lần, hoặc chọn món/số lượng để **tách thành một đơn mới độc lập và thanh toán đơn đó ngay**.
- Màn thanh toán là console dành cho thu ngân, không phải màn đưa cho khách.
- Header hiển thị thu ngân đang đăng nhập, vị trí/order type và số lượng món; khách hàng hiện fallback là `Khách lẻ` vì `OrderDetail` chưa có customer field.
- Khu phương thức thanh toán dùng danh sách có thể mở rộng; hiện chỉ bật `Tiền mặt`, các phương thức thẻ/chuyển khoản/QR hiển thị disabled để tránh hiểu nhầm là đã xử lý thật.
- Khu nhập tiền đặt input `Tiền khách đưa` phía trên keypad custom, có quick cash buttons và hỗ trợ nhập số thủ công; input tự điền theo tổng phần đang chọn.
- **Chọn món để thanh toán** (pane phải): checkbox `Chọn tất cả` **mặc định bật** (= trả nhanh cả bàn, một chạm như cũ). Bỏ chọn rồi tick một dòng sẽ chọn **1 sản phẩm** của dòng đó; chỉnh số lượng bằng chip `đã chọn/tổng` + nút `+` xoay vòng (chạm trần quay về 1). Chỉnh bất kỳ dòng nào dưới mức tối đa → `Chọn tất cả` tự tắt; chọn đủ 100% → tự bật lại.
- Summary: `Khách đưa`, `Tiền thối`/`Còn thiếu`, `Tổng đơn`, dòng nổi bật `Thanh toán lần này`, checkbox `In hóa đơn sau khi thanh toán` mặc định bật và nút hoàn tất.
- Chặn hoàn tất khi tiền nhận chưa đủ **so với phần đang chọn**, hoặc khi chưa chọn món nào.
- Flow tự rẽ nhánh (`payOrderItemsAndPrint`): chọn đủ 100% → RPC `pay_order` (đơn paid, bàn trống, đóng drawer); chọn một phần → RPC `pay_order_items` **tách đơn**: món được chọn thành đơn mới paid ngay (bill riêng, vào report/lịch sử ngay), đơn gốc còn lại trên bàn với phần chưa trả; drawer mở tiếp, toast `Đã tách và thanh toán đơn #N (X). Bàn còn Y.`, selection reset về `Chọn tất cả` phần còn lại.
- **Đánh số theo thứ tự thanh toán**: bill trả trước mang số nhỏ hơn — đơn tách kế thừa `order_no` của đơn gốc, đơn gốc nhận số mới (header drawer đổi số tương ứng sau khi tách).
- Đơn gốc sau khi tách là đơn bình thường: sửa món, thêm món, thậm chí huỷ đều được (tiền đã thu nằm an toàn ở các đơn tách đã paid).
- Selection được clamp theo dữ liệu mới nhất khi đơn bị máy khác cập nhật (lock_version đổi) — không thể trả vượt số lượng.
- Có nút `In tạm tính` mở popup phiếu tạm tính (chưa thanh toán) từ đơn hiện tại.
- Khi checkbox in hóa đơn bật, sau khi thanh toán mở popup hoá đơn thanh toán in-app (PortalPopup); bỏ chọn thì vẫn thanh toán nhưng không mở popup. Phase này in chỉ là preview UI (popup + browser print qua iframe cô lập), chưa nối phần cứng; seam `IPrintPort` giữ nguyên cho adapter ESC/POS tương lai (`BrowserPrintPort` hiện no-op, không còn `window.open`).
- Bill dựng từ payload receipt trả về ngay trong mutation (không chờ refetch); in lại ở Lịch sử thì lấy từ payment snapshot của đơn đó.
- Hoá đơn dùng template dùng chung `ReceiptDocument` (khổ 80mm): 2 biến thể `ticket` (phiếu tạm tính) / `receipt` (hoá đơn thanh toán); dòng món kiểu Bách Hoá Xanh (tên + `SL × đơn giá` / thành tiền); header/footer lấy từ store settings.
- Lý do chọn mô hình split-order (và vì sao bỏ mô hình partial-cùng-đơn của migration 009), ưu/nhược điểm: xem ADR "Instant Pay" trong [architecture.md](architecture.md) và phân tích đầy đủ ở [implementation-log/phase-18-instant-pay.md](implementation-log/phase-18-instant-pay.md).

## Takeaway

- Xem danh sách order takeaway đang mở.
- Mở chi tiết takeaway, tiếp tục chỉnh order hoặc chuyển sang thanh toán.
- Tạo takeaway mới từ drawer.
- Chỉ liệt kê đơn takeaway đang mở thật (đã bỏ dữ liệu paid takeaway hardcode); xem đơn đã thanh toán ở màn Lịch sử đơn.

## Order History

- Xem danh sách đơn theo khoảng ngày; mặc định `Hôm nay`.
- Chỉ hiển thị đơn đã kết thúc (`Đã thanh toán`, `Đã hủy`); đơn đang mở thuộc màn Bàn/Mang đi.
- **Instant pay**: mỗi lần tách thanh toán là một ĐƠN độc lập → tự nhiên là một dòng lịch sử riêng, hiện **ngay sau khi thu tiền** (không chờ bàn đóng). Bàn trả 2 lần = 2 đơn không liên kết gì nhau, chỉ cùng nhãn bàn; số đơn tăng theo thứ tự thanh toán.
- Bộ lọc ngày là một nút `Filter date`, mở popup chọn `Hôm nay`, `7 ngày`, `Tháng này` hoặc khoảng ngày tùy chọn.
- Danh sách đơn dùng phân trang để giữ payload ổn định; date/status/type/search được áp dụng ở repository trước khi cắt trang.
- Layout chính là 2 cột: cột trái hiển thị thông tin nhanh của đơn, cột phải hiển thị chi tiết dạng receipt.
- Cột phải hiển thị item snapshot/options/note/quantity, khách hàng fallback `Khách lẻ`, **nhân viên thanh toán** được map từ `payment.employeeId`, phương thức thanh toán và paid time. Không hiển thị thêm ô `Thu ngân` trùng dữ liệu.
- Summary thanh toán cố định cuối cột phải theo thứ tự `Khách đưa`, `Tiền thừa`, `Tổng tiền`; `Tổng tiền` nổi bật hơn.
- `OrderDetail` đọc payment snapshot để lịch sử hiển thị đúng `receivedAmount` và `changeAmount`, không tính tạm ở UI.
- Nút `In lại hóa đơn` dựng lại bill từ order detail đã lưu và mở popup hoá đơn (dùng chung `ReceiptDocument`); đơn chưa có payment thì báo không in được. Đơn `void` không in lại được (nút bị disable).
- **Hủy đơn đã thanh toán**: nút `Hủy đơn` chỉ hiện với người có quyền `order.voidPaid` (mặc định admin) và đơn đang ở `Đã thanh toán`. Bấm mở popup xác nhận: cảnh báo rõ "đơn <số tiền> sẽ bị loại khỏi doanh thu ngày DD/MM, không thể hoàn tác", chọn 1 trong các lý do ghi sẵn (Nhập sai đơn/sai món, Khách đổi ý/trả món, Hết món/hết nguyên liệu, Đơn bị trùng, Lý do khác) + ô ghi chú (bắt buộc khi chọn "Lý do khác"). Sau khi hủy, đơn chuyển `Đã hủy`, cột chi tiết hiển thị người hủy/thời điểm/lý do, và bị loại khỏi doanh thu (report tự cập nhật). Quyền được chốt ở flow (`requirePermission`) và guardrail lại trong RPC — không tin nút bị ẩn. Trước khi gọi RPC, popup **refetch order detail để lấy `lock_version` tươi** (cache detail sau thanh toán có thể còn version cũ, gây conflict giả); nếu đơn không còn `paid` thì báo tải lại thay vì hủy.
- Dùng cho cashier và admin (hủy đơn đã thanh toán mặc định chỉ admin, trừ khi cashier được cấp `order.voidPaid`).

## Employees

- Xem nhân viên theo role/trạng thái.
- Tạo nhân viên.
- Sửa tên/role/trạng thái.
- Reset PIN.
- Chỉnh checkbox quyền thao tác theo từng nhân viên đã tồn tại; persist grants/denies tối thiểu so với role mặc định.
- Bảo vệ rule còn ít nhất một admin hoạt động, kể cả khi hạ role admin cuối; cảnh báo khi admin sửa quyền chính mình.

## Menu Editor

- Upload/lưu ảnh món JPG/PNG/WebP và hiển thị ảnh trong màn quản lý menu.
- Upload ảnh món có cảnh báo và chặn file quá 5MB trước khi lưu.
- Màn chọn món khi bán hàng hiển thị ảnh món nếu có, fallback bằng icon khi chưa có ảnh; card hết hàng có overlay `Đã bán hết`.
- Card món trong Menu Editor dùng ảnh cover, bỏ pill trạng thái bán khỏi card; trạng thái vẫn chỉnh ở panel chi tiết.
- Panel chi tiết món dùng select `Danh mục`, upload/preview ảnh, trạng thái bán và **danh sách checkbox nhóm tuỳ chọn dùng chung** — tick để gắn/bỏ nhóm cho món (tạo/xoá link). Nút bút chì mở popup `ModifierGroupEditor` để sửa nhóm (tên, chọn-1/chọn-nhiều, bắt buộc, các giá trị + giá).
- Đổi thứ tự món bằng switch `Đổi vị trí`: chọn món gốc, bật switch, bấm món khác trong cùng danh mục để swap rồi tự tắt switch.

- Quản lý category.
- Quản lý món: tên, giá, danh mục, trạng thái bán.
- Quản lý nhóm tuỳ chọn (size/topping) **dùng chung** cho mọi món: tạo/sửa nhóm + giá trị một nơi, gắn vào nhiều món bằng checkbox. Sửa nhóm ảnh hưởng mọi món đang dùng.
- Lưu theo changeset create/update/delete, không hard-delete dữ liệu editor.

## Floor Editor

- Quản lý khu/tầng.
- Tạo/sửa/xóa mềm bàn.
- Tạo/sửa/xóa mềm decor cơ bản: tường, cây, quầy, cửa, decor/image asset.
- Khi chọn một object trên sơ đồ (bàn hoặc decor), hiện 2 handle kéo trực tiếp để xoay và resize; handle luôn nằm ngang bên dưới object, không xoay theo object, và ẩn với object đã xoá hoặc decor đang khoá.
- Lưu layout không ghi đè `table.status`.

## Report

- Core report theo `business_date`.
- Doanh thu, số đơn đã thanh toán, average ticket, top item.
- Biểu đồ doanh thu theo giờ.
- Report chỉ tính order đã thanh toán và loại order hủy. Đơn `paid` bị hủy tự động rời khỏi doanh thu (report tính live, không có bảng tổng hợp).
- Tổng hợp đơn hủy cho admin/chủ: `CoreReport.voidCount`/`voidAmount` đếm các đơn **paid-rồi-hủy** theo `business_date`; hiển thị ở rail trái (số đơn huỷ + tiền hủy). Nguồn lấy từ CoreReport chứ không đếm từ mảng orders phân trang.
- Bộ lọc khoảng: Hôm nay / 7 ngày / Tháng này / Tuỳ chọn (from–to). Nút Xuất hiện disabled (chưa hỗ trợ export).
- Layout dashboard **master/detail** (phase 12): rail trái = thẻ doanh thu + sparkline theo giờ, nav mục báo cáo (có badge) và tóm tắt nhanh (giờ cao điểm, thanh toán phổ biến, đơn huỷ); pane phải = chi tiết mục đang chọn. 4 mục: Tổng quan (KPI tile + biểu đồ giờ + món bán chạy), Theo giờ (bảng), Món bán chạy (bar-list), Đơn đã thanh toán (bảng).
- Look mô phỏng Tremor nhưng dựng bằng Tailwind `pos-*` + Recharts, không thêm dependency.

## Settings & Maintenance

- Sửa tên hiển thị, địa chỉ, footer hóa đơn, timezone.
- Preview thông tin hóa đơn.
- Khởi tạo dữ liệu mẫu (seed demo) ngay trong Cài đặt → Bảo trì dữ liệu, chỉ admin dùng; tiện cho demo nhanh hoặc dev/test trên store trống.
- Clear/đặt lại dữ liệu mẫu theo seed bundle, chỉ admin dùng.
- Clear demo bị block khi còn order mở để tránh mất dữ liệu đang bán.
- Seed demo idempotent: chạy lại sau khi clear sẽ hồi sinh đúng các row mẫu đã xóa mềm (clear `deleted_at`), không tạo trùng.

## Optional/Future UI

- Kitchen drawer là seam UI-only, hiện hàng chờ rỗng (đã bỏ vé bếp hardcode); sẽ nối với đơn thật ở giai đoạn sau.
- Payment settings/QR hiện là preview UI local, chưa persist qua `settingsRepo` và chưa phải QR payment processing thật.

## Shared UI Behavior

- Popup/modal dùng `PortalPopup`; drawer dùng `PortalDrawer`.
- Popup/modal dùng overlay full-screen để modal xác nhận che toàn bộ app shell khi cần.
- Drawer có overlay mờ `rgba(0,0,0,0.2)`, click overlay để đóng và slide-in theo placement khi mở.
- Drawer mặc định dùng workspace viewport sau `LeftNav` để không che left rail.
