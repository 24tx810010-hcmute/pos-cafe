# Review controller phát hành — 30/09/2026

Đây là metadata ghi verdict đã nhận, không mở rộng quyền hoặc phạm vi nghiệm thu.

Candidate source-only chốt30/09: snapshot bảo vệ `controller-session-20260930/candidate-1790738085822`, source fingerprint `a61a2dd5116a7f33612a9cd14d9baf8370215dcd5fad4fe9644512132aa496cb`, baseline `main@ef2c372aec60d8362549e47b7aedb27126129479` cộng working tree. [Manifest](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/source-manifest.json), [25 tooling results](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/focused-tooling.json), [verification](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/verification.json).

| Reviewer độc lập | Phạm vi | Verdict cuối |
| --- | --- | --- |
| `cutover_security_review` | Transaction/data/provenance, legacy-inflight design, Storage journal, COMMIT ACK mất; log và con trỏ task/index | **APPROVE source-only và tài liệu**; SEC01–08 đã sửa/kiểm lại. Log trước thêm metadata review SHA `1a058173a1f08204c0a29ad49fd825451d8f6a93ab369d7f6d099a33571ae4bd`. **Gate vận hành BLOCKED** |
| `runtime_investigation` | Config/proof/TLS/probe/tooling và tính chính xác handoff/evidence | **APPROVE source-only và tài liệu**, candidate fingerprint ở trên, 25/25 tests gắn source. **Gate vận hành BLOCKED** |

Reviewer không sửa source. Investigator chỉ tạo readiness artifact chỉ đọc; root đối chiếu Docker độc lập tại [root-readiness-check.json](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/root-readiness-check.json). Approval của investigator chỉ phủ tính chính xác claim/giới hạn của readiness, không tự duyệt runtime do họ tạo hoặc chứng minh quyền production.

Candidate trước sửa SEC08 có 24 tooling tests, snapshot `candidate-1790737852188`; reviewer trả CHANGES_REQUESTED vì catch khi restore mất ACK bỏ trạng thái UNKNOWN. Candidate cuối giữ nguyên lỗi UNKNOWN, thêm regression và chạy lại 25/25. Không chuyển kết quả snapshot cũ sang source cuối.

Cả hai reviewer giới hạn rõ: chưa chứng minh cleanup/activation dưới NOSUPERUSER, accepted/waiting legacy bootstrap, rollback full data/catalog/sequence, restore prepare/ACL qua PostgreSQL/REST thật, khả năng tiêu thụ input proof vận hành, REST↔DB identity, gate sản phẩm hoặc live release. Không có release approval.

Findings bản nháp và bảng trạng thái/input thiếu nằm tại [handoff phần 1](../implementation-log/permission-release-controller-2026-09-30.md). Bàn giao source-only, chưa hoàn tất gate phần 1; không tự nối MCP, gate tổng hoặc phát hành.

## Candidate runtime hiện hành — 01/10/2026

Fingerprint fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef; bundle 36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70. [Manifest](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/source-manifest-runtime-current.json), [34 tooling](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/focused-tooling-current-20261001.json), [evidence](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/runtime-evidence-manifest-20261001.json), [handoff](../implementation-log/permission-release-controller-2026-09-30.md).

| Reviewer | Scope hiện hành | Verdict |
| --- | --- | --- |
| cutover_security_review | Transaction/rollback, privileges, accepted legacy/cancellation, commit/ACK/journal và handoff claims | **APPROVE** source fdedcfc, conditional local runtime và 5 docs/handoff; production/release **BLOCKED** |
| runtime_investigation | Isolation/REST↔DB, restore adapter/fresh proof, source/test/report binding, parameter ACL/profile và docs fidelity | **APPROVE** source fdedcfc, conditional local runtime và 5 docs/handoff; production/release **BLOCKED** |

Runtime diagnostic có điều kiện:2 augmentation local pin riêng, không tương đương production. Original actor fail-fast trước prepare. Giữ ca table lỗi committed thật và clone/marker; không nhận nó là PASS. Quyền production/release BLOCKED; verdict mới không kế thừa source-only approval 30/09.

Cả hai reviewer đã đọc source/report hiện hành và đối chiếu đủ SHA129 file export; không có changes requested còn mở trong phạm vi handoff local. Security reviewer ghi log trước thêm verdict metadata SHA68d15ea8c479d9e9287084b4b4e0dfce40511384c578614f2f01ed8e7ba6ec0d. Investigator xác nhận lại ACL/membership gốc bằng DB read-only. Reviewer không sửa candidate hoặc mutate runtime. Việc ghi verdict này không thay claim đã duyệt và không mở release.
