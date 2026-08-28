# Mở rộng độ phủ kiểm thử E2E cho luồng nghiệp vụ

## Why

Bộ smoke Playwright hiện tại chạy 34 case và tập trung vào việc màn hình mở được ở nhiều viewport, chưa phải kiểm thử luồng nghiệp vụ đầu-cuối. Các luồng dễ vỡ nhất và khó bắt bằng unit test lại chưa được phủ: instant pay tách đơn kèm đánh số bill theo thứ tự thanh toán, hủy đơn đã thanh toán kèm khóa lạc quan, đồng bộ hai thiết bị, và ranh giới quyền. Đây đúng là những chỗ mà một hồi quy sẽ làm sai tiền, và cũng là những chỗ báo cáo đồ án cần bằng chứng.

## What Changes

- Bổ sung kịch bản E2E cho luồng bán hàng đầy đủ: ghép cửa hàng, đăng nhập nhân viên, mở bàn, thêm món kèm tùy chọn, gửi đơn, thanh toán, in hóa đơn.
- Bổ sung kịch bản E2E cho instant pay: tách đơn thanh toán một phần, kiểm tra đơn tách và đơn gốc độc lập, kiểm tra thứ tự số bill theo thứ tự thu tiền.
- Bổ sung kịch bản E2E cho hủy đơn đã thanh toán: kiểm tra ràng buộc quyền, bắt buộc lý do, và doanh thu giảm tương ứng trong báo cáo.
- Bổ sung kịch bản E2E đa thiết bị: hai ngữ cảnh trình duyệt cùng một cửa hàng, kiểm tra thiết bị thứ hai thấy thay đổi trong khoảng vài giây.
- Bổ sung kịch bản E2E cho ranh giới quyền: thu ngân không hủy được đơn đã thanh toán, và cấp quyền riêng cho một thu ngân thì làm được.
- Bổ sung kịch bản E2E cho trình soạn thực đơn và trình soạn sơ đồ ở mức lưu tập thay đổi và không ghi đè trạng thái bàn.

## Capabilities

### New Capabilities

Không có. Đây là thay đổi về kiểm thử, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có. Các kịch bản E2E bám theo scenario đã mô tả trong baseline spec của `payment`, `order-history`, `order-void`, `receipt-printing`, `access-control`, `multi-device-sync`, `menu-management`, `floor-plan-editor`.

## Impact

- Thư mục `tests` ở worktree `D:\Workspace\pos-cafe`, cấu hình `playwright.config.ts` và `playwright.supabase.config.ts`.
- Thời gian chạy bộ kiểm thử tăng lên; cần cân nhắc tách nhóm chạy nhanh và nhóm chạy đầy đủ.
- Có thể cần thêm thuộc tính định danh phần tử trong UI để chọn phần tử ổn định, đây là thay đổi chạm vào source code nghiệp vụ.
- Cập nhật `docs/testing.md`.

## Ngoài phạm vi

- Định nghĩa chiến lược và cổng chất lượng. Việc đó thuộc `define-test-strategy`.
- Dựng dữ liệu và môi trường test tái lập được. Việc đó thuộc `setup-test-data-environment`.
- Chạy tự động trên pipeline. Việc đó thuộc `add-ci-pipeline`.
- Kiểm thử tính năng chưa tồn tại như tồn kho, khuyến mãi, chấm công, loyalty, offline.

## Phụ thuộc

- `define-test-strategy`: cần chốt tầng test và tiêu chí trước, nếu không các kịch bản viết ra sẽ không nhất quán.
- `setup-test-data-environment`: các kịch bản đa thiết bị và kịch bản báo cáo cần dữ liệu tái lập được.

## Câu hỏi phải chốt trước khi làm

1. E2E chạy trên môi trường nào là chính: adapter mock hiện có, hay một project Supabase riêng dành cho kiểm thử? Nếu chạy trên Supabase thì ai cấp project và dữ liệu được dọn thế nào giữa các lần chạy?
2. Ưu tiên thứ tự thế nào nếu không làm hết một lượt? Đề xuất của tôi là instant pay trước, rồi hủy đơn đã thanh toán, rồi ranh giới quyền, rồi đa thiết bị, nhưng cần bạn xác nhận.
3. Kịch bản đa thiết bị chấp nhận ngưỡng chờ bao nhiêu giây thì coi là đồng bộ thành công? Hiện chu kỳ tải lại là khoảng 5 giây.
4. Có chấp nhận sửa source code nghiệp vụ để thêm thuộc tính định danh phần tử phục vụ kiểm thử không, hay bắt buộc chỉ chọn phần tử qua văn bản và vai trò hiển thị?
5. Bộ viewport cần phủ là gì? Hiện smoke chạy đa viewport và portrait chỉ hiện hướng dẫn xoay ngang; cần chốt E2E nghiệp vụ chạy trên viewport nào.
6. Kịch bản thanh toán có cần kiểm tra nội dung hóa đơn in ra không, hay chỉ cần kiểm tra hóa đơn mở đúng và số tiền đúng?
7. Có cần chụp ảnh màn hình làm bằng chứng cho báo cáo đồ án không? Nếu có thì lưu ở đâu, vì nhánh `docs` hiện quy định không chứa ảnh nhị phân.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
