# Launcher dùng protected runtime — chuẩn bị local 16/10/2026

## Quyết định và phạm vi

Owner duyệt `call_f7792e1526f04c44a29f351267391dd5`: tạo đúng hai file launcher/test mới tại `D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1`, giữ bản cũ và module SQL/TLS/scope/rollback; kiểm bằng dữ liệu giả và review. Source/evidence dự kiến dưới256KiB trên D, dùng Node/PowerShell đã có, heap512MiB/concurrency2, không cài thêm/chi phí. **Chưa được đọc credential/private inputs, chạy probe PostgreSQL, sửa DB, push/CI/deploy hoặc xóa.**

Đây là slice công cụ của direct actor/scope probe đang có, không thêm requirement nghiệp vụ hoặc tạo change OpenSpec mới. Test plan và traceability của slice được ghi trong bảng dưới đây; không nhân lại bộ artifact của feature phân quyền.

[Runtime thật](permission-runtime-private-execution-2026-10-16.md) đã copy/kiểm offline PASS, SEC/EVC duyệt checkpoint SHA `9a5dce3cbb65dbf51bc8dbc0c9792e568208221a1df90deeb3528fa2262ea4a0`:140file/92.755.145B,32directories, private pg34CJS/network0 và post-audit hash/ACL PASS. Không dùng lại quyền copy/offline đó cho probe mới.

[Launcher cũ:47](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:47) kiểm Node alias có symlink, [dòng65](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/invoke-actor-probe.ps1:65) cũng chạy alias; module nằm ở thư mục cũ nên import pg về shared source. Bản mới phải dùng `node.exe` và `actor-probe.mjs` tại runtime root đã xác minh. Module giữ SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e`; SQL READ ONLY/repeatable-read/ROLLBACK, TLS verify-full, target/project và scope không đổi.

## Yêu cầu, test plan và traceability

| ID | Yêu cầu và phép kiểm cần có |
| --- | --- |
| PLR01 | Default PLAN trước mọi input/runtime read/effect; reference/switch chỉ là guard, không cấp quyền người dùng. Kiểm default và thiếu/sai reference bằng fake guard |
| PLR02 | Pin helper/manifest/proof và byte-identical probe. Pin/lock/hash/size đủ140runtime files, exact32directories/172ACL entries, owner/protected ACL current/SYSTEM/Administrators, no-reparse, không extra file. Mọi bước này trước private-input metadata hoặc credential load. Kiểm graph/pins sai, ordering và native helper công khai |
| PLR03 | Private inputs tương lai giữ đúng ba path trên D, protected ACL/current owner, type/bounds và scope/CA pins trước DPAPI. Dữ liệu thật không được đọc trong phase này; kiểm bằng fixture/fake, không đổi ACL hoặc copy input |
| PLR04 | Chỉ một Node child trong một invocation; executable/module/cwd tại protected runtime, env chỉ SystemRoot, payload qua stdin, heap512MiB/wait90s và cleanup hữu hạn. Module tự giới hạn một connection/read-only/TLS/rollback. Kiểm process specification và timeout bằng synthetic child, không pg thật |
| PLR05 | Chỉ xuất schema counts/booleans/hash/fixed stage/code đã kiểm; không raw stdout/stderr/exception, PIN/token/password/IDs hoặc Storage payload. Credential-load/child-start flags phản ánh từng bước thật; connection state UNKNOWN khi child lỗi không có proof. Kiểm success/failure schema, type/count/hash và secret-marker rejection |
| PLR06 | Finally đóng đủ locks/child/credential khi mọi bước lỗi; cleanup lỗi không trả PASS. Giữ handles xuyên credential/child, không retry/delete/overwrite; không tuyên bố .NET string đã zero hóa. Kiểm fault từng stage, close/dispose và output sau finally |
| PLR07 | Module/SQL/TLS/scope/rollback và runtime đã có không bị sửa. Pure/fake/native-public tests phải gắn source hashes/lệnh/counts; không nhận mock thành actor/scope online PASS. Kiểm identity/pins và current runtime metadata khi cần, không execute runtime lại |

## Implementation và kiểm chứng local

Đã tạo đúng hai file, tổng **33.847 B**: [launcher](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1) SHA `8ef30eaadf258fcee13595f4770339653b85730cf120cf88fce329e8ec092491`; [test](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.test.mjs) SHA `d134caeb827aa131330f3d6a3a0b5c02c4e5162fa391929b80fd3b43495bc439`. Bản cũ/runtime/module không đổi. Evidence ở [actor-probe-protected-runtime-run-01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-run-01), có intent/approval và Git baseline.

Walkthrough của source: [default:4](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:4) → [helper pin/lock và full function definitions:11](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:11) → [qualify/lock runtime:61](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:61) → [private inputs:87](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:87) → [DPAPI:112](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:112) → [child:144](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:144) → [strict output:162](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:162) → [finally:193](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1:193). Đã cung cấp đường đọc này; chưa nhận owner đã đọc/hiểu hoặc nghiệm thu.

Production flow tương lai khóa/hash/ACL đủ runtime trước mọi private-input metadata; giữ144public read streams xuyên các bước tiếp, sau đó mới thêm ba private input streams. File input giữ nguyên trên D, scope/CA pins cũ, credential không có hash công khai. Payload chỉ qua stdin, env chỉ SystemRoot, executable/module/cwd đều tại protected runtime. Chỉ một child, heap512MiB, wait budget90s chung cho stdin/exit; tối đa hai cleanup waits5s sau kill. Không phải total wall-clock hard cap hoặc quota OS. Output được dựng sau finally; failure/cleanup không trả PASS. Success connectionState=`CONFIRMED_ROLLED_BACK_CLOSED`; child-start/decrypt có thể `UNKNOWN` nếu call lỗi không đủ proof.

**11/11 kiểm thử PASS, 0 fail/skip/cancel/todo; syntax0errors.** [Root verification](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-run-01/root-source-bound-verification-01.json) lấy tám source/external pins trước và sau replay, giữ read locks xuyên test, không drift, đã đóng mọi parent lock. Lượt builder03 cũng11PASS nhưng không lấy hash ngay trước test; receipt nói rõ giới hạn đó, không bịa sample. Replay root khép phần binding cho source hiện hành, không tăng unique count thành22.

Tám ca default/fake/public-policy (có đọc metadata public helper trong một ca), và ba native contexts: payload/lock/Dispose bằng dữ liệu giả, child PowerShell synthetic, public runtime preflight. Đây không phải11ca thuần memory/no-OS. Public preflight gọi đúng `Lock-ProbeRuntime` rồi `Close-ProbeResources`, **140 files/32directories/172ACLobjects/144readstreams**, handlesClosed=true; không Inputs/Credential/Child, private flagsfalse. Không chạy protected Node/pg hoặc nhánh `-RunReadOnly` thật.

| Requirement | Test cases trong file, đánh số theo thứ tự |
| --- | --- |
| PLR01 | 1 |
| PLR02 | 2,3,6,11 |
| PLR03 | 4,6,9 |
| PLR04 | 6,8,10 |
| PLR05 | 5,7,8,10 |
| PLR06 | 7,9,10,11 |
| PLR07 | 2,3,11 |

TAP01 giữ10PASS/1FAIL do assertion getter SecureString.Length sau Dispose không throw theo giả định test; đã đổi sang method AppendChar xác nhận native disposal. Launcher bytes không đổi qua sửa assertion. TAP02 là11PASS trước bổ sung fake missing/invalid-reference guard trong case1. TAP03/root là current11PASS; test sources01/02 không snapshot đầy đủ, không nhận PASS lịch sử cho bytes mới. Source test/launcher hiện hành, TAP lịch sử và receipts được giữ, không xóa fixture.

## Recipe, budget và bàn giao

Replay bằng Node đã có: `D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2 D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.test.mjs`. Cần exact existing helper/manifest/proof/lock và public runtime; snapshot không kèm binary/cache hoặc private inputs. Source/helper/module được pin, không cài/tải thêm. Heap/concurrency chỉ là giới hạn process/test, không OS quota.

Command tương lai, **chỉ sau quyền probe mới**: `pwsh -NoProfile -File D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-v1/invoke-actor-probe.ps1 -RunReadOnly -ApprovalReference <NEW_OWNER_APPROVAL>`. Root caller phải pin/giữ read lock trên chính launcher đã review, kiểm lại external pins/C-D reserve30GiB, tạo invocation marker mới và chỉ gọi một lượt; lỗi dừng, không retry. Launcher không tự tạo file hoặc cấp quyền theo string reference. Pure/native fixture không chứng minh credential/connection/TLS/SQL online hoạt động.

Tại đầu phase C/D còn202.614.800.384/103.161.716.736B, đều trên dự trữ30GiB; phải đo lại trước actual probe. Source/evidence mới giới hạn dự kiến256KiB logical; không đo allocation vật lý và không nhận logical size là disk allocation. Runtime cũ đang dùng, không duplicate hoặc dọn. Artifacts local được Git ignore; docs thuộc worktree docs; chưa stage/commit/branch/push.

Chờ hai reviewer SEC/EVC APPROVE cùng frozen candidate trước bàn giao hoàn tất. Chỉ sau đó trình owner một quyền actor/scope probe mới dùng credential đã lưu. **Chưa đọc private input thật, chưa decrypt credential, chưa probe/TLS/actor/scope online hoặc DB compatibility PASS; chưa đủ điều kiện push/deploy.**

## Metadata review và closeout

**SEC và EVC cùng APPROVE preparation candidate01**, SHA256 `351115baa9cace254b0dacccdb56845d64301c19a823c2e3fc9c01dd8a79ec7b`, 13 files/100.868 B và sáu external prerequisites, không findings cần sửa. [SEC review](permission-protected-runtime-launcher-sec-review-2026-10-16.md) SHA `19ab52e7d74f9ad31f3347cadbadb0c632afa7758b890f86a4cfdeffad0cb2cc`; [EVC review](permission-protected-runtime-launcher-evc-review-2026-10-16.md) SHA `440cca01044640d4faa49e2c6e6dafc654ea02b52faee708310d05f06e4edfcd`.

Hai reviewer kiểm live/snapshot/prerequisites, scope, source và evidence. SEC replay5ca quyết định PASS, giữ chín public read locks xuyên replay; vẫn là subset của11unique cases. EVC không chạy thêm. Không ai chạy protected Node/pg, đọc private inputs/credential hoặc kết nối DB. Số kiểm hiện hành giữ **11/11**, không cộng các lần replay thành16/22ca.

[Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-protected-runtime-run-01/closeout.json) ghi source/review pins, Git HEAD/staged, dung lượng C/D và source/evidence budget. Metadata này nối thêm sau frozen body, supersede dòng “chờ reviewer” ở trên; source/receipts/snapshot không đổi. Giữ fixtures nhỏ và log lịch sử làm bằng chứng, không xóa dữ liệu.

Hoàn tất đúng hai file và kiểm local đã giao. **Đang chờ quyền mới cho đúng một actor/scope PostgreSQL probe chỉ đọc** dùng credential DPAPI đã lưu; không tự gọi `-RunReadOnly`. Quyền chuẩn bị này không cấp quyền probe, cập nhật Supabase, push/CI hoặc deploy.
