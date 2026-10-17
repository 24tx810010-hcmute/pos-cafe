# Review độc lập TC-PIN-14 — oracle, 10/10/2026

- Reviewer: subagent `/root/tc14_oracle_review`, không tham gia sửa candidate; chỉ đọc.
- Phạm vi: đối chiếu [TC-PIN-14 testplan](../../openspec/changes/force-default-pin-change/testplan.md) với [browser oracle](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:804) và receipt local ba stage. Không review full release.
- Candidate cuối: [manifest v3](D:/Workspace/pos-cafe/artifacts/permission-pin-tc14-close1/source-v3-manifest.json), SHA-256 `138a2e906ff2733b51a638aa608e7ad5dc3b64598be1e466513eb7da5ca4b74c`; tar SHA-256 `a4de4a2d7880a4e57e8439e5e2897446a45703d5d0eec6784a3aefa52fba81ca`.

## Lịch sử finding và xử lý

1. V1 **CHANGES_REQUESTED, chặn**: sau reload/GET và trước retry chỉ so entity counts/no stage call, chưa so workflow revision/receipt/ID/audit/signal; sau retry chưa so owner/PIN. **Đề xuất không chặn:** kiểm cả begin RPC khi completed. Tác giả thêm `ownerIdentityEvidence`, so toàn `stageReplayEvidence` sau reload và login thiết bị hai, bắt begin RPC; chạy lại ba ca trên v2.
2. V2 **CHANGES_REQUESTED, chặn**: `signal_count` không phát hiện `store_change_signals.revision` tăng qua upsert cùng một hàng. Tác giả thêm `signals_snapshot` gồm topic/revision/event_id/target_id; chạy lại ba ca trên v3.

## Kiểm lại candidate cuối

Reviewer xác nhận [snapshot](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:309) bao gồm signal revision/event/target và được so sau reload/GET, sau login thiết bị hai trước retry, sau direct replay; owner identity/PIN flags/count được so trước ACK loss và sau retry/replay; begin/run không tự gọi trước explicit retry. [Receipt v3](D:/Workspace/pos-cafe/artifacts/permission-pin-tc14-close1/tc14-v3-safe.json) 3/3 PASS, không skip/retry; hash manifest/tar/raw report, pre/postflight, stop receipt khớp. Reviewer không sửa file hoặc ghi DB.

**Verdict cuối: APPROVE** cho oracle TC-PIN-14 trên candidate v3 local. Không suy rộng sang toàn19 PIN, PERM60 hay phát hành.
