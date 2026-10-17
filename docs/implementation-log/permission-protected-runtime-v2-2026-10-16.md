# Launcher v2 và conditional actor/scope probe — 16/10/2026

## Quyết định, phạm vi và điều kiện

Owner đã chấp nhận gói có điều kiện tại `call_4b7f8595c137482d88fd8ed31f9250cb`: tạo launcher/test v2 riêng trong D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2, giữ v1. Chỉ thêm `$null=` ở expression GetResult phát VoidTaskResult, thêm hai regression; giữ11cases cũ, strict schema/SQL/TLS/scope/rollback/runtime. Cập nhật caller/pins/marker mới.

**Chỉ nếu13/13 PASS,0skip và SEC/EVC cùng APPROVE đúng candidate mới thì được gọi đúng một probe READ ONLY** tới project `kfqjdfwxhkdwihjobpny`, scope79stores/145authIDs/3StorageID-metadata. Credential DPAPI đã lưu chỉ được dùng sau gate; chỉ lưu counts/booleans/hash và fixed status. Có lỗi hoặc không đủ gate thì dừng, không tự retry. Quyết định này thay trạng thái “chưa owner duyệt v2/probe mới” ở [checkpoint trước](permission-protected-runtime-probe-execution-2026-10-16.md); không biến kết quả trước thành PASS.

Source/evidence mới tổng tối đa512KiB trên D, không cài/tải/copy runtime hoặc phí. Giữ30GiB trống trên C/D; Node heap512MiB/testconcurrency2, probe1connection, inner90s+cleanup10s/caller150s+cleanup10s. Đây không phải quota OS/RSS. Không DB write, push/CI/deploy/delete. Source/code/tests ở main artifacts ignore, report ở docs; không stage/commit/chuyển nhánh.

## Yêu cầu, test plan và traceability

Đây là slice sửa công cụ của actor/scope probe đã có, không thêm feature nghiệp vụ hoặc change OpenSpec mới. Kế thừa PLR01–07 của [v1](permission-protected-runtime-launcher-2026-10-16.md); ghi phần delta tại đây thay vì nhân bộ bảy artifact.

| ID | Acceptance và test |
| --- | --- |
| V2-01 | V1 và module/helper/runtime không đổi; launcher v2 chỉ thêm `$null=` tại expression cũ. So byte-diff và pins trước/sau; giữ11cases |
| V2-02 | Native public synthetic Invoke-ProbeChild phát0pipelineobjects; RawStdout/exit/cleanup đúng. Regression12 |
| V2-03 | Fullfake Runtime/Inputs/Credential/Payload +native public pwsh child, real Report/Close → đúng1dictionary22fields; exact production caller reader chấp nhận, array/unexpectedoutput bị từ chối. Regression13 |
| V2-04 | Caller pin/khóa launcher/test v2, giữ helper/runtime provenance, execution02 CreateNew marker và no-retry; source binding + parser + review. Không dùng old v1 review thay current SEC/EVC gate |
| V2-05 | Full13PASS/0skip + hai APPROVE cùng frozen candidate trước bất kỳ credential/actualprobe. Root ghi gate trước dispatch; lỗi dừng, không tự retry |
| V2-06 | Probe giữ TLS verify-full/READ ONLY/repeatable-read/ROLLBACK/close/exactscope; chỉ có actual validated observation mới chứng minh actor/scope. Không nhận fake/exit0 thành DBcompatibility/release PASS |

## Hiện trạng kiểm chứng

Đã hiện thực đúng hai file v2, tổng37.765B. Launcher18.301B SHA `d5922503e1de275468bddf6d3f5bf1e5332ea54ae267497aa2110377c8b6755e`; test19.464B SHA `e3924502a0e9ec4ddcafdf00533a11cba7f634736730c89acc69f81dc4f27b3f`. Root so byte: launcher đúng v1+duy nhất `$null=`; builder so original11test prefix chỉ đổi source/public-fixture paths, thêm2cases, giữ negative assertions.

Caller [parent-body.txt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/parent-body.txt)9.961B SHA `8b949c85fc28e854f235074ebf419f90f5af018f0bb65b36268f647664c61825`. Delta được ghi trong [source-caller-bindings.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/source-caller-bindings.json): owner reference/pathv2/newmarkerexecution02/directsourcepinsv2 và provenance metadata; strictreader nguyên văn. Legacy manifest351115… và reviews chỉ bind helper/runtime; approval hiện hành phải kiểm từ **hai review v2 mới ở ngoài caller trước dispatch**, không nhận old review thay thế.

**Full suite13/13PASS,0FAIL/SKIP/CANCEL/TODO**, exit0, **14:34:47.5697638Z–14:35:05.476335Z**. [TAP](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/tests-01.tap) SHA `0f1885c6b66b13e63919c9a35f7169130f642773c031e835f88437b6295c5186`; [source-bound receipt](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/tests-verification-01.json) SHA `49cc496eea2016a516c70f887a416fafe563a893b191a9c70ca392426c479fbf`.12source/external pins trước/sau và read locks suốt suite,0drift, mọi parent handle đóng. Parser launcher/caller0errors.

Tám default/fake/public-policy checks (có metadata helper công khai), năm native contexts gồm ba ca cũ và hai regression12/13. Không gọi private inputs/DPAPI/protectedNodepg/actualprobe. Test13 lấy exact production reader giữa hai anchor và kiểm một dictionary được nhận, wrapper array bị từ chối. Các kết quả fake/metadata không phải actor/scope/DB PASS. Các replay reviewer nếu có không cộng unique counts.

Bước local source/test hiện đã có bằng chứng để review **SEC-OUT-01/02**; chờ SEC/EVC cùng APPROVE candidate trước actual conditional probe. Chưa có quyền DBwrite/push/CI/deploy/delete hoặc thay acceptance.


## Walkthrough và giới hạn

Đường đọc dự kiến: PLAN guard → helper/runtime140file pin/ACL/readlock → private inputs scope/CA/DPAPI → stdin child → strict39field observation → close → outer22field result. V2 chỉ bỏ output phụ của thao tác await, không đổi dữ liệu nghiệp vụ hoặc parser acceptance.

Caller mới có thể giữ manifest/reviews v1 làm provenance cho helper/runtime không đổi; current v2 approval là **gate SEC/EVC bên ngoài bắt buộc**, không suy từ old review. Candidate phải chứa exact caller body và regression13 đọc đúng reader của body đó; không tạo vòng tự-hash bằng cách để caller pin manifest chứa chính nó. Root phải đối chiếu source/review/candidate pins mới trước actual dispatch.

Giữ marker/source/receipts cũ; thiếu validated result của execution01 vẫn UNKNOWN. Runtime không duplicate, test không chạy protected Node/pg hoặc private inputs. UI không đổi, không cần Playwright. Hướng dẫn đọc code được cung cấp qua hồ sơ và links sau khi freeze; chưa nhận owner đã đọc/hiểu hoặc nghiệm thu.

Nếu actual probe đạt, đó chỉ là actor/scope metadata proof; Supabase legacy/contract2, cutover/backup/recovery/hosted/fullbackend và điều kiện push/Vercel còn phải đánh giá riêng trong phạm vi được giao. Chưa có quyền cập nhật Supabase hoặc phát hành.

## Metadata review và conditional gate

SEC/EVC cùng **APPROVE** candidate SHA `25941adaa3132e37e440809251fac080626529bf58591a04bedd28f3b8f9c782`,14files/115.417B+10refs. [SEC review](permission-protected-runtime-v2-sec-review-2026-10-16.md) SHA `80facd67209d50a34c883d526b2f543d0dd255427c5615ae4a675e088b70758e`; [EVC review](permission-protected-runtime-v2-evc-review-2026-10-16.md) SHA `759a5f7fb77fbd9ac358ea63cf0da59ce06fd1f292c9631d72968ce3bc6b29e0`. SEC-OUT-01/02 CLOSED cho v2; v1/history UNKNOWN giữ nguyên. SEC replay riêng12/13 dưới read locks,2PASS subset của13; EVC không rerun, không cộng replay thành unique cases. Không reviewer dùng credential/DB.

Clarification theo review: caller evidenceBudgetBytes262144 là mức phân bổ **execution02-only** thấp hơn; tổng source/prep/snapshots/docs/reviews/execution02 vẫn **524288B** do root đo ngoài. Field không code-enforced size guard/OSquota; không nới field hoặc thay source để giải thích.

[Prep closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v2-preparation-01/closeout.json) pin candidate/reviews/counts. Quyền owner call_4b7f8595c137482d88fd8ed31f9250cb đã bao gồm đúng một conditional probe; sau root predispatch pin/read-lock current candidate/source/parent/testreceipt/reviews, counts13/no-drift/reserve và execution02 absent đều đạt thì thực hiện, không hỏi lặp. Source/receipts/snapshot không đổi; metadata này supersede dòng chờ review. Chưa actual DB PASS ở checkpoint preparation này.

Actual closeout metadata: [probe v2](permission-protected-runtime-v2-execution-2026-10-16.md) đạt ACTOR_SCOPE_METADATA_MATCH,79/145/3 exact, TLS/READONLY/rollback/closePASS; SEC/EVC cùng APPROVE actual candidate `5e32f57857341652da8724322a01eb11e97a0b5f422bde1e917b60e8da3382a9`. Conditional authorization đã dùng đúng1invocation; newAttemptAuthorized=false. Prep snapshot trạng thái pending/startedfalse là checkpoint trước actual, không là hiện trạng. Không source/runtime đổi, DBwrite/pushCIdeploydelete.
