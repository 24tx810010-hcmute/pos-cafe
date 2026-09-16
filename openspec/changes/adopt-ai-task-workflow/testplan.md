# Kiểm tra gói quy trình

Các TC sau là **rà soát tài liệu theo tình huống**, không giả làm unit/E2E test của POS. Đầu vào là gói workflow hiện tại và các điểm vào sửa cùng change. Phủ luồng thường, ngoại lệ, biên và thẩm quyền bằng tình huống tài liệu; không phát sinh mã lỗi UI hay case gọi DB vì không đổi ứng dụng. Kết quả thực hiện nằm trong [biên bản](../../../docs/implementation-log/workflow-adoption-2026-09-16.md).

| TC | Requirement | Dữ liệu / tiền điều kiện | Bước kiểm và kết quả mong đợi |
| --- | --- | --- | --- |
| TC-WF-01 | WF-01 | Handoff chỉ tới commit X; worktree có diff Y | Đi theo hướng dẫn khởi động và mẫu input: phải đối chiếu thay đổi liên quan, ghi source/dirty state và không suy evidence X cho Y |
| TC-WF-02 | WF-02 | Đã chốt 5 quyết định; phát sinh câu hỏi thứ 6 về ai được giảm giá; phần khác độc lập | Rà quy tắc hỏi: vẫn hỏi câu 6 với phương án/căn cứ, chỉ chặn phần phụ thuộc; không hỏi lại 5 câu còn hiệu lực, không coi im lặng là đồng ý |
| TC-WF-03 | WF-03 | DEC-A được chốt theo giả thuyết; phép đo mới dẫn tới B | Điền thử các trường của mẫu quyết định: có nguồn/ngày/người chốt, giả thuyết/số đo, DEC mới thay DEC cũ và liên kết tới spec/test; không xóa lịch sử |
| TC-WF-04 | WF-04 | Một sửa chính tả không đổi nghĩa và một sửa một dòng quyền | Đối chiếu phân mức/chuẩn: việc đầu có thể ghi ngắn/cập nhật hồ sơ; việc sau là nhạy cảm. Change chính thức vẫn đủ phần và không bỏ gate riêng |
| TC-WF-05 | WF-05 | `npm test` pass trên mock; backend chưa kiểm; có file mới chưa commit và source đổi sau test | Mẫu evidence/quy tắc phải chỉ đúng phạm vi, gồm source có thể phục hồi/file mới và môi trường; không suy backend PASS hoặc dùng HEAD thay source; gate cần thiết phải kiểm lại |
| TC-WF-06 | WF-06 | Ba lần sửa fail; có thể do fixture sai; chủ dự án chưa đọc code | Rà hướng dẫn: chuyển sang chẩn đoán, không buộc sửa design/nới test; có đường giải thích code và trạng thái chờ phản hồi, không tự đánh dấu đã hiểu |
| TC-WF-07 | WF-07 | Hai task song song; task A chỉ được giao spec, task B đã được code; không có quyền deploy | Rà chỉ mục/mẫu handoff: file riêng, nguồn quyền rõ, A không tự code, B tiếp tục phần đã giao; cả hai không tự mở quyền deploy; trạng thái nghiệm thu/phát hành tách |
| TC-WF-08 | WF-08 | Worktree mới không có AGENTS; repo có nhánh docs; README có sửa dở từ task khác | Rà prompt và entrypoints: có cách tìm worktree/ref docs; link/anchor và OpenSpec strict hợp lệ; diff riêng chỉ có workflow, baseline khác được bảo toàn; không claim đã có CI/pilot |

## Cách tái kiểm

1. Đọc requirement, các tình huống trên và tài liệu đích; ghi kết luận/giới hạn cho từng TC. Không gọi đây là kiểm thử runtime.
2. Trong docs worktree chạy `openspec context --json` để xác minh root, rồi `openspec validate adopt-ai-task-workflow --type change --strict --no-interactive`. Chỉ dùng `--store` khi id đã được xác minh trên máy thực hiện; không mặc định registry tồn tại.
3. Kiểm các link/anchor nội bộ mới, các đường đọc từ AGENTS/CLAUDE/config/README và mẫu bàn giao; kiểm YAML/config bằng CLI.
4. Chạy `git diff --check` với các file của change; rà patch bổ sung so với baseline trước task và đảm bảo không có code ứng dụng hoặc thay đổi feature khác.
5. Pilot thực tế chưa được chạy trong task đóng gói; ghi riêng khi có task áp dụng đầu tiên.
