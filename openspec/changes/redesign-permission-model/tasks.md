# Kế hoạch triển khai — redesign-permission-model

**Trạng thái thay thế, 15/10/2026:** [audit hiện hành](../../../docs/implementation-log/permission-progress-audit-2026-10-15.md) xác nhận actual LOCAL nguồn 58 có 75 PASS, log hash và 835 entry source khớp; full gate 58/SEC→EVC cuối chưa có. Không nhận checkpoint 56/57 thành PASS 58. Online vẫn legacy, chưa catalog 017/permission contract 2; còn 7 audit findings và 11 dependency installed khác lockfile. WSL đã xóa/private package 56 không còn tại đường dẫn đã ghi; không tự dựng lại. Giữ T17/T18 mở, exact79/66Auth/3objects/delete2 và no-push/no-cleanup; các checkpoint dưới lưu lịch sử, không đổi checkbox/acceptance.

**Addendum review CLOSE-3 bước1:** [SEC/EVC](../../../docs/reviews/2026-10-13-permission-close3-step1.md) cùng APPROVE candidate-01 cho hồ sơ PARTIAL/BLOCKED. “Chờ review” của checkpoint ngay dưới đã được xử lý; không đóng gate cleanup/activation/release.

**Checkpoint CLOSE-3 bước1 13/10/2026:** [Handoff](../../../docs/workflow/tasks/permission-close3-step1-2026-10-13.md): fresh binding, backup bảo toàn79 stores/145 Auth và Storage3/3; restore DB strict74/75 vì Auth sequence drift. Có2 store ngoài allowlist77; PARTIAL/BLOCKED, chờ review hồ sơ; dừng trước cleanup/activation/deploy. Những dòng “CLOSE-3 chưa bắt đầu” bên dưới là lịch sử trước checkpoint này.

**Addendum review CLOSE-2 13/10/2026:** [SEC và EVC](../../../docs/reviews/2026-10-13-permission-close2-source31.md) `APPROVE` exact candidate-final-03 SHA-256 `7739adaef16a525fffd0df558a4f035d0217cd80520271ab9575e91989eca492`; CLOSE-2 local readiness hoàn tất. Dòng “chờ review” bên dưới là trạng thái lúc khóa snapshot. CLOSE-3/hosted release/owner acceptance chưa bắt đầu.

**Checkpoint CLOSE-2 source-31 13/10/2026 (chờ review):** [Bàn giao](../../../docs/workflow/tasks/permission-close2-source31-2026-10-13.md) và [log](../../../docs/implementation-log/permission-close2-source31-2026-10-13.md) khóa PIN19/PERM60 strict trên cùng fingerprint source31: 27 stage, 60 TC, 726 variants; T09, TC47 Storage/RPC fault và browser ảnh lỗi→payment PASS local. Proof restore DB/K/Storage source25 được dẫn như lịch sử, không xem là phép restore nguồn31/hosted mới. Hai review exact candidate cuối còn là gate của CLOSE-2; CLOSE-3, phát hành và owner acceptance chưa làm. Các checkpoint source26/source25 dưới đây là lịch sử.

**Checkpoint TC47 source-26 13/10/2026 (chờ review):** [fault fix](../../../docs/implementation-log/permission-close2-source26-tc47-2026-10-13.md) chuyển Storage download trước conditional304, bổ sung runtime503/no-store + browser59/60/61 và ảnh lỗi→payment; unit/build PASS. Source26 khác đúng hai file so source25; strict aggregate27 stage cùng fingerprint mới chưa chạy, chưa tự đóng CLOSE-2/T09/T15/T16. EVC source25 `CHANGES_REQUESTED` được xử lý bằng candidate mới đang khóa; CLOSE-3 và owner acceptance vẫn mở.

**Checkpoint CLOSE-2 source-25 13/10/2026 (chờ review):** [PIN19/PERM60 cùng nguồn](../../../docs/implementation-log/permission-pin19-perm60-source25-2026-10-13.md) đã 2 review APPROVE; [restore/metrics/teardown](../../../docs/implementation-log/permission-close2-source25-2026-10-13.md) có restore DB lịch sử74/74, K fixture và Storage payload, gateway/cache local với provider metrics chưa quan sát được. Hai review CLOSE-2 cuối chưa có verdict tại lúc khóa hồ sơ; chưa nhận CLOSE-3, hosted mutation, phát hành hoặc owner acceptance. Các checkpoint source-20 bên dưới giữ nguyên lịch sử, không dùng thay source-25.

**Checkpoint PERM60 12/10/2026:** [source-20 execution](../../../docs/implementation-log/permission-perm60-2026-10-12.md) có 27 stage / 60 TC / 726 variants, strict aggregate exit0, unit1.173/build/typecheck và preservation/stop PASS. Review SEC và EVC APPROVE exact candidate-01; hoàn tất kỹ thuật PERM60, hồ sơ verdict tại docs/reviews/2026-10-12-permission-perm60.md. Đây là kết quả manifest PERM trong CLOSE-2; không tự đánh checkbox T15/T16/T17/T18 tổng thể khi physical restore, metrics, full PIN19/current aggregate hoặc release còn chưa kiểm.

Ngày 2026-09-17. **Tính năng phân quyền đang tích hợp UI, chưa qua gate tổng và chưa phát hành.** T01–T07 đã có code và bằng chứng kiểm thử cách ly trong phạm vi kỹ thuật; không phải các phần sản phẩm đã bàn giao. [Biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) giữ kết quả 919 unit/component, 120 SQL/Auth/REST, typecheck/build và regression T01–T06 của candidate ngày16/09; chưa chứng minh bản đang triển khai. Chủ dự án yêu cầu làm trọn luồng và đã xác nhận cập nhật `https://pos-cafe-azure.vercel.app`, Supabase `kfqjdfwxhkdwihjobpny`, **giữ nguyên dữ liệu hiện có**. Xem [bàn giao triển khai trọn luồng](../../../docs/workflow/tasks/redesign-permission-model.md).

## Mốc bàn giao sản phẩm — quyết định ngày17/09

Chủ dự án yêu cầu chức năng phải nối UI, chạy đúng và được deploy mới coi là xong. Giữ mã T01–T18 để truy vết và kiểm chứng; tổ chức công việc theo các mốc sau, không giảm TC/gate đã duyệt.

| Mốc | Kết quả quan sát được | Bước cung cấp và điều kiện | Trạng thái hiện tại |
| --- | --- | --- | --- |
| Luồng tích hợp cách ly | Roster/PIN → authority → sơ đồ/POS/lịch sử/báo cáo dùng cùng phiên và projection; UI quản trị/in nối đúng hợp đồng | T08–T14; nối consumer sớm cùng backend, hoàn thiện Storage/Realtime và toàn bộ hành vi đã chốt | Đang rà phụ thuộc; chưa có UI candidate |
| Gói phát hành đã kiểm chứng | Client, DB, gateway và signal tương thích; đủ gate theo source cuối; diễn tập chuyển role/owner, backup/rollback và bảo toàn K/R1 | T15/T16; T17 hoàn thiện runbook, mapping đích và xử lý quyết định thứ tự PIN mặc định | Chưa thực hiện |
| Sản phẩm chạy trên đích đã chọn | Frontend/Supabase đã cập nhật, dữ liệu cũ giữ nguyên, postflight và các luồng kiểm tra trên bản triển khai có bằng chứng | T18; toàn bộ dependency đạt, mapping/backup hợp lệ; không chạy fixture reset trên đích | Đã được chủ dự án cho phép; chưa triển khai |

Không activate riêng T07: SQL thu hồi đọc mà runtime cũ vẫn dùng; role mới cũng chưa được UI cũ hiểu. Preview cách ly là công cụ kiểm tra sớm, chưa thay thế mốc sản phẩm đã phát hành. Quyết định thứ tự `force-default-pin-change` còn theo T17; không tự gộp phạm vi hoặc coi rủi ro PIN mặc định đã được xử lý.

## Quy tắc thực hiện

- T01–T18 là các bước kỹ thuật nội bộ, mỗi bước vẫn phải review/kiểm thử và có bằng chứng. Dấu chọn T01–T07 chỉ xác nhận gate kỹ thuật đã chạy; không có nghĩa sản phẩm hoàn tất. Không dừng bàn giao ở backend khi luồng UI/phát hành còn thiếu.
- Kiểm thử phá dữ liệu chỉ chạy trên môi trường cách ly có marker. Chủ dự án đã cho phép push khi cần và ngày17/09 xác nhận triển khai lên frontend/Supabase nêu trên, giữ dữ liệu hiện có. Quyền phát hành không bỏ qua preflight đích, mapping owner được xác minh, backup, review và gate tương thích. Không dùng .env.local làm fallback đích hoặc chạy suite reset trên DB đang phục vụ ứng dụng.
- B/C là bridge/candidate; T02–T14 kiểm trên fixture/schema cách ly đúng profile. T05/T07/T08/T09 tạo và áp phần DDL/grants của mình khi dựng candidate fixture trước negative test; “đưa vào activation bundle” không có nghĩa hoãn viết/kiểm ACL tới T16. DDL fixture không chuyển store thật. T16 thêm điều phối chuyển dữ liệu A→E và teardown bridge/enum cuối; activation thật chỉ T18 khi được phép.
- Các số TC dưới đây trỏ tới [testplan](testplan.md). 60 TC là kế hoạch, không phải 60 test đã chạy; TC có ma trận sẽ sinh nhiều execution được đếm từ runner.
- Gate thiếu backend thật là BLOCKED ở task đó. Không coi Realtime/Storage mock là integration PASS. Suite reset chung DB chạy tuần tự; sửa source sau gate thì kết quả cũ không chứng minh fingerprint mới.

- Source fingerprint và execution profile tách theo design11.1: cùng source không buộc TC49 legacy, TC50 bridge và candidate có cùng catalog đã áp. Manifest chỉ đúng profile/biến thể/trạng thái trước/sau, không trộn arbitrary report/backend. TC thiếu dependency chỉ báo PARTIAL, không toàn TC PASS.
- Runtime owner: T01 chứng minh DB legacy cách ly cho phần chỉ đọc; T02 chuẩn bị full local Supabase CLI/Docker-compatible WSL2, pin versions/images/config và fixture marker; T09/T10 kiểm Storage/gateway/Realtime thật trên stack đó trước T15. T01 không cần full Realtime. Thiếu tài nguyên thực sự mới báo blocker, không tự giảm gate hoặc cài dịch vụ trả phí.

Các TC được nhắc ở T02–T14 là nguồn oracle cho **biến thể thuộc phạm vi task**, không bắt task sớm chạy assertion của consumer/activation chưa được task sau cung cấp. Manifest bắt buộc chỉ ra variant → task cung cấp → evidence; task chỉ đóng khi mọi biến thể của chính nó đạt, mọi biến thể về sau có owner cụ thể dưới đây, không có FAIL bị chuyển thành deferred. Toàn bộ TC đóng tại T15/T16 theo danh sách gate; điều này không cho miễn negative test ACL thuộc task đang làm.

| Task cung cấp | Phần phải kiểm trước khi đóng task | Phần tích hợp tiếp theo |
| --- | --- | --- |
| T02/T03 | T02 SQL catalog/default/constraints và bridge oracle TC50; T03 domain/ports/mock/normalization và phần layer TC57 | Consumer UI T12–T14, toàn TC57 T15 |
| T04/T05 | Identity/bootstrap DTO/revoke/owner invariant; employee RPC/audit/ceiling/ACL của chính các endpoint này | Seed/clear T08, UI T12, A→E/bootstrap toàn TC52 ở T16 |
| T06 | K authority/locks/TTL/receipt invariant và regression bốn luồng server | Projection T07, receipt grant/UI T14, K xuyên activation TC54 ở T16 |
| T07/T08 | Mỗi projection/changeset/overload/ACL được task đó tạo, gồm HTTP bypass trên candidate fixture | Consumer application T13/T14; activation thật không phải prerequisite |
| T09/T10 | Storage/gateway HTTP/object/cache và Realtime port/signal/ACL service thật; không thay bằng mock | Placeholder/consumer UI T13, authority lifecycle T11, full E2E T15 |
| T11/T12/T13/T14 | Lifecycle/scheduler, employee UI, read consumers/guard cleanup, receipt UI tương ứng; kiểm phần ghép với dependencies đã có | Gate toàn bộ source/profile T15, migration/rollback T16 |

## PERM-T01 — Khóa baseline và dựng preflight/đối chiếu tương thích

- [x] Hoàn tất T01.
- **Dependency:** spec đã sửa sau review được chủ dự án duyệt và có yêu cầu bắt đầu task này; đã đọc main/docs HEAD, dirty baseline và mốc phase27. Ủy quyền bắt đầu được xác nhận ngày 2026-09-15. Phần tích hợp dùng observer DSN tới DB thật cách ly có marker/profile legacy; không cần Auth/REST URL/keys hoặc gọi dịch vụ đó. Đã nghiệm thu theo biên bản T01.
- **Mục tiêu:** tạo công cụ chỉ đọc phát hiện dữ liệu không thể tự chuyển và bộ oracle cố định cho bridge, trước khi sửa role/guard.
- **Input:** main ef2c372 và mọi diff mới nếu có; design mục8, fixtures testplan, catalog 15 và năm mã cũ; không dùng employee UUID tự nó làm proof owner.
- **Phạm vi code/DB/test/docs dự kiến:** scripts/permission-preflight và tests/contracts/permissionMigration, chỉ chạy fixture legacy synthetic được chỉ định; đọc schema/grants/role/overrides, không mutation hoặc migration activation. Fixture setup có ghi là bước chuẩn bị test riêng trước mốc snapshot, không nằm trong công cụ preflight chỉ đọc; không thay dữ liệu cửa hàng thật. Không đọc PIN/hash/token/MAC để serialize report; whitelist field, không dump row/exception tùy ý.
- **Tái sử dụng:** loader/parser/observer check trong tests/contracts/preflight.ts, source hash scripts/idempotency-artifacts.mjs, caseManifest/discover/verify-results và redaction; nguồn/cảnh báo tương thích ở design11.2. Tách ObserverEnvironment/parser và observerPreflight chỉ đọc dùng chung; parseTestEnvironment/preflight phase27 gọi lại phần observer rồi giữ nguyên parse/API/binding/capability/revoke contract. T01 không gọi nguyên preflight(), không nhận hoặc yêu cầu Auth/REST keys. Giữ IDEM_ENV_FILE, database/marker/engine/store_ids, checksum file so marker, loopback, fixture và private-schema guards; checksum khớp marker không chứng minh schema hiện hành chưa drift. Chỉ gate sử dụng API mới cần API/observer binding; không tắt guard suite phase27.
- **Output:** inventory, preflight mapping và oracle bridge; manifest Node24.16.0, source và execution profile. Đã tạo `artifacts/permissions/t01/<runId>/inventory.json`, `preflight.json`, `bridge-oracle.json`, `manifest.json`; runId UUID. Verification riêng liên kết report của 182 executions, catalog ca bắt buộc và mỗi profile; đường dẫn/hash ở biên bản T01.
- **Nghiệm thu:** TC48 chỉ preflight ca xác định owner (L1 có provenance, L2 earliest duy nhất); TC49 các ca mơ hồ, tên ngoài bound nếu phát hiện và chạy lại sau mapping cung cấp, vẫn chỉ đọc. Expected TC50 đủ 3 role × 2 active × 4^5 override = 6.144 hồ sơ độc lập; chưa chạy helper bridge và không đánh TC48/50 toàn phần PASS. Thiếu marker, sai database/engine/fixture/profile, checksum không khớp marker hoặc lộ private schema phải dừng trước đọc dữ liệu nghiệp vụ. Kiểm riêng config không có Auth/REST URL/keys vẫn qua observer khi các bằng chứng DB hợp lệ, không fetch API. Snapshot DB trước/sau công cụ giống nhau gồm employee/session/identity/audit/business, không sinh phiên kiểm tra; regression parser/preflight phase27 giữ nguyên hành vi. Không tự chọn owner ở NEEDS_REVIEW.
- **Docs:** tạo `docs/implementation-log/permission-t01-preflight-<date>.md` trên nhánh docs, ghi baseline/diff, output hashes, scope từng ca chạy/NOT RUN, mapping cần xác minh; không credential hoặc gắn report fixture thành store thật.
- **Điểm dừng:** bàn giao diff/report và các ca cần mapping; chưa đổi schema/defaults hoặc triển khai T02.

Hợp đồng output T01 (mọi report có schemaVersion=1, runId UUID, sourceFingerprint và executionProfile theo manifest gồm fixture identity; field ngoài whitelist bị loại hoặc báo lỗi):

| Artifact/field | Kiểu, ràng buộc và nghĩa |
| --- | --- |
| manifest.sourceFingerprint | SHA256 64 ký tự hex; code HEAD + bytes nguồn/test/bundle được chấp thuận, kiểm trước/sau run |
| manifest.executionProfile | kind legacy/static; runtime/dependency versions, config/command ID, nonsecret backend/project/database identity, fixture IDs, marker proof, migration checksums đã ghi và so với nguồn, catalog/schema quan sát thực tế; observer-only ghi API binding không áp dụng, static ghi backend=null, không nhận DB PASS |
| inventory.surfaces[] | surfaceId string unique; kind SELECT/DML/RPC/Storage/publication; schema/object/signature; source file:line; observedGrants/policies; evidence static/catalog; expectedProtection; khoảng chưa quan sát ghi NOT RUN |
| preflight.stores[] | storeId UUID; status READY/NEEDS_REVIEW; candidateOwnerId UUID hoặc null; provenance source/reference không secret; employeeRoleMapping; normalizedOverrides; rightsBefore/rightsAfter/diff là code[]; blockers reason+targetId; inputMappingRef/hash nếu có |
| bridge-oracle.profiles[] | Đủ 6.144 record unique theo role/active/5 override states; expected quyền/module theo hợp đồng cũ độc lập helper mới; không phụ thuộc catalog15 đã activate |
| manifest.executions[] | TC/variant ID, command/config/profile, expected/observed/outcome PASS/FAIL/NOT RUN/PARTIAL/BLOCKED, artifact paths/hashes, startedAt/finishedAt UTC; expected-only ghi chưa execute helper |
| preflight safety evidence | Snapshot/checksum DB trước/sau whitelist các bảng, observer read-only transaction; chỉ hash/count/khác biệt đã sanitize, không PIN hash/token/DSN trong report |

`employeeRoleMapping` là array `{employeeId:UUID,oldRole:string,newRole:role-code|null}`; `normalizedOverrides` theo DTO PermissionOverrides ở design2.2; mỗi rightsDiff là `{employeeId,added:code[],removed:code[]}`. `blockers` là array `{reason:string,targetId:UUID|null,evidenceRefs:string[]}` với reason được manifest phiên bản1 liệt kê (missing/tied timestamps, no active admin, unverified/inactive primary, contradictory mapping/overrides, invalid name); không echo field bí mật. Input mapping tùy chọn là JSON version1 gồm storeId,ownerId,verifiedByRef,evidenceRefs,sourceSnapshotHash; tool chỉ kiểm/mô tả mapping được cung cấp, không giả đã xác minh con người. Fixture mapping dùng reference synthetic; môi trường thật cần phê duyệt ở T17. Config test từ IDEM_ENV_FILE và profile chỉ định rõ, không dò .env hoặc tự fallback từ legacy sang candidate.

## PERM-T02 — Schema additive và bridge catalog

- [x] Hoàn tất T02.
- **Dependency:** T01 và mapping fixture rõ; không cần mapping live để chạy cách ly.
- **Input:** inventory/expected bridge, design2/8 và [bàn giao bỏ Kế toán/chuẩn bị T02](../../../docs/reviews/2026-09-14-permission-model/11-bo-ke-toan-chuan-bi-t02-2026-09-15.md). Catalog candidate khóa đúng năm role, bốn enabled, ba selectable; 15 quyền. Supabase MCP không thay CLI/Docker runtime cách ly.
- **Phạm vi:** migration 017 trên nhánh code theo ủy quyền bắt đầu T02; catalog/default/state/revision và private registry; legacy role/helper còn dùng ở bridge. Chuẩn bị full local Supabase CLI/Docker-compatible WSL2 theo design11.2, không dùng storage shell giả; fixture/bootstrap tách native và full stack, marker/API-observer proof đầy đủ. Không activate role mapping15 hay đóng read cũ từng phần trên live.
- **Output:** migration additive/revert rehearsal, catalog seed15 với role owner/manager/cashier/waiter/kitchen chưa activate đối với client legacy, không seed accountant; helper bridge giữ nghĩa cũ; runtime manifest khóa CLI/images/config/Node, service health và profile fixture có marker. Chưa có gateway implementation không ghi gateway PASS.
- **Nghiệm thu:** TC01/04/50; cả ba role và mọi tổ hợp grants/denies năm mã cũ, null/trùng; constraints/ACL private; không đổi K/R1/hash hoặc mở grants cũ. Ghi số tổ hợp thực chạy.

**Kết quả T02 ngày 2026-09-15:** migration 017 và revert rehearsal đã kiểm với Supabase local thật; 52/52 test, 6.144/6.144 comparison, 152 tool + 30 DB T01, 637 unit/component và build PASS cùng source fingerprint `e25599ee0e5368b7a8ef26066db5449b48a5e5c536e54438b3637f4dea3dd112`. TC01/04 chỉ đóng phần SQL; core/DTO/patch/UI thuộc T03/T05 và consumer tương ứng. TC50 đạt gate bridge T02; Storage/Realtime mới kiểm service health, gate hành vi vẫn T09/T10. Runtime đã dừng, giữ volume và runbook tại [biên bản T02](../../../docs/implementation-log/permission-t02-catalog-bridge-2026-09-15.md). Không đổi `src/`, enum role hoặc activation; điểm dừng tiếp theo là bàn giao T03.

## PERM-T03 — Domain, ports và mock dùng catalog

- [x] Hoàn tất T03.
- **Dependency:** T02.
- **Input:** catalog/DTO design2/3, requirement01–04/07/08.
- **Phạm vi:** domain/core/ports, mock adapters/fixtures; không import Supabase vào core, không thêm network call vào từng can().
- **Output:** types15 quyền/năm role, module mapping, normalized overrides, authority/admin/read ports cùng semantics; legacy bridge vẫn rõ.
- **Nghiệm thu:** TC01/03/04/19/57. Owner15, manager12, cashier7, waiter3, kitchen0; bốn role hoạt động có floor baseline không tắt. Fixture A là waiter với overrides chỉ xem, chưa có reprint. No-op role giữ deny.

**Kết quả T03 ngày 2026-09-15:** core nhận catalog qua tham số; DTO/validator, module/action predicates và mock authority/admin-read/projections đã có. Aggregate PermissionFoundationPorts chưa nối vào AppPorts hiện hành; admin mutation/server authority/signal transport do T04/T05/T07/T10 cung cấp. 761 unit/component, 4 SQL test đối chiếu1.280 tổ hợp +9 ca lỗi, typecheck/build, T01 152+30 và T02 52+6.144 đều PASS tại source `925b167be58eff127514aa5930c723607a13a864af62e45258d5d8e7810cc94e`. [biên bản T03](../../../docs/implementation-log/permission-t03-domain-ports-mock-2026-09-15.md) nêu rõ TC01/03/04/19/57 phần đã kiểm và consumer/UI còn lại; không đổi UI hoặc activate roles.

## PERM-T04 — Danh tính, owner và khóa phiên

- [x] Hoàn tất T04.
- **Dependency:** T02/T03.
- **Input:** design4/8/10; session/bootstrap phase27.
- **Phạm vi:** DB helper/constraints cho owner duy nhất active, lock protocol; start/revoke session, self PIN, operator recovery riêng; session adapter/port. Không endpoint reset owner trong app hoặc trường recovery_contact.
- **Output:** identity mutex, khóa trước session cần revoke, recovery có operator/case và audit nguyên tử; bootstrap candidate.
- **Nghiệm thu:** TC08–11/14/28/43/52/58; PIN6 ASCII, tự đổi cần currentPin, session revoked/expired vẫn logout idempotent; owner invariant và rollback. Trình bằng chứng thứ tự issuance/reset cả hai chiều; không chạy human recovery thật.

**Kết quả T04 ngày 2026-09-16:** identity SQL candidate và adapter/port/mock đã kiểm; owner active duy nhất, session 12h, self PIN/noop/denied/replay, operator recovery nguyên tử, bootstrap strict/retry. 788 unit/component,42 SQL/Auth/REST, build PASS tại source `946c6dfd0b01e80ca2790790fed6d5bb92b8a67e4d792e08e5fbc456cb0b6e74`; regression T01 152+30, T02 52/6.144 và T03 4SQL/1.280+9 PASS. [Biên bản T04](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md) tách rõ TC08/09/14 chỉ phần primitive/constraint; admin RPC/ceiling/OCC vẫn T05. Không chạy recovery con người hoặc activation thật.

## PERM-T05 — Quản trị nhân viên, trần quyền và audit

- [x] Hoàn tất T05.
- **Dependency:** T04.
- **Input:** UC02–06/13, design2/4, Q2/Q7/Q13/Q14.
- **Phạm vi:** create/update/reset/overrides RPC, operator-safe audit registry và audit read; Supabase employee adapter, mock parity. Tạo DDL thu hồi DML admin trong task này, áp candidate fixture trước negative test, đóng gói để T16 điều phối activation.
- **Output:** field permissions, actor/target before+after ceiling, OCC/catalog conflict, stable requestId retry/MAC private, denied/noop audit committed envelope.
- **Nghiệm thu:** TC05–09/14–24/42. Không self role/override hoặc non-owner chạm owner; target inactive vẫn dùng configured rights. Audit lỗi rollback; retry không nhân audit/mutation; không lộ PIN/MAC/token; người có permission.edit đọc toàn bộ audit same-store, kể cả owner target; clear demo không xóa audit.

**Kết quả T05 ngày 2026-09-16:** create/update/reset/list/get/audit RPC candidate, field permissions, ceiling trước/sau kể cả inactive, OCC/catalog, role+override mới cùng lần lưu, audit applied/noop/denied và HMAC retry đã kiểm. Fragment tự thu hồi legacy employee RPC cùng table/column grants; adapter/mock parity có kiểm riêng. 815 unit/component,55 SQL/Auth/REST, build và regression T01–T04 PASS tại source `c7d5eb16c8b95e2fca028ef04e4cfa222de1da2cb222ffde348354a9b5e8440f`. [Biên bản T05](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md) tách rõ UI T12, clear-demo retention T08 và signal transport T10 còn lại; chưa activate/push.

## PERM-T06 — Chốt quyền catalog trên K sau chờ khóa

- [x] Hoàn tất T06.
- **Dependency:** T02/T04/T05.
- **Input:** design4, PERM29/30, inventory và test phase27.
- **Phạm vi:** register/execute/get/list/cancel/capabilities và helper final authority; tách private.current_employee khỏi việc khóa actor sớm ngoài thứ tự employee UUID, prelock mọi FK employee trước checkpoint cuối theo design4. Không sửa immutable payload/R1, TTL hoặc chủ thể initiator.
- **Output:** permission-catalog SHARE ở checkpoint cuối, READ COMMITTED fresh check; không outer authority SHARE cho financial.
- **Nghiệm thu:** TC25/27/39–44/54 và regression bốn luồng ghi phase27. Chứng minh revoke commit trong khi execute chờ order được nhìn thấy; expiry khi chờ catalog bị chặn; K pending/terminal và giá lịch sử bất biến. Không thay expected cũ để làm race xanh.

**Kết quả T06 ngày 2026-09-16:** sáu protocol RPC candidate kiểm session/action/catalog hiện hành, khóa business trước rồi employee UUID (actor và initiator), session, catalog. Revoke commit được khi execute còn chờ order; expiry/catalog change sau wait và negative controls đã kiểm. Giữ payload/R1, TTL24h, giá lịch sử, UTC wire và attribution. 815 unit/component,44 SQL/Auth/REST, build và regression T01–T05 PASS tại source `819f672d274768a48e0b2a4e2135dc975e120ecf9380abd709af80f734d7b7e3`. [Biên bản T06](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md) tách rõ TC44 mới phần financial takeover, bulk clear/seed chờ T08; TC54 chưa gồm activation bundle T16.

## PERM-T07 — Projection đọc và danh bạ tối thiểu

- [x] Hoàn tất T07.
- **Dependency:** T03–T06.
- **Input:** inventory15 quyền design3, các nguồn orderRepo/reportRepo/employeeRepo/settings hiện hành.
- **Phạm vi:** RPC floor/open detail/history/report/settings/display/employee/audit; adapter read; tạo ACL revoke raw sensitive SELECT và áp vào candidate fixture trước nghiệm thu, đưa cùng DDL vào bundle T16.
- **Output:** projection theo mục đích, session/tenant/current permission; pre-PIN roster tối thiểu; không alias history read thành quyền thao tác.
- **Nghiệm thu:** TC02/03/13/24–28/38. Floor có summary open cần dùng, không paid/history/items/payment; report aggregate không trả raw order detail. Thử raw SELECT mọi bảng/column nhạy cảm bằng role/session khác nhau và forged actor/cross-store.

**Kết quả T07 ngày 2026-09-16:** 13 read RPC/projection kiểm tenant/session/current quyền sau chờ khóa; explicit DTO, receipt v1 không rewrite, raw SELECT bảng/cột/view đóng. Báo cáo theo timezone cửa hàng, listReportOrders tối đa20 paid summaries trên toàn range; quyền report không mở history/receipt. 919 unit/component,120 SQL/Auth/REST, build và regression T01–T06 PASS tại source `1156e4db9cac2d3c91bae30bacd5df83a5a3b8c93f1840fce921e50f5a103363`. [Biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) nêu UI T11–T14/Storage T09/Realtime T10 chưa activate; timezone owner-only write thuộc T08.

## PERM-T08 — Ghi menu/floor/settings và clear demo

- [ ] Hoàn tất T08.
- **Dependency:** T05–T07.
- **Input:** inventory3 và lock4; giữ write-protocol boundaries.
- **Phạm vi:** changeset guards/whitelist, seed overloads, owner-only clear_demo_data; adapter/mock. Theo quyết định T07 ngày 2026-09-16, mặc định timezone UTC+7 (`Asia/Ho_Chi_Minh`); chỉ owner được đổi timezone, non-owner có settings.manage chỉ giữ nguyên giá trị khi lưu trường khác. Kiểm server dưới khóa, từ chối cả request nếu có thay đổi timezone trái quyền; test cả raw RPC bypass. Chưa xử lý upload gateway ở task này.
- **Output:** mọi overload chuyển guard hoặc revoke, DML bypass bị đóng trong DDL do T08 tạo và áp candidate fixture trước test; seed từng call không giả atomic cả bundle; internal bulk identity theo mutex→pos-write→business→employees→sessions→catalog.
- **Nghiệm thu:** TC12/18/25–28/44. Clear giữ custom/finance/K/R1/audit và owner; open-order blocker giữ nguyên; thiếu quyền không mutate trực tiếp. Không cấp menu.manage quyền sửa trạng thái table thuộc POS.

## PERM-T09 — Gateway ảnh và staging private

- [ ] Hoàn tất T09.
- **Dependency:** T07/T08 và full local runtime T02 có Storage API thật; gateway candidate được triển khai vào runtime cách ly đó trong phạm vi task này, không đòi gateway đã tồn tại trước task.
- **Input:** design6.1, bounds5MiB JPEG/PNG/WebP, inventory policies.
- **Phạm vi:** Edge menu-image-gateway verify_jwt=true cho write/staging read + kiểm employee; Edge menu-image-public verify_jwt=false chỉ anonymous GET published ảnh bằng img src. Private bucket/handle policies, menuImage adapter và DB finalization cùng changeset; server credentials/token không vào URL hoặc client.
- **Output:** explicit store JWT+employee token, immutable object binding; tạo/ap dụng policy revoke direct Storage upload/update/delete/copy trong fixture ngay T09, đóng gói T16. GET ảnh mới qua gateway published record tại origin, URL ổn định/cache60s theo design6.1; legacy public GET giữ nguyên.
- **Nghiệm thu:** TC45–47 với HTTP upload/update/delete/copy bypass, revoked/expired/cross-store và revoke giữa upload/finalize; anonymous img GET published thành công nhưng staging/method ghi qua public function bị chặn, không token trong URL; write gateway vẫn đòi cả store JWT và employee authority. Cache header/TTL, no-store lỗi, GET origin sau unlink, placeholder khi lỗi; đo riêng client có cache fresh, revalidate304/full response, origin requests/invocations/bytes và độ trễ/lỗi. Private cache không bảo vệ function công khai khỏi lưu lượng dồn; UUID không phải traffic limit. Orphan luôn private; DB rollback không được báo đã rollback Storage. Thiếu service thật thì BLOCKED; chưa có số đo không hứa miễn phí hoặc SLA ảnh.
- **Docs:** runbook đối chiếu/unlink/cleanup lỗi; lưu object binding và outcome, không credential. Ghi chưa có traffic limit riêng cho public function; hành vi vượt hạn mức do provider kiểm soát, không suy chính sách hoặc hứa miễn phí từ thiết kế.

## PERM-T10 — Realtime chỉ phát tín hiệu tối thiểu

- [ ] Hoàn tất T10.
- **Dependency:** T05–T08 và full local runtime T02 có Realtime thật.
- **Input:** design6.2, inventory publication004/008 và join-table menu.
- **Phạm vi:** signal tables/triggers/grants, publication chuyển đổi, realtime adapter; không publish audit/employee/financial payload.
- **Output:** cùng transaction business/authority tăng revision và signal; catalog global signal; reconnect callback chờ authority gate.
- **Nghiệm thu:** TC21/29/30/55. Rollback không có signal giả, không lộ raw protected fields ở WebSocket; các topic adapter hiện có vẫn invalidate/refetch. Chỉ gắn/bỏ nhóm tùy chọn giữ giới hạn manual reload/reconnect cho change riêng, không dựng expected join realtime đã có. TC55 cần Realtime thật/hai client/marker; thiếu service chỉ hoàn thành unit tương ứng, task chưa đủ gate.

## PERM-T11 — Authority lifecycle, cache và phần đang mở

- [ ] Hoàn tất T11.
- **Dependency:** T03/T07/T10.
- **Input:** Q9/Q10/Q15, design7, UC12.
- **Phạm vi:** app store/lifecycle/query keys/scheduler; tách sessionGeneration khỏi authority revision; explicit focus/reconnect và fallback30s/tab visible.
- **Output:** revision-only shared poll, snapshot khi cần, apply diff quyền; forced close/cache purge nhóm mất quyền đọc/thao tác, giữ nháp khác/K server. Theo Q15 chỉ mất quyền in thì ẩn nút/hủy pending và giữ preview còn quyền đọc, cấp lại không auto print; late response/timer bị chặn theo generation thao tác.
- **Nghiệm thu:** TC31–35/59/60. Fake timer chứng minh nhịp30s và trần35s có điều kiện chuỗi≤5s; hidden không poll; failure không logout nhưng chặn protected render/query. No-op refresh không cắt coordinator. Không thêm retry write/K mới.

## PERM-T12 — UI quản trị nhân viên và owner

- [ ] Hoàn tất T12.
- **Dependency:** T05/T11.
- **Input:** UC02–08, error catalog và default matrix.
- **Phạm vi:** employee drawer/form/flow, owner self PIN; không thêm audit viewer hoặc email recovery UI.
- **Output:** ba role tạo được (manager/cashier/waiter); owner chỉ qua bootstrap, kitchen không chọn; quyền checkbox/source rõ; field action cần quyền đúng; lỗi tiếng Việt đúng contract và refresh conflict.
- **Nghiệm thu:** TC05–11/14–20/56/59. Manager mặc định không có permission.edit/settings; owner không self role/override; PIN6 và confirm; form no-op không reset deny. Dirty prompt không chặn forced close khi mất quyền.

## PERM-T13 — UI tiêu thụ projection, điều hướng và guards

- [ ] Hoàn tất T13.
- **Dependency:** T07/T08/T11.
- **Input:** UC01/09/10, inventory15 quyền và Q11.
- **Phạm vi:** AppShell/nav, POS/payment/history/report/menu/floor/settings/clear demo flows; loại direct reads và role/admin/module map hardcoded khỏi consumer candidate; adapters/mock cùng contract. Giữ migration lịch sử/fixture bridge riêng cho TC50, không dùng chúng làm production authority.
- **Output:** mọi active role vào floor nền; show/hide theo quyền; quyền thao tác chỉ tải projection cần dùng; dữ liệu source được scope theo identity.
- **Nghiệm thu:** TC02/03/12/18/25/26/33/34/56/59 và phần consumer TC57, gate tổng TC57 tại T15 sau T14. Không lấy full floor/order data như side effect của payment; không filter raw unauthorized response ở client rồi gọi an toàn. Business invalid giữ disabled; thiếu quyền thì ẩn.

## PERM-T14 — Receipt reprint và bằng chứng in ban đầu

- [ ] Hoàn tất T14.
- **Dependency:** T06/T07/T11/T13.
- **Input:** Q12/Q12a/Q15, PERM27/28, design5.
- **Phạm vi:** private initial grant ngoài R1, execute response metadata, authorize initial/prepare reprint/read receipt RPC, history/recovery/preview controls và mocks. Không đổi fingerprint v1 hoặc số bản in vật lý.
- **Output:** ba bề mặt reprint cùng quyền; initial có server proof gắn payment applied/actor/session, authorize chỉ đọc không tiêu hao grant, replay payment không cấp grant mới. Nhiều click mới trong preview được phép; double-click pending/repeated callback cùng PR không dispatch thêm; không tự in.
- **Nghiệm thu:** TC13/36–38/60. Cashier bị deny reprint vẫn in initial sau Cancel; fixture A chỉ xem history/report không in cho đến grant; receipt.reprint không cho K access. Mất quyền in chỉ ẩn nút/hủy pending khi còn quyền đọc; mất read/session đóng/purge; cấp lại không auto print. Grant giả/K cũ không được mint, wrong binding/void/session bị chặn; server không giả biết popup đóng; snapshot/R1 hash giữ nguyên.

## PERM-T15 — Gate tổng hợp bảo mật và runtime thật

- [ ] Hoàn tất T15.
- **Dependency:** T09/T10/T12–T14; tất cả nhánh cùng source fingerprint và đúng execution profile theo design11.1.
- **Input:** gate candidate theo testplan, TC01–47, TC49/50 và TC55–60. TC48/51–54 toàn phần dành cho script activation/chuyển dữ liệu/bootstrap/rollback ở T16; kiểm preflight/bootstrap/TTL đơn lẻ ở task trước là bằng chứng từng biến thể, không thay diễn tập chuyển đổi.
- **Phạm vi:** test/harness Node24.16.0, unit/UI, DB/Auth/PostgREST, Storage/EdgeFunction, Realtime và E2E cách ly; không sửa nghiệp vụ ngoài findings liên quan.
- **Output:** manifest TC→variant/execution/profile cho 55 TC (01–47,49/50,55–60): TC49 legacy, TC50 bridge, phần còn lại theo tiền điều kiện/mức test, cùng source fingerprint. Gate service candidate dùng chung full Supabase đã chứng minh deployment/DB, không ghép backend phase27 thiếu service với backend khác. TC48/51–54 ghi PENDING-T16 có lý do; không gọi toàn bộ60TC PASS hoặc cộng diagnostic rerun thành TC mới.
- **Tái sử dụng:** source hash, caseManifest/discovery/verify-results và redaction có sẵn theo design11.2, mở execution metadata tương thích thay tạo harness song song; không lấy report phase27 thay kết quả mới.
- **Nghiệm thu:** thiếu test bắt buộc, skip/only/retry/expected-failure, backend sai, marker thiếu, stale report/source drift đều fail gate. K/payment/open-order projection/audit thực tế được kiểm, không chỉ UI. Gate Realtime thật không trộn với fake timer. Kế thừa và kiểm lại số đo T09 cho ảnh: cache fresh/revalidate/origin, invocation/bytes/latency/lỗi theo đúng source/runtime; báo rõ metric nào không quan sát được. Không dùng UUID hoặc private cache để tuyên bố đã chống lưu lượng dồn hay bảo đảm hạn mức của provider.
- **Điểm dừng:** findings phải có task sửa/kiểm lại cụ thể; không đổi expected để hợp thức hóa implementation sai.

## PERM-T16 — Diễn tập migration, activation và rollback cách ly

- [ ] Hoàn tất T16.
- **Dependency:** T15.
- **Input:** preflight/mapping approved cho fixture, migration bundle đầy đủ, backup và historical hash manifest.
- **Phạm vi:** activation scripts/capability version/client update gate; điều phối DDL candidate đã được T02–T14 tạo/kiểm, owner mapping/role FK/defaults/grants/publication atomically; teardown bridge/enum DB cuối sau dependency checks; bootstrap và seed rehearsal. Cung cấp launcher preflight chỉ đọc cho đích phát hành dùng core của T01, target config/read connection được chỉ định rõ, kiểm binding đích và không fallback từ test profile sang live. Chỉ kiểm launcher trên synthetic/dry-run trong task này; sai đích/thiếu target reference phải bị chặn. Lịch sử migrations/fixture bridge vẫn giữ để dựng lại pha B cho TC50.
- **Output:** biên bản A→B→C→D→E, preflight locked recheck, postflight và rollback/forward-fix rehearsal; bundle có launcher preflight đích phát hành và config schema trước lần khóa source/chạy full60. T17 không viết thêm launcher làm lệch source đã nghiệm thu.
- **Nghiệm thu:** TC48–54 và regression bốn luồng K, sau đó chạy gate đủ TC01–60 trên source đã có activation scripts, từng TC đúng profile legacy/bridge/candidate/transition và ghi trạng thái mỗi pha. Source mới không dùng lại report T15 để đủ số. Sau teardown kiểm candidate consumer/TC57 không dùng legacy authority. NEEDS_REVIEW chặn toàn activation; same-store bootstrap replay không đổi owner/PIN; old client không mở lại legacy DML. Backup restore không bỏ giao dịch sau backup; giữ K/payload/R1 hashes.
- **Giới hạn:** chỉ diễn tập cách ly. Kết quả không tự cho phép áp migration lên cửa hàng thật.

## PERM-T17 — Runbook, bằng chứng và đề nghị phát hành

- [ ] Hoàn tất T17.
- **Dependency:** T15/T16.
- **Input:** code review, manifests/gates thật, limitation recovery/audit/Storage.
- **Phạm vi:** docs hiện trạng/limitations/testing/release checklist; chỉ cập nhật thành đã triển khai đối với phần có bằng chứng code/test, tách rollout thật.
- **Output:** hướng dẫn operator identity/case/secret handoff không log, kiểm owner recovery kỹ thuật cách ly và xác minh người riêng; private orphan cleanup, audit growth monitoring; rollout/rollback bundle review được.
- **Chuẩn bị phát hành thật:** trước cửa sổ mutation T18, khi chủ dự án yêu cầu riêng môi trường và hành động, chạy launcher preflight chỉ đọc đã nằm trong bundle T16 cho toàn store trên đích phát hành; tạo report/mapping không secret, người có thẩm quyền xác minh và duyệt mapping có source/bundle/input hashes. Target config và quyền đọc tối thiểu được xác minh trước; không nới profile test local để chạy nhầm production. Chưa được yêu cầu hoặc còn NEEDS_REVIEW thì bước phát hành chờ, không coi mapping fixture là mapping live. Nếu phải sửa launcher/bundle thì quay lại gate nguồn mới, không dùng kết quả nguồn cũ.
- **Thứ tự release:** ghi rõ trạng thái force-default-pin-change và rủi ro PIN khởi tạo còn dùng chung trước khi đề nghị T18. Change đó giữ riêng, ưu tiên làm trước phát hành permission model; nếu chưa xong cần chủ dự án quyết định thứ tự cụ thể ở release review, không suy Q5 cho phép bỏ xử lý PIN mặc định.
- **Nghiệm thu:** mỗi claim có fingerprint/source/gate; các NOT RUN còn lại rõ, không gọi human verification/physical printing là automated PASS. Mọi sự cố gate liên quan đã xử lý; chủ dự án nhận được phạm vi phát hành cụ thể để quyết định.

## PERM-T18 — Phát hành được cho phép và bàn giao sau triển khai

- [ ] Hoàn tất T18.
- **Dependency:** T17 và chủ dự án yêu cầu cụ thể môi trường/hành động phát hành; không được suy quyền deploy/live DB từ duyệt spec.
- **Input:** bundle đúng source fingerprint đã nghiệm thu, execution manifests phù hợp; backup và mapping từ preflight đích thật T17 đã được xác minh/duyệt trước cửa sổ mutation; recheck dưới khóa khi activation, drift làm chặn và xác minh lại.
- **Phạm vi:** chỉ các bước migration/frontend/gateway/grants/postflight/smoke đã được cho phép; không reset dữ liệu thật hoặc khôi phục backup sau giao dịch mới không đối soát.
- **Output:** biên bản phát hành và mọi gate chưa chạy được nêu rõ; docs current truth cập nhật theo evidence, task chưa đủ gate vẫn chưa đánh dấu xong.
- **Nghiệm thu:** version/client/DB/catalog/service khớp, owner count/rights/grants đúng, old K còn khôi phục được, bề mặt đọc/ghi bypass đóng. Smoke thật chỉ khi được yêu cầu; không lấy kết quả cách ly thay xác nhận live.
- **Điểm dừng:** không tự archive/apply các change khác, không tự mở change owner-email hoặc future permissions. Đồng bộ baseline OpenSpec theo thứ tự delta phase27 rồi change này chỉ trong task tài liệu sau triển khai được xác định rõ.

## Tình trạng bàn giao task spec

Ngày 2026-09-17. **Tính năng phân quyền đang tích hợp UI, chưa qua gate tổng và chưa phát hành.** T01–T07 đã có code và bằng chứng kiểm thử cách ly trong phạm vi kỹ thuật; không phải các phần sản phẩm đã bàn giao. [Biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) giữ kết quả 919 unit/component, 120 SQL/Auth/REST, typecheck/build và regression T01–T06 của candidate ngày16/09; chưa chứng minh bản đang triển khai. Chủ dự án yêu cầu làm trọn luồng và đã xác nhận cập nhật `https://pos-cafe-azure.vercel.app`, Supabase `kfqjdfwxhkdwihjobpny`, **giữ nguyên dữ liệu hiện có**. Xem [bàn giao triển khai trọn luồng](../../../docs/workflow/tasks/redesign-permission-model.md).

Mốc tiếp theo là luồng candidate chạy được từ đăng nhập đến UI với backend cách ly: tích hợp identity/authority/read consumers song song các dependency T08–T10, rồi hoàn thiện quản trị và in hóa đơn. Chỉ phát hành lên đích đã xác nhận sau khi đầy đủ gói tương thích, kiểm thử tích hợp và diễn tập migration/rollback. Không triển khai riêng raw SELECT closure của T07 vào UI cũ.

### CLOSE-3 NEW79 — checkpoint13/10/2026

- [x] Người dùng xác nhận đúng hai quán mới là TEST; lập manifest scope-only79 từ77 gốc + exact2 frozen, fresh read/Auth/FK/Storage và18/18 local guards; source31 drift0.
- [ ] SEC rồi EVC APPROVE exact candidate, xem [handoff](../../../docs/workflow/tasks/permission-close3-scope79-2026-10-13.md) và review liên kết.
- [ ] Bước tiếp theo, sau khi báo và dừng theo yêu cầu: quyền/cấu hình deployment/controlled rollout; backup mới/helper pin79/strict75/75; full-row/catalog/locked recheck; provider controller rehearsal và release review/postflight/owner.

Chỉ scope classification được chốt. Chưa CLOSE-3 hoàn tất, không thay receiptFAIL, không chạy live cleanup hoặc release.


**Metadata review NEW79 ngày13/10/2026:** SEC rồi EVC cùng APPROVE exact candidate-01 SHA `d4ac17c0be198bd2725a9afb9e1ab183d83622995c4acfd156b09fbb373823de`; [verdict](D:/Workspace/pos-cafe-docs/docs/reviews/2026-10-13-permission-close3-scope79.md). Gate bàn giao scope79 đạt; các dòng/checklist chờ review là trạng thái lúc khóa snapshot. Chỉ bổ sung metadata review, không đổi candidate; release vẫn BLOCKED và STOP trước quyền/cấu hình deployment.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.



## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
