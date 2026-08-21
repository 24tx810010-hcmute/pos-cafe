# Chuẩn hóa dữ liệu và môi trường kiểm thử

## Why

Hiện có hai nguồn dữ liệu cho kiểm thử: bộ seed demo trong ứng dụng và adapter mock, cả hai đều được thiết kế cho việc demo chứ không cho kiểm thử. Hệ quả là test khó tái lập: kịch bản báo cáo cần dữ liệu ở nhiều ngày kinh doanh khác nhau, kịch bản quyền cần nhiều nhân viên với cấu hình quyền khác nhau, kịch bản đa thiết bị cần hai phiên trên cùng một cửa hàng, và không có cách dọn sạch giữa các lần chạy. Không giải quyết việc này thì mọi kịch bản E2E sẽ phụ thuộc trạng thái sót lại của lần chạy trước.

## What Changes

- Tách khái niệm dữ liệu demo và dữ liệu kiểm thử: bộ seed dành cho kiểm thử có thể chứa dữ liệu bất thường mà bộ demo không nên có.
- Cung cấp cách tạo cửa hàng kiểm thử độc lập cho mỗi lần chạy, và dọn sạch sau khi chạy.
- Cung cấp bộ dữ liệu dựng sẵn cho các tình huống khó: nhiều ngày kinh doanh có doanh thu, đơn đã hủy, nhân viên có ghi đè quyền, món có nhóm tùy chọn bắt buộc và không bắt buộc.
- Chuẩn hóa cách khai báo biến môi trường cho môi trường kiểm thử, tách khỏi biến môi trường phát triển và sản xuất.
- Ghi tài liệu cách chạy bộ kiểm thử trên máy cá nhân từ trạng thái sạch.

## Capabilities

### New Capabilities

Không có. Đây là hạ tầng kiểm thử, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Thư mục `src/seed` và `src/test` ở worktree `D:\Workspace\pos-cafe`.
- Cấu hình biến môi trường và có thể cả `vercel.json` nếu cần tách môi trường.
- Nếu chọn tạo cửa hàng kiểm thử qua database thì cần cân nhắc migration hoặc hàm tiện ích chỉ dùng cho môi trường kiểm thử; đây là điểm nhạy cảm vì không được để lọt sang sản xuất.
- Cập nhật `docs/testing.md` và `docs/demo-runbook.md`.

## Ngoài phạm vi

- Viết kịch bản kiểm thử. Việc đó thuộc `expand-e2e-coverage`.
- Cấu hình pipeline. Việc đó thuộc `add-ci-pipeline`.
- Sinh dữ liệu quy mô lớn phục vụ kiểm thử hiệu năng.

## Phụ thuộc

- `define-test-strategy`: cần chốt E2E chạy trên mock hay Supabase thật trước, vì hai hướng dẫn tới hai thiết kế dữ liệu hoàn toàn khác nhau.

## Câu hỏi phải chốt trước khi làm

1. Kiểm thử chạy trên Supabase thật hay chỉ trên adapter mock? Nếu chạy trên Supabase thì dùng project riêng cho kiểm thử, hay dùng chung project phát triển với cửa hàng riêng?
2. Nếu dùng chung project phát triển thì chấp nhận rủi ro dữ liệu kiểm thử lẫn vào dữ liệu phát triển không? Nếu không thì cần cấp thêm một project Supabase, bạn có sẵn sàng tạo không?
3. Việc dọn dữ liệu sau khi chạy làm thế nào? Xóa cứng cửa hàng kiểm thử, hay dựa vào cơ chế xóa dữ liệu mẫu hiện có vốn là xóa mềm?
4. Có chấp nhận thêm hàm tiện ích phía database chỉ phục vụ kiểm thử không? Nếu có thì cần cơ chế nào để chắc chắn nó không tồn tại trên môi trường sản xuất?
5. Dữ liệu kiểm thử cần phủ tới mức nào ngay lần này: chỉ đủ cho các kịch bản trong `expand-e2e-coverage`, hay chuẩn bị sẵn cho cả tồn kho, khuyến mãi, chấm công và loyalty sau này?
6. Ngày kinh doanh trong dữ liệu kiểm thử cố định theo ngày cụ thể, hay tính tương đối theo ngày chạy? Cố định thì dễ khẳng định kết quả nhưng sẽ cũ dần.
7. Biến môi trường lưu ở đâu cho môi trường kiểm thử cục bộ và cho pipeline sau này?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
