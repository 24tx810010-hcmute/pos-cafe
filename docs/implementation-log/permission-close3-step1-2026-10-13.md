# CLOSE-3 bước 1 — binding, backup bảo toàn và restore, 13/10/2026

**Addendum review:** SEC rồi EVC cùng APPROVE candidate-01 SHA `30fd08622c79528ca77579d9b30f3ac86e2ecba78dcda1784259e8a506d25ad4`; [verdict](../reviews/2026-10-13-permission-close3-step1.md). Chỉ bổ sung metadata review sau snapshot; gate phát hành vẫn BLOCKED, dừng trước bước kế tiếp. Các câu chờ review bên dưới ghi trạng thái lúc khóa.

## Phạm vi và kết luận tại checkpoint

Người dùng giao kiểm binding rồi backup mới, làm tuần tự, báo kết quả rồi dừng trước phần tiếp theo. [Bàn giao](../workflow/tasks/permission-close3-step1-2026-10-13.md) ghi nguồn ủy quyền. Chỉ có hosted reads/download/dump; writes phục vụ restore chỉ trên target local mới. Không cleanup/activation/Storage deletion/deploy/frontend/postflight live; không stage/commit/push/reset/stash/switch. Không đổi requirements, allowlist DELIVERY03 hoặc settings provider.

**Backup bảo toàn mới đã tạo và restore thực. Gate phát hành vẫn BLOCKED.** Binding danh tính/compiled configuration có bằng chứng mới; restore dữ liệu và Storage đạt các phép kiểm bên dưới, nhưng strict DB comparison là **74/75** vì sequence Auth đổi trong cửa sổ backup. Có **2 cửa hàng ngoài allowlist77**. Đây không phải CLOSE-3 hoàn tất, owner acceptance hay quyền sang cleanup.

Main HEAD `5156820f7d6679cd6f8051bdc38419737ffa0c7e`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; cả hai dirty. Source31 fingerprint `d634c641a8a8c9af83f34fa9e9650ec20071b1d5eae34745d3f857830aceca1a`, bundle `36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70`. Đối chiếu đầu phiên: 812 source entries không drift; 50 absolute references của candidate CLOSE-2 SHA `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492` khớp. Script hỗ trợ của bước1 nằm dưới artifacts trên main, không đổi application source31.

## Binding mới và giới hạn capability

| Phép kiểm | Kết quả mới | Giới hạn |
| --- | --- | --- |
| Supabase Dashboard | `pos-cafe-demo`, account `24tx810010-hcmute`, Org hiển thị `24tx810010-hcmute's Org`, project `kfqjdfwxhkdwihjobpny`; URL `https://kfqjdfwxhkdwihjobpny.supabase.co`; Healthy, Sydney/NANO | Không có immutable org ID hoặc thử quyền write/deploy; banner provider đang điều tra technical issues không được diễn giải thành outage của project |
| DB TLS/capability | 07:20:48Z và snapshot 07:27:51Z: pooler định danh project, TLS CA verified; database/actor/session_user `postgres`, PG17.6, READ ONLY; provider matcher true | Native SET hook và Storage ownership false; supported provider profile true không chứng minh hosted DDL/reload. Không thử cấp quyền hay sửa role |
| Catalog | catalog `f331650154b5109790626fb9343fca0de5d081f41b42110b666df975193ff13c`; release catalog `7781f5fb0b4c2c2cbcdd7c02f1ffd71fcedc6d1593a6d39519adaa880ea8c84d`; FK closure 33 relation | Chỉ observation; exact77 controller/provider rehearsal còn thiếu |
| Edge/Storage | Edge Dashboard chưa có deployed function; public bucket `menu-item-images`, 4 policies, 5MB, JPEG/PNG/WebP; staging absent | Candidate JWT settings/runtime và deploy capability chưa chứng minh. Không gọi list metadata là gateway runtime PASS |
| Vercel | Team `24tx810010-hcmutes-projects`, Hobby; project `pos-cafe`, ID `prj_7xwZL8MUEccVL2o0EvxoCtIYJ1en`; repo `24tx810010-hcmute/pos-cafe`; Production/main; domain `pos-cafe-azure.vercel.app` | Deployment hiện tại `DqnFhDaswqUcqiryL6A2XwDfMmHY`, commit `5156820…`, khác inventory09/10. HEAD commit không chứa dirty SOURCE31 |
| Auto deploy/assignment | Git connected; mỗi push main tạo Production deployment; Auto-Assign Custom Production Domains checked; không deploy hook | Đã thấy control trên UI nhưng chưa thay/kiểm hiệu lực. Kênh cần chuẩn bị trước push là tắt auto-assignment theo quyền riêng, tạo deployment chưa promote rồi promote frontend sau backend. Chưa thực thi hoặc chứng minh quyền write trên kênh này; không push trước khi gate đó đạt |
| Compiled binding | 07:24:58Z: bundle JS `index-CfdNnUcO.js` SHA `74bc45fea095942a74ca64f31ddd8712ed3143d04b1ad9c7ec25d6eeeb073eac`, 1.405.737 byte; composition có mode Supabase, đúng URL; publishable key của bundle được GET `/auth/v1/settings` đích chấp nhận HTTP200 | Không tiết lộ key/env values. Ba env names/scopes thấy trên Dashboard chỉ là metadata; chưa decrypt env project/next deployment, chưa kiểm browser business flow/runtime release |

Receipt chỉ đọc: [DB/catalog/inventory](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/binding-inventory-safe.json), [compiled key](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/compiled-key-binding.json), các `*-ax.txt` trong cùng thư mục. AX đã lưu sau khi tải; browser evidence timestamp chỉ là lúc lưu cuối, không giả từng trang có cùng observation instant. Hai tab task tạo đã đóng.

## Drift và quyết định backup bảo toàn

Baseline gốc có SHA `f231f4bc811d2d0551a2e3f4c23ff87696f9e9ede832c2c2f162073ee8a15af0`. Bản ở Temp đã mất; đã tìm lại byte-identical tại private `backups/helper-source-48130cc1aac37e39/scope-inventory.json`. Không tái chọn allowlist từ live.

Đích có đủ77 UUID gốc, **thêm2 store**, tổng79; Auth145. Hai store mới tạo `2026-10-10T11:09:34.979Z` và `2026-10-12T04:05:39.432Z`. Có dữ liệu ở11 bảng liên quan (employee sessions, employees, menu, floor, settings), không được coi tự động là TEST hoặc disposable. UUID/tên/raw catalog giữ private. Trong snapshot restore có77 Auth cùng77 store đã duyệt,68 Auth ngoài tập đó, gồm2 store mới và66 ngoài scope lịch sử. Không mở rộng cleanup bằng prefix, thời gian hay tổng số hiện tại.

**DEC-CLOSE3-STEP1-01**, AI chọn trong quyền backup ngày13/10: tạo một **preservation-only backup** của toàn79 store, không tạo proof controller exact77. Lý do: giữ cả dữ liệu mới trong khi dừng phần phụ thuộc allowlist; từ chối bỏ2 store khỏi backup hoặc sửa baseline thành79. Helper gốc giữ nguyên. Helper hỗ trợ mới pin nguyên baseline77, pin inventory79, bắt snapshot store set khớp chính xác79; manifest ghi `storeBaselineExactMatch=false`, `preservationStoreCount=79`, `cleanupEligible=false`. Controller nguồn31 từ chối proof kiểu này theo [cutover:161](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:161). Đây không phải nới gate phát hành.

## Backup và restore thực

| Mục | Kết quả | Bằng chứng |
| --- | --- | --- |
| DB backup mới | Snapshot giữ từ **07:30:36.638Z đến07:39:53.039Z** (14:30–14:39 Bangkok). pg_dump/custom/create, TLS verified, READ ONLY. 63 TABLE DATA, toàn schema/owner/ACL/Auth, roles không password verifier, sequence, catalog hashes, full-row count+digest | [Backup receipt](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/backup-result.json); private `backups/database-20261013T073030255Z-0c33f5ee` |
| Hash/archive | Dump869.498byte SHA `72d8ddc864056817b9a2623386575cf78401b83a7004923418b25ebf1863917c`; manifest SHA `58edebb8d2c7b50f13b702d5ad6315da329822a401a31aec846bf10c56086a63`; toàn file hashes/SHA256SUMS và1051 TOC entries được kiểm | Archive/list đọc được là bước trước restore, không gọi là restore |
| DB target mới | `pos-cafe-restore-1791877272165-22c10807`, volume mới, image PG17.6 pin `694296…`; network none, port0, no bind mount, Unix socket `/restore`, cron/network workers không khởi động | [Target](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-target.json), [execution](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-execution-safe.json) |
| Restore tables | `pg_restore` thực exit0; toàn63 table data/count/fullrowdigest khớp; có79 stores/145 Auth/83 orders/70 payments/3 Storage metadata | [Scope](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-scope-safe.json) |
| Catalog/ACL/role | Lượt đầu72/75, sai schemas/grants/Auth sequence. Fresh catalog supplement schemas/grants SHA khớp archive;28 grant rows thiếu được bổ sung chỉ clone;30 role flags và21 memberships khớp; extension member owners/version/schema và database metadata khớp | [Supplement](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/catalog-supplement-safe.json); giữ comparison-before-acl private |
| Strict comparison | **74/75, FAIL còn1**: `auth.refresh_tokens_id_seq` đổi327→328 trong backup. Không xóa receipt hoặc đổi expected của verifier | [Final strict result](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-comparison-final-safe.json) |
| Sequence supplemental | Ba restored sequence bằng đúng `setval` trong archive. Auth value328, snapshot maxID327, next329 tránh trùng ID của snapshot. Hai sequence còn lại166/3017 không đổi | [Scope](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/restore-scope-safe.json). Không override strictFAIL; sequence không thuộc MVCC, không bảo toàn giao dịch sau snapshot bằng cách restore cũ lên live |
| K/payload/R1 | `public.write_operations` **0 row** trong nguồn snapshot và clone; fullrowdigest khớp | Không có K thực để diễn tập phục hồi K ở backup này. Proof lịch sử2/2 nguồn25 giữ nhãn lịch sử, không tạo fixture/live K cho đủ số |
| Storage backup mới | 07:40:19–07:40:29Z, **3/3 object,912.478byte**; cả metadata lẫn payload; 2 approved objects khớp source ID/bucket/path/version/size/SHA của manifest cũ;1 ngoài scope được lưu. Toàn metadata trước/sau tải không đổi, diskSHA khớp | [Backup Storage](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/storage-backup-safe.json) |
| Storage restore mới | New project `pos-cafe-close3-storage-20261013`,12containers mới/loopback, empty DB/Auth/buckets trước; private bucket mới; POST rồi GET readback actual Storage API **3/3**, size/SHA/MIME khớp | [Restore Storage](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/storage-restore-safe.json) |
| Teardown |14 owned containers stopped, giữ volumes/networks; owned WSL keepalive stopped sau identity check; không đụng retained targets trước | [Teardown](D:/Workspace/pos-cafe/artifacts/permission-close3-step1-20261013/teardown-safe.json) |

Private raw/catalog/payload và DB backup được giữ ngoài Git; ACL thư mục mới chỉ current Windows account +SYSTEM. Không upload backup. Manifest candidate public chỉ chứa path/size/SHA và receipt sanitized. Docker volumes chứa dữ liệu phục hồi được giữ local; không coi là backup cloud hay PITR.

Extension/bootstrap supplement là **một quan sát mới sau cửa sổ archive**, dùng cho cả bootstrap role và member owners; không phải cùng exported snapshot. Full-row/canonical catalog hashes trong archive vẫn là phép kiểm chính. Logical dump không bảo đảm root-key recovery/Vault/extension-owned non-config payload, provider physical volume hay PITR. Storage payload/metadata before-after là snapshot khác DB; metadata3object đã đối chiếu nguyên vẹn với DB clone. Storage API restore dùng metadata local mới; metadata gốc được proof riêng ở DB clone, không gọi hai target thành full hosted Supabase recovery trong một lần.

## Các thử chưa đạt và cách xử lý

- Probe frontend đầu giả key kiểu JWT nên không tìm thấy key; đã xác định bundle dùng publishable key. REST root401 “Secret API key required” là endpoint không phù hợp để xác minh publishable key; giữ receipt401, kiểm `/auth/v1/settings` HTTP200. Không nhận401 đó là app bị hỏng, cũng không bỏ qua để gọi full runtimePASS.
- Read inventory đầu bị chặn trước kết nối vì file Temp mất. Tìm bản private khóa hash giống nguyên gốc rồi đọc lại thành công; không tái tạo inventory theo dữ liệu mới.
- Wrapper backup ghi stdout từ child thẳng ra console nên Tee không tạo execution transcript như dự định. Receipt được dựng từ manifest/file hashes thực, không dựng lại raw transcript. Các stage đã quan sát trong tool history; proof chính là artifacts+restore.
- Strict restore đầu72/75, sau ACL74/75; giữ cả hai. Sequence là drift nguồn thật, không sửa clone hay metadata backup để ép khớp.
- Lượt dừng keepalive đầu từ chối do JSON datetime được PowerShell parse thành DateTime thay vì string. Lượt sau đối chiếu PID/name/UTC ticks rồi mới stop đúng process; không broadkill/WSL shutdown.

## Cổng còn mở và việc tiếp theo

1. **Không sang cleanup/activation.** Cần đối chiếu ý định của chủ dự án đối với2 store mới; giữ chúng cho đến khi có quyết định cụ thể. Quy trình hiện tại cần tenant rỗng sau cleanup77 nên không thể tự chuyển thẳng sang activation khi còn2store; không tự đổi controller hoặc DELIVERY03.
2. Backup mới là bản bảo toàn đọc được và dữ liệu restore khớp; strict sequence-stability chưa đạt. Trước cutover phải có cơ chế quiescence được duyệt, backup/proof mới thích hợp và recheck dưới khóa; không rollback live về snapshot này sau giao dịch mới.
3. Provider/native rehearsal matching profile/binary, exact77 controller proof, reload/prepare recovery, Edge/JWT/runtime, quota/CDN/cost và kênh controlled frontend rollout còn chưa thực hiện. Không có quyền sang các bước đó từ checkpoint này.
4. Project env values/next deployment binding và write/deploy capability chưa chứng minh. Control auto-assignment hiện bật; không có push/release trước khi cơ chế điều khiển được duyệt và xác minh.

Review độc lập SEC rồi EVC trên exact candidate cuối là gate bàn giao hồ sơ; approval của **tính chính xác hồ sơ PARTIAL/BLOCKED** không thể biến strictFAIL hoặc inventory drift thành PASS. [Review](../reviews/2026-10-13-permission-close3-step1.md) sẽ ghi verdict/candidate. Walkthrough đã cung cấp theo source binding → exported snapshot → restore tables/catalog → Storage payload; chưa có phản hồi owner acceptance.
