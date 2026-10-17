# Review độc lập TC-PIN-16 — oracle và security, 11/10/2026

- Reviewer: subagent `/root/tc16_oracle_review`, chỉ đọc, không sửa candidate hoặc chạy test ghi DB.
- Phạm vi: [TC16 testplan](../../openspec/changes/force-default-pin-change/testplan.md) đối chiếu với [hai ca browser/SQL actor](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1703), recovery/seed SQL guard và [contract TC16](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:485). Kiểm old token, restricted/normal flow, explicit retry, all-override nonowner, S2 tenant, legacy denial, owner PIN/cờ và không mutation.
- Candidate cuối: [main manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/source-manifest.json) SHA-256 `7ffeefa5d3173f81e42f93cd097d40d7062c61afaca0027b9a691082bda275f9`, tar `0007a8778030596fb6119f7caa49633452d167aaa4c467a2fe9636124c8ef84c`; docs pre-review manifest `a61da9e76675ad9eb3da0f060e32d08cb457f00c94b53ac6fb1dfb15be736d13`.

Reviewer đọc trực tiếp test và SQL guard, xác nhận recovery giữa employee/menu làm token cũ GET/run bị `EMPLOYEE_SESSION_REQUIRED`, restricted GET/begin/run bị chặn, login/focus/online không tự seed, explicit retry giữ employee receipt và PIN/cờ cuối. Cashier/manager có đúng 14 quyền không owner-only vẫn `FORBIDDEN`; legacy function vắng mặt và REST 404/PGRST202; S2 own workflow skipped, token S2 dưới claims S1 bị chặn, S1 snapshot ổn định. [Receipt cuối](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/tc16-safe.json) 2/2 PASS, một attempt mỗi ca, typecheck/postflight đạt.

Candidate close1 được reviewer oracle APPROVE trước khi reviewer bằng chứng tìm count-only oracle. Sau khi tác giả sửa thành so exact danh sách 14 mã quyền và chạy lại 2/2 trên close2, reviewer oracle **APPROVE lại exact close2**, không còn finding chặn. Giới hạn không chặn: S2 gọi public SQL function với claims/token thật trong cùng target, chưa phải REST JWT riêng trên hosted; biên bản local đã nói rõ.

**Verdict cuối: APPROVE** oracle/security TC-PIN-16 local trên main `7ffeefa5…` và docs pre-review `a61da9e…`. Không suy rộng sang CLOSE-2 hay phát hành.
