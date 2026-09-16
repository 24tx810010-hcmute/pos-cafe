# Thiết kế gói quy trình

Ngày 2026-09-16. Tham chiếu DEC-WF-01–09 trong [proposal](proposal.md). Không đổi Ports & Adapters, RLS, migration hoặc Realtime: đây là thay đổi hướng dẫn và tài liệu.

## Cấu trúc và nguồn chuẩn

- `docs/workflow/README.md`: quy trình vận hành; không lặp toàn bộ định dạng đặc tả.
- `docs/workflow/templates.md`: bảy mẫu ngắn (gồm báo cáo reviewer bổ sung) để điền vào hồ sơ phù hợp, không bắt bảy file mới mỗi task.
- `docs/workflow/start-task.md`: prompt cho task mới/tiếp tục và cách tìm nhánh docs ở checkout thiếu pointer.
- `docs/workflow/tasks/README.md` cùng `<task-id>.md`: chỉ mục và bàn giao riêng; tránh một file chung bị task khác ghi đè.
- `openspec/SPEC-STANDARD.md`: thẩm quyền về bộ artifact, input/output, traceability và độ sẵn sàng; cập nhật mục hỏi trước spec để cho phép proposal khảo sát và câu hỏi phát sinh.
- `AGENTS.md`, `CLAUDE.md`, `openspec/config.yaml` và các README: trỏ vào nguồn chuẩn, đồng bộ các quy tắc bị thay đổi, không để câu "không cần hỏi lại" phủ định workflow mới.

Đường dẫn trong tài liệu là tương đối khi cùng nhánh để đi theo repo. Prompt máy hiện tại có vị trí dự kiến nhưng yêu cầu xác minh bằng Git. Code ở nhánh khác chỉ được tham chiếu kèm source thực tế khi task khảo sát nó; không nhân bản code vào docs.

## Tính nhất quán và quyền thực hiện

User request và quyết định còn hiệu lực xác định thẩm quyền; file task chỉ ghi lại. Hướng dẫn chung áp dụng cùng gate riêng của feature; nếu có xung đột thì nêu rõ trước phần phụ thuộc. Task cũ không bị reset hay tự chuyển trạng thái khi thêm quy trình.

Hồ sơ bàn giao không thay proposal/design/testplan và không trở thành bản spec thứ hai. Mục đã có thông tin chuẩn chỉ liên kết. Source/spec có phần chưa commit phải ghi rõ; commit SHA một mình không đại diện cho phần chưa commit.

## Bằng chứng và kiểm tra

Gói ban đầu dùng OpenSpec strict validation, kiểm link/anchor và diff, cùng các kịch bản rà soát TC-WF-01–08. Bổ sung DEC-WF-09 thêm TC-WF-09/10 và cổng subagent độc lập. Đây là kiểm cấu trúc và tính nhất quán tài liệu, không phải test thực thi ứng dụng hoặc pilot với người dùng. Script kiểm tạm ở workspace thực hiện task, không đưa công cụ ứng dụng vào nhánh docs.

Rà diff theo baseline trước chỉnh sửa để giữ các thay đổi của task khác. Khi commit, chỉ stage phần của workflow; với README đang bẩn, stage đúng phần thêm mới, không nhận toàn bộ file vào commit. Kiểm tra patch còn lại sau commit khớp baseline của người dùng.

## Đánh đổi và giới hạn

- Giữ bảy phần cho change chính thức bảo toàn truy vết; tránh chi phí lặp bằng tham chiếu và hồ sơ ngắn cho bảo trì không đổi requirement. Nếu sau này muốn giảm bộ artifact, phải có quyết định sửa chuẩn riêng.
- Prompt rõ nguồn giúp task mới tìm hướng dẫn mà không phải sửa pointer bị ignore. Đánh đổi: không bảo đảm tự nạp ở mọi công cụ hoặc máy chưa có nhánh docs; người dùng cần câu khởi động khi công cụ không đọc được nguồn.
- Mẫu chứa đủ provenance để tái hiện nhưng không thay runner đáng tin hay snapshot thực tế. Pilot cần kiểm chi phí ghi hồ sơ trước khi kết luận hiệu quả.
- Không tự hoãn concurrency, hạ kiểm thử backend, đặt quota quyết định hoặc coi CI là chứng minh tính đúng.

## Review độc lập — DEC-WF-09

Thay đổi cổng cho phép đóng task được xếp nhạy cảm về quy trình: hai subagent không tham gia viết candidate, một người kiểm tính đầy đủ/nhất quán với yêu cầu, một người kiểm khả năng thực hiện/chứng cứ/thẩm quyền. Cả hai đọc snapshot/diff và tự đưa verdict; không cấp kết luận của reviewer kia trong vòng đầu.

Snapshot và manifest hash xác định các tài liệu nội dung được duyệt; báo cáo review và metadata bàn giao được thêm sau để ghi đúng sự kiện đã xảy ra. Metadata không được lén đổi quy tắc, expected, finding hoặc kết luận. Nếu có sửa nội dung sau review, phải lập candidate mới và xin xác nhận lại theo phạm vi ảnh hưởng; người không bị ảnh hưởng vẫn đối chiếu delta rồi xác nhận candidate cuối.

Reviewer trả APPROVE / CHANGES_REQUESTED / BLOCKED. Tác giả được phản biện finding bằng nguồn và phải được reviewer xác nhận xử lý; không coi reviewer luôn đúng hay đồng thuận là chứng minh tuyệt đối. Báo cáo lưu trên docs, liên kết từ biên bản/handoff; không thay kết quả tự rà ban đầu thành review độc lập hồi cứu.
