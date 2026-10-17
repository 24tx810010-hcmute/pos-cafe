# EVC — launcher v2, caller và conditional gate, 2026-10-16

**Verdict: APPROVE** đúng candidate SHA256 `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782`, trong phạm vi preparation/caller và nhánh EVC của gate có điều kiện. Không có finding blocking. Không phải release hoặc DB compatibility approval.

Candidate: `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/candidate-01/manifest.json`.

## Source và binding độc lập

- Đối chiếu đủ 14 file live/snapshot: 115.417 bytes, mọi size/SHA256 khớp, 0 drift. Đủ 10 external prerequisites khớp; không thực thi runtime.
- Launcher v2 18.301 bytes, SHA256 `d5922503e1de275468bddf6d3f5bf1e5332ea54ae267497aa2110377c8b6755e`; test 19.464 bytes, SHA256 `e3924502a0e9ec4ddcafdf00533a11cba7f634736730c89acc69f81dc4f27b3f`. Tổng hai file 37.765 bytes.
- Tự so byte/string với v1: đúng một expression thêm `$null=` tại [launcher:155](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2/invoke-actor-probe.ps1:155). Không đổi module SQL/TLS/scope/rollback `cb3d13b4…f48e`, runtime/helper hoặc strict observation logic. V1 giữ nguyên pin.
- Tự so prefix 11 tests cũ: chỉ thay source path v1→v2 và builder-public-fixtures→v2 public-fixtures. Assertion/negative coverage cũ không đổi; thêm đúng hai tests.
- Parent body 9.961 bytes, SHA256 `8b949c85fc28e854f235074ebf419f90f5af018f0bb65b36268f647664c61825`. Parser launcher/caller đều 0 lỗi. Tự extract và so strict reader với caller trước: nguyên văn, không nới schema.

## Regression và provenance

TAP/receipt trong snapshot ghi full suite **13 PASS; 0 FAIL/SKIP/CANCEL/TODO**, exit0, 14:34:47.5697638Z–14:35:05.4763350Z. Tự đếm 13 dòng ok, 0 not-ok và 0 SKIP directives; summary khớp. TAP SHA256 `0f1885c6b66b13e63919c9a35f7169130f642773c031e835f88437b6295c5186`. Receipt ghi 12 pins trước/sau, read locks suốt suite, 0 drift và parent handles đóng; EVC đối chiếu cả các cặp receipt lẫn current public pins, không drift.

[Regression12:166](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2/invoke-actor-probe.test.mjs:166) dùng native pwsh/public stdin và assert Invoke-ProbeChild phát **0 objects**, giữ exact RawStdout/exit và cleanup. Nó kiểm trực tiếp expression từng phát VoidTaskResult.

[Regression13:180](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2/invoke-actor-probe.test.mjs:180) đọc caller đã pin khi case chạy, lấy reader theo anchor không mơ hồ. Runtime/Inputs/Credential/Payload là fake; Child là native pwsh/public JSON; Report/Close thật. Case assert một dictionary/22 fields, exact reader nhận positive; wrapper array bị từ chối. Fixture observation 39 fields không phải dữ liệu online. Hai regression khép khoảng trống output boundary đã ghi ở checkpoint trước, không chứng minh stage online.

Phân loại báo cáo đúng: 8 default/fake/public-policy checks và 5 native contexts, trong đó có public runtime preflight metadata/read-lock; không có protected Node-pg/DPAPI/DB execution. Không cộng history11 thành 24 unique cases. EVC đọc source và evidence, không rerun suite hoặc synthetic child vì chưa có concern cần replay.

## Caller, authority và nguồn gốc review

[Parent:35](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/parent-body.txt:35) pin trực tiếp hai source v2 và giữ read locks, đồng thời giữ helper/runtime provenance. Caller trỏ approval `call_4b7f8595c137482d88fd8ed31f9250cb`, launcher v2 và execution02; directory phải absent, marker CreateNew/max1/no-retry đứng trước Process.Start (cùng file:28,64,77). EVC kiểm execution02 còn absent tại lượt đọc.

Old manifest/reviews ở parent:29–46 là provenance cho helper/runtime, **không phải approval v2**. Header và metadata parent:1,51 ghi current gate do root kiểm bên ngoài. Đây là thủ tục bắt buộc của root, không phải guard tự động xác thực current SEC/EVC được tích hợp trong body.

Owner đã cho quyền có điều kiện: sau **13/13 PASS, 0 skip và cả SEC/EVC APPROVE cùng exact candidate này**, root có thể gọi đúng một READ ONLY probe; không cần xin lại cùng quyết định. Trước dispatch, root vẫn phải pin/read-lock current candidate/source/parent/test receipt và hai current review reports, xác minh counts/no-drift, C/D reserve30GiB, execution02 absent và ghi một dispatch. Approval cũ, riêng biên bản EVC này, hoặc comment trong caller không thay thế điều kiện SEC còn lại. Lỗi/delta ngoài phạm vi phải dừng, không retry.

## Budget và giới hạn kết luận

Manifest projection 296.370 bytes khớp phép tính 115.417×2 + 65.536 allowance, dưới trần tổng phase 524.288 bytes. Bounded public walk của hai roots v2/preparation cộng hai tài liệu tại thời điểm review là 28 files/229.049 logical bytes, trước biên bản review này; không phải allocated size, quota OS/RSS hoặc maximum output được code enforce. Root phải đo aggregate lại trước dispatch và checkpoint.

Làm rõ nonblocking với root: parent:56 còn `evidenceBudgetBytes=262144` là allocation thấp hơn dành riêng execution02; tổng source/prep/snapshot/docs/reviews/future execution dùng trần 524288 do root kiểm ngoài. Field này là metadata, không phải size guard kỹ thuật. Root xác nhận sẽ ghi scope allocation trong review-resolution/closeout trước actual dispatch; không nới source hoặc thay reader để xử lý điểm này.

Báo cáo/index giữ kết quả execution01 ở UNKNOWN, không suy exit0/fake PASS thành actor/scope, rollback hoặc DB compatibility. Conditional probe chưa chạy; nếu đạt cũng chỉ tạo actor/scope metadata proof theo observation thật được validate. Contract2/cutover/backup/recovery/hosted/full backend/push/Vercel gates còn riêng. Hướng đọc source đã được cung cấp, không nhận owner đã đọc/hiểu khi chưa có phản hồi.

EVC chỉ read/hash/parse public source/evidence. Không actual parent/launcher/-RunReadOnly, private-input metadata/bytes, DPAPI, protected Node-pg, network/DB, install/copy runtime, sửa candidate/source/index, push/CI/deploy hoặc delete.

