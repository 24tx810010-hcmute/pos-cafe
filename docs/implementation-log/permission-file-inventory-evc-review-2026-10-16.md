# EVC review — inventory file local — 16/10/2026

Reviewer độc lập `/root/inventory_evc_review`, không tham gia tạo candidate. Scope: số liệu/status/hash, snapshot và recoverability, import/config/tests/tool/SQL/Edge dependency, deletions, source/index drift, giới hạn evidence. Không reviewer lồng nhau.

## Vòng1 — CHANGES_REQUESTED candidate-01

Candidate [candidate-01.json](D:/Workspace/pos-cafe/artifacts/permission-file-inventory-20261016/candidate-01.json), SHA256 `395678180db1b88a14186a33305eebd4170197effa4c63c1a7c8637c09345341`.

**EVC-01 — chặn:** [report.md:92](D:/Workspace/pos-cafe/artifacts/permission-file-inventory-20261016/candidate-01/report.md:92) chỉ nêu binary assets unchanged bị bỏ khỏi snapshot. [inventory.tsv:1363](D:/Workspace/pos-cafe/artifacts/permission-file-inventory-20261016/inventory.tsv:1363), dòng1363–1374, có12PNG untracked,985.544B dưới `docs/ui-redesign/2026-09-15-huong-a/anh/`, không trong snapshot và không khôi phục từ HEAD. Yêu cầu ghi đúng825/841file thay đổi được snapshot;16ngoài snapshot=4changed pattern-hold+12PNG untracked. Tổng5pattern-hit vì một file unchanged. Không yêu cầu mở rộng snapshot; giữ local originals, freeze lại và review delta.

Các kiểm độc lập đã làm:

-15/15artifact khớp hash/bytes;1.597inventory,841changes,2.159edges; changes khớp inventory.
-1.471hashed record không drift;916snapshot decode đúng8.599.412B, gồm2HEAD deletion contents.
-HEAD/index fingerprints giữ nguyên, không staged. Main473/510, docs271/333;2docs thêm sau capture đúng báo cáo, không đọc online doc.
-AST riêng617file:1.843static import khớp graph không thiếu/thừa; main closure198file;30declarations khớp npm lock;29literal exceptions đúng phân loại.
-Đối chiếu configs, SQL activation order, Edge shared imports, lifecycle thay deletion, discovery tests và UI-audit anchors. Hai diff-check exit0.

Chưa kiểm semantic5pattern-hit/raw/private/env, toàn bộ dynamic dependencies, hành vi/runtime/tương đương deletion/online/deploy. Không sửa candidate/index, không tests/build/runtime/install/push/xóa. Không full-source PASS hoặc quyền publication.

Tác giả sẽ sửa mô tả phạm vi recoverable và bổ sung bảng snapshot coverage; EVC-01 chưa CLOSED cho tới reviewer xác nhận candidate mới.

## Vòng2 — APPROVE candidate-02; EVC-01 CLOSED

Candidate [candidate-02.json](D:/Workspace/pos-cafe/artifacts/permission-file-inventory-20261016/candidate-02.json), SHA256 `a477a6178528fa393d2fb21837982c975d73780aaada547508544a6dbe0996fa`. Reviewer trả **APPROVE**, không còn finding chặn scope EVC.

EVC-01 **CLOSED**: report candidate02 dòng92 ghi đúng825/841file có snapshot;16ngoài snapshot=4pattern-hit+12PNG untracked985.544B; giới hạn HEAD và giữ local originals rõ.

Kiểm độc lập vòng2:

-17/17bound files khớp hash/bytes;14artifact cũ không đổi.
-Coverage841dòng duy nhất;16entry recovery-limits khớp path/status/hash/snapshot thực.
-Report chỉ đổi phần dòng92–94; live khớp frozen lúc review.
-1.471hashed source records không drift; HEAD/index hai checkout giữ nguyên.
-Docs lúc review337thay đổi, gồm6file báo cáo/review ngoài inventory capture; reviewer chỉ kiểm metadata phần phát sinh, không nhập vào verdict candidate.

Giới hạn vòng1 giữ nguyên. APPROVE chỉ là phân tích local, không full-source/runtime PASS, privacy certification hoặc quyền push/deploy. Reviewer không sửa file, chạy recipe tác giả/tests/build/runtime hoặc online. Điều phối chỉ thêm metadata kết quả sau freeze, không sửa nội dung candidate.
