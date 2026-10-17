# Actor/scope online qua launcher v2 — 16/10/2026

## Kết quả và quyền thực hiện

**Một conditional probe thật PASS: ACTOR_SCOPE_METADATA_MATCH.** Có validated observation của launcher, xác nhận TLS verify-full, READ ONLY/repeatable-read, identity stable, exact scope, ROLLBACK và connectionClosed. Đây là proof actor/scope metadata; **không phải Supabase contract2/application compatibility, backup/recovery hoặc release PASS**.

Owner `call_4b7f8595c137482d88fd8ed31f9250cb` cho v2+13tests/review rồi đúng1probe nếu gate đạt. [Preparation](permission-protected-runtime-v2-2026-10-16.md) đạt13PASS/0skip và SEC/EVC cùng APPROVE candidate SHA `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782` trước dispatch. Root kiểm/giữ22public read locks gồm current candidate/source/parent/testreceipt/current review pins và prerequisites; không lấy reviewv1 thay approvalv2. Giữ v1/execution01 UNKNOWN nguyên trạng, không sửa lịch sử thành PASS.

## Bằng chứng thực thi thật

[Root gate](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/conditional-probe-dispatch.json), [root result](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/conditional-probe-result.json), [exact dispatch command](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/conditional-dispatch-command.txt), [parent receipt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/execution-receipt.json) và [CreateNew marker](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/single-invocation.json). Owner ref thống nhất, max1/no-retry; execution02 absent trước khi tạo marker. Dispatch **14:44:14.7063114Z–14:44:26.5015840Z**, exit0; elapsed launcher10.849ms. Không gọi thêm probe sau đó.

| Quan sát đã validate | Kết quả |
| --- | --- |
| Actor/sessionUser/database postgres | true/true/true |
| Role superuser/bypassRLS/canLogin | false/true/true; có visibility phù hợp scope check |
| Store IDs | 79 approved/79 observed;0unexpected; exact=true |
| Auth IDs | 145 observed =79 approved+66 preserved;0unexpected; exact=true |
| Storage metadata | 3 observed =2 approved+1 preserved;0unexpected; exact=true |
| TLS verify-full/transaction READ ONLY/repeatable-read | true/true/true |
| Identity stable/rollbackConfirmed/connectionClosed | true/true/true |
| Runtime qualified/locked files/ACL objects | true/140/172 |
| Credential load/decrypt/child start | true/true/true, trong launcher được duyệt |
| Root/parent/launcher read locks/resources | closed=true; passwordDisposed/processDisposed=true; termination CONFIRMED, cleanupFailed=false |
| Connection state | CONFIRMED_ROLLED_BACK_CLOSED |
| cleanupEligible/fullRowProof/payloadProof/freshBackupProof/liveMutation | false/false/false/false/false |

Safe observation chỉ giữ counts/booleans/hashes/fixed codes; không ID/path/email/PIN/password/token, nội dung đơn hàng hoặc Storage bytes. Hashes scope/CA vẫn `362883c12c6d5a1666258572fc7acb32d283c702725520dc06d8a1705ed8ddb8`/`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Store/auth/storage observed hashes giữ trong JSON có thể đối chiếu, không sao chép raw material.

## Source, điều kiện và tài nguyên

Launcher/test/caller lần lượt SHA `d5922503e1de275468bddf6d3f5bf1e5332ea54ae267497aa2110377c8b6755e`/`e3924502a0e9ec4ddcafdf00533a11cba7f634736730c89acc69f81dc4f27b3f`/`8b949c85fc28e854f235074ebf419f90f5af018f0bb65b36268f647664c61825`; module SQL/TLS/scope giữ `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`. Candidate snapshot chuẩn bị chứa đủ launcher/test/caller và regression đọc exact reader; không nhân runtime hoặc sửaSQL.

Root đã xác minh13counts/no-skip/no-drift, current two reviews bằng SHA, C/D reserve30GiB và aggregate logical budget với153.600B dự trù trước actual. Field execution-only allocation256KiB là metadata thấp hơn tổngphase512KiB; không phải size/OS quota đã tích hợp. Một connection, heap512MiB, inner wait90s+cleanup10s, caller150s+cleanup10s. Không cài/tải/copy runtime/chi phí hoặc UI/Playwright.

[Post-source/Git](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/post-source-git.json):12parent source pins không đổi, main/docs HEAD/branch/staged-entry hashes giữ baseline. [Post-process/disk](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/post-process-disk.json): không còn matching probe process; C/D còn202.195.525.632/102.738.018.304B. Không coi process scan là rollback proof; rollback/close lấy từ validated observation. Không private-input/DB read thêm để hậu kiểm.

Giữ marker/receipts/source/runtime còn dùng; không xóa. Tổng mới của v2source/prep/actual/docs/reviews phải dưới524288logicalB ở checkpoint; allocation vật lý chưa đo. Task policy20GiB/30GiB reserve không thay bằng Linux df hoặc coiheap là RSSquota.

## Đủ cho báo cáo, chưa đủ push/Vercel

Có thể ghi báo cáo đồ án: đã sửa output launcher,13/13local regressionPASS, thực thi mộtactor/scope probe online thành công với TLS/READONLY/rollback và số liệu scope nêu trên. Đây là kết quả cụ thể đã làm; không phải demoVercel hoặc application permission acceptance.

[Khảo sát compatibility trước](permission-online-compatibility-2026-10-16.md) đã ghi các gap contract2/catalog/session/legacy grants/Storage/Edge/signals và migrationtracking. Lượt hiện tại **không query lại schema/contract hoặc deploy code**, nên không cập nhật trạng thái những gap đó từ scopePASS. Source vẫn đòi full gates và hosted capability/control/backup/recovery;17additivebridge riêng không đủ.

Thứ tự tiếp theo cho mục tiêu push/Vercel giữ nguyên: (1) gói LinuxCI1/fullbackend gates đúng source/profile, chỉ chạy sau lệnh riêng; (2) capability/consumer-control và fresh full-row+Storage payload backup/restore trước gói cutover cụ thể; (3) cập nhật backend/2Edgefunctions/signals/strictcontract2 và postflight, rồi mới xét frontend push/Vercel theo lệnh owner. certified hosted profiles còn rỗng ở [source:6](D:/Workspace/pos-cafe/scripts/permission-hosted-profile.mjs:6), backup externalTrust chưa cấp ở [source:18](D:/Workspace/pos-cafe/scripts/permission-backup-dispatch.mjs:18); không bỏ guards hoặc xin quyền write chung để lách.

**Chưa push, chạyCI, sửaSupabase, deploy hoặc xóa dữ liệu.** Quyền một conditional probe đã dùng, newAttemptAuthorized=false; không tự probe lại. Chờ SEC/EVC review actual checkpoint trước bàn giao. Walkthrough source/flow/test/evidence đã cung cấp qua hai hồ sơ v2; chưa nhận owner đã đọc/hiểu/nghiệm thu.

## Metadata review và closeout

**SEC/EVC cùng APPROVE actual checkpoint**, candidate SHA `5e32f57857341652da8724322a01eb11e97a0b5f422bde1e917b60e8da3382a9`,10files/74.508B+12refs. [SEC](permission-protected-runtime-v2-execution-sec-review-2026-10-16.md) SHA `4d86bb058fa02a44846c0031568240bd13c34c602132dbd7eab124bf1fb5c8a5`; [EVC](permission-protected-runtime-v2-execution-evc-review-2026-10-16.md) SHA `d1fced0ea9b19d1d7caf83064842c15614fed74f1207ae6c35210127e1ac901e`. Đủ source/gate/typed39field observation nhất quán, không blocker trong phạm vi actor/scope metadata. Hai reviewer chỉ đọc/hash/parse, không replay hoặc truy cập private/DB.

[Final closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/closeout.json) ghi pins/reviews/Git/C-D/aggregate budget. Root UTC11.795,2726ms, parentUTC11.431,8554ms và launcher monotonic10.849ms là ba phép đo khác nhau. Metadata nối thêm này supersede dòng chờ actualreview; source/receipts/snapshots không đổi. Hoàn tất gói v2+13tests+đúng1conditional probe; **không cấp quyền thử lại hoặc nhận DBcompatibility/releasePASS**.
