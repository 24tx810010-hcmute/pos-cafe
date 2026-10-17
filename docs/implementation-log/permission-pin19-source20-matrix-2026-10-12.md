# Ma trận full PIN19 trên source-20 — 12/10/2026

Ma trận này đối chiếu [testplan](../../openspec/changes/force-default-pin-change/testplan.md) với **lượt chạy mới trên cùng source-20**. `PASS` là kết quả executable tại variant tương ứng; nó không tự chứng minh oracle đầy đủ. Review độc lập phát hiện 18.A thiếu hai phép kiểm thiết yếu, nên **gate full PIN19 source-20 chưa đạt** dù các runner đều exit 0. Verdict và giới hạn ở [biên bản execution](permission-pin19-source20-2026-10-12.md). Các receipt G1/G2a/G2b/G2c và TC riêng trước ngày này là lịch sử, không dùng làm hàng PASS của ma trận.

**Khóa nguồn:** [manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-20.json) SHA-256 `69aa27fcaf7a1844131ae7ead67c423f97d88d6a7927c2463f1961cb85c01e57`, tar `c4428fa7f8298b5ba6cc8c41822a4a2527067663f612d5388d22f15a4546f51d`, 808 file hiện hữu + 2 deletion markers, Windows/WSL drift 0, `permissionFingerprint()` `00cac9604b03e94b7d20cb34206901c99f30c35ea7ba21119be04c4ef615d412`.

**Receipt/executable:** `B` = [browser PIN-only 54/54](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/browser-pin-only-safe.json), `ownerPinOnboardingCloseout.spec.ts` trên 599xx activated contract2 (Auth/REST/PostgreSQL/Storage/Realtime/Chromium); per-test line/status/options trong receipt. `S` = [SQL 41/41](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/sql-options.json), `ownerPinServer.contract.test.ts` + `ownerPinServerRuntime.contract.test.ts` trên 600xx legacy16, suite stage candidate SQL trong transaction rồi restore. `U` = [unit/component 1.173/1.173](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/unit-command.json). `T` = [10 nhóm tooling 79/79](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/tooling-commands.json). `C` = [canary TC19 1/1](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/canary-options.json) trên 598xx fresh empty. `O` = [operator browser 2/2](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/operator-browser-safe.json). `A` = [UI audit mới](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/ui-audit-report.md), 16 state × 3 viewport. Mọi nhóm có exit 0, fail/skip/retry/expected-failure 0; chi tiết option và command ở biên bản.

| Variant | Oracle bắt buộc và executable đã chạy | Profile | Result |
| --- | --- | --- | --- |
| 01.A | Blank Auth bootstrap: một owner forced, workflow skipped, không normal seed/session; B TC01 + S TC01 | 599/600 | PASS |
| 01.B | Restricted DTO/TTL 300s, không authority; sai PIN không session; B TC01 + S | 599/600 | PASS |
| 01.C | Anonymous REST 401/42501, direct SQL `AUTH_REQUIRED`, không token; B TC01 | 599 | PASS |
| 02.A | Cache normal→recovery, URL/back/reload probes giữ gate, AppShell/protected query vắng; B TC02×3 + U `restrictedAppGate` | 599/mock | PASS¹ |
| 02.B | Proof projection/TTL, focus/reconnect/network failure/expired/revoked; B TC02 + U `requiredPinChange`/lifecycle | 599/mock | PASS |
| 02.C | S1→S2 generation cũ không đổi gate S2; B TC02 + U late-callback generation | 599/mock | PASS¹ |
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
| 08.C | S1 completion response muộn không mở authority S2; B TC08 + U generation | 599/mock | PASS¹ |
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
| 17.C | Selftest 23, audit 16×3, màn PIN 0 finding, ảnh phân loại; A | mock UI | PASS² |
| 18.A | Runner ghi 20 runtime scenario × 11 sink, success/denial/fault/ACK/replay; B TC18×7 + T oracle/reporter negative controls. Nhưng `complete:denial` bỏ sót PIN đã submit và sink artifact chỉ quét chuỗi tự dựng, không đọc artifact đã ghi. | 599/tool | **GATE FAIL — oracle thiếu** |
| 18.B | Exact context message và error/receipt projection ở ca tương ứng; B TC18 + U passcode/required PIN/catalog | 599/mock | PASS |
| 18.C | Operator-only local role, CSRF/Origin/body/loopback, replay/ACK và message; B TC18 real PostgreSQL + O desktop/mobile + T core | 599/local | PASS |
| 19.A | Explicit empty/flag/config/source/bundle/marker và orphan/schema/store-set drift preflight; C + T empty activation | 598/tool | PASS |
| 19.B | Writer trước/sau khóa, recheck 18 relation dưới khóa, DDL fault rollback catalog/ACL; C | 598 | PASS |
| 19.C | 66 Auth/identities + Storage metadata/GET bytes/config giữ, clean activation/new owner restricted; C | 598 | PASS |

¹ Ứng dụng không có URL router độc lập: query/hash/back là probe của gate. Request S1 có thể bị browser hủy khi đổi quán; U kiểm callback cũ thực sự tới generation mới. Không gọi browser probe là deep-link thật hoặc delivery chắc chắn.

² Audit có 6 baseline finding trên `floor/mobile`; ảnh cho thấy nhãn chữ của rail thu gọn có chủ đích, icon vẫn thấy và dùng được. [Phân loại từng selector/kích thước/ảnh](D:/Workspace/pos-cafe/artifacts/permission-pin19-source20/ui-classification.json), không chạy `ui-audit:update`. Màn PIN 0 finding ở desktop/tablet/mobile; 0 setup failure, 0 finding mới.
