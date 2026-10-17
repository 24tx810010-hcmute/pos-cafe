# Runbook phát hành phân quyền — bản nháp 08/10/2026

## Trạng thái và phạm vi

Đây là bản nháp vận hành phục vụ **PERM-T17**, được viết trong slice runbook/gate mapping nhỏ đã được chủ dự án duyệt. Slice hiện tại gồm tài liệu và kiểm local/mock/unit/UI theo ủy quyền đã ghi trong [biên bản readiness](../implementation-log/permission-runbook-readiness-2026-10-08.md) và [bàn giao readiness](../workflow/tasks/permission-runbook-readiness-2026-10-08.md). Sửa hẹp lỗi mock `imageUrl` là ủy quyền riêng trong cùng phiên. Tài liệu này không cấp quyền chạy live mutation, cleanup Storage, deploy, commit hoặc push mới. Những bước tương lai dưới đây chỉ được chạy sau khi có ủy quyền đúng môi trường/hành động.

**Chưa đóng T15, T16, PIN-T06, T17 hoặc T18.** T15 là gate tổng hợp; T16 là diễn tập chuyển đổi/rollback và full gate trên source cuối; T17 cần cả bằng chứng và review phát hành; T18 cần thực thi được cho phép và postflight. Các tiêu chí giữ nguyên trong [tasks phân quyền](../../openspec/changes/redesign-permission-model/tasks.md#perm-t15--gate-tổng-hợp-bảo-mật-và-runtime-thật). Runbook có thể được review như một tài liệu nháp mà không làm các task đó đạt.

Đầu vào của phiên: main HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`, cả hai có working tree chưa commit. Đây là baseline tham chiếu, **không phải source lock cuối**. Fingerprint, snapshot phục hồi được, kết quả kiểm cuối và reviewer verdict phải lấy từ biên bản readiness; không tái dùng các số test/fingerprint lịch sử làm kết luận cho candidate đang sửa.

Quyết định **DELIVERY-03** là cleanup đúng **77 TEST stores** trong inventory đã được xác minh, thay mapping lịch sử 77 admin→owner. Không áp mapping cũ vào đích rỗng sau cleanup. Không mở rộng tập xóa bằng prefix, ngày tạo hoặc truy vấn “mọi store”. Nếu inventory mới có store/Auth user ngoài tập đã duyệt, bảo toàn chúng và dừng phần bị ảnh hưởng để đối chiếu. Nguồn quyết định và thứ tự cutover: [design mục 8.2.1](../../openspec/changes/redesign-permission-model/design.md#821-cutover-sau-cleanup-dữ-liệu-test-theo-delivery-03), dòng 262–278.

## Những gì inventory đã và chưa chứng minh

| Nguồn | Bằng chứng sử dụng được | Khoảng chưa chứng minh, bắt buộc giữ mở |
| --- | --- | --- |
| [Edge/Storage inventory 07/10](../workflow/tasks/supabase-edge-storage-inventory-2026-10-07.md) | Dashboard đúng project; hai candidate functions và private staging absent trong list; legacy public bucket và bốn policies còn hiển thị | List metadata không chứng minh quyền deploy, JWT runtime, Storage API/bypass/cache, exact object payload hoặc cleanup |
| [Vercel inventory 07/10](../workflow/tasks/vercel-binding-inventory-2026-10-07.md) | Đúng repo/project/domain; Production dùng main; auto-assign bật; ba tên Vite env hiện diện ở UI | Secret presence/scopes không chứng minh giá trị hợp lệ, compiled data mode, frontend/backend binding hoặc capability deploy |
| [Provider guard 06/10](../implementation-log/permission-provider-capability-guard-2026-10-06.md) | Guard nhận full supported provider profile; rehearsal local pin binary chạy prepare/restore/image rollback với native flags false | Không chứng minh hosted binary/config/DDL/reload giống local; không chứng minh full product hoặc cleanup gate trên source mới |

**STOP trước bất kỳ push main nào:** Vercel đang có tự động phát hành Production theo main. Push có thể phát hành frontend trước backend. Phải xác minh cơ chế điều khiển rollout và có quyền thực hiện cơ chế đó trước push/release; không suy rằng push chỉ lưu code, hoặc env đã có là runtime đã bind đúng.

## Gói bằng chứng operator phải chuẩn bị

Operator giữ một manifest phiên phát hành gồm source/bundle fingerprint, snapshot/patch chứa cả file mới và tests, docs candidate, reviewer scope/verdict, execution profiles, runtime/dependency versions, thời gian UTC, command/config ID, exit code, counts pass/fail/skip và artifact path/hash. Không ghi credential, DSN, PIN/hash, JWT, service-role key, PAT hoặc giá trị env vào docs/log. Secret handoff dùng kênh được duyệt; hồ sơ chỉ ghi tham chiếu và binding không secret.

Một người điều phối giữ quyền chạy fixture tại một thời điểm. “Lease” ở đây là kiểm soát vận hành: ghi người giữ, fixture/profile, thời gian bắt đầu/kết thúc; không giả hệ thống có API lease. Suite reset cùng DB chạy tuần tự. Identity fixture phải có marker, dedicated container/volume/project, loopback, store IDs/checksum/schema đúng; các service Auth/REST/Realtime/Storage/Edge và observer phải được chứng minh cùng deployment/DB trước ghi kết quả service. Tuyệt đối không fallback `.env`/`.env.local`, không tạo marker giả trên live. [design:361–375](../../openspec/changes/redesign-permission-model/design.md#111-evidence-theo-nguồn-và-pha-thực-thi) và [identity runtime:45](../../../pos-cafe/scripts/permission-identity-runtime.mjs:45) là nguồn ràng buộc.

## Trình tự vận hành và cổng dừng

| Bước | Hành động, bằng chứng đầu ra | STOP và cách tiếp tục |
| --- | --- | --- |
| 1. Khóa candidate | Chốt bytes source/test/scripts/bundle và snapshot phục hồi; kiểm fingerprint trước/sau. Ghi profile legacy, bridge, candidate, transition riêng, đúng catalog trước/sau | Source đổi → evidence bị ảnh hưởng trở thành lịch sử; khóa source mới, chạy lại gate bắt buộc. Không ghép report khác fingerprint |
| 2. Chuẩn bị fixture cách ly | Xác minh identity/marker/checksum/fixture IDs, runtime/service health/binding; nhận lease vận hành; dựng đúng pha bằng harness đã đọc | Sai target, thiếu marker/binding, fixture đang được dùng → dừng trước reset/query business; sửa cấu hình đã xác minh, không nới guard |
| 3. Kiểm theo profile | Chạy images/TC44 seed-clear và recovery, SQL/Auth/REST/bypass, Realtime hai client, Storage HTTP/cache/revoke, PIN/bootstrap/recovery, unit/UI và E2E. Ghi từng variant và phần chưa chạy | Mock không thay integration; native DB không thay full services; thiếu dependency/skip/retry/only/expected failure → PARTIAL/BLOCKED. Sửa finding trong scope rồi kiểm lại |
| 4. Tổng hợp T15/T16 | Dùng aggregate `t15` cho 55 TC đúng manifest, `full` sau transition/activation/rollback và đủ TC01–60 trên source cuối; lưu JSON output, exit code, evidence refs | Aggregate chỉ **validate evidence được cung cấp**, không chạy tests và không làm thiếu report thành PASS. `PENDING-T16` không hợp lệ ở full. T15/T16 vẫn mở nếu gate thiếu |
| 5. Capability/preflight và rehearsal | Thu profile catalog chỉ đọc được cho phép; kiểm execution actor và provider/native path. Rehearsal đúng binary/full profile, exact prepare/fixed restore, fragments, fault matrix/inflight bootstrap và postflight | Chỉ có native flags false không tự đòi thêm hai native grants trên hosted. Guard pass không chứng minh hosted DDL. Binary/profile mismatch, guard fail, reload chưa proof → dừng; khảo sát/rehearsal bổ sung được duyệt |
| 6. Backup/restore và prepare proof mới | Xác minh exact 77 UUID, FK closure, catalog/full-row counts+digests trên phạm vi dự kiến và ngoài phạm vi; backup dữ liệu/metadata/sequence, restore thực vào môi trường cách ly; backup/restore payload đúng hai Storage objects và paths/version/size/SHA-256. Pin inventory/backup/restore/catalog supplement/prepare proof | Backup thành công mà restore chưa chứng minh → dừng. Snapshot cũ không còn khớp, object/version/digest drift hoặc ngoài allowlist → dừng và tạo proof mới; không mở rộng cleanup |
| 7. Review và ủy quyền phát hành | Hai reviewer độc lập đúng trọng tâm xác nhận candidate cuối; trình manifest, limits, đích, cửa sổ, maintenance, DB/Storage/Edge/frontend và postflight cụ thể cho người có thẩm quyền | Không dùng quyền local hay inventory chỉ đọc làm quyền release. Chưa có xác nhận rõ cho phần tương lai → giữ phần đó NOT RUN. Runbook nháp không tự đóng T17 |
| 8. Đóng ghi, chuẩn bị cutover | Bắt đầu maintenance theo cơ chế đã diễn tập; xác nhận không còn đường ghi cũ/Auth bootstrap/Storage race; freeze contract và recheck source/bundle/target/proofs. Contract permission **2**, write protocol **1**; forced-PIN phải đạt trước frontend | Không chứng minh quiescence hoặc inflight behavior → dừng. Không áp một phần ACL lên client cũ rồi mở phục vụ. Hook hiện hữu chưa có chiến lược bảo toàn → dừng trước prepare |
| 9. DB cleanup + activation | Controller prepare có proof/reload REST; cleanup và activation chung connection/transaction READ COMMITTED, khóa đúng closure/Auth liên quan và Storage metadata, recheck exact UUID/full-row digest/FK/catalog dưới khóa, cleanup đúng tập, kiểm tenant rỗng, 11 fragments/final strict/postflight rồi COMMIT | Lỗi/drift trước COMMIT → rollback cả cleanup+activation và xử lý prepare đúng trạng thái đã biết. COMMIT mất ACK hoặc trạng thái prepare UNKNOWN → giữ maintenance, đối chiếu bằng chứng độc lập; không chạy lại mù/quay về legacy |
| 10. Storage API riêng | Khi DB commit đã xác định và có quyền cleanup Storage, dùng journal exact hai objects; tái kiểm path/version/size/hash, đóng race thay thế object, xóa qua Storage API, kiểm payload lẫn metadata; ngoài scope nguyên vẹn | `PENDING_STORAGE_API` chỉ chứng minh còn chờ Storage. Không DELETE metadata trực tiếp. Xóa lỗi/mất ACK → đối chiếu object/journal rồi retry đúng phần được chứng minh; không gọi DB rollback, không đánh cleanup hoàn tất |
| 11. Gateway/signal rồi frontend | Triển khai Edge settings/JWT và secret bindings được duyệt, kiểm REST config/reload, private bucket/policies/publication và current contracts; xác minh backend binding. Frontend phát hành cuối qua kênh đã kiểm soát auto-deploy | Function tồn tại hoặc deploy ACK không thay runtime proof. Sai JWT/settings/backend/client/contract → giữ maintenance, sửa phần lỗi trong quyền được cấp; không mở frontend |
| 12. Postflight và bàn giao | Forced-PIN onboarding/recovery và restricted state; owner/roles/floor/ceiling/deny, session revoke hai thiết bị, bypass, payment K/payload/R1/retry/receipt, projections, image public/private/revoke/cache, print client binding; ghi runtime/backend/client và ngoài scope preservation | FAIL/NOT RUN thiết yếu → chưa mở phục vụ/chưa đóng T18. Smoke có ghi live chỉ chạy khi được yêu cầu. Human identity và in máy thật không được ghi automated PASS |

Khóa, digest và COMMIT/journal hiện thực ở [cutover:417](../../../pos-cafe/scripts/permission-release-cutover.mjs:417), [locked digest:427](../../../pos-cafe/scripts/permission-release-cutover.mjs:427), [commit:577](../../../pos-cafe/scripts/permission-release-cutover.mjs:577), [durable journal:629](../../../pos-cafe/scripts/permission-release-cutover.mjs:629); thứ tự fragments tại [activation steps:39](../../../pos-cafe/scripts/permission-activation-steps.mjs:39). Những đường dẫn này trỏ worktree `main` cạnh worktree docs, cần đối chiếu lại khi candidate thay đổi.

## Mẫu lệnh tương lai — tất cả NOT RUN trong runbook này

Chạy từ `D:/Workspace/pos-cafe` chỉ sau khi người vận hành thay placeholder bằng **config/profile đã xác minh**, đủ quyền cho bước và có cửa sổ phù hợp. Các placeholder bên dưới là tham chiếu file/artifact, không phải template secret hoặc giá trị env. Không copy nguyên lệnh và không lấy `.env.local` làm cấu hình. Mỗi output mới dùng tên riêng; giữ failure artifacts. Những mẫu có `IDEM_ENV_FILE` cần đường dẫn file secret cục bộ do operator cung cấp qua kênh đã duyệt, không ghi giá trị vào tài liệu.

### Kiểm cách ly và tổng hợp

```powershell
# NOT RUN — chỉ dedicated isolated fixture đã xác minh, giữ lease vận hành
$env:IDEM_ENV_FILE = '<VERIFIED_ISOLATED_CONFIG_FILE>'
node node_modules/vitest/vitest.mjs run --config vitest.permission-identity.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.permission-images-runtime.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.permission-seed.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.permission-clear-demo.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.permission-signals.config.ts
node node_modules/vitest/vitest.mjs run --config vitest.owner-pin-server.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.permission-candidate.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.permission-realtime.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.owner-pin-onboarding.config.ts

# NOT RUN — evidence phải chứa đầy đủ executions đúng fingerprint/profile
node scripts/permission-aggregate-verify.mjs --mode t15 --evidence '<VERIFIED_T15_EXECUTIONS_JSON>'
node scripts/permission-aggregate-verify.mjs --mode full --evidence '<VERIFIED_FULL_EXECUTIONS_JSON>'
```

Danh sách trên là những mốc lệnh đọc được từ checkout, **không phải bộ lệnh đầy đủ tự đóng gate**. SQL/Auth/REST, images, Realtime, PIN và UI có fixture/global setup riêng; operator phải đọc config/harness từng suite, ghi exact report options/paths và evidence theo case catalog trước chạy. Identity/images setup có mutation fixture; không chạy với đích live. TC44 gồm seed/clear và các biến thể concurrency/recovery theo manifest, không đạt chỉ từ một config seed. UI audit theo workflow bắt đầu selftest rồi audit/đọc report và ảnh; không tự accept baseline. Sources: [identity config:1](../../../pos-cafe/vitest.permission-identity.config.ts:1), [images config:1](../../../pos-cafe/vitest.permission-images-runtime.config.ts:1), [candidate browser config:1](../../../pos-cafe/playwright.permission-candidate.config.ts:1), [aggregate CLI:149](../../../pos-cafe/scripts/permission-aggregate-verify.mjs:149).

### Rehearsal provider và controller

```powershell
# NOT RUN — runner hiện pin source container/binary/mount; phải kiểm chúng trước
node scripts/permission-provider-capability-rehearsal.mjs --source-container '<EXACT_SUPPORTED_STOPPED_SOURCE_CONTAINER>' --profile '<VERIFIED_FULL_PROFILE_JSON>' --profile-sha256 '<VERIFIED_PROFILE_SHA256>' --output '<NEW_PROVIDER_REHEARSAL_OUTPUT_JSON>'

# NOT RUN — observation và faults chỉ clone Unix socket/isolation proof hợp lệ
node scripts/permission-release-rehearsal.mjs '<VERIFIED_ISOLATED_OBSERVATION_CONFIG_JSON>'
node scripts/permission-release-rehearsal.mjs --fault-matrix '<VERIFIED_ISOLATED_ROLLBACK_CONFIG_JSON>' '<NEW_FAULT_OUTPUT_JSON>'
node scripts/permission-release-rehearsal.mjs --legacy-inflight '<VERIFIED_ISOLATED_COMMIT_CONFIG_JSON>' '<NEW_INFLIGHT_OUTPUT_JSON>'
node scripts/permission-release-cutover.mjs '<VERIFIED_ISOLATED_ROLLBACK_CONFIG_JSON>'
```

Provider runner chưa phải công cụ nhận mọi container: source container literal, image/binary, stopped state, profile hash và mount paths bị pin; placeholder phải trỏ **đúng input mà runner hiện hỗ trợ**, không tự sửa runner để nhận đích khác sau source lock. Nguồn [provider CLI:172](../../../pos-cafe/scripts/permission-provider-capability-rehearsal.mjs:172). Controller mode mặc định `rehearsal-rollback`; `isolated-commit-rehearsal` bắt buộc Unix socket/isolation proof và không cho Storage API. Không dùng Unix socket mode cho `release-commit`. Sources: [cutover config:75](../../../pos-cafe/scripts/permission-release-cutover.mjs:75), [rehearsal CLI:479](../../../pos-cafe/scripts/permission-release-rehearsal.mjs:479).

### Đích phát hành — cần ủy quyền riêng, vẫn NOT RUN

```powershell
# NOT RUN — chỉ đọc trên đích đã xác minh và được yêu cầu riêng
node scripts/permission-release-preflight.mjs '<VERIFIED_RELEASE_READONLY_TARGET_CONFIG_JSON>'

# NOT RUN — mutation, chỉ khi đúng cửa sổ và explicit release authorization
node scripts/permission-release-cutover.mjs '<VERIFIED_AUTHORIZED_RELEASE_COMMIT_CONFIG_JSON>'
```

Release preflight schema riêng có mode `release-read-only-preflight`, explicit project/backend/database/source/bundle, store IDs/catalog/mapping hoặc empty-target evidence. Không biến fixture mapping thành release mapping. Release cutover config pin inventory/backup/restore/prepare SQL+restore SQL/proofs/journal/timeouts; hosted binding dùng TLS verify-full và CA pin theo parser. Mode `release-commit` phải ghi rõ trong file; đổi mode không tạo thẩm quyền. [release preflight:17](../../../pos-cafe/scripts/permission-release-preflight.mjs:17), [cutover config:81](../../../pos-cafe/scripts/permission-release-cutover.mjs:81).

Chưa đưa lệnh Storage API, Edge deploy hoặc Vercel push vào mẫu: kênh thực thi, quyền, exact targets/JWT/secret references và race-safe cleanup cần được xác minh trong slice riêng. Hai Edge Function có trách nhiệm khác nhau: gateway cần store JWT và employee token; public GET cần phục vụ ảnh published không yêu cầu employee session. Operator phải chứng minh JWT setting riêng phù hợp hành vi bằng HTTP authenticated/unauthenticated/deny tests trước frontend; không deploy cả hai với một setting mặc định chưa kiểm. Nguồn [design:185–212](../../openspec/changes/redesign-permission-model/design.md#6-storage-gateway-và-realtime), [gateway runtime tests:57](../../../pos-cafe/tests/contracts/permissionImagesRuntime.contract.test.ts:57), [public handler:10](../../../pos-cafe/supabase/functions/menu-image-public/index.ts:10).

## Xử lý lỗi và giới hạn rollback

| Trạng thái quan sát | Xử lý operator bắt buộc |
| --- | --- |
| Binding/hash/catalog/UUID/row/object drift; missing guard capability | Dừng trước mutation tiếp theo; giữ report đã sanitize; xác minh lại input/proof/rehearsal và review candidate mới. Không grant/đổi owner bảng provider để ép qua guard |
| Lỗi fragment trước commit, transaction outcome xác định rollback | Chứng minh cleanup+activation đều rollback; kiểm prepare fixed restore và REST reload về baseline. Nếu restore fail, giữ maintenance và chuyển incident, không mở phục vụ |
| `PREPARE_COMMIT_OUTCOME_UNKNOWN` hoặc `RESTORE_PREPARE_COMMIT_OUTCOME_UNKNOWN` | Trạng thái prepare UNKNOWN; không tự restore hoặc chạy lại. Đọc trạng thái catalog/config/REST qua kênh được phép, đối chiếu proof; chỉ chọn hành động tiếp khi outcome xác định |
| `DATABASE_COMMIT_OUTCOME_UNKNOWN` | Có thể DB đã commit. Giữ journal trước effects, nguồn/target/session timing và maintenance; đối chiếu DB/catalog/closure bằng read-only được phép. Không dùng thiếu `.committed` marker làm bằng chứng rollback |
| `DATABASE_COMMITTED_JOURNAL_FINALIZE_FAILED` | DB đã commit; journal finalize thất bại. Giữ journal gốc, xác minh DB outcome và phục hồi evidence theo incident được duyệt; không chạy cleanup DB lần hai |
| `PENDING_STORAGE_API`, Storage request fail/mất ACK | DB và Storage là hai phạm vi commit khác nhau. Giữ pending, kiểm object/version/payload và ngoài scope, retry phần Storage được phép sau race guard; chỉ đóng journal khi có bằng chứng đủ |
| Backend/Edge/client postflight lỗi sau activation | Forward fix hoặc bundle vẫn hiểu 15 quyền/contract hiện hành. Không mở lại legacy RPC/DML. Giữ maintenance nếu invariant/deny/K/PIN chưa đạt |

Error/output hiện thực: [cutover prepare UNKNOWN:319](../../../pos-cafe/scripts/permission-release-cutover.mjs:319), [DB unknown:581](../../../pos-cafe/scripts/permission-release-cutover.mjs:581), [finalize failure:658](../../../pos-cafe/scripts/permission-release-cutover.mjs:658), [CLI status:690](../../../pos-cafe/scripts/permission-release-cutover.mjs:690). Exit code thành công và marker DB không đủ để suy toàn release PASS.

Trước activation, revert additive chỉ khi dependency checks và phase27 guards/grants được giữ. Sau activation, không hạ role/schema khi tiếp nhận ghi. Restore backup chỉ khi đã dừng ghi và chứng minh không có giao dịch mới sau backup, hoặc có bằng chứng đối soát/khôi phục đầy đủ giao dịch mới; thiếu chứng minh thì STOP restore. Giữ nguyên K/payload/R1/receipt hashes. Bằng chứng rollback cách ly không cho phép rollback live tự động. [design:278](../../openspec/changes/redesign-permission-model/design.md#83-rollback).

Owner recovery yêu cầu operator identity/case/proof được xác minh riêng và audit nguyên tử; không reset owner qua app hoặc log PIN. Audit growth/private orphan cleanup là việc vận hành cần theo dõi, chưa có GC/tamper-proof trước DB admin; không tự đặt lịch cleanup. Human identity proof và in máy thật cần người có thẩm quyền/thiết bị xác nhận.

## Các slice tiếp theo để đề nghị, theo thứ tự dependency

| Slice | Phạm vi có thể giao cụ thể | Đầu ra để xét slice sau |
| --- | --- | --- |
| A. Candidate và local gate | Hoàn tất fix đã duyệt, khóa source, unit/mock/UI và tooling đúng scope; review độc lập | Readiness log, snapshot/fingerprint, findings/verdict và giới hạn; chưa full service PASS |
| B. Full isolated gate | Xác minh/dựng fixture full stack được cho phép, identity/lease rồi toàn bộ service/PIN/UI/transition/recovery trên source cuối | T15/T16/PIN evidence theo manifest và aggregate; không hosted cleanup |
| C. Target capability và proofs | Read-only binding/capability profile mới; rehearsal matching binary/profile; backup/restore/full-row/object proof theo quyền riêng | Exact release package, 77 UUID và hai objects, ngoài scope preservation, incident/reload/JWT plan |
| D. Release review/authorization | Chốt maintenance, kênh auto-deploy control, DB/Storage/Edge/frontend/window và operator recovery responsibilities | Quyết định explicit cho từng hành động; đủ dependency T17, chưa tuyên bố deploy |
| E. Coordinated rollout | Thực thi bước 8–12 đúng quyền: DB → Storage API → Edge/config/signal/contracts → frontend → postflight | Live release record, journal đủ, postflight/limits; chỉ đóng task khi toàn gate/review/acceptance thực đạt |

Khi bàn giao, operator cung cấp lượt walkthrough theo bảng bước/cổng dừng, minh họa COMMIT unknown và Storage pending; ghi owner đã nhận/đã phản hồi/chưa phản hồi đúng sự thật. Hồ sơ cuối giữ trạng thái kỹ thuật, nghiệm thu và phát hành riêng theo [workflow](../workflow/README.md#review-doc-lap).
