# Actor/scope probe dùng protected runtime — thực thi 16/10/2026

## Phạm vi và quyết định

Owner duyệt `call_ca7dd7f1f37d4c48a492f0ab56230e59`: một invocation mới bằng EncodedCommand đã chuẩn bị, dùng nguyên launcher/runtime đã duyệt; một kết nối READ ONLY/TLS/scope79/145/3, ROLLBACK/đóng, heap512MiB; child90s+cleanup10s, caller150s+cleanup10s. C/D giữ30GiB, evidence mới tối đa256KiB trên D:/Workspace. Không cài/tải/phí, DB write, push/CI/deploy/delete; có lỗi dừng, không tự retry.

**Đã gọi đúng một reviewed launcher và dừng vì lớp parent không nhận được kết quả hợp lệ. Không có actor/scope online PASS mới.** Khác [checkpoint transport trước](permission-probe-launch-transport-2026-10-16.md), lần này có execution directory, CreateNew marker, process start và termination thật. Quyền một invocation này đã dùng; không suy có quyền thử tiếp từ exit0 hoặc từ việc có thể DB đã chạy.

## Source, lệnh và kết quả thật

[Intent](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/intent.json) và [parent body](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/parent-body.txt) giữ exact source: 9.085B/SHA `01d4f1e5520e48c68da267d9c75fb9bf4a41d34902acbf59d71a45d8b422def3`. Chỉ thay đúng một approval reference từ body đã review; transport EncodedCommand UTF-16LE dài24.228 ký tự, roundtrip exact. Launcher/test vẫn SHA `8ef30eaadf258fcee13595f4770339653b85730cf120cf88fce329e8ec092491`/`d134caeb827aa131330f3d6a3a0b5c02c4e5162fa391929b80fd3b43495bc439`; module SQL/TLS/scope/rollback giữ `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`.

Lệnh: PowerShell đã có, `-NoProfile -NonInteractive -EncodedCommand <base64 UTF-16LE exact parent-body>`; parent gọi duy nhất launcher v1 bằng `-File …/invoke-actor-probe.ps1 -RunReadOnly -ApprovalReference call_ca7dd7f1f37d4c48a492f0ab56230e59`, cwd D:/Workspace/pos-cafe. Parent kiểm/giữ12public read locks (manifest/closeout, hai source, sáu prerequisites, hai review), reserve và marker trước process start. Credential contents không nằm trong argv hoặc evidence.

[Transport result](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/transport-result.json), tool chunks `fc9d93`/`74882f`: **14:09:18.898Z–14:09:31.319Z**, elapsed12.419ms; một dispatch, transport exit0, parse được outer envelope. Parent receipt: [execution-receipt.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-01/execution-receipt.json), **14:09:19.4777985Z–14:09:31.2474609Z**. [Marker](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-execution-01/single-invocation.json) tạo14:09:19.6639055Z/max1/no-retry.

| Quan sát thật | Kết quả |
| --- | --- |
| Reviewed launcher start attempted/started | true/true; đúng1 lời gọi |
| Launcher exit/timeout/termination/dispose | 0/false/CONFIRMED/true |
| Parent source locks closed | true |
| Parent result | EXECUTION_STOPPED; failureStage READ_SAFE_LAUNCHER_RESULT |
| Validated safe launcher result | Không nhận được; raw stdout/stderr không lưu |
| Runtime140 qualification, credential/DPAPI, Node/pg, DB connection/TLS/actor/scope/rollback | **UNKNOWN trong lượt thật**, thiếu validated observation |
| Process probe/launcher khớp sau dừng | Không còn theo kiểm metadata; không thay cho server/rollback proof |
| DB write/push/CI/deploy/delete/install | Không thực hiện/không được giao; không retry probe |

Không nhận exit0 của launcher thành rollback/connection/scope PASS. Cũng không nhận thành “credential chưa đọc/DB chưa kết nối”: lần này launcher đã được gọi và có thể đã đi qua các bước nhạy cảm. Parent failure stage gom parse JSON/schema/status; không giữ raw để xác định exact bytes của stdout thật. Nội dung SQL và one-client/TLS/readonly guards không đổi; không quan sát online thêm để bù bằng chứng còn thiếu.

## Chẩn đoán local sau dừng

Chỉ dùng source công khai và PowerShell child giả, không gọi whole launcher, credential/private-input metadata/bytes hoặc protected Node/pg/DB thêm. Source file không sửa.

Lỗi tái hiện ở [launcher:155](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:155): `$write.GetAwaiter().GetResult()` phát `System.Threading.Tasks.VoidTaskResult` vào success stream trong runtime PowerShell hiện tại. [Diagnostic hẹp](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/synthetic-child-emission-diagnostic.json), tool24ee52: một emitted object loại này, native synthetic child exit0, payload/output giả và resource close/dispose đạt.

[Full synthetic diagnostic source](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/synthetic-output-diagnostic.txt) và [receipt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/synthetic-output-diagnostic.json), tool14de80, dùng adapter Runtime/Inputs/Credential/Payload giả; Child gọi native pwsh giả, Report/Close dùng hàm thật. Fake observation có đúng39field/counts/flags/hashes và không chứa dữ liệu online.

| Case | Cách kiểm | Kết quả |
| --- | --- | --- |
| OUT01 | Native Invoke-ProbeChild, stdin/output giả | Phát1 VoidTaskResult thừa |
| OUT02 | Toàn sequence v1 giả → serialize → strict parent schema | Hai objects: VoidTaskResult+OrderedDictionary; JSON array, parent từ chối |
| OUT03 | Chỉ thay một expression trong function ở bộ nhớ bằng `$null=…GetResult()`, cùng sequence giả | Một OrderedDictionary/22fields; parent chấp nhận; resource đóng |

Ba synthetic child này không phải DB tests; hai sequence sử dụng native process với adapter nhạy cảm giả. UTC boundaries không lấy cho diagnostic; không dựng hồi cứu. Chẩn đoán tái hiện được một lỗi source phù hợp symptom; **không có actual stdout để đối chiếu byte trực tiếp**, không dùng fake39field thành actual DB proof.

Bộ11local tests trước vẫn là lịch sử PASS đúng source/phạm vi, nhưng **chưa phủ pipeline-output boundary của native child → coordinator → outer reader**. Những ca native trước kiểm RawStdout/timeout/dispose mà không assert emitted object count; fake coordinator không qua native child. Không cộng11+3 thành14DB cases hoặc coi suite cũ chứng minh boundary này.

## Đề xuất xử lý cụ thể, chưa được giao triển khai

[Diff đề xuất, chưa áp dụng](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/proposed-fix.diff.txt): tạo launcher/test v2 riêng, giữ v1; thêm `$null=` tại đúng expression trên để không phát VoidTaskResult. Giữ nguyên strict parent schema; không chọn lấy JSON cuối hoặc bỏ output lạ để giả PASS.

Thêm hai regression: native Invoke-ProbeChild phải không phát object ngoài ý muốn; full synthetic sequence/native child phải ra đúng một22field dictionary và được strict reader chấp nhận. Giữ11cases/negative assertions/SQL/TLS/scope/rollback, chạy suite và hai review SEC/EVC cùng candidate mới. Runtime140files/module không cần copy hoặc sửa.

Có thể xin owner một gói quyền có điều kiện để giảm vòng chờ: **chuẩn bị v2 và test/review; chỉ nếu mọi gate local/review đạt thì đúng một probe READ ONLY mới**. Caller phải trỏ/pin candidate v2, guard marker ở execution02 mới, C/D reserve30GiB; giữ marker/evidence execution01. Nếu có lỗi/delta ngoài phạm vi thì dừng, không retry. Gói tương lai dự kiến source/evidence tối đa512KiB trên D, không cài/tải/runtime mới hoặc phí; đây là đề xuất, **chưa được owner chấp nhận**.

## Tài nguyên và bàn giao

[Post-source/Git verification](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/post-source-git-verification.json): tám source/external pins không đổi; Git main/docs HEAD/branch/raw staged-entry hashes giữ baseline. C/D sau kiểm còn202.269.200.384/102.741.434.368B; disk free biến động toàn ổ không được quy thành dữ liệu task. Logical evidence phải đo tổng hai roots launch02+execution01 và docs; không đo allocation hoặc bật quota OS.

Giữ tất cả marker/receipts/source cần dùng, không xóa. Không UI/Playwright. **Actor/scope và Supabase contract2 compatibility chưa có PASS; DB cutover/backup/recovery/hosted/full backend và điều kiện push/deploy vẫn mở.** Có thể báo cáo đã thực hiện một invocation có kiểm soát, phát hiện và tái hiện lỗi công cụ; không báo database tương thích hoặc deploy-ready. Chờ SEC/EVC review checkpoint này; đang đợi quyết định mới trước sửa source v2 hoặc gọi thêm DB.

## Metadata review và closeout

**SEC/EVC cùng APPROVE checkpoint đã dừng**, candidate SHA `6b41652d59d43b6e00861332759ec10f8c7ac4fd3a77eb4a1521edb9c3ae8423`,16files/118.383B+6refs. [SEC](permission-protected-runtime-probe-execution-sec-review-2026-10-16.md) SHA `4ed1594d1362bc59bffa214b61b1228dd74330cad0ad305e2c8455010a4070b5`; [EVC](permission-protected-runtime-probe-execution-evc-review-2026-10-16.md) SHA `4619ef0b9956f2a8a5d7678a14adab80f48cc7a051606963666d7b69637e248a`. SEC-OUT-01 (VoidTaskResult) và SEC-OUT-02 (gap tests) vẫn OPEN, chặn dùng v1 cho lần thực thi tiếp; không chặn tính trung thực của checkpoint này. Chưa có v2 hoặc online PASS.

SEC replay hai synthetic sequence của cùng diagnostic bằng frozen source, không thêm unique cases/DB tests; EVC chỉ đọc/hash/parse/encode, đủ6refs và12executionpins. Không reviewer dùng credential hoặc DB. Root giữ ba synthetic child đã ghi, replay không cộng thành năm unique scenarios. Hai phép thời gian khác nhau: UTC interval12.421ms lấy trước ghi dispatch marker; elapsed12.419ms dùng performance.now bắt đầu sau ghi marker. Không nhận hai số là cùng phép đo.

[Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-launch-02/closeout.json) giữ source/review pins, Git và dung lượng tổng hai evidence roots. Metadata nối thêm này supersede dòng chờ review; source/receipts/snapshot giữ nguyên. **Chờ owner quyết định gói v2+test/review+conditional one-probe; chưa sửa source hoặc gọi tiếp.** Giữ actual inner credential/Nodepg/connection/TLS/scope/rollback UNKNOWN và chưa push/CI/DB write/deploy/delete.
