# Review đề xuất Linux CI-0 — 15/10/2026

SEC/EVC cùng APPROVE candidate-02, phạm vi proposal/đọc metadata Vercel và quyền/privacy/ngân sách. Chưa tạo repo, push, chạy CI hoặc provider mutation. Approval proposal không thay owner authorization hoặc runtime evidence. Các verdict cuối phía dưới là metadata sau freeze.

## Lịch sử candidate-01

Manifest SHA256 `9eb37b7c1e902403f6bc1a8a40039f588327cd8f2748386c1f22b0638ae73615`,7file/24.684bytes; snapshot-01 bảo toàn. EVC APPROVE phạm vi proposal: hashes/receipt/parse+Bash-n, guards/quyền/budget và giới hạn evidence; không provider/network/actionlint/actual CI.

SEC **CHANGES_REQUESTED**, finding chặn `SEC-CI0-01`: workflow:35–40 chỉ in UNAVAILABLE rồi tiếp tục, có thể final PASS dù thiếu tool trong khi proposal:41 yêu cầu đủ công cụ. Không finding khác. Tác giả chấp nhận, sửa required-list7tools và fail rõ trước namespace, giữ toàn bộ guards/quyền. EVC được thông báo để kiểm lại delta; không dùng approval01 của một reviewer thay cho đồng thuận cuối. Candidate02 sẽ giữ snapshot/receipt mới và cả hai reviewer phải chốt lại.

## Candidate-02 — verdict cuối

[Manifest](D:/Workspace/pos-cafe/artifacts/permission-linux-ci0-proposal-20261015/candidate-02.json), SHA256 `787d119c4f9c789be678389e5b1aaa4092686ef9d28355217581b982b5c0290d`,7file/26.994bytes, snapshot-02; payload SHA `e27e848b0e596f89081a6727bdfbfa4aebc76a3a084df5d5f4a3ce3608e815d0`.

- **SEC APPROVE** exactSHA02; `SEC-CI0-01` đóng. Kiểm7/7live/snapshot/bytes, previous/base hashes, toàn bộ delta/static receipt khớp payload; thiếu một trong7tools sẽ exit1 trước namespace/PASS, version khác daemon. Không còn finding chặn/không chặn. Giới hạn: kiểm tĩnh, không shell body/CI/network/install/mutation hoặc xác minh quyền tạo/Actions/integration thực tế.
- **EVC APPROVE** exactSHA02; độc lập xác nhận finding đóng,7/7hash/bytes, delta chỉ proposal/review/workflow/receipt; PyYAML/static guards và Bash-n outer/inner đạt, hashes khớp receipt. Guards/manual/repo/public/main/30GiB và giới hạn quyền giữ nguyên, không finding mới. Giới hạn: không shell body/CI hoặc xác minh provider mới.

Hợp review chỉ duyệt proposal để trình owner. Owner decision vẫn PENDING: chưa có quyền tạo repo, công khai/push payload, dispatch hoặc kiểm chứng runtime/full backend/readiness. Sau verdict chỉ bổ sung metadata trong hồ sơ này và dòng trạng thái proposal; frozen snapshot/payload/receipts giữ nguyên. Không lấy APPROVE này thay cho quyền thực hiện.
