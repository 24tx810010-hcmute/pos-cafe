# Review độc lập TC-PIN-16 — bằng chứng và môi trường, 11/10/2026

- Reviewer: subagent `/root/tc16_evidence_review`, chỉ đọc; scope khác reviewer oracle. Không sửa candidate hay chạy test ghi DB.
- Phạm vi: snapshot main/docs, raw reporter private, pre/postflight, role recovery, typecheck/unit/build, target stop và tính đúng của [biên bản TC16](../implementation-log/permission-pin-tc16-closeout-2026-10-11.md).
- Candidate cuối: [main manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/source-manifest.json) SHA-256 `7ffeefa5d3173f81e42f93cd097d40d7062c61afaca0027b9a691082bda275f9`, tar `0007a8778030596fb6119f7caa49633452d167aaa4c467a2fe9636124c8ef84c`; [docs pre-review manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/docs-pre-review-manifest.json) SHA-256 `a61da9e76675ad9eb3da0f060e32d08cb457f00c94b53ac6fb1dfb15be736d13`, tar `a06990ae5e12055f3a8487cbce0cbda3f317c8817763e2c84a1dc8f3a409ff08`.

Vòng đầu trên close1 **CHANGES_REQUESTED (chặn)**: ở [oracle quyền](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1877), kiểm `permissions.length === 14` có thể qua với tập quyền sai. Tác giả đổi sang so từng tập quyền hiệu lực của cashier/manager với đúng 14 code catalog không owner-only; chạy lại cả hai ca và cập nhật toàn bộ evidence close2.

Reviewer kiểm 782/782 file main và 3/3 file docs giữa live tree, manifest, tar; không thiếu/thừa/lệch hash. Chỉ browser spec thay đổi so TC15 và so close1. Raw private SHA `caea1255…` khớp receipt, hai ca passed mỗi ca một attempt, retry0. Pre/postflight guarded PASS, fixture zero, role membership `supabase_admin→postgres SET FALSE` nguyên trạng, [typecheck receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/typecheck-receipt.json) exit0, unit26/26, build PASS; đúng 12 container target dừng, volume/network giữ. Tài liệu trỏ close2, đánh dấu close1 lịch sử và ghi giới hạn local.

**Verdict cuối: APPROVE** evidence TC-PIN-16 trên exact main `7ffeefa5…` và docs pre-review `a61da9e…`. Không phát hiện chặn còn lại.
