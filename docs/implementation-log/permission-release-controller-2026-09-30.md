# Controller phát hành phân quyền — phần 1, 30/09/2026

> **Checkpoint hiện hành 01/10/2026:** PostgreSQL/PostgREST thực đã chạy trên clone cách ly. Candidate fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef có 34/34 tooling và 15/15 fault cases PASS; legacy, hủy harness và mô phỏng lỗi client sau COMMIT thật đã chạy. Runtime PASS dùng quyền local bổ sung được ghi riêng. Actor gốc bị chặn trước prepare; **quyền production/release vẫn BLOCKED/chưa xác minh live**. Nội dung 30/09 bên dưới giữ làm lịch sử source-only; xem phần tiếp tục 01/10 ở cuối.

**Bàn giao candidate source-only; gate phần 1 BLOCKED, chưa phát hành.** Phạm vi được giao trong chat ngày 30/09 là xây controller/test, review độc lập và diễn tập riêng trên bản sao backup với actor tương đương production. Runtime không sẵn sàng nên chưa hoàn tất diễn tập bắt buộc. Không khôi phục MCP, chạy gate tổng sản phẩm, sửa UI, push hoặc thao tác live. Dừng sau bàn giao này, không tự nối phần khác.

## Source và bảo toàn working tree

- Code: `D:/Workspace/pos-cafe`, `main`, HEAD `ef2c372aec60d8362549e47b7aedb27126129479`. Kiểm đầu phiên: 329 đường dẫn thay đổi/chưa theo dõi. Giữ toàn bộ, gồm `pnpm-lock.yaml`; không reset/stash/chuyển nhánh hoặc tạo checkout từ HEAD.
- Docs: `D:/Workspace/pos-cafe-docs`, `docs`, có thay đổi chưa commit từ trước. Chỉ cập nhật hồ sơ phần được giao.
- Manifest source và trạng thái đầu phiên được lưu ngoài Git tại `C:/Users/nguye/AppData/Local/pos-cafe-release/backups/controller-session-20260930/baseline-main-manifest.json` và `baseline-main-status.txt`, 698 đường dẫn gồm deletion. Snapshot candidate source có 700 đường dẫn và bản sao nội dung gồm file mới/deletion; manifest hiện hành tại [source-manifest.json](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/source-manifest.json) ghi fingerprint, đường dẫn snapshot bảo vệ và hash từng file thay đổi. Snapshot trước sửa finding cuối được giữ riêng, không ghi đè.
- Điểm vào kế thừa: [checkpoint 28/09](permission-release-stop-2026-09-28.md), [diễn biến/evidence](permission-release-resume-2026-09-28.md), [handoff](../workflow/tasks/redesign-permission-model.md), [design §8.2.1](../../openspec/changes/redesign-permission-model/design.md#821-cutover-sau-cleanup-dữ-liệu-test-theo-delivery-03), [TC53](../../openspec/changes/redesign-permission-model/testplan.md#tc-perm-53--kiểm-tra-trước-triển-khai-và-rollback-không-làm-mất-giao-dịch-sau-backup).

## Chẩn đoán runtime cách ly

Kiểm chỉ đọc đúng container `pos-cafe-restore-1790593558895-4c7ba556`: trạng thái `exited`, exit code 0, không OOM, không lỗi Docker được ghi nhận. Lần chạy kết thúc `2026-09-28T12:23:03.311591605Z`; đây là dữ liệu Docker, không phải suy đoán nguyên nhân dịch vụ dừng. Container có network `none`, không publish port, PostgreSQL chỉ Unix socket `/restore`, `listen_addresses` rỗng.

Evidence [runtime-readiness.json](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/runtime-readiness.json) do investigator ghi; root kiểm độc lập Docker lần nữa và lưu [root-readiness-check.json](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/root-readiness-check.json), xác nhận cùng trạng thái/isolation, không sửa môi trường hoặc kết nối DB.

Vì runtime không chạy, PostgreSQL/REST rehearsal hiện **NOT RUN / BLOCKED**. Không start/restart, chuyển bản backup sang backend khác, thay quyền actor hoặc giảm assertion để qua gate. Kết quả 74/74 restore và cleanup rollback ngày 28/09 giữ nguyên phạm vi lịch sử, không làm lại và không suy thành chứng minh controller mới.

Metadata role nguồn đã lưu trước đó xác nhận actor `postgres` là NOSUPERUSER/BYPASSRLS. Chưa có phiên chạy controller dưới actor này. Helper cleanup cũ chạy `restore_operator` superuser và khóa mọi bảng provider; không dùng nó làm bằng chứng quyền production.

Container đang dừng không phải khoảng trống duy nhất: config controller dùng TCP URL cho Node `pg`, còn socket `/restore` nằm trong named volume của container; không có đường Node đã kiểm tới socket. Container cũng không có PostgREST nối đúng bản restore. Chỉ khởi động container sẽ chưa đủ gate REST. Không dùng REST của backend khác để chứng minh hook trên DB restore.

### Input vận hành còn thiếu

| Input | Trạng thái/nguồn |
| --- | --- |
| Inventory/backup manifest/metadata | Đã có tại thư mục bảo vệ `backups/cleanup-scope-inventory-20260922.json` và `backups/database-20260928T103619082Z-33e8ff53/`; giữ nguyên proof lịch sử |
| Liên kết restore→backup | `comparison.json` không có trường `backupManifestSha256` hoặc `releaseCatalogHash` mà envelope controller yêu cầu; `restore-input-manifest.json` có liên kết backup. **Chưa có adapter/supplement được kiểm** để tiêu thụ trực tiếp các proof cũ; controller dừng, không sửa comparison hoặc dựng proof PASS |
| Full release catalog/cleanup FK/lock set provenance | Chưa có supplement theo format controller; cần capture thật trên baseline restore đã đối chiếu khi runtime sẵn sàng, không lấy hash giả |
| Prepare proof baseline→prepared + REST | Chưa tạo. Phải bind target/source/bundle, state trước/sau và probe thật; không dùng file fixture test cho release |
| SQL phục hồi prepare | Source có SQL cố định cho baseline không có cả hook/functions/gate/setting; file vận hành pin đúng SQL đó chưa tạo/kiểm trên DB. Controller từ chối baseline đã có prepare tùy biến; không nhận phục hồi definition/ACL tùy ý và không chỉ đặt strict=false |
| Config/REST credential tường minh | Chưa tạo config vận hành, không đọc `.env.local` hoặc credential live để thử |
| Node/socket và PostgREST trên đúng restore | Chưa có transport/runtime được kiểm; không thay môi trường trong phần được giao khi readiness lỗi |

Việc chuẩn bị các input mới không làm mất giá trị backup/restore đã đạt; nó là proof bổ sung cho controller mới. Không ghi các input này là đã sẵn sàng hoặc cho phép commit từ tooling test.

## Code đã hiện thực và đường đọc

| File | Thay đổi/phạm vi |
| --- | --- |
| [permission-release-cutover.mjs](D:/Workspace/pos-cafe/scripts/permission-release-cutover.mjs:69) | Controller riêng: config/proof pin, remote TLS CA, guard actor trước prepare, prepare/probe/restore, cleanup+activation atomic, default rollback, journal và commit-unknown |
| [permission-activation-steps.mjs](D:/Workspace/pos-cafe/scripts/permission-activation-steps.mjs:28) | Tùy chọn `sqlFiles` chứa đúng 11 fragment đã đọc/pin trong bộ nhớ; wrapper synthetic và guard của nó giữ nguyên |
| [permissionReleaseCutover.tool.test.ts](D:/Workspace/pos-cafe/tests/contracts/permissionReleaseCutover.tool.test.ts:1) | Validation/orchestration bằng fixture và dependency injection; không có PostgreSQL/REST runtime claim |

Đường đọc được cung cấp để chủ dự án tự theo dõi: `parseReleaseCutoverConfig` → `loadReleaseEvidence` → `runReleaseCutover` → `executeCutoverTransaction` → shared activation. `verifyBackupDigests` kiểm digest full-row của relation bị khóa và Storage trước xóa; scope/FK/catalog được recheck dưới khóa; tenant phải rỗng trước fragment đầu tiên. Postflight ép deferred constraints chạy, kiểm role/FK/owner triggers và strict gate. Source giữ cả data/catalog/sequence để đối chiếu rollback. Những bảo vệ này đã đọc/review ở source, chưa chứng minh chạy đúng trên actor production.

Prepare chỉ nhận byte đúng `permission-compatibility-prepare.sql` hiện hành; baseline phải chưa có hook/gate/functions/setting. Lý do giới hạn này: SQL pin tùy ý có thể thay dữ liệu trước locked recheck, và restore tùy ý không bảo đảm khôi phục ACL/catalog. Existing prepare tùy biến bị từ chối, không tự ghi đè.

Mode vắng mặc định `rehearsal-rollback`; chỉ `release-commit` mới commit. Commit mode chuẩn bị journal và fsync trước hiệu ứng, không xóa Storage. Mất ACK COMMIT được phân biệt với rollback và commit chắc chắn; khi chưa biết kết quả không tự restore hook. REST bắt buộc endpoint cùng target, không redirect, timeout hữu hạn và header pass-through ở pha chuẩn bị; restore baseline vắng hook đòi header vắng. Runtime phải chứng minh REST thực sự nối cùng DB, loopback URL một mình chưa chứng minh.

## Kiểm tra source hiện hành

- Windows, Node `v24.16.0`, dependency hiện có trong working tree; không đổi lockfile/dependency hoặc runtime. Manifest gắn baseline HEAD + fingerprint toàn source/test và snapshot có thể tái hiện.
- Root chạy `node --check scripts/permission-release-cutover.mjs` và `node --check scripts/permission-activation-steps.mjs`: exit 0.
- Root chạy `node node_modules/vitest/vitest.mjs run --config vitest.permission-tooling.config.ts tests/contracts/permissionReleaseCutover.tool.test.ts tests/contracts/permissionMigrationActivation.tool.test.ts tests/contracts/permissionEmptyActivation.tool.test.ts --reporter=json --outputFile=artifacts/permission-release-controller-20260930/focused-tooling.json`: candidate cuối **25/25 PASS**, gồm 11 controller + 7 activation + 7 empty-target, 0 fail/pending. [Report cuối](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/focused-tooling.json) và [verification source/environment](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/verification.json) xác nhận source trước/sau khớp snapshot `candidate-1790738085822`, 700 đường dẫn. Report 24 ca trước sửa SEC08 giữ tại `focused-tooling-before-sec08.json` cùng manifest/snapshot cũ; không nhận nó là kết quả candidate cuối.
- Builder báo 12 file/179 tooling PASS tại lúc chốt source đầu; chưa có report được root đối chiếu nên không dùng số này làm evidence chính. Không chạy gate tổng/unit/build/browser của sản phẩm.
- Các phép PostgreSQL/REST/accepted bootstrap/fault rollback/prepare ACL restore thật: **NOT RUN**, theo readiness artifact và các input thiếu bên trên. Kết quả 1.139 test lịch sử không gán cho source này.

## Gate còn phải chứng minh bằng runtime

- Prepare hook pass-through có provenance catalog trước/sau, REST probe thật và drift check; hoàn tác đúng function/table/ACL/settings/catalog sau rehearsal.
- Cleanup đúng 77 UUID/closure và empty activation cùng connection, transaction READ COMMITTED; locked recheck FK/scope/data/catalog, strict postflight và sequence.
- Fault sau cleanup và từng fragment trả lại dữ liệu/catalog/sequence; ngoài scope giữ 66 Auth users và toàn bộ Storage metadata.
- Legacy bootstrap đã được nhận/đang đợi trước cutover, gồm Auth user ngoài tập 77, không để lại quán admin cũ hoặc thiếu owner sau cutover. Thu hồi grants/khóa bảng một mình không chứng minh điều này.
- Mặc định rollback; commit chỉ bằng mode tường minh. Journal Storage chỉ chuẩn bị cho API sau DB commit, không SQL-delete metadata và không xóa object trong phần này.

## Review và bàn giao

Hai reviewer đã **APPROVE source-only và tài liệu** trên candidate `candidate-1790738085822`: `cutover_security_review` kiểm tính nguyên tử/quyền/legacy bootstrap; `runtime_investigation` kiểm config/proof/TLS/probe/tooling/evidence. [Biên bản verdict](../reviews/2026-09-30-permission-release-controller.md) giữ candidate và giới hạn từng reviewer. **Cả hai ghi gate vận hành BLOCKED**, không có release approval. Đường đọc code đã cung cấp bên trên; chưa có phản hồi chủ dự án hoặc lượt giải thích tương tác, không tự ghi đã nghiệm thu.

### Findings bản nháp (chưa phải verdict candidate cuối)

Hai reviewer không sửa source. Các findings được giao lại builder để xử lý; bảng này giữ lịch sử bản nháp, không mô tả bản cuối.

| Mã/phạm vi | Finding bản nháp | Điều kiện kiểm lại |
| --- | --- | --- |
| SEC01, tính toàn vẹn | Chỉ kiểm UUID/count và suy closure từ dữ liệu hiện tại có thể xóa dữ liệu mới cùng store | So full-row digest pin từ backup dưới khóa trước hiệu ứng |
| SEC02 / PROBE03 | Status/body của inert probe không chứng minh hook; URL bất kỳ có thể nhận credential | Pin origin/path và header pass-through; chặn redirect; timeout hữu hạn |
| SEC03 / JOURNAL07 | Ghi journal sau COMMIT thất bại bị báo BLOCKED dù DB đã commit | Chuẩn bị journal bền trước hiệu ứng; ghi chính xác kết quả commit hoặc unknown |
| SEC04 / SOURCE | Không recheck source/bundle trước COMMIT | Recheck source và bundle ngay trước kết thúc transaction; không dùng fragment thay byte |
| SEC05 / PREPARE02 | Chỉ đọc setting database-specific bỏ setting ALTER ROLE global | Capture đủ setting global/database và function/table/ACL/catalog; phục hồi so baseline |
| SEC06 | Fetch REST không timeout có thể treo sau committed prepare | Timeout, phục hồi prepare trong đường lỗi |
| PREPARE01 | Scanner keyword từ chối chính SQL prepare hiện hành có INSERT vào singleton | Scope prepare được pin cụ thể, không bỏ guard để nhận SQL tùy ý |
| TARGET04 | Guard actor/database chỉ diễn ra sau committed prepare | Kiểm target/actor trước mọi mutation prepare |
| PROOF05 | Proof restore hiện có không chứa trường backupManifestSha256 do controller tự yêu cầu | Nối qua restore-input/execution pin đã tồn tại; không sửa proof lịch sử hoặc dựng PASS |
| MODE06 | Thiếu mode bị từ chối, chưa đúng mặc định rollback | Mode vắng mặc định rehearsal-rollback; commit chỉ mode tường minh |
| AUTH-CATALOG | Inventory hiện có không bao phủ catalog schema auth | Pin/recheck FK và lock closure gồm Auth; không mở rộng closure khi FK drift |
| SEC07 | Restore probe đòi pass-through dù baseline chưa có hook | Expected header vắng tường minh trên cùng origin; không dùng endpoint chỉ xuất hiện sau activation |
| SEC08 | Mất ACK COMMIT bị suy là rollback và tự restore prepare | Ghi COMMIT_OUTCOME_UNKNOWN, giữ journal, không tự restore hook hoặc xác nhận rollback |

**Runtime vẫn BLOCKED:** source/test giả lập không thay diễn tập accepted legacy bootstrap, full data/catalog/sequence rollback hoặc prepare REST/ACL restore thật.

## Điểm tiếp tục và ranh giới dừng

Phần 1 có candidate code và kiểm tra source; chưa đạt gate vận hành. Khi được chọn tiếp tục phần này, cần xử lý readiness/transport Node+PostgREST trên đúng restore cách ly và chuẩn bị adapter/supplement proof pin từ evidence thật. Sau đó mới chạy dưới `postgres` NOSUPERUSER/BYPASSRLS: pass-through REST, locked exact-scope cleanup+activation, lỗi sau cleanup/từng fragment/trước commit, đối chiếu toàn bộ dữ liệu/catalog/sequence và restore prepare, lịch legacy bootstrap đã nhận/chờ cả user ngoài 77. Cần review evidence runtime riêng; không tự mở khóa commit mode từ review source.

Không dùng count 77 lịch sử để xóa dữ liệu phát sinh mới. Không làm lại backup/restore đã đạt để che thiếu proof controller. Các phần MCP, gate tổng sản phẩm, UI hoãn và live release/Storage API vẫn ngoài phạm vi; phiên này dừng tại handoff source-only này.

File docs cập nhật trong phiên: log này; `docs/reviews/2026-09-30-permission-release-controller.md`; `docs/implementation-log/README.md`; `docs/workflow/tasks/redesign-permission-model.md`; `docs/workflow/tasks/README.md`. Không sửa bộ spec hoặc checkpoint lịch sử 28/09; design §8.2.1/TC53 vẫn là gate bắt buộc chưa đạt runtime.

## Tiếp tục được duyệt và recovery — 01/10/2026

Chủ dự án duyệt tiếp tục chỉ phần 1 qua lượt giao trong chính chat này: cấu hình dịch vụ local cách ly, diễn tập thật, sửa lỗi trong phạm vi, commit/ACK chỉ trên bản sao thử được nhận diện. Giữ backup/proof/credential ngoài Git và mọi dirty changes của main/docs. Không push/deploy, không sửa quyền/dữ liệu live, không xóa Storage thật, không khôi phục MCP, không sửa UI hoặc chạy gate tổng. Quyền cấu hình local mới thay giới hạn handoff source-only 30/09; không mở quyền live.

Trước mutation mới, root kiểm container/process/transaction/lock/schema/data/journal. Không còn transaction hoạt động hoặc prepared transaction; 77 stores, 143 Auth users, 3 Storage objects. Prepare đã commit, strict=false/contract=2 và hash khớp prepared đã pin; 62 bảng khớp backup; không journal/commit marker. Không mặc định interruption đã rollback: kiểm DB thật cho thấy cutover chưa commit, còn prepare phải hoàn tác. Sau đó chạy đúng fixed restore SQL; catalog/functions/table/ACL/settings khớp baseline, REST404/header vắng. Hai lượt đối chiếu74/74 sau recovery và sau fault hiện hành PASS. Giữ resume-audit-20261001.json, resume-fixed-restore-20261001.json, resume-state-20261001.txt ngoài Git.

### Candidate và môi trường

- HEAD vẫn main@ef2c372aec60d8362549e47b7aedb27126129479 cộng dirty tree; source hiện hành fdedcfc792fa3fc663353ed534f82daf69376f136e6ab168494a00d642aec0ef, snapshot704 paths. Bundle36a081f9478c159d303f2db1d5cb972faace081042192661c9123dc730f7dd70. [Manifest](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/source-manifest-runtime-current.json).
- Root chạy lại 3 file tooling:34/34 PASS (controller17, rehearsal10, empty activation7). [Report source hiện hành](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/focused-tooling-current-20261001.json). Reports25/29/32 và fingerprints a61/8485/e209 giữ lịch sử, không gán cho candidate cuối. Syntax checks 5 scripts exit0.
- Restore gốc pos-cafe-restore-1790593558895-4c7ba556 và volume gốc vẫn dừng/không sửa. Runner pos-cafe-release-rehearsal-1790738842939 dùng copy offline từ volume gốc mount read-only, network none, không published ports, socket /restore; PG17.6 image pin sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb.
- Node24.16.0/pg và PostgREST16.2 nối chính socket/volume này; REST chỉ loopback3000, proxy3001 chỉ chuyển probe path, không tạo header/marker. Nonce RPC tạo/đọc/xóa thật chứng minh REST↔DB, helper source giữ/pin. Không suy hosted gateway từ proxy này.
- Clone table/advisory/ack suffix1790828326340 và clone table-retry-1790828838261 đều có volume riêng, copy offline read-only từ restore gốc, Node/PostgREST riêng, config/proof/profile riêng. Không reset clone table lỗi để lấy PASS.
- Adapter giữ nguyên4 artifact restore lịch sử, pin lineage/backup rồi tạo supplement+prepare proof mới bằng 62-table REPEATABLE READ READ ONLY comparison. Unix-socket chỉ cho rehearsal; release-commit không nhận socket.
- Hai payload Storage814829 byte đối chiếu hash với backup/report API restore lịch sử. Phiên này không phát sinh Storage API mutation.

### Quyền gốc, augmentation và điều kiện triển khai

Actor gốc current_user=session_user=postgres, NOSUPERUSER/BYPASSRLS/CREATEROLE. Runtime đầu42501 khi ALTER ROLE authenticator SET pgrst.db_pre_request; sau SET riêng trong clone, fragment menu images42501 must be owner of relation objects khi DROP POLICY storage.objects. ALL table privileges không thay owner authority.

Runner logical restore dùng shared_preload_libraries rỗng; không tái hiện hook đặc quyền/provider configuration của live. Các capability guard hiện hành là contract fail-closed của controller trên PostgreSQL đã kiểm, không phải kết luận rằng hai GRANT này là quyền tối thiểu phổ quát cho Supabase. Cần xác minh cơ chế provider trước quyết định triển khai, không grant live chỉ vì clone thiếu quyền.

| Capability | Baseline gốc | Diagnostic clone bổ sung |
| --- | --- | --- |
| postgres superuser/BYPASSRLS | false/true | false/true |
| SET pgrst.db_pre_request | false; pg_parameter_acl không có row | GRANT SET bởi supabase_admin |
| Storage owner | false; không member supabase_storage_admin | GRANT supabase_storage_admin TO postgres WITH INHERIT TRUE, SET FALSE |
| Quyền live | Chưa đọc/kiểm live | Không suy từ quyền clone |

privilege-setup.json và storage-owner-augmentation.json giữ SQL/actor/provenance. execution-profile-final.json pin source/config/proofs, setup hashes và actual parameter ACL/membership/capability trước run. Storage owner membership cho quyền owner trên object của role đó, rộng hơn riêng DROP POLICY; không gọi nó là grant tối thiểu riêng một policy, không áp dụng live. Không bổ sung quyền rộng hơn hai augmentation đã ghi.

Backup roles-no-passwords.sql không ghi parameter grant; reviewer xác minh pg_dumpall --roles-only PG17 có khả năng xuất GRANT ON PARAMETER. 74 checks/catalog metadata lịch sử không kiểm pg_parameter_acl. Supplement quyền tách khỏi PASS lịch sử, không chứng minh quyền live.

Sau diễn tập, root thu hồi cả hai augmentation trên clone rollback: raw pg_parameter_acl=[] và membership=[], effective capabilities khớp gốc, prepare/catalog baseline gốc khớp, REST404/header vắng. Controller source cuối trả STORAGE_OBJECTS_OWNERSHIP_REQUIRED khi thiếu owner, rồi PGRST_PARAMETER_SET_PRIVILEGE_REQUIRED khi thiếu SET, đều trước prepare. original-rights-restored-guard.json giữ bằng chứng. Clone commit vẫn giữ trạng thái diagnostic được nhận diện.

**Contract triển khai:** chỉ chạy khi actor NOSUPERUSER/BYPASSRLS/CREATEROLE có SET parameter và effective Storage owner capability, cùng proof/binding/prepared provenance/locked checks đạt. Thiếu capability thì dừng trước hiệu ứng; không auto-grant hoặc đổi actor live. Bước tiếp theo cần đọc quyền live khi được giao riêng và chọn cơ chế deployment/DDL được provider hỗ trợ, duyệt phạm vi quyền. Nếu cần đổi atomic transaction/ownership phải thiết kế/review riêng. **Release-readiness phần1 vẫn BLOCKED do contract quyền production chưa được chứng minh/chốt.**

### Runtime source hiện hành

| Phép kiểm | Bằng chứng thật |
| --- | --- |
| Default rollback/control | PASS: approved77 UUID, 2801 row/33 relations, cleanup+11 fragments một connection READ COMMITTED; target rỗng trước fragment0; strict postflight5 roles gồm waiter, 15 permissions, validated FK/deferred owner triggers; rollback và restore prepare |
| Fault matrix | 15/15 PASS:control-before, sau cleanup, sau fragment0–10, trước commit, control-after. SQL SHA/backend PID/XID/isolation trace chứng minh cùng transaction; không dùng mocks cho verdict runtime |
| Rollback cuối | 62 whole tables, data/catalog/prepare functions/table/ACL/settings khớp baseline;3 sequences khớp;74/74 PASS. Parameter ACL/membership khớp augmented profile khi chạy và về gốc sau revoke |
| Legacy advisory→commit | authenticated được EXECUTE RPC thật, Auth principal ngoài77; bootstrap đã vào/chờ advisory, rồi chờ relation dưới cutover barrier. Sau commit không store/employee/admin cũ của principal, Auth user còn |
| Legacy relation→bootstrap completes | Clone table-retry PASS:RPC đã nhận/chờ relation; bootstrap hoàn tất trước locked precheck. Cutover LOCKED_SCOPE_DRIFT, không commit.77 stores cũ giữ nguyên; thêm đúng store/settings/admin fixture ngoài scope.59 whole tables+3 backup remainders khớp, chỉ loại đúng3 fixture rows trong phép đối chiếu riêng |
| Harness cancel thực | Tiêm observer failure khi RPC cũ đang chờ; controller thật tới beforeCommit guard và bị hủy; outcome KNOWN, không marker commit;62 bảng+prepare baseline phục hồi |
| ACK loss | Clone ack:COMMIT thật rồi tiêm client08006 sau server ACK; caller DATABASE_COMMIT_OUTCOME_UNKNOWN, không tự restore prepare/ghi marker khẳng định commit; independent connection xác nhận DB committed. Giữ prepared journal. Đây là mô phỏng lỗi client sau COMMIT thật, không phải đo network mất ACK vật lý |
| Ngoài scope | Full-row hash66 Auth users và cả3 Storage metadata khớp precommit baseline ở4 variants;3 sequences nguyên trạng. Hai clone commit còn đối chiếu 7 whole Storage tables và toàn bộ bucket rows cũ với backup; chỉ thêm staging bucket đúng fragment đã duyệt. Không SQL-delete Storage, không API delete |

Mọi PASS trong bảng có điều kiện hai augmentation local. Không chứng minh quyền production gốc, hosted gateway, Realtime delivery, Storage API cleanup, UI, gate tổng hoặc release approval.

### Lỗi runtime đã xử lý và lịch sử giữ nguyên

- Exact role postflight cũ thiếu waiter: sửa đúng5 roles, giữ15 permissions/FK/owner constraints.
- Rollback baseline trước locks có thể coi commit bên ngoài là rollback loss: capture dưới locks, sau scope/data/prepared checks, trước cleanup. Precheck drift giữ code; sau mutation vẫn kiểm rollback nghiêm ngặt.
- Cleanup harness cũ rollback bootstrap trước nhả blocker có thể kẹt: nhả blocker trước, settle/rollback/close riêng với bound.
- Stats transaction snapshot cũ: pg_stat_clear_snapshot trước mỗi poll; wait evidence ghi PID/backend XID/state/wait type/event.
- **Ca table lỗi đã commit thật trong clone thử:** observer timeout, harness rollback bootstrap nhưng controller chạy nền và commit. Clone table-1790828326340 giữ0 stores/66 Auth/3 Storage và committed marker; classification FAILED_CASE_WITH_DATABASE_COMMITTED, không nhận PASS legacy. Sửa beforeCommit guard cả2 variants:table không commit; lỗi harness abort trước nhả waits; chờ controller outcome có bound, timeout UNKNOWN. Cancel thực và table-retry chứng minh sửa.

Không sửa old proof để dựng PASS;42501, timeout, source/test/proof cũ và clone committed lỗi đều giữ.

### Evidence, review và bàn giao

Raw reports/configs/UUID/trace và helper tái hiện ở C:/Users/nguye/AppData/Local/pos-cafe-release/backups/controller-runtime-20260930/. Export evidence-20261001 loại mọi anon-jwt; credential vẫn ngoài Git. [Evidence manifest](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/runtime-evidence-manifest-20261001.json) và [verification](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/runtime-verification-20261001.json) pin source/environment/report hashes; artifacts chỉ metadata an toàn. Chưa commit/push.

Hai review hiện hành:security/atomicity/legacy/journal và topology/proof/source/report fidelity. Không kế thừa source-only approval 30/09. [Biên bản](../reviews/2026-09-30-permission-release-controller.md) đã có **APPROVE** cuối từ cả hai reviewer cho source fdedcfc, runtime diagnostic có điều kiện và 5 tài liệu/handoff; không có production/release approval.

Đường đọc:permission-release-cutover.mjs (role→proof→prepare/probe→lock/recheck→cleanup/shared activation→outcome); permission-release-rehearsal.mjs (adapter/fresh snapshot→fault matrix→client concurrency/abort); permission-release-rest-proxy.mjs và permission-release-transport-probe.mjs (REST binding). Đã cung cấp walkthrough bằng đường đọc; chưa có phản hồi chủ dự án, không ghi nghiệm thu tương tác.

Code và verification local có kết quả reviewable; **release vẫn BLOCKED ở quyền production**. Dừng phần1/handoff này, không tiếp tục MCP/UI/gate tổng/Storage API/live release.

Dọn phiên local sau review: đã kiểm không còn active/prepared test transaction, rồi dừng 15 container riêng của 5 clone; giữ nguyên volume, journal, proof và clone lỗi để kiểm lại. Không dừng hoặc đổi container ngoài phạm vi. [Trạng thái dịch vụ](D:/Workspace/pos-cafe/artifacts/permission-release-controller-20260930/services-parked-20261001.json). Local được phép khởi động lại khi tiếp tục; trạng thái parked không phải lý do quyền production BLOCKED.
