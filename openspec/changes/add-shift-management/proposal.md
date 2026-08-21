# Quản lý ca làm việc và bảng công

## Why

Bản ghi chấm công thô chỉ trả lời được câu hỏi nhân viên có mặt lúc nào. Quán còn cần biết ai đáng lẽ phải làm ca nào, ai đi trễ, ai làm thừa giờ, và tổng giờ công tháng này là bao nhiêu. Đó là phần biến dữ liệu chấm công thành thứ dùng được để trả lương và xếp lịch.

Ngoài ra, ca làm việc trong quán cà phê còn gắn với việc bàn giao tiền mặt: mở ca với số tiền đầu ca, chốt ca và đối chiếu tiền trong két với doanh thu tiền mặt. Danh mục quyền chưa dùng trong `docs/features.md` đã có sẵn nhóm quyền mở và chốt ca cùng kiểm két, cho thấy hướng này đã được tính tới từ trước.

## What Changes

- Thêm khái niệm ca làm việc theo lịch: khung giờ, ngày áp dụng, và nhân viên được phân công.
- Đối chiếu chấm công thực tế với ca theo lịch để tính đi trễ, về sớm và làm thừa giờ.
- Tính giờ công theo khoảng thời gian, tổng hợp theo từng nhân viên.
- Màn bảng công cho quản lý: xem giờ công, xem chi tiết từng ngày, sửa và duyệt.
- Cân nhắc phần chốt ca tiền mặt: số tiền đầu ca, doanh thu tiền mặt trong ca, số tiền đếm được cuối ca và phần chênh lệch.

## Capabilities

### New Capabilities

- `shift-scheduling`: định nghĩa ca làm việc theo lịch và phân công nhân viên vào ca.
- `timesheet`: tổng hợp giờ công từ dữ liệu chấm công đối chiếu với ca theo lịch, và luồng duyệt bảng công.

### Modified Capabilities

- `time-clock`: bổ sung quan hệ giữa bản ghi chấm công và ca theo lịch.
- `access-control`: bổ sung quyền xếp ca, xem bảng công và duyệt bảng công.
- `reporting`: bổ sung số liệu doanh thu theo ca nếu được chốt là cần.

## Impact

- Thêm bảng ca làm việc, bảng phân công và có thể cả bảng chốt ca tiền mặt; kéo theo migration.
- Thêm module bảng công vào vỏ ứng dụng và điều hướng.
- Nếu làm phần chốt ca tiền mặt thì chạm vào luồng thanh toán và báo cáo doanh thu.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/screens.md`.

## Ngoài phạm vi

- Bản ghi chấm công thô. Việc đó thuộc `add-employee-time-clock`.
- Tính lương, phụ cấp, thuế và bảo hiểm.
- Xin nghỉ phép và đổi ca giữa nhân viên.
- Dự báo nhu cầu nhân sự theo doanh thu.

## Phụ thuộc

- `add-employee-time-clock`: bắt buộc.

## Câu hỏi phải chốt trước khi làm

1. Có thật sự cần xếp ca theo lịch không, hay chỉ cần tổng giờ công từ chấm công là đủ? Xếp lịch làm phạm vi tăng gấp đôi. Với quán nhỏ, nhiều nơi chỉ cần tổng giờ.
2. Nếu có xếp lịch thì lịch lặp theo tuần, hay xếp tay từng ngày?
3. Có làm phần chốt ca tiền mặt không? Đây thực chất là một tính năng riêng và khá lớn, chạm vào tiền, nên có thể nên tách thành change riêng.
4. Giờ công tính theo quy tắc nào: tính đúng thời gian thực tế, làm tròn theo khối 15 hoặc 30 phút, hay lấy theo ca đã phân công khi chênh lệch nhỏ?
5. Đi trễ bao nhiêu phút thì tính là trễ, và làm thừa bao nhiêu thì tính là thừa giờ?
6. Bảng công có cần bước duyệt không, và ai duyệt?
7. Kỳ tính công theo tháng, theo nửa tháng, hay theo tuần?
8. Có cần xuất bảng công ra tệp không? Lưu ý nút xuất báo cáo hiện đang bị vô hiệu hóa vì chưa hỗ trợ.
9. Nếu sau này làm nhiều cửa hàng thì một nhân viên có làm ở nhiều cửa hàng không? Câu trả lời ảnh hưởng mô hình dữ liệu ngay từ đầu.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
