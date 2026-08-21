# Báo cáo tổng hợp nhiều cửa hàng

## Why

Khi một chủ sở hữu nhiều cửa hàng, câu hỏi đầu tiên họ hỏi không phải là quán A hôm nay bán bao nhiêu, mà là cả hệ thống bán bao nhiêu và quán nào đang yếu. Báo cáo hiện tại tính theo ngày kinh doanh trong phạm vi một cửa hàng, không có khái niệm tổng hợp nhiều cửa hàng.

Đây là lý do chính khiến chủ quán chịu bỏ tiền cho phần mềm quản lý chuỗi, nên nếu `add-multi-store-ownership` được làm thì change này là phần tạo ra giá trị nhìn thấy được.

## What Changes

- Cho phép chọn phạm vi báo cáo: một cửa hàng, một nhóm cửa hàng, hoặc toàn bộ.
- Tổng hợp các chỉ số hiện có theo phạm vi đã chọn: doanh thu, số đơn, giá trị trung bình mỗi đơn, món bán chạy, doanh thu theo giờ, đơn hủy.
- So sánh giữa các cửa hàng trong cùng khoảng thời gian.
- Xử lý khác biệt múi giờ giữa các cửa hàng khi gộp theo ngày kinh doanh.
- Giới hạn phạm vi báo cáo theo quyền: quản lý một cửa hàng chỉ thấy cửa hàng của mình.

## Capabilities

### New Capabilities

Không có năng lực hoàn toàn mới; đây là mở rộng phạm vi của năng lực báo cáo hiện có.

### Modified Capabilities

- `reporting`: bổ sung phạm vi nhiều cửa hàng, khả năng so sánh, và quy tắc gộp theo ngày kinh doanh khi các cửa hàng khác múi giờ.
- `access-control`: bổ sung giới hạn phạm vi báo cáo theo quyền của người xem.

## Impact

- Cách truy vấn báo cáo hiện đang tính trực tiếp từ dữ liệu đơn trong phạm vi một cửa hàng; mở rộng phạm vi sẽ làm truy vấn nặng hơn đáng kể.
- Có thể cần bảng tổng hợp lưu sẵn, điều này đi ngược nguyên tắc hiện tại là báo cáo tính live không có bảng tổng hợp.
- Bố cục màn báo cáo hiện là dạng rail trái kèm pane phải với bốn mục; thêm chiều cửa hàng sẽ phải thiết kế lại.
- Cập nhật `docs/features.md`, `docs/report-source-map.md`, `docs/screens.md`.

## Ngoài phạm vi

- Mô hình chủ sở hữu nhiều cửa hàng. Việc đó thuộc `add-multi-store-ownership`.
- Phân tích chuyên sâu và dự báo.
- Xuất báo cáo ra tệp.
- Bảng điều khiển thời gian thực cho chủ quán.

## Phụ thuộc

- `add-multi-store-ownership`: bắt buộc. Không có khái niệm nhóm cửa hàng thì không có gì để tổng hợp.

## Câu hỏi phải chốt trước khi làm

1. Change này chỉ có nghĩa nếu `add-multi-store-ownership` được làm thật. Nếu hướng đó chỉ dừng ở phân tích cho báo cáo thì change này nên bỏ hẳn hay cũng chỉ dừng ở phân tích?
2. Các cửa hàng có khác múi giờ không? Nếu có thì gộp theo ngày kinh doanh của từng cửa hàng, hay quy về một múi giờ chung của chủ sở hữu?
3. Báo cáo tổng hợp cần tới mức nào: chỉ cần tổng của các chỉ số hiện có, hay cần cả so sánh và xếp hạng giữa các cửa hàng?
4. Chấp nhận báo cáo chậm hơn tới mức nào khi phạm vi rộng? Nếu không chấp nhận thì phải thêm bảng tổng hợp, và khi đó phải chốt tần suất cập nhật.
5. Quản lý cấp cửa hàng có được xem số liệu của cửa hàng khác không?
6. Màn báo cáo hiện có bốn mục là tổng quan, theo giờ, món bán chạy và đơn đã thanh toán. Chiều cửa hàng thêm vào bằng cách nào: một bộ lọc phạm vi phía trên, hay một mục mới?
7. Có cần đơn vị tiền tệ khác nhau giữa các cửa hàng không?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
