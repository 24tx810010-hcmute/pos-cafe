# TC-PIN-18 — canary, audit projection và thông báo, 11/10/2026

## Phạm vi và quyết định

Chủ dự án yêu cầu đi tuần tự TC-PIN-18 trong CLOSE-1, chưa giao TC19 hay phát hành. Trong lúc kiểm va chạm seed, runtime trả `ENTITY_ID_CONFLICT` nhưng [InitialSeedLifecycle](D:/Workspace/pos-cafe/src/app/InitialSeedLifecycle.tsx:30) hiển thị câu chung. Chủ dự án cho phép sửa đúng nhánh này, rồi cho sửa câu `ADMIN_REQUEST_REUSED`, và giao thiết kế/hiện thực UI recovery. Quyết định cuối: [công cụ operator riêng](../../docs/runbooks/owner-pin-recovery-operator-2026-10-11.md), local-only, backend giữ DB credential; không mở recovery cho POS. Hai câu app đã khớp [design](../../openspec/changes/force-default-pin-change/design.md#ma-loi-va-thong-bao). Không đổi SQL nghiệp vụ, grants bền vững, hoặc release.

Main HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, docs HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; cả hai worktree vốn đã dirty. Candidate local dùng source chưa commit. [Manifest/archives phục hồi](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1) gồm cả file mới và test; hash của candidate cuối được ghi trong review record, không lấy HEAD một mình làm fingerprint. Target test cô lập `pos-cafe-perm-pin-onboard-20261009`, API `127.0.0.1:59921`, PostgreSQL `127.0.0.1:59922`, Vite `127.0.0.1:5189`, strict contract v2; không dùng hosted.

## Môi trường, lệnh chạy lại và dấu nguồn

Chạy từ `D:/Workspace/pos-cafe` bằng PowerShell trên Windows 11, Node `v24.16.0`, npm `11.13.0`, Playwright `1.62.1`, PostgreSQL target `17.6`, Supabase CLI target `2.117.0`; `pnpm-lock.yaml` SHA-256 `8eea3a22ef3172cd8ef8d260efbd9b0e7c9cd685bcc47f034d775016c1d10143`, `package-lock.json` SHA-256 `fa532f1203f4074fa1a4400f830458e465ba32e13ad39cc44291ae1505a7cc08`. `PIN_ONBOARD_ENV_FILE` trỏ tới file private `\\wsl.localhost\Ubuntu-24.04\var\tmp\pos-cafe-perm-pin-onboard-20261009\private\pin-onboard.env`; không xuất nội dung. [Target guard](D:/Workspace/pos-cafe/tests/supabase/permissionPinOnboardEnvironment.ts) từ chối sai project/marker/API/DSN/CLI/container/volume/network, kiểm checksum 16 migration và activation SQL, contract gate strict v2, owned fixture graph; đây là điều kiện tái chạy, không phải môi trường hosted.

```powershell
$env:PIN_ONBOARD_ENV_FILE='\\wsl.localhost\Ubuntu-24.04\var\tmp\pos-cafe-perm-pin-onboard-20261009\private\pin-onboard.env'
node scripts/permission-pin-onboard-preflight.mjs
npx vitest run --config vitest.permission-canary-oracle.config.ts
npx vitest run --config vitest.owner-recovery-operator.config.ts
npx playwright test --config=playwright.pin-tc18.config.ts
node scripts/permission-pin-onboard-postflight.mjs
npx playwright test --config=playwright.owner-recovery-operator.config.ts
npm test
npm run build
npx tsc -p tsconfig.pin-onboard.json --noEmit
npm run ui-audit:selftest
npm run ui-audit
```

`playwright.pin-tc18.config.ts` chỉ chọn TC18 và dùng **duy nhất** [reporter redaction](D:/Workspace/pos-cafe/scripts/permission-pin-canary-reporter.mjs); receipt mặc định `artifacts/permission-pin-tc18-browser-safe.json`, bản đóng gói là [tc18-safe.json](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/tc18-safe.json). Reporter không serialize assertion body/stack/row dù FAIL; negative unit đã inject secret vào lỗi. Cấu hình full-file cũ xuất JSON thô, **không dùng để tái chạy canary TC18**; JSON thô của lượt config cũ gần nhất giữ trong thư mục `artifacts/permission-pin-tc18-private`, không trong gói chia sẻ. [Fingerprint receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/source-fingerprints.json) ghi SHA-256 manifest/archive của main+docs cùng safe receipt sau khi freeze, ngoài hai archive để tránh tự tham chiếu hash.

| Mốc 11/10/2026 UTC+7 | Lệnh/kiểm | Exit và kết quả |
| --- | --- | --- |
| 19:23–19:26 | Focused operator browser, core và parser/required PIN/passcode | `0`; browser 2/2, core 3/3, parser+screen 46/46, passcode 2/2 |
| 19:23–19:28 | `playwright.pin-onboard-closeout.config.ts` toàn file rồi TC13 riêng | Full-file `1`: 20 PASS/1 timeout/23 chưa chạy; TC13 riêng `0`: 1/1 PASS. Không dùng full-file làm PASS TC18 |
| 19:29–19:31 | TC18 7 ca trên config closeout cũ, rồi postflight | `0`: 7/7, 20×11/0 N/A, fixture zero; kết quả lịch sử trước reporter/UX fix |
| 19:31–19:38 | `npm test`, `npm run build`, `tsc`, `ui-audit:selftest`, `ui-audit` | `0`: 110/1.170, build/typecheck PASS, selftest23, 16×3/22 baseline/0 mới |
| 19:42–19:47 | Dedicated safe TC18 config sau review fix; first full, ca đầu riêng, second full | First full `1`: Realtime wait tại line 2489, 0/7 an toàn; ca đầu riêng `0`: 1/1; second full `0`: 7/7, 0 retry/skip/fatal. Postflight `0`: fixture zero |
| 19:46–19:48 | Final operator browser/core, full unit, build/typecheck | `0`: browser 2/2, core 3/3, unit 110/1.170, build/typecheck PASS |

Các phép kiểm UI audit thuộc POS; delta review sau audit chỉ đổi công cụ operator riêng, fake server, test và config TC18 nên ảnh POS/audit vẫn cùng mã POS. Browser operator được chạy lại sau delta. Mã thoát ở bảng lấy từ process CLI; `PIN_CANARY_FAIL 0/7` của lượt Realtime là FAIL thật, không ghi thành PASS. Reporter an toàn chỉ giữ số đếm và vị trí dòng. Các câu lỗi design ngoài phạm vi TC18 giữ liên kết với TC liên quan; không tuyên bố mọi context đã runtime trigger trong một suite.

## Oracle và kết quả đã chạy

- [Oracle fail-closed](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryOracle.ts) kiểm equality cho canary gốc, URL encoding và base64, giới hạn quét, bắt sink thiếu/chưa capture. [Matrix](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryScenarioMatrix.ts) bắt đúng 20 kịch bản complete/recovery/bootstrap/seed × success/denial/fault/lost ACK/replay, 11 sink cho mỗi kịch bản, không dùng N/A trong runtime cuối. Đối chứng âm gồm leak từng sink, thiếu capture, sai N/A, thiếu/duplicate scenario và [reporter redaction](D:/Workspace/pos-cafe/tests/contracts/permissionPinCanaryReporter.tool.test.ts). Tooling cuối 3 file/9 test PASS; dòng `PIN_CANARY_FAIL 0/1` là phép thử reporter âm được suite kỳ vọng.
- [Browser TC18](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:2382) chạy real Auth/REST/PostgreSQL/Realtime và browser trên target cách ly. Mỗi capture đọc raw audit, registry, signal, Realtime frame, storage/cookie/IndexedDB, URL, console, telemetry, safe artifact, error text và masked screenshot vào memory để oracle so canary; chỉ receipt không chứa secret được chia sẻ. Matrix cuối **7/7 PASS, một attempt mỗi test, 20 scenario, 220 sink capture, 0 N/A** (gồm real operator UI), [receipt an toàn](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/tc18-safe.json). Browser và SQL có deny, injected audit fault/rollback, ACK mất sau commit, replay, seed stale. Auth JWT của Supabase được loại khỏi tập canary vì đó là credential nội bộ của chính client; token nhân viên do scenario tạo vẫn nằm trong tập kiểm.
- Ca menu ID collision riêng **1/1 PASS** sau sửa: DB `last_error_code=ENTITY_ID_CONFLICT`, row va chạm và stage receipts được bảo toàn, browser hiện nguyên câu “Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán.”, retry vẫn cần thao tác rõ. [Ảnh chụp riêng](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-private/entity-context.png) đã mở: thông báo có trên màn; toast chào mừng tạm che một phần ở thời điểm chụp. Assertion kiểm nguyên câu trong DOM, không dùng ảnh đó làm bằng chứng không chồng lấp mọi thời điểm.
- Unit toàn app sau delta app/context và assertion CSP/fault cuối **110 file/1.170 test PASS**. Focused catalog **3 file/41 test PASS**, focused parser + required PIN 46/46 và passcode 2/2 PASS. Operator core 3/3 PASS; browser fake DB desktop/mobile 2/2 PASS sau CSP script hash, đã xem ảnh toàn trang và xác nhận không tràn ngang/UUID không cắt. Real PostgreSQL operator test với role hạ tầng được cấp tạm, role denial trước cấp, audit và owner login **1/1 PASS** trong matrix cuối; grant tạm được thu hồi và postflight zero. [Receipt an toàn](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/operator-db-safe.json). Build TypeScript/Vite và typecheck PIN PASS. `ui-audit:selftest` **23 findings và selftest OK**. [Full UI audit source cuối](D:/Workspace/pos-cafe/artifacts/permission-pin-tc18-close1/ui-audit-report.md) **16 state × 3 viewport, 22 finding baseline / 0 mới, exit 0**, setup failure 0; PIN screen 0 finding ở cả ba kích thước. 16 finding thật cũ và 6 dương tính giả nav thu gọn; không update baseline. Operator UI riêng được kiểm Chromium desktop/mobile về kích thước, overflow, thông báo và ảnh toàn trang, không nằm trong bộ state POS của ui-audit.

Lượt matrix đầu sau sửa UI **FAIL** tại mốc audit recovery: seed tự chạy nền sau login nên baseline count bị lấy trước commit seed. Đây là race của test. Test nay đợi workflow seed `completed` trước baseline; postflight giữa hai lượt xác nhận target sạch. Lượt matrix sau đó 6/6 PASS; không dùng lượt FAIL làm bằng chứng đạt. Diagnostic recovery ACK ban đầu cũng từng gây Node `error` event chưa được handle; test đã gắn handler và lượt cuối đạt. Raw logs/screenshot chứa dữ liệu thử được giữ private, không chép vào docs/artifact chia sẻ.

Một lượt chạy **toàn bộ** file browser 44 ca trên candidate này dừng sau 20 PASS vì ca TC13 `in_progress requires explicit retry` hết 60 giây khi nút mở khóa vẫn disabled; 23 ca sau chưa chạy. Hậu kiểm target sau lỗi sạch. Cùng ca TC13 chạy riêng sau đó **1/1 PASS (36 giây)**. TC18 chạy riêng 7/7 PASS với 0 skip/retry/fail; không ghi lượt full file là PASS. Timeout TC13 là rủi ro hồi quy/độ ổn định còn ghi nhận, không che bằng kết quả TC18.

Hậu kiểm cuối TC18: `fixtureCountsZero=true`, API binding đúng; `tc18_*` function 0, trigger 0; membership `postgres → pos_owner_recovery` chỉ còn một grant gốc của `supabase_admin`, `set_option=false`. Sau hai reviewer `APPROVE`, đã dừng đúng 12 container target (running 0), giữ DB volume/network; keepalive PID 43948 đã tắt sau khi xác minh command.

## Sweep thông báo và quyết định mới

Đối chiếu **26 dòng app/context** từ [bảng design](../../openspec/changes/force-default-pin-change/design.md#ma-loi-va-thong-bao) với literal trong `src` và assertion trong `*.test`/`*.spec` là phép rà source, **không thay runtime trigger**. Các lệch câu phát hiện trong TC18 và cách xử lý:

| Context | Bằng chứng nguồn | Tình trạng |
| --- | --- | --- |
| `ADMIN_REQUEST_REUSED` | [permissionErrors.ts](D:/Workspace/pos-cafe/src/core/permissionErrors.ts:15), [design](../../openspec/changes/force-default-pin-change/design.md#ma-loi-va-thong-bao) | Chủ dự án cho phép sửa đúng câu. Catalog, mock adapter và assertion cập nhật; focused unit 41/41 và full unit 1.170/1.170 PASS. |
| `OWNER_PROTECTED` trong recovery | [operator core](D:/Workspace/pos-cafe/scripts/owner-recovery-operator-core.mjs) | Context recovery có exact câu riêng; browser desktop/mobile assert. |
| `NOT_FOUND` trong recovery | [operator core](D:/Workspace/pos-cafe/scripts/owner-recovery-operator-core.mjs) | Context recovery có exact câu riêng; browser desktop/mobile assert. |
| `PERMISSION_UPDATE_UNAVAILABLE / recovery` | [operator core](D:/Workspace/pos-cafe/scripts/owner-recovery-operator-core.mjs) | Fault được chiếu thành câu an toàn theo context; browser desktop/mobile assert. |

Operator UI đã có exact browser assertion cho `OWNER_PROTECTED`, `NOT_FOUND`, `PERMISSION_UPDATE_UNAVAILABLE`, `OWNER_RECOVERY_REVIEW_REQUIRED`, `FORBIDDEN`, `ADMIN_REQUEST_REUSED`; core validate PIN và unknown fault. `RequiredPinChangeScreen` có exact assertion mới cho proof-check unavailable, version conflict, PIN format/confirmation/reuse và payload khác. Sau quyết định bổ sung của chủ dự án, parser requestId/revision lỗi trả đúng câu payload khác; PIN sai vẫn trả câu PIN. Focused parser + màn đổi PIN 46/46 PASS. [Passcode exact-context test](D:/Workspace/pos-cafe/src/app/passcodeErrorMessages.test.tsx) kiểm `INVALID_PIN` và `AUTH_REQUIRED / phiên quán`, 2/2 PASS. Các context còn lại trong design được đối chiếu ở TC liên quan; không dùng PASS canary để suy toàn bộ bảng câu đã được runtime trigger ở TC18. Không suy full CLOSE-1/CLOSE-2/CLOSE-3, PERM60, hosted hoặc phát hành.

## Trạng thái và bàn giao

[Hai review độc lập](permission-pin-tc18-review-2026-10-11.md) vòng đầu trả `CHANGES_REQUESTED`; các finding đã được sửa và cả hai xác nhận `APPROVE` trên candidate mới. TC18 **local technical PASS** với các giới hạn đã ghi: full-file browser TC13 từng timeout và môi trường hosted/release chưa kiểm. Các context khác thuộc TC liên quan theo testplan; không tự sửa app ngoài ba câu đã được chủ dự án cho phép. Walkthrough code đi theo browser capture → oracle/reporter → operator UI → docs; **chưa ghi chủ dự án đã xem hoặc nghiệm thu**. TC19 chưa bắt đầu.
