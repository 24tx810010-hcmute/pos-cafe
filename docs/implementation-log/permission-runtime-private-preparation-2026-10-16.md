# Chuẩn bị runtime riêng cho probe — 16/10/2026

## Kết quả và phạm vi

Owner chọn **chuẩn bị runtime riêng và gói kiểm local** qua `call_8c7d925b11ca4d56bb70055958e0237a`. Đã hoàn tất khảo sát integrity, manifest, helper sao chép, chương trình kiểm offline, recipe và kiểm thử local. Đây là bước chuẩn bị sau [run04](permission-private-probe-execution-2026-10-16.md), không phải retry lượt probe đã thất bại.

**Chưa tạo/copy runtime thật; chưa đọc credential/private inputs, chạy probe mới, sửa Supabase, push, CI, deploy, cài/tải package hoặc xóa file.** Thư mục tương lai `D:/Workspace/pos-cafe-db-probe-runtime-private` vẫn absent. Ba input đã tạo ở run04 được giữ nguyên. Quyền chuẩn bị không cấp quyền thực thi helper với `-Prepare` hoặc verifier với `-Verify`.

Source nằm tại [runtime-preparation-v1](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1), evidence tại [runtime-preparation-run-01](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01). Đây là công cụ local dưới artifacts trên worktree main, chưa là public push payload. Hồ sơ này và chỉ mục thuộc worktree docs. Không stage/commit hoặc đổi nhánh.

## Integrity đã xác minh

| Thành phần | Kiểm thực tế | Giới hạn |
| --- | --- | --- |
| Node v24.16.0 Windows x64 | HTTPS GET chính thức [SHASUMS256.txt](https://nodejs.org/dist/v24.16.0/SHASUMS256.txt), HTTP 200, 2.967 B; SHA256 `e20ebbf68d33f42d196a7a11b8a91d422fa37b759c0a51aa4857977135cc5e95`. Entry `win-x64/node.exe` và binary canonical đang có cùng SHA `b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3` | Tin cậy checksum qua HTTPS; chưa xác minh chữ ký GPG. Không tải binary |
| 14 package dependency của pg 8.23.0 | 14 archive có sẵn trong npm cache trên D, tổng 122.603 B, SHA512 khớp SRI của lock hiện tại; kiểm gzip/tar trong bộ nhớ, đầy đủ 138 installed files khớp kích thước/SHA256 với inventory archive | Không đọc cache/credential trên C, không npm install, không import/evaluate pg thật trong phase này |
| Probe module | Giữ byte-identical `actor-probe-retry-v3/actor-probe.mjs`, SHA `cb3d13b4f6d9844f64e2532b1c5098f5da6531426660b6d032957e8a56baf48e` | Copy tương lai đặt module tại runtime root để bare import `pg` resolve từ runtime. Chưa sửa/chạy probe |

Lock hiện tại được pin SHA256 `85969c1c161f74e9f68563182d99d1b0ac6fb5f17f5074444f329675ffd34e18`. Manifest gồm **140 file / 92.755.145 logical bytes**: Node 92.279.112 B, 138 package files 463.780 B, probe 12.253 B. Không cài optional peer `pg-native`; closure có pg-cloudflare để bao phủ nhánh optional đã khảo sát.

Manifest SHA `1408e6e8fabfd1fe4346b5d3369fbba044e57ac539d2abfc1b923bdc7235d0e4`; proof SHA `42d7159ef29634387cafa64e521c93485a0c00f5e129105be001515d667fd1f0`. [Qualifier:42](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/qualify-runtime.mjs:42) chặn archive quá giới hạn, tar link/extended header, Windows traversal/ADS/reserved name/case collision; [qualifier:122](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/qualify-runtime.mjs:122) so exact set và bytes, không nhận fingerprint local đơn thuần thành integrity.

## Helper và kiểm offline đã chuẩn bị

[Copy helper:44](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/prepare-private-runtime.ps1:44) kiểm graph manifest/proof/lock và pins cố định; không nhận đường dẫn, số file hoặc trần dung lượng tùy ý từ caller. [Source locks:182](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/prepare-private-runtime.ps1:182) giữ handles đọc, hash đủ nguồn trước tạo target. [Copy:298](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/prepare-private-runtime.ps1:298) chỉ nhận target mới, DACL protected cho current user/SYSTEM/Administrators, owner hiện tại, không reparse, file CreateNew và ACL trước khi copy bytes. Xác minh lại hash/size/ACL và exact inventory; lỗi thì đóng handles, giữ partial state, không overwrite/delete/retry. Helper SHA `a0d9890785e22266c9331b5abf80fa60627d2322a3c848d36de6d53765d46430`.

[Public preflight02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/public-runtime-preflight-02.json) dùng đúng hàm/adapter đọc nguồn trích từ AST helper đã pin và khóa trước đánh giá: **PASS 140 runtime files / 144 public source streams**, thêm một handle khóa helper; mọi handle đã đóng. Kiểm cả owner/ancestor/no-reparse, hash/size và target-new metadata; **0 thư mục/file runtime tạo**, không gọi CreateDirectories/Copy. Utility đã thay cách nạp AST bằng ScriptBlock.Create và pin/lock helper trước parse; receipt01 giữ làm lịch sử, receipt02 là bản hiện hành.

[Offline program generator:3](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/offline-runtime-check.mjs:3) và [verifier:10](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/verify-private-runtime-offline.ps1:10) được chuẩn bị cho bước sau: hash/lock toàn bộ protected runtime, env Node chỉ SystemRoot; kiểm ESM entry nằm đúng private pg và CJS dependency không fallback shared source; chặn các API kết nối/DNS được pg dùng trước network. Chỉ import pg và dựng Client bằng password synthetic, không gọi connect. Chương trình này không phải sandbox bảo mật tổng quát và chưa chạy trên pg/runtime thật; test hiện tại dùng module giả công khai.

## Kiểm thử gắn với source hiện hành

[Full verification02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/runtime-preparation-full-verification-02.json): **28/28 PASS, 0 fail/skip/cancel/todo**, source không đổi trong lượt kiểm; ba PowerShell file syntax 0 lỗi. Node có sẵn v24.16.0, heap 512 MiB, concurrency 2. Hai entrypoint mặc định trả PLAN trước input read/effect. Đây không phải giới hạn CPU/RAM của OS.

| Nhóm | Số ca | Phạm vi |
| --- | --- | --- |
| Qualifier | 7 | Archive/SRI/path/link/collision/bounds và exact installed mapping |
| Copy helper | 15 | 14 pure/fake/static/default checks; 1 native fixture công khai kiểm DACL-only/CreateNew/hash/read-lock bằng đúng helpers |
| Offline | 6 | 3 generator/default checks; 3 native fixture công khai: resolve graph giả local, từ chối shared fallback trước evaluate, chặn synthetic connect trước socket thực |

Tổng **24 non-native + 4 native synthetic**, không cộng public metadata preflight thành test DB. Không có phép đo actor PostgreSQL, TLS credential hoặc scope79 mới. Native fixture dùng ProcessStartInfo/Environment.Clear giống verifier dự kiến; lượt đầu 7 PASS/3 FAIL vì Node child_process tự thêm env Windows đã bị guard từ chối, đã lưu receipt và source lịch sử trong `initial-offline-test-*`. Đổi harness sang API dự kiến, giữ guard; không giấu lỗi cũ hoặc nhận fixture thành hosted PASS.

Replay theo [recipe.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/recipe.json): chạy đúng ba test files với `--max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2`; qualifier `--check-existing-public` chỉ đối chiếu public sources. Snapshot có source/receipts, không chứa Node/cache/installed package bytes: replay integrity cần đúng external prerequisites và pins đã ghi. Không nhận snapshot là môi trường tự chứa đầy đủ.

## Ngân sách và bước cần duyệt tiếp

Source/evidence hiện có trước freeze khoảng 260 KiB logical, budget phase 1 MiB; closeout sẽ đo lại gồm snapshot, docs/review mới và fixtures. Không đo file allocation, không nhận logical size là dung lượng vật lý chiếm ổ. Artifact root online-compatibility đang khoảng 3,53 MB logical, dưới budget riêng 10 MiB. Không dọn dữ liệu hoặc tạo môi trường nặng mới. C/D tại checkpoint sau test còn khoảng 202,85 / 103,34 tỷ bytes; cần đo lại trước bước ghi lớn.

Nếu được owner duyệt riêng, recipe tiếp theo là tạo đúng runtime trên D và **một kiểm offline không credential/DB sau copy verified**. Ước tính tăng **100–150 MiB**, đỉnh dự trù **150–250 MiB**; source payload 92.755.145 B, allowance gồm metadata/evidence/temp. Copy helper chặn logical payload trên 250 MiB; yêu cầu C còn ít nhất 30 GiB, D trước copy còn ít nhất 30 GiB + 250 MiB. Đây là guards chương trình và dự trữ vận hành, chưa là quota OS.

Outer controller tương lai theo recipe cần pin/lock source review, marker CreateNew cho một invocation, timeout copy 90 giây và offline parent 30 giây; verifier đã có Node timeout 15 giây/heap512 MiB. Hai bước tuần tự, tối đa một process mỗi bước. Controller thực thi chưa chạy trong phase này. Mọi lỗi dừng, giữ receipt/partial, không tự retry/xóa. **Chưa có quyền mới cho create/copy runtime hoặc offline thật, và bước đó vẫn không cấp quyền dùng credential/probe PostgreSQL.**

## Báo cáo và phát hành

Có thể báo cáo đã xác minh nguồn Node và dependency closure, xây helper copy có ACL/pins/locks, chuẩn bị offline qualification và đạt 28 kiểm local. Không báo runtime thật, actor/scope, database contract 2, cutover hoặc Vercel thành công. Hai trust gaps của run04 có phương án cụ thể đã kiểm local; chưa đóng execution gaps trước khi protected copy/offline thật đạt.

[Online compatibility](permission-online-compatibility-2026-10-16.md) vẫn cho thấy backend legacy; backup/recovery, hosted profile/control và full backend gates còn mở. Chưa đủ điều kiện push phát hành khi main kích hoạt Vercel Production; giữ lệnh chưa push. Tailwind 3 tiếp tục theo quyết định owner, không mở lại yêu cầu nâng Tailwind 4.

Walkthrough được cung cấp qua chuỗi: official bytes → bounded archive qualification → pinned manifest → khóa nguồn/ACL copy → offline resolution/no-connect → quyền riêng cho execution. Chưa nhận owner nghiệm thu/đã đọc hiểu. SEC/EVC review final candidate được ghi riêng; chưa lấy review preparation thay quyền execution hoặc production gate.

## Metadata review và closeout

**SEC và EVC cùng APPROVE preparation/recipe candidate-01**, SHA256 `14d532a575b1a30a38619a736593139c124e35212b5b33b59c4cc21677eb227d`, **30 files/297.755 logical bytes**, không finding cần sửa. [SEC review](permission-runtime-private-preparation-sec-review-2026-10-16.md) SHA `591c8c8b6f88425ca92f729b7366fa28e2e8033f7fb39cdc28fc0dc524b1dc15`; [EVC review](permission-runtime-private-preparation-evc-review-2026-10-16.md) SHA `a632a6dff589bd1666acf6ad9d4d4af489ff1dcced09005861247bb9106a1b89`.

Hai reviewer kiểm đủ live/snapshot pins và độc lập recompute public integrity, đều PASS. SEC replay 20 ca, EVC replay 7 ca — đều là subset của 28 ca hiện hành, không tăng số ca unique. SEC public preflight PASS, 0 target writes, handles closed; reviewer chỉ tạo bốn fixture công khai nhỏ, giữ nguyên. Không reviewer nào chạy actual protected runtime, đọc credential, kết nối DB hoặc dùng quyền execution.

[Closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/closeout.json) lưu review pins, kiểm lại source/snapshot, ngân sách logical, C/D reserve, Git HEAD/staged entries và target absent. Hai doc metadata này được nối thêm sau frozen body, không sửa source hoặc receipts đã review. Snapshot là căn cứ immutable; các dòng “chờ review” trong snapshot/index được metadata này supersede. Dữ liệu source/evidence gọn được giữ để đối chiếu; chưa xóa temp hoặc runtime cũ.

Hoàn tất đúng preparation được giao. **Bước đang chờ quyết định owner là create/copy runtime + một offline qualification có điều kiện**, chưa có quyền thực hiện. Outer controller phải được làm cụ thể, kiểm/review pins/locks/markers/timeouts trước execution; review preparation không nhận controller planned thành implementation. Credential-bearing PostgreSQL probe, DB compatibility và push/deploy vẫn chưa được duyệt hoặc xác minh hoàn tất.

## Bổ sung controller local trước xin quyền execution

Để gói execution đủ cụ thể trước khi hỏi owner, đã viết thêm đúng hai file controller/test trong phạm vi preparation đang có. [Controller](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-v1/invoke-private-runtime-preparation.ps1) SHA `0f7c4273a836b68b764c5594ec2177fc1522e0e2a59a36c228b68da21ec1efdb`; test SHA `16b904ad71ee9c42193dbb03f758b02671accf44bd8a12e8e772e3b36ad0b1c9`. Không sửa copy helper, offline verifier hoặc chương trình offline đã review. Candidate01/closeout01 giữ nguyên checkpoint trước bổ sung này; recipe hiện hành nối controller và pin mới.

Default controller trả PLAN trước read/effect. Nhánh execution tương lai giữ lock trên 5 public inputs đã pin, kiểm owner/no-reparse và dự trữ C/D, bắt runtime và receipt root mới hoàn toàn; tạo receipt/marker bằng CreateNew trong root protected. Đúng một child copy, chỉ khi exit/shape/counts/handles VERIFIED mới lưu safe result, đo lại C/D và tạo marker cho đúng một child offline. Lỗi dừng, đóng handles, giữ partial, không retry/overwrite/xóa. Output chỉ schema allowlist/counts/stage/booleans/elapsed, không raw child output/error hoặc credential. Receipt root tương lai cố định `artifacts/permission-online-compatibility-20261016/runtime-execution-run-01`, hiện chưa tạo.

Child copy timeout 90 giây; child offline timeout 30 giây, Node bên trong 15 giây/heap512 MiB. Mỗi child có thể thêm tối đa hai lần chờ shutdown 5 giây sau kill; **90/30 giây không là tổng wall-clock hard cap**. Root lúc thực thi phải kiểm và giữ read lock trên chính controller đã review. Chưa có quota OS CPU/RAM/disk; các bước tuần tự và payload/disk guards giữ như recipe.

Rà draft phát hiện loader dùng riêng AST Body làm mất formal parameters; đã sửa lấy full definition và chỉ qualify function scope, giữ nguyên parameter/body. Native fixture dùng đúng loader production trên helper thật đã pin/read-lock, kiểm metadata/DACL và CreateNew receipt. Không chạy toàn adapter Validate hoặc CreateRun thật, không nhận fixture là execution pipeline đã chạy.

[Full verification03](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/runtime-preparation-full-verification-03.json) chạy cùng bốn test files: **35/35 PASS**, 0 fail/skip/cancel/todo; 14 source pins không drift, recipe controller pin khớp, 4 PowerShell syntax checks 0 lỗi. Gồm 28 ca cũ + 7 ca controller mới; **29 non-native + 6 native synthetic**. Hai native mới là bounded public child process và public helper-loader/ACL/receipt, không runtime/pg thật. Không cộng các lượt replay thành ca unique. Replay hiện hành thêm `invoke-private-runtime-preparation.test.mjs` vào ba file trong recipe cũ, vẫn heap512/concurrency2.

Composite candidate02 dùng lại các snapshot candidate01 không đổi, chỉ snapshot bytes mới/đổi và pin mọi nguồn/receipts trong một manifest mới, tránh nhân đôi toàn bộ bằng chứng. SEC/EVC phải review controller delta + recipe/docs và final35 evidence trước bàn giao. **Runtime và future receipt root vẫn absent; không dùng credential/DB, chưa có quyền `-Execute`.** Kết quả này bổ sung implementation controller local, không thay giới hạn actual-runtime/online còn mở.

### Closeout controller — trạng thái hiện hành

**SEC/EVC cùng APPROVE composite candidate02**, SHA256 `7e135630001be578af40d77a420e9f3186201fb9911254891c7ac94d331d4ae9`, 36 file tham chiếu/339.705 B; 27 snapshot dùng lại, 9 snapshot mới/đổi 86.833 B, không findings. [SEC delta](permission-runtime-controller-sec-review-2026-10-16.md) SHA `5aafef32d9536dccb0d93471e1a12b8a6d51f29c031de6df910bc992f9643eea`; [EVC delta](permission-runtime-controller-evc-review-2026-10-16.md) SHA `47f94f86fe9de118bf80fd92c9bf0e9e34b89172d0d5c03e9c9e8b33e5f10d1d`. SEC replay riêng 7 ca controller PASS, vẫn là subset của 35; EVC không chạy thêm. Controller implementation/tests local đã hoàn tất review, supersede các dòng “controller planned/chờ review” ở checkpoint trước.

[Closeout02](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/runtime-preparation-run-01/closeout-02.json) lưu xác minh cuối, budget và quyền còn chờ. Metadata tổng tham chiếu trong manifest draft đầu bị null do phép cộng PowerShell trên dictionary; đã sửa bằng cộng explicit rows trước dispatch và giữ nguyên bản initial cùng SHA. Cả hai reviewer xác nhận file rows/source/test không đổi qua correction; không dùng draft metadata làm kết quả cuối.

Gói chuẩn bị hiện đạt **35/35 local checks**, đã đủ source cụ thể để xin quyền tạo/copy runtime và một kiểm offline có điều kiện. Chưa chạy full production Validate/Execute hoặc tạo hai đích thật. `artifacts/` được `.gitignore:2` loại khỏi push mặc định; docs mới vẫn cần được chốt trong public payload khi owner ra lệnh push. Không xóa file hoặc dùng runtime thật/credential/DB; push/deploy chưa được phép và compatibility vẫn mở.
