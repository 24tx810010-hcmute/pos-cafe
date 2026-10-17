# Kiểm tiến độ phân quyền, file tạm và khả năng push — 15/10/2026

## Kết quả và phạm vi

**Chưa sẵn sàng push toàn bộ candidate lên `main` hoặc phát hành.** Database online vẫn là contract legacy; frontend hiện tại đòi permission contract 2. HP1 nguồn58 có bằng chứng actual LOCAL harness 75 PASS, nhưng chưa đủ full gate/review cuối. Dependency audit mới vẫn có 7 findings. Không push, stage, commit, xóa file, chạy migration, sửa dữ liệu online hoặc dựng lại WSL/Docker trong phiên khảo sát này.

Yêu cầu của chủ dự án trong chat ngày15/10: tổng hợp code và docs liên quan phân quyền; chỉ ra file temp, nội dung/mục đích/tác động xóa; đánh giá push nhưng đợi lệnh; kiểm database online. Chủ dự án chọn bật MCP `pos_cafe_supabase_ro`, tự tạo và nhập PAT qua ô ẩn, sau đó xác nhận “Tôi đã lưu token rồi… Chưa push hay xóa gì.” Đây là **khảo sát/đánh giá**, không giao sửa ứng dụng hoặc phát hành.

Mức nhạy cảm: quyền/danh tính và trạng thái database. Kết luận chỉ thuộc phạm vi khảo sát; không đóng task sản phẩm, HP1, T17/T18 hoặc PIN-T07.

## Source và Git đã đối chiếu

| Worktree | HEAD | Thay đổi trước khi thêm hồ sơ audit này |
| --- | --- | --- |
| `D:/Workspace/pos-cafe`, `main` | `5156820f7d6679cd6f8051bdc38419737ffa0c7e` | 122 modified + 2 deleted + 370 untracked = **494 file** |
| `D:/Workspace/pos-cafe-docs`, `docs` | `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19` | 23 modified + 270 untracked = **293 file** |

Đếm bằng `git status --porcelain=v1 -z -uall`; số đếm không dùng `-uall` trước đó gộp thư mục mới, không phải số file. Đây là toàn bộ thay đổi hai checkout, có cả UI redesign/workflow và feature dự kiến ngoài phân quyền; không gán toàn bộ cho feature permission. Danh sách path/status/hash và bản sao **785 file hiện tồn tại** cùng2deletion markers ở [local-inventory.json](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/local-inventory.json) và thư mục `source/main`, `source/docs` bên cạnh. Tổng source copy8.718.086 bytes; file không đổi phục hồi từ HEAD tương ứng. Đây là snapshot khảo sát, không phải gói phát hành.

`git ls-remote --heads origin main docs` đọc mới xác nhận remote `main` bằng HEAD local; remote `docs=132e9d6cc065459031ee92cfbafcd423b5ac81c5`. Nhánh docs local đang hơn remote2commit, chưa kể working tree. Không fetch/push. Không có thay đổi phân quyền working tree nào tự trở thành nội dung remote chỉ vì HEAD khớp.

## Tổng hợp thay đổi code

| Nhóm | Thay đổi đọc được và mục đích | Nguồn chính |
| --- | --- | --- |
| Domain/catalog | 5 mã role `owner/manager/cashier/waiter/kitchen`; `kitchen` đang disabled/dự phòng, 3role nhân viên được chọn;15permission, default/grant/deny, revision catalog và nhân viên; `floor.view` baseline, `data.clearDemo` owner-only | [permissions.ts:1](D:/Workspace/pos-cafe/src/domain/permissions.ts:1), [catalog](D:/Workspace/pos-cafe/src/seed/permissionCatalog.json:1) |
| Authority và vòng đời | Chỉ cho phép khi authority đã verified/catalog đúng revision; ràng buộc cache với identity/generation/purpose, chặn response cũ sau logout hoặc đổi quyền | [permissionAuthority.ts:18](D:/Workspace/pos-cafe/src/core/permissionAuthority.ts:18), [permissionLifecycle.ts:1](D:/Workspace/pos-cafe/src/core/permissionLifecycle.ts:1), [permissionSession.ts:1](D:/Workspace/pos-cafe/src/features/shared/permissionSession.ts:1) |
| Ports/adapters | Browser dùng `PermissionRuntimePorts`; mock và Supabase có identity/admin/read/changes/signals/images/print; giữ legacy adapter riêng cho kiểm thử/chuyển tiếp | [ports:152](D:/Workspace/pos-cafe/src/ports/index.ts:152), [runtime:29](D:/Workspace/pos-cafe/src/app/runtimePorts.ts:29) |
| UI/PIN/onboarding | Compatibility gate, bắt đổi PIN tạm, lifecycle quyền/seed; chỉnh quản trị nhân viên, quyền điều hướng/thao tác, receipt và vòng đời drawer | [App lifecycle:118](D:/Workspace/pos-cafe/src/app/App.tsx:118), [PIN gate:122](D:/Workspace/pos-cafe/src/app/App.tsx:122), [compatibility:9](D:/Workspace/pos-cafe/src/app/compatibilityGate.ts:9) |
| SQL bridge | Migration017 thêm catalog/roles/defaults/revision và legacy bridge, **chưa activation** | [017:1](D:/Workspace/pos-cafe/supabase/migrations/017_permission_catalog_bridge.sql:1) |
| SQL candidate | 11fragment cho identity/owner invariant/PIN/session, employee admin/audit, financial/read projections, changes, seed, images/print/signals và compatibility; entry point/RPC thực thi quyền, thu hồi direct access tương ứng | [identity:11](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:11), [admin:308](D:/Workspace/pos-cafe/supabase/candidate/permission-administration.sql:308), [financial:231](D:/Workspace/pos-cafe/supabase/candidate/permission-financial.sql:231), [read:367](D:/Workspace/pos-cafe/supabase/candidate/permission-read.sql:367) |
| Ảnh/in/Realtime | Gateway và public-image Edge handlers, private staging theo candidate; receipt authorization, tín hiệu store/catalog thay vì suy quyền từ UI | [gateway:20](D:/Workspace/pos-cafe/supabase/functions/menu-image-gateway/index.ts:20), [public:7](D:/Workspace/pos-cafe/supabase/functions/menu-image-public/index.ts:7), [signals:4](D:/Workspace/pos-cafe/supabase/candidate/permission-signals.sql:4) |
| Tooling và test | Contract/Playwright cho role, direct DB, forced PIN, lost ACK/race/expiry, images, Realtime, activation/rollback; controller, backupv2 và HP1 producer/comparator/loader | [activation:33](D:/Workspace/pos-cafe/scripts/permission-activation-steps.mjs:33), [hosted comparison:39](D:/Workspace/pos-cafe/scripts/permission-hosted-compare.mjs:39) |
| Thay đổi kèm theo | Dependency remediation/npm+pnpm locks, UI audit tooling, portal/lifetime; cần phân scope khi đóng gói commit. Hai file `useRealtimeInvalidation.ts` và test cũ đang deletion markers; không tự khôi phục hoặc coi là temp | [package](D:/Workspace/pos-cafe/package.json:1), [inventory](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/local-inventory.json) |

Đây là tổng hợp kiến trúc/chức năng từ source, không phải review từng dòng của toàn bộ494file hoặc chứng nhận runtime. File mới chưa tracked không tự là lỗi hay rác; bỏ chúng khỏi commit có thể làm thiếu implementation/test.

## Tài liệu và tiến độ thực

Docs thay đổi gồm bộ spec7artifact permission, forced-PIN và provider guard, architecture/data-model/features/testing/limitations/roadmap; implementation log, review, runbook, task handoff qua các mốc15/09→15/10. Các proposal/UI redesign ngoài phạm vi được giữ riêng trong inventory, không mặc định đã triển khai hoặc thuộc permission.

| Mốc | Bằng chứng hiện có | Giới hạn hiện tại |
| --- | --- | --- |
| CLOSE-2 nguồn 31 | [Handoff nguồn 31](../workflow/tasks/permission-close2-source31-2026-10-13.md) khóa PIN19/PERM60 và TC47 local; SEC/EVC APPROVE đúng candidate nguồn 31 | Bằng chứng lịch sử riêng, không chuyển approval sang nguồn 34/58 |
| npm remediation nguồn 34 | [Handoff nguồn 34](../workflow/tasks/permission-npm-remediation-2026-10-13.md) có unit1173/PIN19/PERM60; [SEC/EVC cùng APPROVE](../reviews/2026-10-13-permission-npm-remediation.md) candidate SHA `7d3aa43aa600ba98d1422fe80d4f9661a6a043905890b7df26bee96b5681b03c` | Là local verification sau sửa inventory/dependency/TC02; phát hành vẫn BLOCKED, không cấp hosted readiness |
| Backupv2 source40 | Slice LOCAL được review APPROVE | Không đủ C/Storage/L hosted |
| HP1 source56/57 | Execution lịch sử; SEC candidate01 CHANGES_REQUESTED, preliminary57 còn exporter identity/log finding | Không có APPROVE cuối thay thế trên source58 |
| HP1 source58 | Receipt actual harness exit0 ngày14/10; log **75PASS/0FAIL**; manifest/tar/log SHA được kiểm lại trong lượt này.835entry gồm833file và2deletion markers khớp source hiện tại | Không rerun actual harness; không replay raw private; chưa có full unit/tooling/build/PIN19/PERM60 aggregate58 hoặc SEC→EVC cuối |
| Sau xóa WSL | Source Windows và source58 tar còn; runtime/volumes/raw chỉ trong Ubuntu đã mất | Không tự dựng lại môi trường; không đổi gate để tiết kiệm ổ |

Nguồn58: [receipt](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/hp1-local58.json), [log](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/hp1-local58.log), [kiểm hash](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/evidence-check.json), [manifest](D:/Workspace/pos-cafe/artifacts/permission-hosted-hp1-20261014/source-58.json). Manifest SHA `10e9c2d879ae881c34561f2e97a0a617f988b92b01aab1ea65be0ddf85831a0f`; tar SHA `f7fe96849ef2713d1841aa01e52ed960b34e822eceaa7ea1219d722a40646c33`. Không gộp75checks với60TC/19PIN thành một PASS tổng.

**Evidence thất lạc cần ghi đúng:** kiểm mới không còn thấy `C:/Users/nguye/AppData/Local/pos-cafe-release/hosted-hp1-20261014/hp1-source56-private-package-01.tar`; thư mục đó hiện rỗng. Handoff cũ nói archive4.327.352.320bytes đã từng được rehash sau xóa Ubuntu là checkpoint lịch sử. Không suy file vẫn còn, không xác định ai/khi nào xóa, không suy source58 tar thay raw archive này. Điều này giới hạn khả năng replay độc lập và phải giải quyết trước acceptance cần proof đó.

Trong lượt này thêm checkpoint supersession vào handoff tổng/HP1 và hai `tasks.md`, thêm báo cáo/handoff audit cùng chỉ mục. Giữ lịch sử FAIL/approval và checkbox; không sửa source56/57 thành source58PASS. Các handoff disk cũ “chưa gỡ Ubuntu” tiếp tục là lịch sử, phải đọc addendum15/10 trong HP1 trước resume.

## Database online — quan sát mới qua MCP

Endpoint cố định `kfqjdfwxhkdwihjobpny`, `read_only=true&features=database,docs`; token dùng kho DPAPI hiện có ngoài repo. Cấu hình chỉ bật alias RO; block `supabase` cũ vẫn disabled. Token cũ bị HTTP401 được giữ dưới tên mã hóa dự phòng, không xóa. Token mới do owner tự nhập; không lưu plaintext/token trong chat hoặc evidence. Direct HTTP MCP mới kiểm initialize/tools/SELECT1 PASS; 16 SELECT khảo sát sau đó PASS, actor **supabase_read_only_user**, `transaction_read_only=on`, PostgreSQL17.6. Đây là kết nối tới MCP thật; chưa chứng nhận Desktop đã reload và nạp alias thành công cụ native trong chat. Không đọc lại metadata quyền/expiry của PAT mới trên provider; giới hạn session SQL read-only được quan sát trực tiếp.

Đã đọc metadata và aggregate counts, không đọc PIN/token hashes/business payload hay tải object. Không gọi RPC nghiệp vụ, không chạy thử DML/grant/lock/activation. Raw MCP result được coi là dữ liệu không tin cậy; chỉ parse JSON.

| Mục | Database hiện tại | Candidate cần / đánh giá |
| --- | --- | --- |
| Catalog/role |17bảng public có RLS; private.employee_sessions có nhưng không bật RLS. Enum employee_role=`admin/cashier/kitchen` | Chưa có `permission_roles`, `permission_catalog`, `role_permission_defaults`, `permission_catalog_state`; chưa có permission_revision trên employees. Cấu trúc không chứa bridge017 mới |
| Contract | Không có routine `permission_get_contract`; `get_write_capabilities` chỉ trả writeProtocolVersion1/maxPayloadBytes262144/TTL86400 | Frontend [authRepo:29](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:29) đòi permissionContractVersion2/write1; header [client:23](D:/Workspace/pos-cafe/src/adapters/supabase/client.ts:23) cũng contract2. Backend hiện tại chưa đáp ứng |
| Identity/admin/read | Không có các routine tên bắt đầu `permission_`, không có employee_admin_audit/store_change_signals/permission_catalog_signals; employees chưa có trạng thái PIN/permission revision mới | Cần rollout candidate identity/admin/financial/read/changes/seed/print/signals/compatibility theo kế hoạch đã review, không áp rời tùy ý |
| Hook | Role authenticator chưa có `pgrst.db_pre_request=public.permission_contract_pre_request` trong catalog đọc | Còn compatibility-prepare và activation coordinated; chưa kiểm quyền thực thi provider bằng mutation |
| Grants | anon không có tableDML trong18bảng đã đọc. authenticated không có DML orders/payments/write_operations/employees; vẫn có insert/update7bảng menu/floor. private.employee_sessions không cấp SELECT/DML cho anon/authenticated/service_role | Đây là legacy catalog; RLS/grants không tự chứng minh behavior deny của candidate. Không gọi private table thiếu RLS là lỗ hổng chỉ từ cờ RLS |
| Storage |1bucket PUBLIC `menu-item-images`,3objects,4legacy policies. Chưa có staging bucket candidate | Candidate cần private staging/gateway, kiểm direct bypass, payload preservation và control thật. Public bucket không đồng nghĩa public write |
| Realtime |12bảng legacy trong supabase_realtime, chưa có tín hiệu quyền mới | Chưa đủ chứng nhận invalidation/revocation contract mới |
| Migration history | `to_regclass('supabase_migrations.schema_migrations')=null` | Không thể xác nhận “đã apply tới migrationN” bằng lịch sử; chỉ kết luận từ cấu trúc/functions vừa đọc |

Counts lúc08:52Bangkok: **79stores,158employees,83orders,70payments,0write_operations,145Authusers,1bucket/3objects**. Role active:79admin,77cashier,1kitchen;1cashier inactive. Counts tương thích tổng checkpoint79/145/3 nhưng **không chứng minh exact IDs/full rows/allowlist không drift**, cũng không cấp quyền xóa. Giữ nguyên quyết định exact79/66Auth/3objects/delete2; cần recheck theo manifest riêng trước bất kỳ cutover. Không lấy hiệu145−79 làm proof bảo toàn tập66.

Evidence: [catalog normalized](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/online-catalog-normalized.json), [detail normalized](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/online-detail-normalized.json), raw receipts/query strings/client script cùng thư mục. Metadata quan sát khoảng08:51–08:53ngày15/10, không phải một snapshot transaction xuyên suốt16request. Catalog/row có thể đổi sau quan sát. Database Read không kiểm Edge deployment/secrets/JWT/frontend env; Edge absent ở dashboard07/10 chỉ là lịch sử, chưa nhận thành quan sát mới.

**Đánh giá đủ/chưa đủ:** cấu trúc quan sát được vẫn thuộc mô hình legacy; chưa đáp ứng frontend permission candidate hiện tại. Không có test hành vi online mới để chứng nhận backend legacy hoạt động đầy đủ. Cần bridge 017 và toàn gói activation tương thích, images/signals/backend/frontend/env và postflight đúng kế hoạch sau khi các gate/ủy quyền đủ. Backup/full-row C/Storage/L, actor/control và phê duyệt action/window vẫn thiếu; chưa có cơ sở áp SQL ngay trong lượt khảo sát.

## Kiểm tra mới và giới hạn

| Kiểm | Kết quả mới | Ý nghĩa |
| --- | --- | --- |
| MCP và16SELECT | PASS | Chỉ quan sát read-only, không phải runtime permission tests |
| Source58 manifest |835/835khớp, tar/log hash khớp | Không drift trong manifest; không thay reviewer/gate toàn dự án |
| TypeScript app | `node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit --incremental false`, exit0 | Không emit/build hoặc ghi đè dist |
| TypeScript config | `node node_modules/typescript/bin/tsc --project tsconfig.node.json --noEmit --composite false --incremental false`, exit0 | Kiểm kiểu với composite tắt để không ghi buildinfo; không thay build chính thức |
| Dependency audit | `npm.cmd audit --json --ignore-scripts`, exit1; **5high+2moderate** | [Receipt](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/npm-audit-receipt.json), [report](D:/Workspace/pos-cafe/artifacts/permission-progress-audit-20261015/npm-audit.json). Không audit fix/install/upgrade |

**11 dependency trực tiếp trong node_modules khác exact version của package-lock**: Supabase JS, TanStack Query, Playwright, jest-dom, user-event, @types/node, plugin-react, autoprefixer, postcss, vite, vitest. Ví dụ Vite installed 8.2.1/lock 8.0.16; Vitest installed 4.1.10/lock 4.1.11. Vì vậy typecheck PASS thuộc môi trường Windows hiện có, không nhận là clean lock install hoặc full gate có thể tái hiện. Chi tiết versions và lock SHA ở local-inventory. Không chạy npm ci để tự sửa môi trường trong task khảo sát; không cài thêm dependencies.

Audit findings: high ở braces/chokidar/fast-glob/micromatch/tailwindcss, moderate ở postcss-nested/postcss-selector-parser. Đây là 7 package findings, không khẳng định 7 CVE độc lập. Giữ quyết định Tailwind 3/chờ upstream hiện hành; không tự nâng Tailwind 4/override hoặc chấp nhận residual risk. Chưa đánh giá lại mọi phương án remediation/upstream trong lượt này.

Không chạy mới unit, buildVite, UIaudit, browser, PIN19/PERM60 hoặc DBintegration; không biến chúng thànhFAIL chỉ vì chưa chạy, nhưng release gate chưa được chứng nhận. Không thay baselineUI hoặc acceptance.

## File tạm và đề xuất dọn — chưa xóa

Các số sau là **logical bytes**, không phải allocation thực được cam kết thu hồi; chưa đo compression/sparse/hardlink. Không coi ignored/untracked là temp.

| Nhóm/path dưới `D:/Workspace/pos-cafe` | Nội dung và mục đích | Sốfile / bytes | Nếu xóa và đề xuất |
| --- | --- | --- | --- |
| `.tmp-full-test.log`, `.tmp-full-test-ui.log` | Log full test/UI17/09; được đánh dấu đích danh mới trong `.gitignore`; không tìm thấy refs trong phạm vi source/docs đã search |2 / **2.211.286** | Mất log chẩn đoán cũ, không mất source; **ứng viên rõ nhất**, chỉ xóa sau lệnh riêng |
| `dist/` | Bundle build frontend |154 / **7.528.708** | Preview thiếu build cho tới build lại; không thấy evidence dùng root này. Candidate dọn khi không cần bản build hiện có |
| `coverage/` | ReportHTML/JSONcoverage |42 / **503.077** | Mất report cũ, có thể sinh lại; candidate dọn |
| `test-results/.last-run.json` | Trạng thái Playwright cuối, không có failedTests |1 / **45** | Mất trạng thái last-run, không mất testcase; candidate nhỏ |
| `supabase/.temp/cli-latest` | Cache chuỗi versionCLI `v2.120.0`, marker `.temp` mới đượcignore |1 / **8** | CLI có thể tạo lại; không phải migration/schema; candidate nhỏ |
| `ui-audit/report.md`, `report.json`, `out/` | Report/ảnh annotated dùng kiểm audit |31 / **1.540.341** | **Giữ**: docs còn dẫn root. Report hiện khác hash lịch sử; chưa có proof snapshot đủ để dọn |

Tổng **200 file/10.243.124 bytes (~9,77 MiB)** cho các nhóm candidate trừ UI. Hai log trong đó khoảng 2,11 MiB. Chỉ là đề xuất; không có quyền cleanup trong lượt này.

`ui-audit/report.md` hiện 2421 bytes, JSON 5794 bytes; hash report hiện `463f…` khác hash `894f…` dẫn tại [close2 evidence:32](permission-close2-evidence-2026-10-11.md:32). Root generated report đã thay theo lần chạy; link cũ không cố định evidence cũ. Chưa thấy bản byte-identical trong các path `artifacts/**/ui-audit/report.md` đã kiểm, không khẳng định không còn ở mọi định dạng/archive. Cần archive/relink đúng source trước cleanup; không sửa report/hình trong audit này.

**Giữ source và hồ sơ:** scripts/tests/SQL candidate/Edge/config Playwright/Vitest, pnpm-lock.yaml (các verifier hash/đọc lock), spec/runbook/review/implementation log, cả lịch sử FAIL/BLOCKED. Không tự khôi phục hai file đã có deletion marker; không đề xuất xóa .env, local credentials hoặc worktrees.

**Giữ artifacts theo từng gói:** trước thêm audit, `artifacts` có 141.783 file/4.956.982.146 bytes (~4,617 GiB logic), gồm source snapshots, receipts, failures và replay; không đủ căn cứ xóa toàn thư mục. Private release root kiểm metadata có 8135 file/793.112.166 bytes, trong đó hosted-path 612.370.419 bytes và backups 106.791.578 bytes; chưa phân loại ownership/replay đủ để xin dọn. Không đọc payload/credential private. Bản copy source và receipts của audit này là evidence mới cần giữ.

Ngân sách: C còn 206.724.902.912 bytes và D còn 104.131.936.256 bytes ở precheck; checkpoint sau copy còn C 206.719.729.664/D 104.114.688.000. Chỉ tạo evidence nhỏ (ngân sách khoảng 20 MB), không cài/download stack hoặc tạo WSL/Docker/import/DB clone. Không quy chênh free toàn ổ thành dung lượng task vì có process khác.

## Đánh giá push và việc còn thiếu

1. **Không push gói hiện tại lên main:** frontend contract 2/backend legacy không khớp. Cần phối hợp DB/Edge/frontend và giữ compatibility/recovery plan; apply 017 riêng không đủ.
2. **Khóa candidate và dependency đúng lock**, giải 7 audit findings hoặc có quyết định mới hợp lệ; không tự thay quyết định Tailwind 3. Hoàn thành full gate 58/current source và SEC→EVC trên exact candidate. Khôi phục khả năng tái kiểm cần thiết trong ngân sách/môi trường owner duyệt; không tự tạo lab mới.
3. **Khép HP1 và hosted capability prerequisites**: registry certified rỗng; C/Storage S1/L/provenance/actor/action window còn thiếu. Private package nguồn 56 không còn tại đường dẫn đã ghi. B/I local hoặc count K rỗng không thay các proof đó.
4. **Rà phạm vi commit**: 494/293 file trước audit gồm phần ngoài permission; giữ file mới bắt buộc, loại generated outputs khỏi commit, đồng bộ docs/handoff. Không tự stage/commit.
5. **Xác minh tác động push** trước lệnh phát hành: [vercel.json:4](D:/Workspace/pos-cafe/vercel.json:4) chạy npm ci→build→dist; build không chạy toàn gate. Inventory 07/10 ghi main auto-assign bật, nhưng setting provider hiện tại chưa đọc mới; không khẳng định push sẽ không deploy. Không thấy .github/workflows trong checkout. Push nhánh review/docs riêng cũng cần owner ra lệnh và scope rõ; no-push không chỉ cấm deploy.
6. Khi owner cho phép đúng action/window: kiểm mới exact IDs/full rows/ACL/provider binding/backup/restore/controlled rollout/postflight theo T17/T18 và PIN-T07. Khảo sát này không cấp quyền hay đổi acceptance exact79/66Auth/3objects/delete2.

Đường đọc code đã chuẩn bị qua các link trong bảng; đây là đề nghị walkthrough, chưa có xác nhận owner đã đọc/hiểu/nghiệm thu. Không có câu hỏi nghiệp vụ buộc chọn trong phạm vi khảo sát; các lựa chọn triển khai, cleanup và phát hành để bước sau khi owner giao.

## Review độc lập của hồ sơ khảo sát

Candidate được freeze bằng manifest SHA và snapshots của các file audit/docs thay đổi trong lượt này. Hai reviewer không sửa candidate: SEC kiểm live DB/permissions/scope/release; EVC kiểm source/evidence/temp/docs và tính tái hiện. Verdict và xử lý findings sẽ được ghi tại [review 15/10](../reviews/2026-10-15-permission-progress-audit.md). Chỉ nhận **khảo sát hoàn tất** khi cả hai APPROVE cùng candidate cuối; không chuyển thành APPROVE ứng dụng/phát hành.
