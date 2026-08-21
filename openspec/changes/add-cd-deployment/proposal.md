# Dựng quy trình triển khai liên tục

## Why

Ứng dụng deploy lên Vercel và backend là Supabase managed, nhưng quy trình đưa một thay đổi ra môi trường chạy thật hiện chưa được viết thành văn và chưa tự động. Rủi ro lớn nhất nằm ở migration: `docs/requirements.md` ghi rõ database đã có dữ liệu thì chỉ được apply forward migration chưa có và không được replay bước reset. Việc này đang phụ thuộc hoàn toàn vào việc nhớ đúng thứ tự thao tác. NFR-08 cũng ghi rằng URL live cần xác minh riêng trước khi khẳng định.

## What Changes

- Định nghĩa các môi trường và ranh giới giữa chúng, tối thiểu là môi trường xem trước và môi trường chạy thật.
- Tự động triển khai frontend theo nhánh và theo pull request.
- Quy trình áp dụng migration database có kiểm soát: chỉ forward, có bước kiểm tra trước khi chạy, có cách xác minh sau khi chạy.
- Quy trình xử lý khi triển khai hỏng: quay lui frontend, và cách xử lý khi migration đã chạy.
- Kiểm tra sức khỏe sau khi triển khai, đủ để khẳng định môi trường chạy thật thực sự hoạt động.
- Ghi tài liệu quy trình phát hành.

## Capabilities

### New Capabilities

Không có. Đây là hạ tầng vận hành, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Cấu hình triển khai trên Vercel và cấu hình pipeline ở worktree `D:\Workspace\pos-cafe`.
- Thư mục `supabase` chứa migration, và cách chúng được áp dụng.
- Biến môi trường và bí mật cho từng môi trường.
- Cập nhật `docs/tech-stack.md`, `docs/demo-runbook.md`, và NFR-08 trong `docs/requirements.md`.

## Ngoài phạm vi

- Kiểm tra chất lượng trước khi triển khai. Việc đó thuộc `add-ci-pipeline`.
- Giám sát, cảnh báo và thu thập log sau khi triển khai.
- Sao lưu và khôi phục database.

## Phụ thuộc

- `add-ci-pipeline`: chỉ nên triển khai tự động những thay đổi đã qua cổng chất lượng.

## Câu hỏi phải chốt trước khi làm

1. Hiện có bao nhiêu project Supabase? Nếu chỉ có một thì môi trường xem trước và môi trường chạy thật đang dùng chung database, và triển khai tự động sẽ nguy hiểm. Cần chốt có tách project hay không.
2. Có môi trường chạy thật thật sự đang được ai đó sử dụng chưa, hay tất cả vẫn là demo? Câu trả lời quyết định mức độ nghiêm ngặt của quy trình migration.
3. Migration được áp dụng bằng cách nào hiện tại: chạy tay trên bảng điều khiển Supabase, hay bằng công cụ dòng lệnh? Có muốn tự động hóa bước này không, hay giữ thủ công có kiểm soát vì rủi ro mất dữ liệu?
4. Có cần quy trình quay lui migration không? Nếu có thì mỗi migration phải viết kèm bước hoàn tác, việc này làm tăng đáng kể công sức cho mọi tính năng sau này.
5. Triển khai tự động kích hoạt theo cái gì: mỗi lần đẩy lên `main`, hay chỉ khi gắn thẻ phiên bản?
6. Kiểm tra sức khỏe sau triển khai cần tới mức nào: chỉ cần trang tải được, hay phải chạy một kịch bản nghiệp vụ tối thiểu trên môi trường chạy thật?
7. Nhánh `docs` có cần triển khai gì không, hay chỉ là kho tài liệu thuần?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
