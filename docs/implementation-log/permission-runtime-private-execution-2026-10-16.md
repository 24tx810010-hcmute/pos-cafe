# Thực thi runtime riêng và kiểm offline — 16/10/2026

## Phạm vi và kết quả thật

Owner duyệt `call_3065fd94e628417490366dbae83e5812`: đúng một lượt controller tạo/copy runtime, rồi một kiểm offline nếu copy verified; không credential/private input, PostgreSQL probe/DB, push/CI/deploy/install/delete. Gói nguồn [đã SEC/EVC review](permission-runtime-private-preparation-2026-10-16.md) là composite candidate02 SHA `7e135630001be578af40d77a420e9f3186201fb9911254891c7ac94d331d4ae9`; controller SHA `0f7c4273a836b68b764c5594ec2177fc1522e0e2a59a36c228b68da21ec1efdb`.

**Actual copy và actual offline đều PASS.** Controller đã chạy đúng một invocation, không sửa source và không retry. Runtime mới tại `D:/Workspace/pos-cafe-db-probe-runtime-private` có **140 file / 92.755.145 logical bytes (~88,46 MiB), 32 directories kể cả root**. Không còn dùng alias Node symlink hoặc pg từ shared source trong lượt kiểm offline này.

| Bằng chứng thực tế | Kết quả và giới hạn |
| --- | --- |
| Parent launcher | Start 13:07:30.0349478Z, finish 13:07:45.7346843Z; child-process stopwatch 15.640 ms, exit0. Stopwatch bắt đầu sau ghi marker nên không bằng toàn timestamp interval. Controller read-lock giữ xuyên invocation, đã đóng |
| Controller | RUNTIME_PREPARATION_VERIFIED, failureStage NONE, elapsed15.291 ms; copyAttempts1, offlineAttempts1, handlesClosed=true, finalReceiptWritten=true |
| Copy | COPY_VERIFIED, 140 files,32 directories, hashVerificationCompleted=true, handlesClosed=true. Không thực thi Node/pg trong copy |
| Offline thật | OFFLINE_VERIFIED, 140 verified files, **34 CJS files** được load trong private graph, privateResolution=true, networkAttempts0, credentialRead/databaseConnected/newProbeAuthorized=false |
| Kiểm public bytes/metadata sau chạy | PASS lúc13:09:47.4325798Z–13:09:49.8967919Z: đủ140hash/size khớp manifest,172metadata entries (files+directories/root), đúng owner/protected ACL current user/SYSTEM/Administrators, no-reparse; không execute runtime lại |

Offline dùng đúng chương trình đã pin: Node24.16.0, env chỉ SystemRoot, exact pg ESM entry và CJS bên trong runtime, chỉ dựng Client với password synthetic, không gọi connect. Đây là **actual Node/pg offline qualification**, khác 35 test local trước đó. Không nhận 34 loaded files thành 34 test cases hoặc thành kiểm TLS/actor/scope online.

## Nguồn và provenance

Trước invocation, root kiểm lại 14 source pins của full03, manifest/review hashes, runtime/receipt targets absent và dung lượng C/D; khóa controller đúng hash đã review. Controller tiếp tục khóa năm public inputs, kiểm metadata, tạo marker/receipt bằng protected CreateNew, chạy copy90s rồi conditional offline30s và đo lại disks giữa hai bước. Không chạm điều kiện timeout/lỗi; không tự retry.

[Launch receipts](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-execution-launch-01) gồm intent, argv/cwd/start marker, parent result và post-copy-public-audit. [Protected execution receipts](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-execution-run-01) gồm hai invocation markers, hai safe child results và controller result. Chỉ giữ safe fields; raw stdout/stderr không ghi ra artifact.

Các pins chính:

- Copy result SHA `91a48750e955f3c03f97208d96689fa5602bdfc8c019e60e24aee9f7d7c56e26`.
- Offline result SHA `c2a879842911078064e3e41555714fbbfb63e318494c094f8ea3a9619d482fe7`.
- Stored controller result SHA `573044280c94ea07d74cffa55fedd42f810d91d3b132a98d5a082de39d40ba83`.

Stored controller receipt không có `finalReceiptWritten`; source thêm field này vào stdout sau khi lưu receipt thành công. Parent result giữ field=true từ stdout, phù hợp code, không phải hai kết quả bị lệch. Parent tool exit0 chỉ xác nhận wrapper hoàn tất; ở đây controller exit0 và status cũng verified. Không suy các trạng thái này cho probe lỗi run04 cũ.

## Tài nguyên và dữ liệu giữ lại

Chỉ copy Node cùng14package/probe đã có, không tải binary/package hoặc tạo Linux/Docker/CI environment. Payload thực tế92.755.145 B dưới trần logical250MiB và khoảng tăng dự trù100–150MiB/đỉnh250MiB. Chưa đo allocation vật lý; không coi logical payload hoặc chênh lệch free drive là allocation chính xác do các process khác vẫn hoạt động.

Checkpoint sau public audit: C còn202.848.555.008 B, D còn103.197.413.376 B, đều trên dự trữ30GiB. Các bước tuần tự; copy90s/offline30s với cleanup waits tối đa10s mỗi child, Node15s/heap512MiB. Đây không là quota OS hoặc total wall-clock hard cap. Không phát sinh dịch vụ trả phí.

Runtime đang cần cho bước tiếp theo, không phải temp hết nhu cầu. Ba private inputs của run04 được giữ, phase này không đọc bytes/decrypt hoặc đổi ACL của chúng. Giữ source/receipts/fixture lịch sử; không xóa hoặc overwrite dữ liệu cũ. `artifacts/` được Git ignore; runtime ở ngoài checkout, không tự đi vào push payload. Review/closeout sẽ kiểm lại HEAD và staged entries.

## Điều đã đủ và việc còn chặn

Có thể báo cáo cụ thể: đã xác minh integrity Node/dependency, xây và kiểm35ca local, áp dụng protected runtime thật đủ140file, chạy actual pg offline thành công và audit hash/ACL sau đó. Đây là tiến độ đã thực hiện, không phải proposal.

**Chưa có actor PostgreSQL/scope79 online PASS mới; chưa chứng minh Supabase contract2/cutover/recovery hoặc Vercel deploy.** Launcher credential cũ vẫn ghim Node alias/shared dependency; không được dùng lại nguyên trạng chỉ vì runtime mới tồn tại. Bước cần chuẩn bị tiếp là nối launcher với runtime đã pin/khóa, giữ nguyên module SQL READ ONLY/TLS/scope/rollback và kiểm/review trước một quyền probe mới. Phase này chưa sửa launcher credential hoặc dùng credential.

Quyền một controller/copy/offline vừa cấp đã dùng. Không rerun actual offline/copy, sử dụng credential hoặc thực hiện PostgreSQL probe bằng quyền này. [Online compatibility](permission-online-compatibility-2026-10-16.md) vẫn còn backend legacy, backup/recovery/hosted controls/full gates mở; **chưa đủ điều kiện push phát hành**, chưa push hoặc deploy. Tailwind3 vẫn theo quyết định owner trước đó.

Walkthrough: review pins → một invocation → protected copy verified → actual private pg offline34modules/no-connect → public post-audit → checkpoint review → quyết định scope tiếp theo. Chưa nhận owner nghiệm thu/đã đọc hiểu. SEC/EVC review checkpoint thực thi được lưu riêng; review không mở quyền probe/DB hoặc phát hành.

## Metadata review và bàn giao

**SEC/EVC cùng APPROVE checkpoint thực thi candidate01**, SHA256 `9a5dce3cbb65dbf51bc8dbc0c9792e568208221a1df90deeb3528fa2262ea4a0`, 11 files/41.869 B và sáu source references, không findings cần sửa. [SEC](permission-runtime-private-execution-sec-review-2026-10-16.md) SHA `86ec097e0eb5d6bd3a5c95e5975b320229f1935792cdf091a2ddc79c8db475e7`; [EVC](permission-runtime-private-execution-evc-review-2026-10-16.md) SHA `2911e76c44ba0c924fdda7200ad036503e8b0cc5e7f8c439a4c5998edac24b15`.

Hai reviewer kiểm source/snapshot/receipt/authority/timing và giới hạn actual offline, không chạy lại runtime/tests/credential hoặc đọc DB. Không nhân kết quả synthetic/34modules thành số ca DB. [Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-execution-launch-01/closeout.json) lưu kiểm cuối, review pins, Git/staged và budget. Phần metadata này nối thêm sau frozen body; snapshot/source/receipts đã review giữ nguyên.

Hoàn tất đúng lượt controller/copy/offline được duyệt. Runtime được giữ phục vụ bước sau, chưa xóa dữ liệu. Bước mới cần chốt là chuẩn bị launcher credential dùng protected runtime và kiểm local, rồi trình một quyền actor/scope probe mới khi gói cụ thể đủ review; chưa sửa launcher hoặc dùng credential/probe trong checkpoint này. Không push/CI/DB write/deploy.
