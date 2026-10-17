# Review local backup rehearsal — 13/10/2026

Gói nhạy cảm. SEC rồi EVC, độc lập, read-only, cùng exact candidate manifest/snapshot. Review chỉ gói kết quả thực nghiệm và proposal có giới hạn; không criteria acceptance, không permission hosted/release, không nhận coverageComplete=true.

Candidate và verdict sẽ được thêm dưới dạng metadata sau khi khóa. Reviewer phải kiểm source/evidence, lỗi lịch sử, phần chưa chạy, ranh giới authorization và nguồn dữ liệu synthetic; không chỉ đọc kết luận tác giả. Nếu thiếu evidence bắt buộc thì BLOCKED/CHANGES_REQUESTED, không suy APPROVE.

Scopes: SEC = authorization/target isolation/private data/outside preservation/experimental eligibility/control semantics; EVC = actual commands/provenance/hash/coverage/matrix/fidelity/negative witnesses/unknowns. Reviewer không sửa, không mutation/restart/deploy. Chưa có review tại lúc tạo file này.

## Metadata kết quả review — 13/10/2026

Candidate bất biến: `D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261013/candidate-01.json`, SHA256 `9b6c1705bdd4e85d891bb74201768d8549b45d3ad1b1a0a2c5a40eb5e8307832`. Snapshot chứa86 public entries, manifest bind62 private references và archive. Nội dung candidate/snapshot không thay sau khóa; phần này chỉ ghi review theo ngoại lệ metadata của workflow.

| Reviewer | Thứ tự / phạm vi | Verdict exact candidate |
| --- | --- | --- |
| `/root/sec_review`, gpt-6-astra/high, fresh context | 1 — isolation, authorization, private data, outside preservation, control semantics | **APPROVE** bằng chứng local/proposal; không finding chặn trong scope |
| `/root/evc_review`, gpt-6-astra/high, fresh context; không nhận kết luận SEC trước verdict | 2 — execution, provenance/hash, coverage/fidelity, negative witnesses | **APPROVE** bằng chứng local/proposal; không finding chặn trong scope |

Bản chép verdict đầy đủ: [SEC](D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261013/review-sec.txt), [EVC](D:/Workspace/pos-cafe/artifacts/permission-backup-lab-20261013/review-evc.txt). Cả hai chỉ đọc/hash/inspect, không sửa/rerun writer/restore/restart/hosted. Hai bên kiểm86 snapshots,62 private references, source34/archive; Docker inspect xác nhận8 exact targets stopped, EVC xác nhận8 volumes retained. EVC đối chiếu61 payload files trong private tar (entry còn lại là directory), logs dump/restore và78 identity comparisons. SEC kiểm ACL và không thấy synthetic credentials trong86 public snapshots.

| Finding / loại | Xử lý, không thay candidate |
| --- | --- |
| SEC-N1, đề xuất không chặn: citation canonical DELETE ghi484–486, checkout485–487 | Ghi nhận cho lần sửa nội dung tiếp theo; không thay kết luận hoặc snapshot hiện tại |
| EVC-N1, đề xuất không chặn: nêu mức đa dạng fixture | Ghi nguyên nhận xét: **9/63 bảng có dữ liệu,54 bảng rỗng**. Equality63 bảng không chứng minh mọi schema/data branch; synthetic scope giữ nguyên |
| EVC-N2, đề xuất không chặn: traceability restore failures/rerun | Ghi cho vòng kế tiếp: missing-role/restore schema-or-ACL failure và rerun trên target mới chưa được phủ hết; role-add/ACL-drift/extension-error không thay mọi biến thể. Không nhận nhóm OBSERVED là exhaustive |

Review chỉ xác nhận độ chính xác của checkpoint evidence/proposal. **Không đóng toàn bước2**, không đổi criteria, không owner acceptance và không hosted permission. Pre-run whole matrix chưa khóa, consumer/cached-session discovery chưa đầy đủ, positive cleanup+production activation nonempty K chưa có, Storage admission/drain/retention/conditional delete và protocol races còn thiếu; canonical loader/controller/fresh gates chưa chạy. `coverageComplete=false`, `eligibility=false`, old74/75 FAIL, phase2 BLOCKED và7 upstream issues giữ nguyên.
