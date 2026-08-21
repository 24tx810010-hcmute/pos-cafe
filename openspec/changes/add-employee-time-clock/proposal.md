# Chấm công vào ca và ra ca cho nhân viên

## Why

Hệ thống biết ai đang đăng nhập trên từng thiết bị nhưng không biết ai đang trong ca làm việc. Nhân viên có thể nhập PIN để bán hàng mà không hề có bản ghi nào về việc họ bắt đầu và kết thúc làm việc lúc nào. Quán không có cơ sở để tính lương theo giờ, và cũng không biết đơn hàng nào được bán trong ca của ai.

Điểm thuận lợi là hệ thống đã có sẵn màn chọn nhân viên và nhập PIN, nên việc chấm công có thể gắn vào đúng chỗ mà nhân viên vốn đã phải thao tác mỗi ngày.

## What Changes

- Thêm khái niệm bản ghi chấm công gồm nhân viên, thời điểm vào ca và thời điểm ra ca.
- Thêm luồng vào ca và ra ca cho nhân viên, gắn với thao tác đăng nhập bằng PIN đang có.
- Hiển thị trạng thái đang trong ca của nhân viên hiện hành.
- Xử lý các trường hợp bất thường: quên ra ca, vào ca hai lần, ra ca khi chưa vào ca.
- Cho quản lý sửa bản ghi chấm công sai, kèm dấu vết ai sửa và sửa lúc nào.
- Bổ sung quyền liên quan chấm công vào mô hình phân quyền.

## Capabilities

### New Capabilities

- `time-clock`: bản ghi chấm công của nhân viên, luồng vào ca và ra ca, và các quy tắc xử lý bản ghi bất thường.

### Modified Capabilities

- `employee-session`: bổ sung quan hệ giữa việc đăng nhập bằng PIN và việc vào ca.
- `access-control`: bổ sung quyền xem và sửa dữ liệu chấm công.

## Impact

- Thêm bảng chấm công và migration.
- Chạm vào màn nhập PIN, là màn nhân viên dùng nhiều nhất trong ngày, nên mọi thao tác thêm vào đây đều phải rất gọn.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/screens.md`.

## Ngoài phạm vi

- Định nghĩa ca làm việc theo lịch, tính giờ công và bảng công. Việc đó thuộc `add-shift-management`.
- Tính lương và các khoản phụ cấp.
- Chấm công bằng vân tay, khuôn mặt hoặc thiết bị chuyên dụng.
- Kiểm soát vị trí địa lý khi chấm công.

## Phụ thuộc

- `redesign-permission-model`: nên chốt trước để quyền chấm công khai báo đúng cách. Lưu ý danh mục quyền chưa dùng trong `docs/features.md` đã có sẵn nhóm quyền mở và chốt ca.

## Câu hỏi phải chốt trước khi làm

1. Vào ca có bắt buộc không? Nếu bắt buộc thì nhân viên chưa vào ca không được bán hàng, điều này an toàn cho việc tính công nhưng có thể làm kẹt quán khi có sự cố.
2. Vào ca gắn với đăng nhập bằng PIN hay là thao tác riêng? Gắn chung thì gọn nhưng nhân viên đăng nhập lại giữa ca sẽ tạo bản ghi thừa nếu không xử lý cẩn thận.
3. Một nhân viên có được vào ca ở nhiều thiết bị cùng lúc không? Thực tế quán có nhiều máy nên chuyện này sẽ xảy ra.
4. Quên ra ca thì xử lý thế nào: tự đóng ca sau một khoảng thời gian, tự đóng vào cuối ngày kinh doanh, hay để trống và bắt quản lý sửa tay?
5. Ai được sửa bản ghi chấm công, và có cần giữ lại giá trị cũ để đối chiếu không?
6. Đơn hàng có cần gắn với bản ghi ca của người bán không? Nếu có thì đây là thay đổi chạm vào bảng đơn hàng.
7. Có cần chấm công giờ nghỉ giữa ca không?
8. Thời gian lấy từ đâu: đồng hồ thiết bị hay đồng hồ phía database? Với dữ liệu tính lương thì nguồn thời gian phải tin cậy.
9. Nhân viên có được xem lịch sử chấm công của chính mình không?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
