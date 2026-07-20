# Phase 10 - Order History Responsive Redesign

## Mục tiêu

- Redesign Order History thành màn xem lại đơn đã thực hiện, không trộn metric/report.
- Giữ layout 2 cột trên các màn landscape nhỏ: trái là danh sách/tóm tắt đơn, phải là chi tiết dạng receipt.
- Lưu và đọc lại payment snapshot gồm tiền khách đưa và tiền thừa để dùng cho history/report sau này.

## Branch/Commit

- Branch code: `ui-order-history-responsive`
- Merge commit: chưa có trong lúc ghi log này.

## Đã implement

- `OrderHistoryDrawer` dùng layout 2 cột responsive, không còn card doanh thu/report trong history.
- Header có nút filter ngày mặc định `Hôm nay`; popup có `Hôm nay`, `7 ngày`, `Tháng này`, `Tùy chọn`.
- Danh sách đơn dùng phân trang theo contract `listOrderHistory({ fromDate, toDate, page, pageSize, status, orderType, search, tableIds })`.
- Date/status/type/search được áp dụng trước pagination trong repository để `total`, empty state và số trang khớp bộ lọc.
- Order History chỉ đọc các đơn đã kết thúc (`paid`, `void`); đơn `open` thuộc màn Bàn/Mang đi và không xuất hiện trong lịch sử.
- Right nav hiển thị chi tiết đơn dạng receipt: item snapshot, option/note, quantity, table/order type, status, paid time, customer fallback và nhân viên thực hiện thanh toán.
- Payment summary cố định cuối right nav theo thứ tự `Khách đưa`, `Tiền thừa`, `Tổng tiền`.
- Nút thao tác `In lại hóa đơn`, `Sao chép mã đơn`, `Tải lại chi tiết` đặt ở header của right nav.
- Domain thêm `OrderPaymentSnapshot`; `OrderDetail.payment` là nullable snapshot.
- Supabase `getOrder` đọc row mới nhất từ `payments` khi order đã paid.
- Mock payment flow lưu payment snapshot vào order sau khi thanh toán.
- Mock open orders được normalize `businessDate` theo ngày hiện tại của store timezone khi tạo state, để đơn vừa thanh toán từ dữ liệu mẫu xuất hiện trong filter `Hôm nay`.
- Store Pairing chỉ giữ `0001-X8F3QA` làm placeholder; input mặc định rỗng để không tự dẫn user vào store mẫu.

## Quyết định kỹ thuật

- Chọn phân trang thay vì infinite scroll vì Order History có date/status/type/search và selected detail. Pagination dễ reset selection, dễ test, ổn định memory/payload, phù hợp với contract hiện có.
- Lọc bỏ order `open` và áp dụng status/type/search ở tầng repository thay vì chỉ ẩn ở UI, để `total`, phân trang và trạng thái empty/list luôn đúng với dữ liệu đã kết thúc.
- Không mở rộng `listOrderHistory` để join payment trong danh sách; payment detail chỉ fetch khi chọn đơn, tránh làm nặng list.
- `Khách hàng` vẫn fallback `Khách lẻ` vì domain chưa có customer entity. Ô `Nhân viên thanh toán` dùng `payments.employee_id` qua `OrderPaymentSnapshot.employeeId`; bỏ ô `Thu ngân` trùng nghĩa và không dùng `Khách lẻ` làm tên nhân viên.
- `In lại hóa đơn` hiện là placeholder toast vì chưa có persisted receipt template/render snapshot riêng cho reprint.

## Verification

- `npm run test -- src/adapters/mock/mockRepos.test.ts src/adapters/supabase/repos.test.ts src/app/reportHistoryDrawer.test.tsx`: 22 tests passed.
- `npm run test`: 173 tests passed.
- `npm run build`: passed. Vite vẫn cảnh báo chunk lớn như hiện trạng.
- Browser responsive check trực tiếp trên `http://127.0.0.1:5173/`: Order History giữ 2 cột và không horizontal overflow ở 1280x720, 1024x600, 844x390, 740x360. Payment summary đọc đúng `100.000đ`, `23.000đ`, `77.000đ` cho order demo paid.
- Browser flow trực tiếp ngày 2026-06-23: reload mock state, kết nối store mẫu `0001-X8F3QA`, đăng nhập admin PIN `123456`, thanh toán B02, mở Order History mặc định `Hôm nay`; row `#24 / B02 / 23/06/2026 / 125.000đ` hiển thị và right nav đọc đúng `Khách đưa 125.000đ`, `Tiền thừa 0đ`, `Tổng tiền 125.000đ`.
- Sau khi giới hạn history ở completed orders, browser flow cùng ngày chỉ hiển thị row B02 đã thanh toán; B05 và đơn mang đi đang mở không còn xuất hiện, và filter trạng thái không còn lựa chọn `Đang mở`.

## Known Gaps/Risks

- `npm run smoke` trong lần kiểm tra này: 18 passed, 13 skipped, 4 failed ở flow admin mock modules trước khi chạm Order History. Failure nằm tại việc test tìm nút `Huỷ` trong Menu Editor dirty cancel, cần xử lý riêng nếu muốn smoke full xanh.
- Search theo tên bàn dùng `tableIds` được map từ floor plan hiện tại; nếu sau này cần search full-text theo customer/payer thì cần mở rộng domain riêng.
- Customer/payer thật vẫn cần domain riêng nếu sau này muốn lưu người khách thực tế đưa tiền; `Nhân viên thanh toán` hiện là nhân viên POS thực hiện giao dịch.
