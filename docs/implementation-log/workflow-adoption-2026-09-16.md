# Đóng gói quy trình task AI — 2026-09-16

## Phạm vi và nguồn

Chủ dự án chấp thuận hướng quy trình sau phản biện và yêu cầu đưa vào dự án để dùng cho task mới. [Proposal và quyết định](../../openspec/changes/adopt-ai-task-workflow/proposal.md). Chỉ chỉnh hướng dẫn, mẫu và hồ sơ trên nhánh `docs`; không sửa/chạy code ứng dụng, không kiểm lại backend hoặc deployment.

Baseline docs: `132e9d6cc065459031ee92cfbafcd423b5ac81c5`, có thay đổi chưa commit từ các task khác. Đã sao lưu bảy file dự kiến chỉnh và manifest SHA-256 của 486 file Git theo dõi/không-ignore để đối chiếu phạm vi. Bản baseline đầy đủ là scratch của lần làm, không cần để dùng quy trình; commit riêng là bản có thể lấy lại của gói sau khi hoàn tất.

## Đã thay đổi

- [Quy trình](../workflow/README.md), [mẫu](../workflow/templates.md), [câu mở đầu](../workflow/start-task.md) và [chỉ mục bàn giao](../workflow/tasks/README.md).
- AGENTS/CLAUDE và chuẩn spec: đầu vào rõ, hỏi theo tác động, giải quyết thông tin mới trong task, tiếp tục phần độc lập; giữ bộ bảy phần và gate riêng.
- Config OpenSpec và các chỉ mục dẫn đến nguồn chuẩn.
- Bộ change quy trình có requirement, design, testplan và traceability; không có use case ứng dụng theo ngoại lệ được giải trình.

## Kiểm chứng

Đã kiểm cấu trúc và rà kịch bản tài liệu ngày 2026-09-16. Cùng AI thực hiện và tự rà; không gọi đây là review độc lập, test runtime hay pilot có người dùng.

| Phép kiểm | Kết quả và phạm vi |
| --- | --- |
| `openspec context --json` từ docs worktree | Đúng root `D:/Workspace/pos-cafe-docs`, nguồn `nearest`, không lỗi context |
| `openspec validate adopt-ai-task-workflow --type change --strict --no-interactive` | PASS; change hợp lệ |
| `openspec status --change adopt-ai-task-workflow --json` | Đọc được cấu hình và bộ artifact; trạng thái cấu trúc không thay kết quả nghiệm thu |
| Link/anchor mới và nội dung Markdown | 56 liên kết nội bộ được kiểm; đích/anchor tồn tại, không ký tự thay thế hoặc dấu xung đột; phạm vi gồm 7 file sửa và 13 file mới |
| `git diff --check` trên các file tracked của workflow | PASS |
| Bảo toàn baseline | 479 file có sẵn ngoài 7 file được chỉnh giữ nguyên SHA-256; 13 file mới đều thuộc gói. Với 7 file chỉnh, patch được tính từ bản sao trước task để tách thay đổi có sẵn |

| Kịch bản rà soát | Kết luận trên tài liệu |
| --- | --- |
| TC-WF-01: nguồn cũ, worktree mới | Có bước kiểm Git/diff và không nhận evidence cũ cho source mới |
| TC-WF-02: câu hỏi thứ sáu | Vẫn hỏi khi ảnh hưởng nghiệp vụ; phần độc lập tiếp tục; không lặp quyền còn hiệu lực |
| TC-WF-03: thay giả thuyết bằng số đo | Mẫu có nguồn/ngày/người chốt, trạng thái, căn cứ và liên kết thay thế; giữ lịch sử |
| TC-WF-04: sửa chữ so với sửa quyền một dòng | Có phân mức theo tác động; không bỏ bộ artifact/gate chính thức vì diff nhỏ |
| TC-WF-05: mock xanh, source đổi | Ghi đúng backend và source gồm file mới/snapshot; không suy PASS chung; có điều kiện kiểm lại |
| TC-WF-06: sửa không tiến triển, chưa đọc code | Có chẩn đoán thay sửa mò; không tự kết luận design sai hoặc chủ dự án đã hiểu |
| TC-WF-07: hai task, phạm vi quyền khác nhau | Bàn giao riêng, nguồn quyền và trạng thái tách; không nâng quyền từ nội dung file |
| TC-WF-08: thiếu pointer và README đang bẩn | Có prompt tìm worktree/ref; liên kết và strict validation đạt; phần stage phải được tách khỏi baseline khác |

**Lỗi công cụ đã gặp:** lần đầu dùng `--store pos-cafe-docs` theo README cũ thất bại vì CLI không có store đăng ký. Đã xác minh root bằng `context` rồi chạy tại docs worktree, không sửa registry toàn cục. Cập nhật hướng dẫn gọi trong README và testplan. Điều này không phải lỗi ứng dụng POS.

Để tái kiểm sau checkout, dùng ba lệnh OpenSpec ở bảng, đọc [TC-WF-01–08](../../openspec/changes/adopt-ai-task-workflow/testplan.md), kiểm link/anchor và `git show --check <commit-cua-goi>`. Script kiểm/lần chạy raw là scratch của task; kết luận ở đây chỉ là kiểm tài liệu. Phiên bản chính xác của gói là commit chứa change này, có thể tìm bằng `git log -1 -- openspec/changes/adopt-ai-task-workflow/tasks.md`.

## Bàn giao

Đầu ra kỹ thuật: gói tài liệu sẵn dùng; [prompt mở task](../workflow/start-task.md) và [bàn giao ngắn](../workflow/tasks/adopt-ai-task-workflow.md). Có đầy đủ quy tắc và ví dụ để AI lập đề bài, hỏi, ghi quyết định, kiểm chứng và tiếp tục phiên sau. Đây không phải sự kiện chủ dự án đã trải nghiệm/nghiệm thu một feature ứng dụng.

## Giới hạn

- Chưa có pilot thực tế, không khẳng định giảm thời gian hoặc lỗi.
- Chưa tạo CI/runner, chưa chuyển task cũ sang quy trình, chưa chốt tính năng mới.
- Pointer trên main đang bị ignore; prompt khởi động nêu rõ đường đọc docs để dùng ở worktree mới. Không thay cài đặt toàn cục hay hứa tự nạp ở mọi môi trường.
- Không có sự kiện chủ dự án đã nghiệm thu sản phẩm hoặc đọc code ứng dụng trong task này. Đầu ra là gói tài liệu đã yêu cầu.
