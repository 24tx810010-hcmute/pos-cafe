# Review backup-v2 LOCAL — 14/10/2026

Candidate01 có verdict SEC **CHANGES_REQUESTED**, chưa có approval. Nguồn quyền và phạm vi: [task](../workflow/tasks/permission-backup-v2-2026-10-14.md); [contract](../runbooks/permission-backup-v2-2026-10-14.md); [kết quả/chronology](../implementation-log/permission-backup-v2-2026-10-14.md).

Candidate kế tiếp sẽ pin source40 (823entries,13delta từ source34;4file đổi từ source39), bản docs cuối, gate support, reports và private raw evidence references. SEC đọc trước; EVC riêng đọc sau. Reviewer chỉ đọc, không sửa candidate/expected, không restart Docker proof targets, không hosted probe/provider contact hoặc push. Hash manifest candidate và verdict của từng reviewer được thêm ở dưới sau khi freeze; metadata ghi review không thay nội dung candidate.

| Reviewer | Trọng tâm | Gate |
| --- | --- | --- |
| SEC | B/I completeness/snapshot/archive sequence fidelity, allocation contract, privacy/isolation, loader forgery, EXACT79 provenance, C/L/Storage actor limits và giữ fail-closed | APPROVE candidate02; SEC-01 CLOSED |
| EVC | Accepted spec/traceability/test expectations, exact source/dependencies/runtime/support binding, fresh full PIN19/PERM60, chronology/failures/historical drift, recoverability và claims | APPROVE candidate02 |

Không có task completion hoặc release acceptance trước khi cả hai APPROVE cùng exact candidate. Walkthrough đã chuẩn bị, owner chưa xác nhận hiểu. Hosted phase2/C/Storage/provider và7dependency blockers vẫn độc lập.

## Candidate01 — SEC, giữ nguyên lịch sử

Manifest SHA `668b442b279f5540fc3f1a0c6308b70bb9de3263b3c18e29688a4e554f7c5741`, source39. Reviewer `/root/sec_backup_v2`, LOCAL read-only, verdict **CHANGES_REQUESTED**.

**SEC-01 (chặn):** catalog roles bỏ `rolvaliduntil`, role comments/security labels; `pg_dump` database không bù globals. Có dump/hash/restore `roles.sql` nhưng thiếu oracle globals đầy đủ từ restored cluster. Hai cluster chỉ khác expiration/comment vẫn có thể được B/I PASS. Reviewer xác nhận bằng đường code và tài liệu PostgreSQL; không mutation/restart DB và không khẳng định frozen DB thực tế có drift.

Đã kiểm độc lập: 354/354 public snapshots và1975/1975 private refs khớp; source39 823entries/0drift/2deletion markers,13delta từ source34,hai HEAD đúng. Production loader tính lại91fidelity PASS/3allocation PASS, Storage/C BLOCKED. Bảy biến thể proof trong bộ nhớ refuse đúng; planner79/66/2+1, readinessfalse; hai loader chỉ thêm dispatch v2, full-row C verifier/cleanup/L assessor không đổi. Đã đọc sequence/parser/allocation/snapshot/catalog/LO/ACL/schema/target guards/privacy/Storage/spec deltas. Chưa chạy lại capture/restore/E2E, hosted/provider/live L. Ngoài SEC-01 không có finding chặn khác trong phạm vi đã kiểm.

Xử lý đang thực hiện: source40 đã bổ sung source/window/pristine/probe roles-only SQL oracle toàn văn, pin graph và mandatory recompute; fixture expiration/comment và từng negative trên clone mới + source window. Candidate01/source39 giữ nguyên. Phải chạy lại trên source mới, rồi SEC kiểm lại trước EVC; không coi đề xuất sửa là finding đã đóng.

## Candidate02 — metadata verdict SEC

Reviewer `/root/sec_backup_v2`: **APPROVE**, candidate SHA256 `1109d6efe26070ff6c26305eebc1c3bb118b59c19563c939c4702c0d6eaca13f`, phạm vi backup v2 LOCAL/spec/helper/verification. **SEC-01 CLOSED.** Candidate01 vẫn giữ CHANGES_REQUESTED lịch sử; verdict mới chỉ áp dụng candidate02/source40.

Reviewer kiểm độc lập391/391 public snapshots+2057/2057 private refs, source40 823entries/0drift/2deletion markers, đúng4file delta từ39 và hai HEAD không đổi. Production readBackupV2 tính lại94fidelity PASS/allocation PASS, requireBackupV2Cutover trả CUTOVER_BLOCKED. Tự sửa từng bản source/restored/window/probe roles trong bộ nhớ:4/4 fidelity FAIL; bỏ từng roles command:4/4 PROOF_INVALID. Đọc lại15pinned negative graphs qua production loader:15/15 từ chối. Raw expiration/comment clone và source-window evidence khớp expected FAIL/CATALOG_WINDOW_DRIFT; positive chứa cả hai thuộc tính, report36assertions0failure. Các biến thể provider/importer/dynamic/shared/catalog/schema, BigInt >2^53 và cache>1 refuse/FAIL/BLOCKED đúng. Planner79/66/2+1, readinessfalse; không làm yếu C full-row verifier/cleanup/L assessor. Không còn finding chặn trong phạm vi SEC.

Giới hạn kiểm: chỉ đọc/in-memory, không chạy lại capture/restore/E2E/DB mutation, không restart hoặc hosted/provider/live L. Không có runtime security-label provider case riêng; capture và phép so được đối chiếu code. Runtime artifacts được kiểm không được tính thành lượt chạy mới của reviewer. APPROVE không chứng nhận hosted C/Storage/provider/L hoặc cho phép phase2/release; coverageComplete/cleanupEligible/executionReady vẫnfalse và7dependency findings vẫnchặn. EVC được gọi sau verdict SEC, ngữ cảnh riêng, chưa có verdict.

## Candidate02 — metadata verdict EVC và đóng slice LOCAL

Reviewer `/root/evc_backup_v2`: **APPROVE**, đúng candidate SHA256 `1109d6efe26070ff6c26305eebc1c3bb118b59c19563c939c4702c0d6eaca13f`, phạm vi backup-v2 LOCAL. **Không có finding chặn EVC.** SEC và EVC đều APPROVE cùng exact candidate; hoàn tất slice LOCAL được giao, không đóng feature/release hoặc cấp quyền phase2/push.

EVC kiểm độc lập391public+85Windows private+1972Linux private hashes, source40 823entries/2deletions/13delta đúngscope, archive đúng821file và nội dung, hai HEAD đúng. Đối chiếu contract/TC53-V2/traceability PERM06/30→UC14/PIN-T07 và bốn nhóm main/error/boundary/security, không đổi60TC/19PIN. Production loader tính lại94fidelity/3allocation PASS, StorageBLOCKED và ba eligibilityflagsfalse; đọc36runtime/Storage8/negative globals/schema/row/LO/proof, chạy lại8adversarial permutations trong bộ nhớ. Production aggregate60cases/27stages/726variants/0errors; strict PIN55browser/41SQL/1canary/2operator/110tooling,0requiredskip/retry;65timed receipts khôngoverlap/nonzero, helper/Storage tuần tự. Core npmci/inventory7/tooling344/unit1173/build/2typecheck/selftest23/UI16×3 được đối chiếu; reviewer mở lại4ảnh,6finding là nhãn sidebar cố ý ẩn. Runtime/dependencies/support/fixture preservation/comparator có truy nguyên; historical failures và mismatch không bị hợp thức hóa; walkthrough chỉ ghi đã cung cấp.

**Ghi chú không chặn EVC-R1 (recoverability):** [remaining-gates.py:22](D:/Workspace/pos-cafe/artifacts/permission-backup-v2-gates-source40-20261014/remaining-gates.py:22) đọc focused jobs từ recipe ngoài candidate02. EVC xác minh recipe hiện tại và [historical snapshot](D:/Workspace/pos-cafe/artifacts/permission-npm-recipe-20261013/candidate-01-snapshot/support/reproduce.py) cùng SHA `e3c68b5b15c2eb0cc4c5037bf48e143d44a70a6115b8bc220fa8c2b6e69e5efc`; historical manifest SHA `e0cce54023a6e8e4e43491e381bcf00ee79a0d693b6dc5bc8201f30cba160fcd`. Đây là pin lịch sử riêng, không tuyên bố transitively rooted trong candidate02. Resolved commands thực chạy đã được candidate02 pin, strict verification đạt; không ảnh hưởng kết quả hiện tại. Khi đóng gói tái hiện độc lập cần mang recipe historical hoặc lấy job list từ receipts đã pin. Không sửa candidate để che ghi chú.

EVC chưa chạy lại capture/restore/E2E hoặc restart target; chưa kiểm hosted/provider/actual actor control/live L; chưa xác lập nguyên nhân/thời điểm historical mismatch hoặc xác nhận owner hiểu. Audit5high+2moderate và C/Storage/provider/hosted/L gates tiếp tục chặn release. Metadata review này được bổ sung sau freeze theo ngoại lệ review gate; không đổi candidate snapshots, source, tests, expected hoặc proof gốc.
