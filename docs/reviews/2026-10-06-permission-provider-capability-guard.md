# Review guard capability provider — 2026-10-06

## Spec gate

Candidate spec round 2: `D:/Workspace/pos-cafe/artifacts/permission-provider-guard-20261006/spec-candidate.json`, SHA-256 `fdd956314bf3824e79111cb3e0b81ff817c1844c0c35d75a257d495db0225855`. Sáu tài liệu/snapshot đều khớp hashes; baseline main fingerprint `fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef` trước implementation.

- `/root/closeout_evidence_review`: **APPROVE round 2**, phạm vi kỹ thuật/security. Actor invariant, read-only guard, native hoặc full supported profile, typed GUC/effective role/exact tokens và rehearsal isolation đủ rõ; chưa nhận là DDL hosted. Round 1 APPROVE kèm đề xuất không chặn ghi mixed native cases; đề xuất đã được xử lý bằng MIX01–06 trong round 2.
- `/root/closeout_scope_review`: **APPROVE round 2**, phạm vi ủy quyền/quy trình/spec/testplan/traceability. Round 1 CHANGES_REQUESTED với hai finding chặn: thiếu fixture/error oracle cụ thể ở negative/mixed cases; thiếu use-case column và tổng độ phủ. Tác giả bổ sung bảng B/P/ACT/NAT/MIX/GUC/ROLE/CFG/RSV/POL/BND/DML, RT01–05 và traceability IDs/cột/tổng 0/0/6. Reviewer xác nhận cả hai đã đóng, bốn file khác giữ nguyên hash.

Spec round 1 và snapshots được giữ riêng. Approval chỉ spec của slice chủ dự án chọn bằng câu “ok”; không thay review implementation/evidence hoặc approval phát hành. Reviewers chỉ đọc, không sửa file/query live/dựng dịch vụ.

## Implementation gate

Candidate đã review: `D:/Workspace/pos-cafe/artifacts/permission-provider-guard-20261006/implementation-candidate.json`, SHA-256 `0c0582bb18ca8a8e3ec7e1a67bbc51539dcd0ca5733ec2a908204deeb9112049`, 3 file main và 12 file docs. Source fingerprint `30dd5664e47f670e1c208151407c58b5dbb71943ca30d8a57f17de49051c1bad`, snapshot 706 entries. Không có finding chặn hoặc đề xuất sửa ở vòng implementation.

### Reviewer guard/security

`/root/closeout_evidence_review`: **APPROVE final implementation candidate** trong scope guard/security và kiểm chứng local. Đối chiếu đủ 15 file/snapshot/source manifest, diff với source 01/10 chỉ vùng guard và giữ các gate transaction/cleanup/recovery/orchestration. Guard chỉ SELECT, typed GUC/context/source, effective inherited USAGE và token/JSON exact phù hợp spec; native/full profile OR giữ actor invariants và error codes.

Reviewer chạy lại bốn file focused tooling: **77/77 PASS, exit 0**, source fingerprint trước/sau khớp. Đối chiếu hashes/report/runner của 7 runtime scenarios: native flags false, không parameter grant/owner membership; prepare/fixed restore/images rollback và baseline 53 bảng/catalog/settings khớp, negative chặn đúng mã. Reviewer không chạy lại DB rehearsal, query live, sửa source hoặc dựng dịch vụ. Không có finding chặn hoặc đề xuất không chặn thêm. Approval chỉ slice local; hosted/full product gates/release chưa chứng minh.

### Reviewer runner/evidence/isolation/docs

`/root/closeout_scope_review`: **APPROVE implementation candidate** trong scope runner/evidence/isolation/docs. Tự đối chiếu 15 file/snapshot, 706 entries, verification/source/report binding; 77/77 tooling và 7/7 runtime, negative oracle và baseline hashes. Kiểm runner copy nguồn read-only, setup admin và DDL actor postgres NOSUPERUSER/native flags false, không thêm native grants/owner membership.

Docker inspect chỉ đọc xác nhận clone/sidecar cuối và nguồn đã dừng, không publish ports; clone network none, source/Node/dependencies mount read-only, không container dùng volume nguồn. Failure được giữ đúng trạng thái; log/spec/handoff/source map không overstate hosted/gate/release, không link local hỏng. Reviewer không mutation hoặc live call; không có finding chặn/đề xuất sửa. Approval không thay hosted proof hoặc approval phát hành.

## Bàn giao sau review

Hai reviewer đều APPROVE candidate cuối trong scope riêng. Slice guard/provider rehearsal và hồ sơ kỹ thuật **hoàn tất local**. Các proof release theo source mới, management channels, hosted DDL/full product gate và rollout vẫn còn pending. Không thay application UI, grants/data live, push/deploy hoặc tạo session mới.

Chỉ metadata ghi chính verdict và checkbox review được bổ sung sau approval, theo ngoại lệ không review đệ quy của workflow. Candidate đã duyệt và snapshot giữ nguyên; artifact `handoff-metadata.json` ghi hash checkbox sau cập nhật và đối chiếu delta đúng một metadata field. Docs/code chưa commit. Walkthrough đã cung cấp đường đọc, chưa xác nhận chủ dự án đã thực hiện hoặc nghiệm thu.
