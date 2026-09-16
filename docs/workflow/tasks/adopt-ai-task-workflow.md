# Bàn giao — adopt-ai-task-workflow

- Cập nhật: 2026-09-16, AI thực hiện task đóng gói.
- Mục tiêu: đưa quy trình đã thảo luận vào dự án để áp dụng task mới; [change](../../../openspec/changes/adopt-ai-task-workflow/proposal.md).
- Bước hiện tại / trạng thái: 6 — đã kiểm gói tài liệu, sẵn dùng cho task mới.
- Đọc tiếp: [quy trình](../README.md), [prompt](../start-task.md), [biên bản](../../implementation-log/workflow-adoption-2026-09-16.md), [tasks](../../../openspec/changes/adopt-ai-task-workflow/tasks.md).
- Code/docs: code worktree `D:/Workspace/pos-cafe` chỉ đọc; docs worktree `D:/Workspace/pos-cafe-docs`, nhánh `docs`, baseline `132e9d6cc065459031ee92cfbafcd423b5ac81c5`; có sửa dở từ task khác, phải giữ nguyên.
- Phạm vi được giao: đóng gói/tích hợp hướng dẫn và mẫu; nguồn là yêu cầu chủ dự án ngày 16/09, trích trong proposal. Không mở quyền làm feature, push, deploy hay dữ liệu thật. Commit local chỉ gói này.
- Quyết định: DEC-WF-01–08; không còn câu hỏi chặn việc đóng gói. Câu hỏi nghiệp vụ của feature khác giữ nguyên ở change đó.
- Đã làm: quy trình, mẫu, bộ change và cập nhật entrypoints; OpenSpec strict/config/link/diff và TC-WF-01–08 đạt trong phạm vi rà tài liệu. [Biên bản và giới hạn](../../implementation-log/workflow-adoption-2026-09-16.md).
- Chưa làm/chưa kiểm: chưa pilot, CI hoặc kiểm thử runtime ứng dụng; không chuyển trạng thái feature khác.
- Việc tiếp theo: task mới dùng prompt và tạo bàn giao riêng. Task cũ chỉ bổ sung bàn giao khi tiếp tục; không phải rà lại toàn bộ backlog.
- Phiên bản gói: commit local chứa change, tra `git log -1 -- openspec/changes/adopt-ai-task-workflow/tasks.md`; không gắn lại kết quả task ứng dụng khác vào phiên bản này.
- Việc cần người dùng: không có để hoàn tất gói đã yêu cầu; task mới chỉ cần mô tả việc muốn làm và dùng prompt.
- Nghiệm thu/phát hành: bàn giao gói tài liệu theo yêu cầu; chưa có phản hồi sử dụng pilot. Phát hành ứng dụng ngoài phạm vi, không push từ task này.

## Bổ sung sau bản 9937f1f — cổng subagent

Ngày 2026-09-16, chủ dự án yêu cầu review độc lập trước bàn giao. Đã bổ sung DEC-WF-09/WF-09; cả hai reviewer bắt buộc APPROVE candidate cuối `9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af`. Finding không chặn RQ-N1 đã được sửa và reviewer xác nhận đóng; không còn finding mở. [Báo cáo nguyên văn, manifest và giới hạn](../reviews/2026-09-16-gate/README.md) được lưu trên docs. Phần đóng gói ban đầu ở trên là checkpoint lịch sử; không gọi tự rà của checkpoint đó là review subagent.
