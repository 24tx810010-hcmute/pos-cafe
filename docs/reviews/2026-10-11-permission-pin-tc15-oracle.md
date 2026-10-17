# Review độc lập TC-PIN-15 — oracle, 11/10/2026

- Reviewer: subagent `/root/tc15_oracle_review`, chỉ đọc, không sửa candidate hay chạy test ghi DB.
- Phạm vi: đối chiếu [TC15 testplan](../../openspec/changes/force-default-pin-change/testplan.md) với [năm browser oracle](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1292), helper và evidence local; kiểm claim/retry race, fault, lock, collision, stale/out-of-order, read-only và không duplicate.
- Candidate cuối: [manifest main](D:/Workspace/pos-cafe/artifacts/permission-pin-tc15-close3/source-manifest.json) SHA-256 `3bbfb3b6226a061ef23159815e6f612729f36ff71d452e52bdedd9e8119c9810`, tar `7ede301a8cbcf9478484f4b1eca577fcc7456e31594a67d844adb1084fb5ee3d`; docs pre-review manifest `e4e28183b84eb878b556b9735172d846eb4c22962f0205ad79d0148013054ab4`.

## Finding và xử lý

Vòng đầu **CHANGES_REQUESTED (chặn)**: ca hai owner retry tại [route handler](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1406) mới log payload, chưa assert cả hai `mode: retry`, `expectedWorkflowRevision: 3`. Kết quả một acquired/một stale có thể vẫn PASS với input lệch revision, trái testplan yêu cầu cùng revision. Tác giả thêm assertion cho từng routed request tại dòng 1408, chạy lại toàn bộ năm ca và chốt candidate close3.

Reviewer kiểm lại file hash khớp manifest; [receipt cuối](D:/Workspace/pos-cafe/artifacts/permission-pin-tc15-close3/tc15-safe.json) 5/5 một attempt mỗi ca, 0 skip/retry; pre/postflight PASS, unit26/26, typecheck/build exit0, target dừng bảo toàn volume/network. Các oracle còn lại đã đọc và không có finding chặn/không chặn. Docs claims cập nhật close3.

**Verdict cuối: APPROVE** oracle TC-PIN-15 local trên exact main `3bbfb3b6…` và docs pre-review `e4e28183…`. Không suy rộng sang CLOSE-2 hay release.
