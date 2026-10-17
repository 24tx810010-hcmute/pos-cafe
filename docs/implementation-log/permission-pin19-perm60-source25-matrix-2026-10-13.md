# Ma trận full PIN19 source-25 — 13/10/2026

Ma trận required variants theo [testplan PIN](../../openspec/changes/force-default-pin-change/testplan.md) và ma trận source20 lịch sử. Nội dung variant/oracle giữ nguyên; riêng 18.A dùng oracle đã sửa trên source25. Đây là kết quả chạy mới, không ghép receipt source20. Source25 manifest SHA-256 `51dad91ead2a94d8d1204bd6ace0f2fc5e1800e75a4113ed4148d2dbc7c1c547`, tar `cbd1a9cca1d6d18fc32b6ec786628a9aafa3f0652006b9b50a5a5d21ae719ebb`, fingerprint `45e697906e2b366c011eeeace0b9e160781ce8b3811cf770135de04558d02db4`, 810 file + 2 deletion markers, Windows/WSL drift0 sau chạy.

Receipt: `B` = [browser PIN khác TC18 47/47](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/browser-other-safe.json) + [wrapper TC18 7/7](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/tc18-attempt-01/artifact-scan-safe.json), cùng 599xx activated contract2; `S` = [SQL41/41](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/sql-results.json) trên 600xx staged/restore; `C` = [TC19 1/1](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/canary-results.json) trên 598xx fresh; `U` = [unit1173/1173](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/unit-command.json); `T` = [tooling110/110](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/tooling-commands.json); `O` = [operator desktop/mobile2/2](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/operator-browser-safe.json); `A` = [UI audit 16×3](D:/Workspace/pos-cafe/artifacts/permission-pin19-perm60-source25/ui-audit-report.md) sau selftest23. Browser, SQL và canary discovery khớp execution; fail/skip/retry/expected-failure0. Các target stateful chạy tuần tự. Trạng thái review cuối ghi tại execution log, không suy từ riêng các runner.

| Variant | Oracle bắt buộc và executable đã chạy | Profile | Result |
| --- | --- | --- | --- |
| 01.A | Blank Auth bootstrap: một owner forced, workflow skipped, không normal seed/session; B TC01 + S TC01 | 599/600 | PASS |
| 01.B | Restricted DTO/TTL 300s, không authority; sai PIN không session; B TC01 + S | 599/600 | PASS |
| 01.C | Anonymous REST 401/42501, direct SQL `AUTH_REQUIRED`, không token; B TC01 | 599 | PASS |
| 02.A | Cache normal→recovery, URL/back/reload probes giữ gate, AppShell/protected query vắng; B TC02×3 + U `restrictedAppGate` | 599/mock | PASS |
| 02.B | Proof projection/TTL, focus/reconnect/network failure/expired/revoked; B TC02 + U `requiredPinChange`/lifecycle | 599/mock | PASS |
| 02.C | S1→S2 generation cũ không đổi gate S2; B TC02 + U late-callback generation | 599/mock | PASS |
| 03.A | Inventory 42 protected RPC, restricted/missing/invalid/revoked/foreign denial và no body; B TC03×2 | 599 | PASS |
| 03.B | REST read/DML, SQL app role, Storage upload/delete, trước/sau business/K/R1 và bytes; B TC03 + T surface oracle | 599/tool | PASS |
| 03.C | Chỉ check/complete/revoke restricted; proof/public metadata tối thiểu; B TC03 + S contract | 599/600 | PASS |
| 04.A | PIN/UUID/revision/extra-field direct RPC boundary, denied state/hash/session/evidence unchanged; S TC04 + U inputs | 600/mock | PASS |
| 04.B | Confirmation mismatch không RPC; same PIN reuse exact denial; U `requiredPinChange`, S TC04/09 | 600/mock | PASS |
| 04.C | `000000`/`111111` hợp lệ khi khác PIN cũ; S TC04 | 600 | PASS |
| 05.A | Tám recovery combinations: same/different PIN × flag × session count, revision/evidence/revoke; S TC05/09 | 600 | PASS |
| 05.B | Refs/target/PIN và app actor/override/service denial, unchanged snapshot; S TC05, B TC18 operator, O/T | 600/599/local | PASS |
| 06.A | Hai restricted tokens revoke; old PIN fail, new normal12h/authority; B TC06 + S TC01/06 | 599/600 | PASS |
| 06.B | Một audit/signal/receipt, pending K/financial/print không tự replay; B TC06 | 599 | PASS |
| 07.A | Fault audit/signal/registry của complete/recovery rollback toàn bộ, retry explicit; S TC07 | 600 | PASS |
| 07.B | Employee/menu/floor receipt fault, needs_retry, prior committed edit giữ, retry không reapply; S TC07 + B TC14/15 | 600/599 | PASS |
| 08.A | Barriers two-complete cả thứ tự và complete/recovery cả thứ tự, final state/session; S TC08 | 600 | PASS |
| 08.B | TTL −1/0/+1ms, expiry trong lock wait và stale revision còn valid; S TC08 + T clock/barrier | 600/tool | PASS |
| 08.C | S1 completion response muộn không mở authority S2; B TC08 + U generation | 599/mock | PASS |
| 09.A | ACK drop trước execute/sau commit, login xác minh và không auto replay; B TC09×2 | 599 | PASS |
| 09.B | Denied same/different request, recovery→complete→historical replay và actor/tenant denial, unchanged state; S TC04/05/09 | 600 | PASS |
| 10.A | Unicode displayName/address và boolean/storeNo/UUID/field boundaries qua UI + direct RPC; B TC10×9 + U input | 599/mock | PASS |
| 10.B | Canonical replay, changed payload/tenant denial, no partial entities or PIN/Key in DTO; B TC10 + S bootstrap | 599/600 | PASS |
| 10.C | Store Key 1/99999999/100000000/2147483647 pair đúng quán; bad Key no network; B TC10 + U parser | 599/mock | PASS |
| 11.A | Reserve/signup/bootstrap ACK loss giữ một create identity và canonical payload; B TC11×9 | 599 | PASS |
| 11.B | Pre-execute loss, double submit/pending coalescing, explicit retry; B TC11 + U onboarding/component | 599/mock | PASS |
| 11.C | Bootstrap response mismatch/tenant context fail closed, Key không hiển thị sai; B TC11 | 599 | PASS |
| 12.A | Warning ACK chặn create; Key ACK clear memory/secret; B TC12×4 + U compatibility | 599/mock | PASS |
| 12.B | Unmount/remount + compatibility gate giữ Key trước ACK, không mount protected app; B TC12 | 599 | PASS |
| 12.C | Hard reload trước/sau ACK không recreate/không lưu Key, external saved Key vẫn pair; B TC12 | 599 | PASS |
| 13.A | Restricted không seed; normal login lần đầu claim/run 3 stages một lần; B TC13×4 + S bootstrap | 599/600 | PASS |
| 13.B | `pending/in_progress/needs_retry/completed/skipped`, GET read-only, focus/reconnect/reload không auto retry; B TC13 + U lifecycle | 599/mock | PASS |
| 13.C | Blank store skipped, không cashier/menu/floor demo; B TC13 | 599 | PASS |
| 14.A | Employee ACK loss, cashier PIN edit giữ qua reload/second-device retry/receipt replay; B TC14×3 | 599 | PASS |
| 14.B | Menu ACK loss, giá/tên edit giữ, chỉ pending stages chạy tiếp; B TC14 + S receipt fault | 599/600 | PASS |
| 14.C | Floor ACK loss, edit giữ, completed không nút retry/không reapply; B TC14 + S | 599/600 | PASS |
| 15.A | Hai owner initial claim race: một claim/commit; B TC15×5 + S TC15 | 599/600 | PASS |
| 15.B | Menu fault→needs_retry, cashier edit giữ, two-owner explicit retry; B TC15 + U lifecycle | 599/mock | PASS |
| 15.C | Retry reclaim chờ stage lock, old generation/out-of-order stale; B TC15 + S | 599/600 | PASS |
| 15.D | Menu/floor deterministic collision không overwrite/partial receipt; B TC15 | 599 | PASS |
| 16.A | Recovery giữa stages revoke runner, owner normal sau đổi PIN vẫn đợi retry explicit; B TC16×2 + S TC16 | 599/600 | PASS |
| 16.B | Restricted/nonowner/foreign tenant không đọc/ghi seed; B TC16 + S TC16 | 599/600 | PASS |
| 16.C | Legacy standalone seed route đóng; B TC16 + S contract | 599/600 | PASS |
| 17.A | Normal owner same-PIN no-op, change thật, cashier administration/role ceiling; B TC17 + S TC17 + U | 599/600/mock | PASS |
| 17.B | Client/server contract1/2 fail closed, permission regressions; B TC17 + U/build/typecheck | 599/mock | PASS |
| 17.C | Selftest 23, audit 16×3, màn PIN 0 finding, ảnh phân loại; A | mock UI | PASS |
| 18.A | Wrapper TC18 ghi 20 scenario × 11 sink và operator; quét PIN đã submit, artifact PNG/JSON/log/reporter thực sau child exit; 40 đối chứng oracle, artifact scan48, browser7/7. | 599/tool | PASS |
| 18.B | Exact context message và error/receipt projection ở ca tương ứng; B TC18 + U passcode/required PIN/catalog | 599/mock | PASS |
| 18.C | Operator-only local role, CSRF/Origin/body/loopback, replay/ACK và message; B TC18 real PostgreSQL + O desktop/mobile + T core | 599/local | PASS |
| 19.A | Explicit empty/flag/config/source/bundle/marker và orphan/schema/store-set drift preflight; C + T empty activation | 598/tool | PASS |
| 19.B | Writer trước/sau khóa, recheck 18 relation dưới khóa, DDL fault rollback catalog/ACL; C | 598 | PASS |
| 19.C | 66 Auth/identities + Storage metadata/GET bytes/config giữ, clean activation/new owner restricted; C | 598 | PASS |

Giới hạn 02.A/02.C/08.C: app không có URL router độc lập; query/hash/back chỉ probe gate, và unit generation chứng minh callback muộn khi response browser bị cancel. Audit có sáu baseline finding tại `floor/mobile`; ảnh annotated cho thấy rail cố ý thu gọn nhãn, icon và controls còn hiển thị. Màn PIN 0 finding tại desktop/tablet/mobile; không chạy `ui-audit:update`. TC19 backup được đọc bằng `pg_restore --list`, chưa physical restore. Không mở rộng kết luận sang hosted, CLOSE2/CLOSE3 hoặc release.
