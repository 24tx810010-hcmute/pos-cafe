# Phase 26 - Liệt kê lịch sử đơn theo "gần đây"

## Mục Tiêu

- Cho màn Lịch sử đơn hiển thị được đơn đã kết thúc của nhiều ngày kinh doanh, không bó buộc trong ngày hôm nay.
- Giải quyết va chạm số hiệu: `order_no` chỉ duy nhất trong phạm vi một `business_date`, nên danh sách trải nhiều ngày sẽ có nhiều dòng cùng số.

## Trạng Thái

- Code commit: `main@c7f2f4e`.
- Log này được viết bổ sung ngày 2026-08-21 khi rà soát đồng bộ docs với code; commit gốc không có phase log kèm theo.
- Không thay đổi schema database, migration hoặc RPC.

## Nội Dung Thực Hiện

- Thêm phạm vi `Gần đây` vào bộ lọc ngày và đặt làm mặc định thay cho `Hôm nay`. Bộ lọc ngày giờ có 5 lựa chọn: `Gần đây`, `Hôm nay`, `7 ngày`, `Tháng này`, khoảng tùy chọn.
- `OrderHistoryFilter.fromDate` và `toDate` chuyển thành tùy chọn; chế độ `Gần đây` truyền phạm vi rỗng.
- Thay `orderNo` bằng `displayNo` trong `HistoryOrderRow`. `displayNo` được tính theo tập đơn khớp bộ lọc: `total - (page - 1) * pageSize - index`, đếm giảm dần. Áp dụng ở cả cột danh sách và tiêu đề cột chi tiết.
- Gỡ ô tìm kiếm khỏi giao diện. Trường `search` vẫn còn trong `OrderHistoryFilter` và repository vẫn hỗ trợ, nhưng không còn entry point cho người dùng.
- Tăng `PAGE_SIZE` từ 8 lên 20.

## Verification 2026-08-21

- `npm test`: **49/49 files, 260/260 tests pass** trong 22,89 giây.
- `npm run build`: pass, 3197 module trong 2,43 giây; chunk JS 1.347,25 KB minified / 368,88 KB gzip, còn chunk-size warning đã biết.
- `npm run smoke`: **không chạy được** vì Playwright thiếu binary trình duyệt (`browserType.launch: Executable doesn't exist ... chrome-headless-shell.exe`). Đây là lỗi môi trường, không phải lỗi ứng dụng. Kết quả smoke gần nhất vẫn là 34 pass/31 skipped/0 failed ngày 2026-08-12.
- Không chạy lại cloud E2E; bằng chứng cloud gần nhất tách riêng trong [../testing.md](../testing.md).

## Quyết Định Cho Báo Cáo

- Mô tả màn lịch sử là liệt kê đơn đã kết thúc gần đây nhất theo mặc định, có thể thu hẹp theo khoảng ngày; không mô tả mặc định là "hôm nay".
- Nêu rõ số hiển thị trong lịch sử là số thứ tự theo bộ lọc, **không phải số bill**. Số bill chỉ còn xuất hiện trên hóa đơn in. Đây là điểm dễ hiểu nhầm khi trình bày, nên nói thẳng.
- Không liệt kê tìm kiếm như một chức năng hiện hành của màn lịch sử.

## Quyết Định Đã Chốt

- **Màn lịch sử không hiển thị `order_no` là CHỦ Ý, không phải thiếu sót.** Người dùng xác nhận ngày 2026-08-21 rằng đây là quyết định đã có từ trước. Lý do nhất quán với thiết kế: `order_no` chỉ duy nhất trong phạm vi một `business_date`, nên khi danh sách trải nhiều ngày thì hiển thị nó sẽ sinh ra nhiều dòng trùng số và gây nhầm lẫn. `order_no` giữ đúng vai trò số bill trên hóa đơn in, không phải số dòng tra cứu.
- Vì vậy khi viết báo cáo, trình bày `displayNo` và `order_no` là hai khái niệm khác nhau có mục đích khác nhau, không mô tả như một hạn chế.

## Giới Hạn

- Trường `search` trở thành code không có đường tới từ giao diện. Đã ghi vào mục seam của [../features.md](../features.md); cần quyết định nối lại entry point hay gỡ hẳn.
- Trường `tableIds` trong cùng bộ lọc cũng chưa từng có control nào trên giao diện truyền vào.
- Phase này không đụng tới hiệu năng truy vấn khi phạm vi `Gần đây` chạy trên lượng đơn lớn; chưa có đo đạc.

## Liên Quan

- [../features.md](../features.md) mục Order History.
- [../screens.md](../screens.md) mục 11.
- [../requirements.md](../requirements.md) FR-14.
- Baseline spec `order-history` trong `openspec/specs/`.
