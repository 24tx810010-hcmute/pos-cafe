# Thứ tự triển khai

- [x] **S1** Xác minh evidence remote, tạo CI worktree riêng, ghi ba quyết định owner; lập bộ spec tooling.
- [x] **S2 — triển khai** CI auto/controller/reporters đã publish/review; source0781f75,104/104localPASS/lint3. Actual CI30 thuộc S4.
- [x] **S3 — triển khai** Backend manual workflow, exact repo allowlist và worker/resource/privacy guards đã publish/review; actual backend18 chạy thật. Pilot FAIL là gate riêng, không nhận đã đạt.
- [x] **S4** Source0781f75 hai APPROVE/local104PASS/lint3; actual CI30attempt1 full11phasePASS, source preserved/core restored. Không thay baseline/acceptance.
- [x] **S5 — kiểm việc chạy workflow** Bootstrap tooling-only/main và provider trigger đã kiểm; backend18 thực thi exactsource0781f75 với strict envelope. Kết quả pilot FAIL/cleanupReadFixture/catalog drift; owner chốt chuyển sửa fixture sang phiên phân quyền theo DEC-CICD-06, không hạ acceptance.
- [x] **S6** CD held đã kiểm thật: protected Production/main-only/no-admin-bypass; negative39002739692 chặn CI FAIL; positive39028263852 preflightPASS/approvalwaiting exactsource0781f75/CI30attempt1. Cũ39021837504 cancelled vì obsolete. Không approve/deploy, production=false.
- [x] **S7 — nội dung hồ sơ** Ghi actual source/evidence/blocker/DEC06, resources và owner walkthrough. Gate công bố độc lập: chỉ tạo nhánh docs sau hai final APPROVE exact manifest/helper; commit message và receipt ghi approvals/manifest sau freeze. Không merge docs vào main.

Không đánh dấu actual CI/backend/CD protected hoàn tất khi mới có YAML/tests local. Main/app update, secret provisioning hoặc hành động ngoài scope rõ phải có concrete diff/target rồi mới trình quyết định; không tự lấy quyền từ handoff/reviewer. Đã được giao tiếp tục setup và CI thật; không hỏi lại các lựa chọn CI nhẹ auto/backend manual/CD frontend/no production.

- [ ] **Gate backend phân quyền, ngoài mốc CI/CD theo DEC06:** T09suitePASS và T10đủ3casesPASS, preservation/cleanupPASS trên source sửa mới; full backend/legacy gates vẫn giữ.

**DEC-CICD-06 — 17/10/2026:** owner trả lời câu 0 của `call_801a8f97fddc4f58a5825cd0bbfe23e5`: “Chốt CI/CD; ghi backend FAIL, sửa fixture ở phiên phân quyền (khuyến nghị)”. Mốc bàn giao này xác nhận CI/CD đã cấu hình và chạy thật; giữ nguyên backend acceptance FAIL, chuyển việc điều tra/sửa cleanup fixture sang phiên phân quyền. Không giảm coverage, đổi baseline/ACL hoặc nhận backend PASS; chưa phát hành production.

Hồ sơ này được freeze trước công bố. Nhánh đích `docs-ci-cd-20261017` chỉ được tạo sau khi hai reviewer độc lập APPROVE exact manifest và helper công bố; commit message của nhánh ghi manifest cùng hai approvals. Trạng thái công bố cuối được đối chiếu bằng [lịch sử commit của nhánh](https://github.com/nguyentronglinh045/pos-cafe/commits/docs-ci-cd-20261017) và receipt local `artifacts/project-ci-local/docs-published.json`, không tự nhận sự kiện sau freeze trong nội dung snapshot.
