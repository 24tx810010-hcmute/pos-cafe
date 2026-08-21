# Màn hình quản lý khách hàng thân thiết

## Why

Hồ sơ khách và sổ điểm cần chỗ để quản lý: tra cứu khách, xem lịch sử mua và lịch sử điểm, xử lý khiếu nại về điểm, và cấu hình quy tắc tích đổi. Không có màn này thì mọi việc phải làm bằng thao tác trực tiếp vào database, và nhân viên tại quầy không giải quyết được khi khách hỏi tại sao điểm không đúng.

## What Changes

- Thêm một module quản lý khách hàng thân thiết vào ứng dụng, hiển thị trong điều hướng theo quyền.
- Danh sách khách hàng với tìm kiếm và bộ lọc, hiển thị số dư điểm và mức chi tiêu.
- Hồ sơ chi tiết một khách: thông tin liên hệ, lịch sử mua hàng, lịch sử biến động điểm.
- Điều chỉnh điểm thủ công kèm lý do và dấu vết người thực hiện.
- Cấu hình quy tắc chương trình: tỷ lệ tích, tỷ lệ đổi, giới hạn mỗi đơn, hạn sử dụng điểm nếu có.
- Thống kê chương trình: số khách tham gia, điểm đã phát hành, điểm đã tiêu, và phần điểm còn treo.

## Capabilities

### New Capabilities

- `loyalty-management-ui`: các luồng thao tác của người quản lý để tra cứu khách, xử lý điểm, cấu hình quy tắc chương trình và theo dõi hiệu quả.

### Modified Capabilities

- `access-control`: bổ sung quyền truy cập module khách hàng thân thiết, quyền điều chỉnh điểm thủ công và quyền cấu hình quy tắc.
- `loyalty-points`: bổ sung luồng điều chỉnh điểm thủ công có kiểm soát.

## Impact

- Thêm module vào vỏ ứng dụng và điều hướng ở worktree `D:\Workspace\pos-cafe`.
- Hiển thị dữ liệu cá nhân của khách, cần cân nhắc quyền truy cập.
- Điều hướng tiếp tục phình ra nếu cả module kho, module khuyến mãi và module này cùng được thêm.
- Cập nhật `docs/screens.md`, `docs/features.md`.

## Ngoài phạm vi

- Hồ sơ khách hàng và cơ chế điểm. Việc đó thuộc hai change còn lại của nhóm.
- Phân nhóm khách và chiến dịch tiếp thị.
- Cổng tra cứu điểm dành cho khách tự xem.

## Phụ thuộc

- `add-customer-registry`: bắt buộc.
- `add-loyalty-points`: bắt buộc.

## Câu hỏi phải chốt trước khi làm

1. Nhân viên tại quầy có cần tra cứu điểm của khách ngay trong lúc bán không, hay chỉ quản lý mới truy cập module này? Nếu thu ngân cần thì phải có lối tắt tra cứu nhanh ngay ở màn thanh toán.
2. Ai được điều chỉnh điểm thủ công? Đây là thao tác tương đương phát tiền nên cần kiểm soát chặt.
3. Cấu hình quy tắc chương trình đặt ở đây hay đặt trong màn cài đặt cửa hàng vốn đã có?
4. Sửa quy tắc tích đổi có ảnh hưởng tới điểm đã tích trước đó không? Câu trả lời phải là không, nhưng cần xác nhận và cần cảnh báo trên giao diện.
5. Thống kê chương trình đặt ở đây hay thêm một mục vào màn báo cáo?
6. Danh sách khách hiển thị số điện thoại đầy đủ hay che bớt? Đây là dữ liệu cá nhân và màn hình POS thường đặt ở nơi khách nhìn thấy được.
7. Có cần xuất danh sách khách ra tệp không? Lưu ý nút xuất báo cáo hiện đang bị vô hiệu hóa vì chưa hỗ trợ, và việc xuất dữ liệu cá nhân cần cân nhắc thêm.
8. Điều hướng sắp xếp lại thế nào khi có thêm các module mới?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
