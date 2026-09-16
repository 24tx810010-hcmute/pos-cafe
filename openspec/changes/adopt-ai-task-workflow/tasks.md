# Thực hiện gói quy trình

Input: yêu cầu đóng gói ngày 2026-09-16, proposal/spec của change và quy ước hai nhánh hiện hữu. Output: gói docs áp dụng được cho task mới, nguồn quyết định, cách kiểm tra và bàn giao. Quyền: chỉnh tài liệu/cấu hình hướng dẫn trong docs; commit local riêng thuộc việc đưa vào dự án. Không có quyền push/deploy/đổi code ứng dụng từ task này.

- [x] 1. Khảo sát quy ước, entrypoints, trạng thái Git và lưu baseline thay đổi sẵn có.
- [x] 2. Ghi phạm vi, quyết định và requirement WF-01–08; testplan/traceability cho change quy trình.
- [x] 3. Tạo quy trình, mẫu, prompt khởi động và chỉ mục bàn giao.
- [x] 4. Đồng bộ AGENTS, CLAUDE, chuẩn spec, config OpenSpec và README; giữ gate riêng của feature.
- [x] 5. Rà TC-WF-01–08, kiểm liên kết/anchor, cấu hình, OpenSpec strict và diff; sửa lỗi trong phạm vi.
- [x] 6. Ghi biên bản và bàn giao; tạo bản hướng dẫn khởi động cho người dùng.

Phiên bản bàn giao được lưu bằng commit local riêng chỉ phần workflow; đối chiếu patch còn lại với baseline, không push. Dùng `git log -1 -- openspec/changes/adopt-ai-task-workflow/tasks.md` để lấy mã phiên bản thay vì ghi mã của chính commit vào nội dung nó.

Điểm chặn: không đánh dấu kiểm tra đạt nếu chỉ viết kế hoạch; không đưa sửa dở của task khác vào commit. Task ứng dụng đầu tiên dùng quy trình là công việc về sau, không nằm trong checklist hoàn thành gói này.
