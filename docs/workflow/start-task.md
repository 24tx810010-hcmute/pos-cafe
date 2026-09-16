# Bắt đầu task mới cho POS-cafe

Quy trình và hồ sơ ở nhánh `docs`; code và công cụ chạy được ở `main`. Điểm vào là [AGENTS.md](../../AGENTS.md), [chuẩn spec](../../openspec/SPEC-STANDARD.md) và [quy trình task](README.md).

## Câu mở đầu có thể sao chép

Thay dòng "Việc cần làm" bằng yêu cầu của bạn; không cần tự điền toàn bộ mẫu đề bài.

```text
Áp dụng quy trình task POS-cafe trên nhánh docs.

Trước tiên xác minh worktree docs; trên máy này dự kiến là
D:/Workspace/pos-cafe-docs. Đọc AGENTS.md, openspec/SPEC-STANDARD.md,
docs/workflow/README.md và bàn giao đúng task trong docs/workflow/tasks/.
Ưu tiên nội dung worktree hiện có và ghi rõ phần chưa commit.

Việc cần làm: [mô tả tính năng/vấn đề và kết quả tôi muốn thấy].

Hãy tự khảo sát code/tài liệu liên quan, hoàn thiện đề bài, nêu câu hỏi
có phương án và khuyến nghị khi chưa rõ yêu cầu. Không giới hạn tổng số
câu hỏi cần thiết. Ghi quyết định và lý do trên docs. Tiếp tục công việc
độc lập đã được giao trong lúc chờ; không hỏi lại điều đã chốt còn hiệu lực.
Nếu đây là yêu cầu phân tích/spec, hoàn thành hồ sơ để tôi duyệt.
Nếu tôi đã giao triển khai phạm vi được duyệt, thực hiện và kiểm chứng
theo quy trình, cập nhật bằng chứng và bàn giao trước khi kết thúc.
```

## Khi tiếp tục việc đang làm

```text
Tiếp tục task [mã task/change] của POS-cafe theo quy trình trên nhánh docs.
Đọc bàn giao và các quyết định liên quan, kiểm tra phần code/docs đã đổi
từ checkpoint, rồi tiếp tục trong phạm vi đã được tôi cho phép.
Nếu có thông tin mới làm đổi nghiệp vụ hoặc nghiệm thu, giải thích lựa chọn
và hỏi tôi trước phần phụ thuộc. Giữ bằng chứng và bàn giao cập nhật.
```

## Với checkout hoặc worktree mới

Con trỏ `AGENTS.md` trên worktree code hiện tại bị Git ignore, nên không bảo đảm tự xuất hiện trong mọi worktree mới. Không hứa rằng chỉ tạo task là AI tự đọc được nhánh khác. Câu mở đầu trên chỉ rõ nguồn cần đọc.

- Dùng `git worktree list` để tìm worktree mang nhánh `docs`; xác minh bằng Git, không đoán theo tên thư mục.
- Nếu không có worktree docs nhưng có ref `docs`, có thể đọc bản đã commit bằng `git show docs:AGENTS.md`, `git show docs:openspec/SPEC-STANDARD.md` và `git show docs:docs/workflow/README.md`, rồi các đường dẫn mà chúng chỉ tới. Đây không bao gồm thay đổi chưa commit ở máy khác.
- Nếu không có cả worktree lẫn ref, nêu nguồn còn thiếu và hỏi cách lấy tài liệu; không suy diễn quy trình từ trí nhớ hoặc tạo ra sự ủy quyền.

Gói này không đổi cài đặt toàn cục của công cụ AI hoặc di chuyển các task đang làm. [Mẫu đầy đủ](templates.md) giúp AI tự lập đầu vào, quyết định, nghiệm thu và bàn giao.
