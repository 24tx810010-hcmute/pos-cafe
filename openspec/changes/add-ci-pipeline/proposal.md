# Dựng pipeline tích hợp liên tục

## Why

Hiện mọi kiểm tra chất lượng đều chạy thủ công trên máy cá nhân: `npm test`, `npm run build`, `npm run smoke`. Kết quả được chép tay vào `docs/testing.md` kèm ngày chạy. Cách này không chứng minh được rằng trạng thái hiện tại của nhánh đang xanh, và với 8 nhóm tính năng mở rộng sắp làm thì việc phát hiện hồi quy sẽ ngày càng chậm. NFR-06 và NFR-07 đang được khẳng định bằng lời chứ chưa bằng bằng chứng tự động.

## What Changes

- Thêm pipeline chạy tự động trên mỗi push và mỗi pull request.
- Pipeline chạy tối thiểu: cài dependency, kiểm tra kiểu, chạy unit test, build sản xuất.
- Chạy bộ kiểm thử đầu-cuối theo mức đã chốt ở `define-test-strategy`.
- Xuất kết quả và tạo tác kiểm thử để tra cứu khi thất bại.
- Cấu hình cache dependency để thời gian chạy chấp nhận được.
- Ghi tài liệu cách đọc kết quả pipeline và cách xử lý khi đỏ.

## Capabilities

### New Capabilities

Không có. Đây là hạ tầng phát triển, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Thêm cấu hình pipeline vào worktree `D:\Workspace\pos-cafe` nhánh `main`.
- Có thể cần thêm script trong `package.json` để gom các bước kiểm tra.
- Cần bí mật cho môi trường kiểm thử nếu chạy E2E trên Supabase thật.
- Cập nhật `docs/testing.md` và `docs/tech-stack.md`.

## Ngoài phạm vi

- Triển khai tự động lên môi trường chạy thật. Việc đó thuộc `add-cd-deployment`.
- Viết thêm test. Việc đó thuộc `expand-e2e-coverage`.
- Quét bảo mật, phân tích tĩnh nâng cao, đo hiệu năng.

## Phụ thuộc

- `define-test-strategy`: cần biết bước nào là cổng chặn, bước nào chỉ cảnh báo.
- `setup-test-data-environment`: cần trước nếu pipeline phải chạy E2E trên Supabase thật.

## Câu hỏi phải chốt trước khi làm

1. Dùng nền tảng nào? GitHub Actions là lựa chọn hiển nhiên vì repo đã ở GitHub và có mức miễn phí, nhưng cần bạn xác nhận.
2. Repo hiện có ba nhánh dùng cho ba mục đích khác nhau: `main` chứa code, `docs` chứa tài liệu, và các nhánh làm việc. Pipeline chạy trên nhánh nào? Nhánh `docs` không có `package.json` nên sẽ hỏng nếu cấu hình chạy trên mọi nhánh.
3. Bước nào được phép chặn merge và bước nào chỉ cảnh báo?
4. Có bật E2E trong pipeline ngay lần này không? Nếu có thì chạy trên mock hay Supabase thật, và bí mật kết nối lưu ở đâu?
5. Thời gian chạy tối đa chấp nhận được là bao nhiêu? Con số này quyết định có tách nhóm chạy nhanh và nhóm chạy đầy đủ hay không.
6. Trình quản lý gói dùng gì? Trong worktree hiện có cả `package-lock.json` và `pnpm-lock.yaml`, mà `docs/tech-stack.md` ghi là npm. Cần chốt một cái, nếu không pipeline sẽ cài khác với máy cá nhân.
7. Có cần chạy pipeline theo lịch định kỳ ngoài lúc push không, ví dụ chạy E2E đầy đủ mỗi đêm?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
