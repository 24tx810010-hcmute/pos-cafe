# G2c — Phiên restricted hết hạn trong khi completion chờ identity lock

## Phạm vi và nguồn quyền

Ngày 09/10/2026, chủ dự án giao tiếp tục kiểm tra trường hợp phiên hết hạn khi completion đã vào PostgreSQL và còn chờ khóa, qua lời xác nhận được ghi ở [handoff G2c](../workflow/tasks/permission-pin-expiry-wait-2026-10-09.md). Đây là một lát của bước 3 [TC-PIN-08](../../openspec/changes/force-default-pin-change/testplan.md), không phải bằng chứng hoàn tất toàn TC-PIN-08. Chỉ dùng local synthetic target riêng; không sửa ứng dụng hoặc candidate SQL để làm test đạt.

## Cơ chế cần chứng minh

- [Completion SQL](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:347) lấy identity lock rồi mới đọc lại session và so `expires_at <= private.write_clock()`. Clock sản xuất ở [migration 014](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:9) dùng `clock_timestamp()`.
- UI có [timer phiên](D:/Workspace/pos-cafe/src/app/screens/RequiredPinChangeScreen.tsx:98) tiếp tục chạy lúc submit; notice hết phiên có thể đến từ timer. Acceptance phải giữ browser Date ở T0 với timer thật, chỉ tiến DB clock đúng `expires_at`, giữ ACK sau server denial và kiểm form còn ở trạng thái submitting trước khi trả response gốc.
- Expired khác revoked: row/session cũ và `revoked_at` phải giữ nguyên, projection effective validity chuyển sang expired. Completion denial phải giữ hash/cờ/revision và mọi receipt/audit/signal/K/business row.

## Quyết định kỹ thuật trong quyền kiểm chứng đã giao

### DEC-G2c-01 — Clock DB có kiểm soát trên target mới

- Trạng thái: AI chọn ngày 09/10/2026 trong phạm vi kiểm chứng local được chủ dự án giao ở handoff; không phải thay đổi yêu cầu nghiệp vụ.
- Phương án: đợi thật năm phút, hoặc thay `private.write_clock()` có bảo toàn catalog trên một Supabase target synthetic mới. Chọn clock có kiểm soát để đặt đúng thời điểm `expires_at` lấy từ DB, kiểm thứ tự lock và chạy case trong ngân sách thời gian ổn định. Đợi thật không chứng minh được equality đúng biên một cách lặp lại đáng tin cậy.
- Hệ quả: phải kiểm definition/metadata/ACL trước cài, chỉ cho phép delta fixture được liệt kê, giữ DB tại T1 trong mọi probe token cũ, rollback controller/đợi route settle trước khi restore; restore sai là FAIL. Không chạm G1/G2a/G2b.

### DEC-G2c-02 — Tách clock trình duyệt và ACK

- Trạng thái: AI chọn ngày 09/10/2026 trong cùng quyền kiểm chứng.
- Phương án: dùng Playwright `setFixedTime(T0)` để `Date.now()` của UI giữ gần thời gian thực ban đầu trong khi timer vẫn chạy, hoặc để timer UI tự hết hạn sau khi DB tiến. Chọn cách thứ nhất và giữ response REST sau khi server đã trả. Chỉ notice sau response không thể phân biệt timer với xử lý lỗi server.
- Hệ quả: test cần assertion trước ACK rằng form vẫn mounted, nút disabled ghi “Đang đổi PIN...”, chưa có notice/login/protected UI; sau fulfill response gốc mới xác nhận notice hết phiên. Không fast-forward browser năm phút.

## Môi trường, source và cách chạy lại

Target `pos-cafe-perm-g2c-20261009` riêng, API `127.0.0.1:59721`, DB `127.0.0.1:59722`, Vite `127.0.0.1:5181`, Docker network với option bind `127.0.0.1`, DB volume tên đúng project. [Guard](D:/Workspace/pos-cafe/tests/supabase/permissionPinExpiryEnvironment.ts) kiểm config SHA-256 `58da931a3edb6c88a5c043862145a1db85f8f5cd82921a27c40711b6bfd40baa`, CLI 2.117.0, 12 service và image IDs khớp G2b, loopback bindings, marker/migration hashes, **live function catalog** và clock sản xuất, 16 migrations + 11 activation, strict contract 2, API↔DB, graph Auth/store/owner/workflow. Một quán `G2c Expiry Wait`, `seedDemo:false`; pending K synthetic trong quán. Không dùng hosted backend, dữ liệu/credential thật hoặc email. [Backend provision receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/backend-provision.json) chỉ ghi trạng thái hữu hạn, không chứa secret.

`main` HEAD nền `ef2c372aec60d8362549e47b7aedb27126129479`; source cuối thực chạy là [source-04 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/source-04.json) SHA-256 `215709bd7cc1c835170249fd3ee1b7931529de0c24bef721eadf800489dfbe31` và [tar phục hồi](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/source-04.tar) SHA-256 `df679297621a543ddc50a7b3661eed3cbdd89f96e1d17905aa365a4ed2675e09`; 752 file hiện hữu + 2 deletion markers. `package-lock.json` SHA-256 `fa532f1203f4074fa1a4400f830458e465ba32e13ad39cc44291ae1505a7cc08`, `pnpm-lock.yaml` `8eea3a22ef3172cd8ef8d260efbd9b0e7c9cd685bcc47f034d775016c1d10143`. Runner Linux là bản extract nguyên source-04 ở `/var/tmp/pos-cafe-perm-g2c-20261009/runner-source-04`, symlink đến dependency tree Linux có lockfile cùng hash; Node 24.16.0, Playwright 1.60.0, Vite 8.0.16, Vitest 4.1.11, TypeScript 5.9.3, `pg` 8.23.0. Phiên bản Playwright runtime này được kiểm trực tiếp, thay cho số 1.62.1 nêu từ Windows `node_modules` ở handoff khảo sát.

Điều kiện dựng lại: stack G2c blank có network/ports/marker/strict guard như [prepare](D:/Workspace/pos-cafe/scripts/permission-pin-expiry-prepare.mjs), private env tại `/var/tmp/pos-cafe-perm-g2c-20261009/private/pin-expiry.env` mode 600; chạy preservation `before` cho G1/G2a/G2b, preflight, một Playwright case, preflight và preservation `after`. Lệnh browser thực tế tại runner Linux, chỉ dẫn đường dẫn env chứ không ghi nội dung:

```text
PIN_EXPIRY_ENV_FILE=/var/tmp/pos-cafe-perm-g2c-20261009/private/pin-expiry.env PIN_EXPIRY_VITE_PORT=5181 /var/tmp/pos-cafe-idem-release-20260914/node-v24.16.0-linux-x64/bin/node node_modules/@playwright/test/cli.js test -c playwright.permission-pin-expiry.config.ts --workers=1 --retries=0 --forbid-only
```

`PATH` của process đặt Node24 lên đầu để Vite `npm run dev -- --host 127.0.0.1 --port 5181 --strictPort` dùng cùng runtime. `reuseExistingServer=false`, screenshot/trace/video off, workers1, retries0, forbidOnly. Project `tsc -b` không tự phủ harness mới nên có targeted strict/noEmit riêng.

## Kết quả source-04

| Phép kiểm tại `runner-source-04` | UTC / exit | Kết quả và bằng chứng |
| --- | --- | --- |
| `node node_modules/typescript/bin/tsc -b --pretty false` | 09/10, exit 0 | Repo typecheck PASS |
| `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --module nodenext --moduleResolution nodenext --target ES2022 --allowImportingTsExtensions` với 8 file G2c TS/config | 09/10, exit 0 | Harness typecheck PASS |
| `node node_modules/vitest/vitest.mjs run -c tests/supabase/permissionPinExpiryClock.vitest.config.ts --reporter=dot` | 08:42 UTC, exit 0 | 3/3: equality expired/unrevoked, sai thời gian, catalog/restore tamper |
| `node node_modules/vitest/vitest.mjs run -c tests/supabase/permissionPinExpiryReporter.vitest.config.ts --reporter=dot` | 08:42 UTC, exit 0 | 9/9: thêm PIN-shaped stack location và phase annotation giả; chỉ exact allowlisted codes/phases và finite counts |
| Playwright `--list` | 08:45 UTC, exit 0 | [Discovery](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/discovery-source04-safe.json): 1 required case/1 file |
| G2c preflight trước và sau browser | cả hai exit 0 | Catalog production clock phục hồi, marker/API↔DB/12 service/graph guard PASS tại thời điểm hai lần kiểm |
| Playwright Chromium/Auth/REST | 08:46:51–08:46:56 UTC, exit 0 | [Safe report](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/ui-attempt-05-safe.json): **1/1 PASS**, 0 skip/retry/expected failure/hook failure, pha cuối fresh restricted login |
| G1/G2a/G2b preservation sau case | 09/10, exit 0 | Mỗi target: 69 table whole-row hashes, 2 sequences, canonical catalog, session graph và Storage bytes không đổi; G1 6 Storage objects/3 sessions, G2a 0/6, G2b 0/8 |

[Acceptance case](D:/Workspace/pos-cafe/tests/supabase/permissionPinExpiryWait.spec.ts) chạy một completion thật từ form: restricted token TTL đúng 300.000 ms và còn hạn lúc REST đã chiếm store mutex/chờ owner row. [Wait graph](D:/Workspace/pos-cafe/tests/supabase/permissionPinRaceLocks.ts) quan sát hai mẫu cùng backend PID, lock key, blocker controller. DB clock tiến **đúng `expires_at` của row** khi controller vẫn giữ khóa; cùng PID/blocker vẫn chờ, token `expired=1`, `valid=0`, `revoked=0`, session row vẫn unrevoked. Sau nhả khóa, server REST trả HTTP success với `ok:false`, `EMPLOYEE_SESSION_REQUIRED`; exact owner/session/evidence/K/business row SHA-256 fingerprints không đổi trước/during/sau denial và old-token probes. Credential bcrypt chỉ được so opaque equality/boolean, không vào report.

UI browser Date giữ T0, timer chạy thật. Khi server denial đã tới nhưng ACK bị giữ, form vẫn mounted, nút disabled ghi “Đang đổi PIN...”, chưa có login/notice/AppShell/financial/print; browser Date vẫn T0. Chỉ sau fulfill **nguyên response server** mới hiện login với câu “Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.”; focus/reconnect không replay hoặc mở protected UI. Old token `complete` và `check` bị session error tại DB T1, không đổi rows. Browser Date chuyển T1 trước login mới: PIN đề xuất `INVALID_PIN`, PIN tạm cấp restricted token mới khác token cũ, TTL5m, revision không đổi; session mới này được kiểm và tách khỏi no-effects của completion. Không có normal authority claim. Clock fixture cài/đọc/restore trong `finally`; postflight preflight xác nhận production definition/metadata/ACL và toàn live function catalog giống baseline, fixture cell vắng.

## Lịch sử thất bại giữ riêng

[Source-01 manifest](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/source-01.json) SHA-256 `65be1c6c7cb9b2891aefeb88f03ea6b4cc0c2c43a609d58d049128769dea4ece`; tar `924d98a123eb46e0dce48d0fb1eace6c0b9d337bb32a503eb0926cc1fd4cb561`. Chromium attempt01 08:16:44–08:16:48 UTC [safe report](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/ui-attempt-01-safe.json) 1/1 FAIL `PIN_EXPIRY_NO_EFFECTS_BASELINE_FAILED` trước pha wait. Observer SQL dùng `$1` nhưng gửi hai bind values ở một số table; sửa đúng tham số trong source-02. Postfailure preflight PASS chứng minh clock đã phục hồi. Preservation `after` lần đầu báo `PIN_EXPIRY_PRESERVE_RUNTIME_COMMAND_FAILED` từ lệnh Docker/CLI transient; read-only probe từng command exit 0 và chạy lại `after` PASS. Chỉ reset ba volume và containers của **G2c** sau guard exact project/config/ports/network/marker/clock, giữ env và baseline attempt01 trong private; sau đó dựng mới, chụp baseline ba old targets lại rồi prepare và chạy source-02. [Provision receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/backend-provision.json) lưu các setup/guard failure trước đó theo finite code; vài thử nghiệm đầu chưa có timestamp/source fingerprint riêng, nên không coi chúng là source-02 checks.

Source-02 manifest SHA-256 `e42fe006920c52c27fbd8fcf5d636cfe0d094c25279edca9e51a2fedadee4254`, tar SHA-256 `9b24f91a64bfac2f7e64198d4949bdb7f084baf52ea1bcfc26f2fb0d6c37be70`: Chromium 08:22:59–08:23:05 UTC [attempt02 report](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/ui-attempt-02-safe.json) 1/1 PASS, clock3/reporter5 controls PASS, postflight và ba target cũ PASS. Candidate-01 SHA-256 `cb827b220af7d1eb950843f4ae54d3cf3907b1aded07354b0a35ce1279c6dd5e` nhận SEC APPROVE nhưng COV CHANGES_REQUESTED: reporter có thể lấy một substring `PIN_EXPIRY_[A-Z_]+` bất kỳ từ error message, làm rò chuỗi bí mật có cùng hình dạng. Source-03 đổi sang exact allowlist finite error codes và fallback `TEST_FAILURE_REDACTED`, thêm regression synthetic secret shaped like code; reporter7/7 và toàn case chạy lại trên target G2c fresh sau guarded reset riêng. Candidate-01 chỉ là lịch sử, không dùng verdict SEC cũ thay review source-03.

Source-03 manifest SHA-256 `b7f09d4e22383437ff301624303df05429a9b7ecd44456e94dcef74680db59a5`, tar SHA-256 `7954e32b94d79afe43673d7b9da7ef5913ee9ef3ac88a120dc7ef087ac0af50a`: Chromium 08:35:24–08:35:30 UTC [attempt03 report](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/ui-attempt-03-safe.json) 1/1 PASS, reporter7/7, clock3/3, typechecks và postflight PASS. Candidate-02 SHA-256 `cacfb33ed11e840a01e37c4d2c8da2a07ab5524efe0b753377f7d6b3498a6788` nhận COV APPROVE/đóng finding cũ nhưng SEC CHANGES_REQUESTED: reporter xuất `sourceLocations` lấy số dòng bất kỳ từ untrusted stack; chuỗi stack có thể chứa PIN dạng sáu chữ số. SEC còn gợi ý allowlist phase annotation. Source-04 bỏ trường location, dùng exact static phase allowlist và thêm negative controls; rerun PASS ở attempt05 sau khi xử lý service G2c.

Source-04 attempt04 08:45:53–08:45:55 UTC [safe report](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/ui-attempt-04-safe.json) 1/1 FAIL tại `PREFLIGHT`, trước ca wait. Read-only diagnostic trả `PIN_EXPIRY_SERVICE_REFUSED`: Edge Runtime **chỉ của G2c** ở trạng thái exited(15) sau WSL idle. Giữ WSL hoạt động, start chính xác G2c Edge và preflight lại PASS; không reset old targets hoặc thay code/expected. Attempt05 nêu trên là lần chạy lại riêng với source-04 y hệt; [hai biên nhận hữu hạn](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/attempt-05-safe.json) lưu cả FAIL và PASS, không gộp fingerprint.

## Review và trạng thái

Hai review độc lập đã **APPROVE exact [candidate-03](D:/Workspace/pos-cafe/artifacts/permission-pin-expiry-wait/candidate-03.json)** SHA-256 `9492512b2af199b1699e5277863e1e79730e66e1a51d3887b2735d4d85af7d98`: SEC xác nhận đóng finding stack/location và kiểm clock/authority/transaction/isolation/privacy; COV xác nhận coverage/UI/evidence/authorization/docs. [Biên bản review](../reviews/2026-10-09-permission-pin-expiry-wait.md) giữ verdict lịch sử candidate-01/02. Cổng review G2c của **một ca này** đạt; chưa có chủ dự án nghiệm thu. Walkthrough đã chuẩn bị: restricted login → lock wait → DB exact expiry → after-lock denial → held ACK chống timer → no-effects/old token → fresh restricted login → clock restore; chưa có xác nhận chủ dự án đọc/hiểu/đồng ý.

## Giới hạn

Lát này không bao gồm ma trận TTL−1/0/+1 ms, thứ tự complete/recovery, stale revision với token hợp lệ, toàn vòng đời hoặc phát hành. Chưa có xác nhận chủ dự án đã đọc walkthrough hay nghiệm thu.
