# Kiểm độc lập bổ sung cổng reviewer — 2026-09-16

## Candidate và phạm vi

DEC-WF-09 bổ sung yêu cầu dùng subagent độc lập trước bàn giao. Chỉ thay hướng dẫn/spec/mẫu; không đổi code ứng dụng. Base: `9937f1f005f1569b0e348374b37cc95d8b490ca5`.

Candidate cuối v2: `9c627e44f45155de9f61b0b7cdc419b52dfe0ba65e10f43106cbb4b83ca295af`, gồm 13 file. [Manifest lưu cùng hồ sơ](candidate.json) giữ hash bytes lúc review và hash sau chuẩn hóa CRLF thành LF để đối chiếu với nội dung Git. Hash nhận diện nội dung, không thay thế nội dung có thể phục hồi.

Candidate v1 `25496be810acffe6082a2903563890f96d9fface218fe514f9100c5ee8481664` được giữ trong lịch sử hai báo cáo. V2 chỉ sửa hai dải mã giới thiệu từ 01–08 thành 01–09 tại proposal/design; 11 file còn lại không đổi. Cả hai reviewer tự kiểm delta và xác nhận v2.

Hai reviewer bắt buộc, ngữ cảnh khởi tạo riêng, không tham gia soạn candidate và không được sửa candidate:

| Reviewer | Phạm vi | Verdict |
| --- | --- | --- |
| [review_gate_requirements](requirements.md) | Đầy đủ/nhất quán với yêu cầu, entrypoints, đóng findings và điều kiện đồng thuận | APPROVE v2; RQ-N1 đã đóng |
| [review_gate_evidence](evidence.md) | Khả năng thực thi, source/evidence, quyền review, thiếu công cụ và kiểm cấu trúc | APPROVE v2; không có finding |

Các lần kiểm của tác giả: OpenSpec strict/context/status, link/anchor mới, diff và bảo toàn phần ngoài phạm vi đều đạt. Đây không thay thế verdict của reviewer. Không có kiểm thử runtime POS hoặc pilot trên feature trong lần này.

## Finding và kết luận

| Finding | Xử lý | Xác nhận |
| --- | --- | --- |
| RQ-N1 — dải mã giới thiệu chưa gồm WF-09/DEC-WF-09; đề xuất không chặn | Sửa đúng hai dải mã tại proposal/design, tạo v2 | review_gate_requirements kiểm delta và đóng; review_gate_evidence cũng kiểm delta và APPROVE v2 |

Hai reviewer bắt buộc đều APPROVE cùng candidate cuối trong phạm vi riêng; không còn finding mở. Hai báo cáo được lưu nguyên văn, giữ cả verdict vòng đầu và xác nhận v2. Những phần bổ sung sau review chỉ ghi metadata/kết quả: trang này, manifest, báo cáo, cập nhật bàn giao và đánh dấu checklist 8–9. Không thay đổi quy tắc hoặc kết luận reviewer.

Để phục hồi nội dung đã review từ commit chứa hồ sơ này: lấy 13 đường dẫn trong `candidate.json`, đổi riêng checkbox task 8–9 của `openspec/changes/adopt-ai-task-workflow/tasks.md` từ `[x]` về `[ ]`, rồi chuẩn hóa CRLF thành LF và đối chiếu `normalizedLfSha256`. Nội dung khác phải giữ nguyên. Dùng `git log -1 -- docs/workflow/reviews/2026-09-16-gate/README.md` để tìm commit bàn giao ban đầu trong lịch sử; khi trang được cập nhật về sau, chọn commit tạo hồ sơ ngày này.

Kết luận chỉ áp dụng gói tài liệu/cấu hình hướng dẫn này. Chưa đo hiệu quả trên task tính năng, chưa kiểm ứng dụng/DB/CI, và đồng thuận của hai reviewer không phải chứng minh không còn lỗi.
