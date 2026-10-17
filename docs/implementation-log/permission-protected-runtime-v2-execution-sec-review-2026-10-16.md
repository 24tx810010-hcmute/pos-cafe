# SEC — checkpoint actor/scope thật qua v2, 16/10/2026

**APPROVE** candidate SHA256 `5e32f57857341652da8724322a01eb11e97a0b5f422bde1e917b60e8da3382a9`, chỉ cho hồ sơ một conditional invocation và kết quả actor/scope metadata đã validate. Không có finding chặn checkpoint. Không phải APPROVE DB compatibility, cutover, backup/recovery, application acceptance, push/deploy hoặc quyền thử tiếp.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-02/candidate-01/manifest.json`; 10 file, 74.508 B, 12 external prerequisites. Reviewer độc lập `/root/ci1_worker_sec`; chỉ tạo báo cáo này, không sửa candidate/source/index/review cũ.

## Cách kiểm và binding

Tự kiểm hash/kích thước toàn bộ 10 original + 10 snapshot và 12 references công khai: 0 sai khác. Current preparation vẫn `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782`; launcher/test/parent/module giữ pins đã review. Đọc exact root dispatch command, gate/result/parent receipt/marker/closeout/post-check và báo cáo tác giả. Parse dispatch command 0 lỗi; không thực thi nó hoặc parse thành script để gọi lại.

Parse JSON độc lập xác nhận observation đúng39 tên field, types/counts/booleans/hash và scope/CA pins; safeLauncherResult trong parent và root result giống nhau. Checker public đầu dùng nhầm tên hằng PowerShell nên output schema lượt đó bị loại; sửa tên biến checker rồi kiểm lại: 0 lỗi schema. Candidate không bị thay đổi; không nhận lỗi checker thành lỗi sản phẩm hoặc PASS. Không chạy tests/synthetic/probe mới.

Không gọi parent/launcher/`-RunReadOnly`, private-input metadata/bytes/DPAPI, protected Node/pg, DB/network, ACL/copy/install/Git/CI/deploy/delete. Kết luận actual dựa trên source và receipts đã bind, không có server query hoặc private-material hậu kiểm riêng của SEC.

## Thẩm quyền và chronology

Các đường dẫn artifact dưới đây có prefix `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/`.

`actor-probe-protected-runtime-v2-preparation-01/conditional-dispatch-command.txt:24`–51 kiểm đúng current candidate/source/parent/test receipt/TAP/closeout và **hai review v2 mới**, full13/no fail/skip/cancel/todo, source drift0; giữ FileShare.Read locks. Review cũ chỉ là provenance, không thay current gate. Source gate thật này thực hiện yêu cầu external gate đã nêu ở review preparation; không chỉ dựa comment hoặc owner-reference string.

Closeout hoàn tất14:42:29.935Z; gate ghi14:44:14.6811087Z; dispatch14:44:14.7063114Z; parent bắt đầu14:44:14.9993924Z, marker14:44:15.1919716Z, parent kết thúc14:44:26.4312478Z; root kết thúc14:44:26.5015840Z. Trình tự receipts nhất quán với gate trước invocation. Root source dòng 22–23 từ chối dispatch/execution tồn tại; dòng 60–67 CreateNew/flush gate trước một EncodedCommand invocation. Parent đã review tạo execution02 marker trước một launcher Start. Không có retry trong hai flow; max1/no-retry và approval `call_4b7f8595c137482d88fd8ed31f9250cb` thống nhất.

Owner đã cho đúng một probe có điều kiện; conditions đã có evidence đạt trước dispatch. Quyền đó **đã dùng hết**; `newAttemptAuthorized=false`. Checkpoint này không cho invocation mới. V1, marker cũ và execution01 thiếu validated result vẫn là lịch sử UNKNOWN.

## Kết quả actual và cleanup

`actor-probe-protected-runtime-execution-02/execution-receipt.json` có outer22field launcher result hợp lệ và observation39field, khác checkpoint thất bại trước. Chỉ exit0 không đủ; lần này có exact schema/status/typed flags và code nguồn xử lý tương ứng:

| Bằng chứng actual đã validate | Kết quả |
| --- | --- |
| Actor/session/database | postgres/postgres/postgres; superuser=false, bypassRLS=true, canLogin=true |
| Scope store/auth/Storage metadata | 79/145(79+66)/3(2+1), exact flags true, mọi unexpected count0 |
| TLS/transaction/identity | verify-full, READ ONLY, repeatable-read, identity stable=true |
| Rollback/connection | rollbackConfirmed/connectionClosed=true; CONFIRMED_ROLLED_BACK_CLOSED |
| Runtime | qualified=true, 140 files locked/172 ACL objects |
| Credential/child | loadAttempted/loaded/decrypted/started=true, timedOut=false |
| Resource closure | root22/parent12 locks closed; launcher handles/password/process disposed, termination CONFIRMED, cleanupFailed=false |
| Các proof không được cấp | cleanupEligible/fullRowProof/payloadProof/freshBackupProof/liveMutation=false |

Launcher `actor-probe-protected-runtime-v2/invoke-actor-probe.ps1:162`–191 chỉ nhận đúng39field/type/count/pins và role visibility trước gán connectionState; dòng 193–240 đóng resources trước safe output. Module `actor-probe-retry-v3/actor-probe.mjs:101`–125 thực hiện fixed READ ONLY observation rồi ROLLBACK/close trước trả proof; dòng 150–165 giữ TLS/one-client/timeouts. Source/module không đổi so reviewed preparation. Role bypassRLS đủ cho kiểm visibility trong contract này; không phải chứng nhận RLS của app user, mọi quyền DB hoặc quyền DDL.

Safe output chỉ có fixed codes/status, counts/booleans/hash; không lưu credential, raw IDs, business full rows hoặc Storage payload. Không có memory-zeroization claim. Post-process receipt không thấy matching process, nhưng rollback/close proof lấy từ observation và flow, không suy từ process scan. Không đọc private inputs/DB thêm để bù bằng chứng.

## Ngân sách và giới hạn bàn giao

Đánh giá độc lập: field parent `evidenceBudgetBytes=262144` có thể giữ là **execution-only allocation metadata** dưới trần owner tổng524288B; không đổi cap hoặc scope. Root command dòng 52–59 thực sự kiểm C/D reserve30GiB và aggregate247809 + reserve153600 =401409B <524288 trước dispatch. Gate/closeout ghi rõ không code-enforced allocation/OSquota. Không nhận metadata256KiB thành quota đã áp dụng, hoặc thành allowance cộng thêm ngoài tổng512KiB. Manifest checkpoint dự trù406557B gồm49152B allowance; báo cáo SEC này nằm trong allowance, không tạo evidence khác.

Báo cáo tác giả dòng 5/40–48 giữ đúng actor/scope PASS riêng với những gate còn mở. Source `D:/Workspace/pos-cafe/scripts/permission-hosted-profile.mjs:6` vẫn certified profiles rỗng; `permission-backup-dispatch.mjs:18` truyền externalTrust=null rồi từ chối action; `supabase/migrations/017_permission_catalog_bridge.sql:1` là additive bridge/no candidate activation, dòng 225 giữ existing grants/policies. Đây là nhận định **source guard**, không khẳng định live schema đã query lại hoặc migration đã apply/chưa apply.

Giữ **APPROVE checkpoint actual actor/scope** đúng hash trên. Các điều kiện contract2/application/fullbackend/hosted backup+restore/cutover/push/Vercel không được thay bằng probe này; không có quyền mutation hoặc retry mới.
