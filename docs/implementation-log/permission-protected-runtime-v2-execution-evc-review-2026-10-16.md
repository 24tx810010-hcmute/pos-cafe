# EVC — actual actor/scope checkpoint v2, 2026-10-16

**Verdict: APPROVE** checkpoint đúng candidate SHA256 `5e32f57857341652da8724322a01eb11e97a0b5f422bde1e917b60e8da3382a9`. Không có finding blocking. PASS được chấp nhận trong phạm vi **actor/scope metadata của một transaction đã ghi nhận**, không phải application compatibility, backup/cutover hoặc release approval.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/candidate-01/manifest.json`.

## Binding và gate trước dispatch

EVC đối chiếu 10 file live/snapshot, tổng 74.508 bytes, và 12 external prerequisites: mọi size/SHA256 khớp, 0 drift. Đối chiếu tiếp cả 22 public pins của root dispatch, 12 public pins của parent receipt và 14 file snapshot preparation: 0 drift. Launcher/test/caller vẫn là `d5922503…6755e`/`e3924502…7b3f`/`8b949c85…1825`; module SQL/TLS/scope/rollback `cb3d13b4…f48e`. Không đọc lại private input hoặc thực thi runtime để xác minh.

Đã đọc exact root command 7.572 bytes/SHA256 `45a4ed785c4ddce319e33e014292822d58997d478e72c949e664032247afd2d7`. [Command:24](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/conditional-dispatch-command.txt:24) pin preparation candidate `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782`; dòng 34–50 pin/read-lock hai current SEC/EVC APPROVE cùng candidate, full13/no-skip/no-drift và test bindings. Reviews v1 không thay current gate. Hai review v2 thật khớp pin và có verdict tương ứng.

Command kiểm dispatch/execution02 absent, giữ 22 public locks, C/D reserve, aggregate budget rồi CreateNew dispatch record trước một lần EncodedCommand; không có nhánh retry. Owner `call_4b7f8595c137482d88fd8ed31f9250cb` thống nhất giữa gate, marker, result và parent. Gate ghi14:44:14.6811087Z, trước dispatch14:44:14.7063114Z; marker execution02 tạo14:44:15.1919716Z trước lời gọi launcher theo caller đã duyệt. Điều kiện 13 PASS/0skip + hai exact-candidate approvals đã được ghi nhận trước invocation.

## Kết quả thật và nguồn chứng minh

Root result và parent receipt đều có `ACTOR_SCOPE_METADATA_MATCH`, failure=null, exit0; inner safeLauncherResult đồng nhất. Tự đếm **22 fields ở safe launcher result và 39 fields ở observation**. Đây là validated result của invocation thật, khác output bị mất của execution01.

| Phạm vi observation | Giá trị khớp receipt/source |
| --- | --- |
| Actor/session user/database | postgres/postgres/postgres |
| Superuser/bypassRLS/canLogin | false/true/true |
| Store IDs | 79 approved =79 observed; exact=true, unexpected0 |
| Auth IDs | 145 =79 approved+66 preserved; exact=true, unexpected0 |
| Storage metadata | 3 =2 approved+1 preserved; exact=true, unexpected0 |
| TLS/transaction/identity | verify-full, READ ONLY, repeatable-read, stable đều true |
| Rollback/connection | rollbackConfirmed=true, connectionClosed=true; CONFIRMED_ROLLED_BACK_CLOSED |
| Runtime/credential | qualified=true,140files/172ACL; load/decrypt/child-start=true |
| Cleanup resources | root/parent/launcher closed; password/process disposed; termination CONFIRMED; cleanupFailed=false |
| Eligibility và phạm vi chưa chứng minh | cleanupEligible/fullRowProof/payloadProof/freshBackupProof/liveMutation đều false |

Đã đọc effectful module, không chỉ fake tests: [actor-probe.mjs:10](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/actor-probe.mjs:10) cố định BEGIN REPEATABLE READ READ ONLY, identity và bounded SELECT; LIMIT80/146/4 cùng exact sets kiểm overflow và unexpected rows cho scope79/145/3. Dòng65–97 kiểm postgres identity, superuser hoặc bypassRLS, ID sets và Storage id/bucket/path/version/size tuples. Dòng101–125 kiểm identity trước/sau, ROLLBACK và close trước khi trả PASS. Dòng150–166 dùng pinned CA, rejectUnauthorized, hostname check và encrypted/authorized stream. Launcher strict39field validator và caller strict22field reader giữ nguyên source đã duyệt.

Scope/CA hashes là các pin `362883c1…ddb8`/`70072358…3b7`; các observed-set hashes có trong safe receipt. EVC kiểm định dạng/binding và source tạo chúng, không đọc raw ID sets/private scope/CA hoặc tái tính từ database. Storage proof chỉ là metadata so với tuple đã pin; không chứng minh bytes/payload SHA của object. Counts/booleans/hash không thay full-row proof hoặc trạng thái database sau transaction.

## Thời gian, tài nguyên và hậu kiểm

Root UTC interval14:44:14.7063114Z–14:44:26.5015840Z =11.795,2726 ms; parent14:44:14.9993924Z–14:44:26.4312478Z =11.431,8554 ms; launcher monotonic elapsed10.849 ms. Ba phạm vi/phép đo khác nhau, không nhận launcher elapsed là hiệu hai root UTC. Một dispatch, một connection theo source/guard, không timeout hoặc retry trong receipt.

Predispatch logical247.809 + reserved153.600 =401.409 bytes, dưới tổng phase524.288. Manifest checkpoint projection282.897 + snapshot74.508 + allowance49.152 =406.557, cũng dưới trần; allocation256KiB trong parent là phần execution-only metadata như đã làm rõ, không phải tổng phase. C/D before và post đều trên30GiB. Heap512MiB/concurrency2/wait bounds không phải quota OS/RSS; chưa đo allocated disk size.

Post-process receipt ghi không có matching probe process; đó không phải rollback proof. Rollback/close lấy từ observation được validate. Post-source/Git receipt ghi 12 parent pins không drift, main/docs HEAD/branch/staged-entry hashes giữ baseline; staged-entry hash không phải raw .git/index hash. EVC đối chiếu receipt/pins, không chạy Git, process scan, runtime140 audit hoặc DB hậu kiểm lại.

## Giới hạn và authority còn lại

Báo cáo/index giữ 13 local tests riêng với một actual probe; không cộng thành 14 business/DB cases. Execution01/v1 UNKNOWN không được viết lại thành PASS. Khảo sát schema/contract trước chỉ được dẫn như lịch sử: lượt này không query schema hoặc deploy code.

Ba source remaining-gates được pin/read: [hosted-profile:6](D:/Workspace/pos-cafe/scripts/permission-hosted-profile.mjs:6) vẫn có certified profiles rỗng; [backup-dispatch:18](D:/Workspace/pos-cafe/scripts/permission-backup-dispatch.mjs:18) giữ externalTrust=null và action unauthorized; migration017 ghi additive bridge/no candidate activation. Actor/scope PASS không khép contract2/application/hosted capability, consumer control, fresh full-row+Storage backup/restore, cutover, Linux/full-backend hoặc push/Vercel gates. Bước tiếp theo vẫn cần phạm vi riêng phù hợp.

Quyền một conditional invocation đã tiêu thụ; newAttemptAuthorized=false, không tự probe lại. EVC chỉ public read/hash/parse; không parent/launcher/probe replay, private-input metadata/bytes, DPAPI, protected Node-pg, network/DB, install/copy, sửa candidate/source/index, push/CI/deploy hoặc delete.

