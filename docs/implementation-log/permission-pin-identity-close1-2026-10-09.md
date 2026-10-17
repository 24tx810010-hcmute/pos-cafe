# CLOSE-1 — identity/recovery/security PIN (09/10/2026)

## Phạm vi và tình trạng

Nhóm này đối chiếu TC-PIN-01–09 với [ma trận gate 08/10](permission-pin-gate-inventory-2026-10-08.md) và [testplan](../../openspec/changes/force-default-pin-change/testplan.md). Chủ dự án đã cho tiếp tục test/tooling để đóng task phân quyền/PIN; không đổi app/SQL, requirement, expected hoặc guard fixture. Các review/receipt G1, G2a, G2b, G2c chỉ chứng minh scope và source riêng của chúng. **TC-PIN-01–09 và gate PIN toàn bộ chưa đóng.**

## Biến thể hữu hạn sau khi trừ coverage lịch sử

| Nhóm | Đã có executable/evidence trước slice | Phần cần chứng minh tiếp |
| --- | --- | --- |
| TC01–03 | Restricted login/proof/complete SQL, browser onboarding một viewport, inventory42 protected RPC và G1 pre-rollback oracle | Bootstrap `seedDemo=false` qua Auth/REST với exact DTO/lỗi; browser cache/deep-link/back/reload/focus/reconnect và stale tenant generation; missing/invalid/foreign/revoked token × RPC, REST direct read/DML, Storage gateway; exact allowed-route projections, mutation-negative oracle trước rollback. |
| TC04–06 | Parser, same-PIN denial, tám recovery transition cơ bản, complete/relogin | Forced RPC invalid payload/UUID/revision/weak PIN; confirmation mismatch UI no-RPC; recovery hash/counts và denied refs/callers/target; hai restricted tokens→revoke→normal12h và pending K/payment/print observer. |
| TC07–09 | Audit/signal/registry/employee fault; G2b complete/complete hai ordering; G2c expiry đúng mốc khi wait; G2a forced ACK trước execute/sau commit | Menu/floor faults với retry/stage preservation; TTL−1/+1ms, stale expectedRevision với token valid, recovery/complete ordering và late UI generation; actual recovery→complete→replay, wrong payload/actor/tenant và unchanged snapshots. |

## Thay đổi executable trong slice này

Chỉ sửa [ownerPinServerRuntime.contract.test.ts](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts), không sửa candidate SQL/app:

- TC04: gọi forced RPC với 17 payload sai gồm null/shape/UUID/revision/PIN Unicode/extra field; xác nhận không đổi cờ, revision, PIN, session, audit/registry. Thử `000000` và `111111` khác PIN hiện tại bằng savepoint độc lập, kiểm applied/credential sau mỗi biến thể.
- TC05/09: trong cả tám tổ hợp recovery, kiểm hash **bằng boolean**, đúng một audit/registry/signal và session revoke; sau đó restricted login và **complete thật** tới revision9 rồi replay recovery lịch sử. Kiểm exact replay DTO không có field thừa; so state gồm hash/session/counts/signal trước/sau replay bằng boolean. Payload khác ID cũ phải `ADMIN_REQUEST_REUSED`, caller không có operator role phải `FORBIDDEN`, foreign store/target phải `NOT_FOUND`. Bỏ direct flag/revision UPDATE cũ vốn không chứng minh complete thực.
- TC08: parametrized lock-wait clock tại expiry−1ms, expiry, expiry+1ms; trước expiry applied, tại/sau expiry session-denied, state tương ứng. Thêm expectedRevision stale=1 trong khi restricted token revision0 còn valid; denial audit/registry không đổi credential/session và cùng token vẫn complete được với revision0.

Các test mới giữ fault/clock/snapshot trong transaction/fixture reset và không in token/hash/PIN thật; secret thử là fixture synthetic của testplan. Chúng là executable **chưa có kết quả SQL runtime**.

## Kiểm tra đã chạy và giới hạn

| Check | Kết quả |
| --- | --- |
| TypeScript `transpileModule` cho file contract sửa | Không có lỗi cú pháp. |
| `npx tsc --noEmit ... --strict` một file | FAIL do hai khai báo kiểu `.mjs` thiếu sẵn ở `permissionIdentityFixture.ts`, không phải kết quả SQL; không coi là gate build. |
| `npx tsc --noEmit ...` cùng file không `--strict` | Exit0; chỉ là static check cho file contract. |
| `npx vitest run src/core/permissionIdentityInputs.test.ts src/app/requiredPinChange.test.tsx --reporter=dot` | 2 files, 40/40 PASS, exit0; đây là unit/component đã có, **không chạy** các contract mới. |
| Owner PIN server contract mới trên DB/Auth/REST cách ly | Ở checkpoint static ban đầu **NOT RUN** vì fixture G1 cũ khóa cứng `pos-cafe-perm-t04-20260916`/59421/59422. Sau khi chuẩn bị target riêng và onboarding nhường tài nguyên, đã chạy source-01; kết quả và giới hạn ở mục Runtime dưới. |

Các static/unit check trên máy Windows dùng Node v24.16.0, TypeScript 5.9.3 và Vitest 4.1.10 đang cài. Vitest này khác 4.1.11 của runner lockfile cuối, nên không tái gắn unit40 thành receipt final-source/final-runtime.

Source-01 có snapshot/runtime receipt riêng ở mục dưới, nhưng chưa là source-wide **final** candidate hay PIN gate. Không chạy UI browser thật trong nhóm này, không sửa baseline audit, không review độc lập ở checkpoint đang thực hiện. Owner sẽ tích hợp matrix và handoff; nhóm này không sửa index chung.

## Vấn đề kỹ thuật và hướng kiểm tiếp

Fixture identity G1 [runtime guard](D:/Workspace/pos-cafe/scripts/permission-identity-runtime.mjs) buộc project/port/volume cũ. [Contract fixture](D:/Workspace/pos-cafe/tests/contracts/permissionIdentityFixture.ts) nay chỉ chọn [runtime close1 riêng](D:/Workspace/pos-cafe/scripts/permission-pin-identity-runtime.mjs) khi `PIN_IDENTITY_RUNTIME=close1`; không đặt biến thì nhánh G1 cũ giữ nguyên, giá trị khác fail-closed. Runtime mới pin đường dẫn private env/control, project `pos-cafe-perm-identity-20261009`, API60021/DB60022, marker và16 migration checksums, phase schema, Auth role/JWT, config hash, CLI2.117.0, 12 healthy service, network/volume riêng và loopback bind. Preflight so status CLI với env rồi gọi fixture identity RPC qua API để chứng minh API↔observer DB cùng marker. Không in secret.

[Launcher stack](D:/Workspace/pos-cafe/scripts/permission-pin-identity-stack.mjs) có `plan` read-only và `start` chỉ nhận root mới; nó từ chối container/network/volume/root đã có, tạo network bind loopback, start Supabase CLI rồi kiểm topology. Nếu start lỗi, giữ partial target để chẩn đoán, không auto cleanup. [Config riêng](D:/Workspace/pos-cafe/tests/permissions/runtime/identity-close1.toml) dùng port60020–60029/inspector8090. [Preflight riêng](D:/Workspace/pos-cafe/scripts/permission-pin-identity-preflight.mjs) yêu cầu explicit profile/env path và chỉ xuất finite status. Bootstrap dùng subcommand của runtime mới, từ chối private path khác trước DB access; chỉ tạo private directory mode0700 trên target DB blank, env/control mode0600. `tests/contracts/permissionPinIdentityGuard.tool.test.ts` kiểm topology positive và bảy negative controls; [Vitest config riêng](D:/Workspace/pos-cafe/vitest.owner-pin-identity-guard.config.ts) không gọi DB.

Static preparation 09/10: `node scripts/permission-pin-identity-stack.mjs plan` exit0, config SHA-256 `bf71152aff878bd27101f23e5efb93ffe0cd3d93d8dee0699234188f2b64c58e`; `npx vitest run --config vitest.owner-pin-identity-guard.config.ts --reporter=dot` 9/9 PASS exit0 (thêm wrong private env path); `node --check` ba script exit0; targeted non-strict `tsc` cho contract/tool test exit0. Negative CLI calls: preflight thiếu profile → `IDENTITY_PREFLIGHT_PROFILE_REQUIRED`, bootstrap sai private root → `IDENTITY_PRIVATE_PATH_REQUIRED`, launcher action lạ → `IDENTITY_STACK_ARGUMENT_REFUSED`, cả ba exit1. Đây chỉ là **static/fail-closed proof**, chưa chứng minh Docker/SQL/Auth/REST runtime trên target mới. Runtime G1 source không sửa.

Kế hoạch sau khi nhóm onboarding nhường tài nguyên: (1) kiểm resource/ports và snapshot preservation các G1/G2a/G2b/G2c; (2) `node scripts/permission-pin-identity-stack.mjs start` một lần, kiểm runtimeProof exact topology; (3) trên Linux runner, `node scripts/permission-pin-identity-runtime.mjs bootstrap /var/tmp/pos-cafe-perm-identity-20261009/private` một lần, lưu env/control private mode600; (4) chạy `PIN_IDENTITY_RUNTIME=close1 IDEM_ENV_FILE=/var/tmp/pos-cafe-perm-identity-20261009/private/bridge.env node scripts/permission-pin-identity-preflight.mjs`; (5) chạy `vitest.owner-pin-server.config.ts` với cùng explicit env/profile và reporter an toàn; (6) preflight lại và preservation hậu kiểm, ghi actual result/restore/source snapshot. Đây là profile **legacy16 migrations → suite tự stage bridge017 + identity/seed candidate rồi restore**, không phải full 11-fragment activation. Nếu bất kỳ guard fail, không chạy suite; không trỏ env về G1 hoặc hosted để thay thế.

## Runtime source-01 — 09/10/2026

Sau khi onboarding 599xx stop verified12/12, launcher `start` target 600xx exit0, kiểm 12 service, project/config/network/volume/loopback. Bootstrap trên DB blank tạo marker/16 migrations và Auth fixture synthetic, env/control ở private mode0700/0600. Preflight marker/schema/API↔DB exit0. CLI có câu cảnh báo chung rằng service bind `0.0.0.0`; kết quả Docker inspect thực tế trong guard xác nhận mọi published binding là `127.0.0.1` hoặc `::1`, network option là `127.0.0.1`. Không dùng câu CLI thay cho kiểm binding.

Preflight đầu tiên từ runner frozen gặp `ISOLATED_SERVICE_NOT_HEALTHY`: riêng Edge container 600xx exited(15) sau WSL idle, 11 service khác vẫn chạy. Giữ FAIL attempt riêng. Sau khi bật hidden WSL keepalive và restart **chỉ** Edge 600xx, preflight cùng snapshot PASS; không sửa app/SQL/test/guard để bỏ lỗi. Nguyên nhân Edge exit15 chưa chứng minh chắc là WSL idle, nên chỉ ghi tương quan thời gian và cách phục hồi đã kiểm.

[Source-01 manifest và archive](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-01.json) gồm778 file hiện hữu +2 deletion markers, tar SHA-256 `9f2b024849a325e345745ca8f4c8fe7e31e49937c2c3e527df3871b38cf6f0d4`; extract Linux so778 hash, mismatch0. Linux runner Node24.16.0/Vitest4.1.11, package-lock hash `fa532f12…` trùng dependency tree có sẵn. Discovery35. `vitest.owner-pin-server.config.ts` chạy2 files/35 tests: **35 PASS, 0 fail/skip/retry/expected-failure**, exit0, reporter success=true, hookErrors0. Preflight hậu kiểm PASS legacy phase/marker/16 migrations/API↔DB; `cleanupIdentityFixture()` đã chạy và không có hook error. [Safe receipt](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/receipt-source-01.json) lưu path/hash của discovery/results/actual-options private, profile và giới hạn; raw output không model-read hoặc ghi docs.

Kết quả này chứng minh đúng các SQL variants có assertion trong source-01, gồm 17 invalid forced payloads, hai weak PIN, TTL lock-wait −1/0/+1ms, staleRevision token-valid, tám recovery hash/counts và recovery→actual complete→replay cùng wrong payload/nonoperator/foreign tenant. Nó không tự chứng minh phần Auth/REST/browser/Storage còn thiếu của TC01–09 hoặc toàn bộ19TC. Reviewer độc lập và final candidate gate vẫn chờ; receipt này là một slice runtime, không là acceptance hay release.

Walkthrough code/test chưa thực hiện với chủ dự án; không suy họ đã đọc hoặc nghiệm thu. Hồ sơ này là checkpoint tác giả, chờ runtime và reviewer độc lập trên final candidate.

## Phản hồi review SQL source-01 — 10/10/2026

[Review độc lập](../reviews/2026-10-10-permission-pin-identity-close1-sql.md) kết luận **CHANGES_REQUESTED** cho source-01 vì hai oracle denial còn thiếu: 17 payload invalid chỉ đo state sau cả vòng, còn same-PIN denied/replay chưa so credential hash, session và signal. Receipt 35/35 source-01 giữ nguyên là bằng chứng lịch sử trong phạm vi assertion cũ, không dùng để đóng hai finding ID-SQL-01/02.

Test đã sửa trên working source: baseline của credential hash, toàn bộ session của employee và toàn bộ permission signal được giữ trong temporary table thuộc transaction; query trả về chỉ boolean so sánh và audit/registry count. Cả 17 invalid payload đều kiểm ngay sau từng denial (hash/flag/revision/session/signal không đổi, audit/registry bằng 0). Same-PIN denial lần đầu, replay cùng MAC và payload đổi MAC đều kiểm ngay sau từng lời gọi (hash/flag/revision/session/signal không đổi; audit/registry đúng 1 sau denial đầu). Không đưa raw hash/token vào assertion, report hoặc tài liệu.

Static check sau sửa: TypeScript transpile không diagnostic; targeted `tsc --moduleResolution bundler` exit0; topology guard 9/9 PASS; unit/component PIN liên quan 40/40 PASS.

[Source-02 manifest và archive](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/source-02.json) chứa 779 tệp hiện hữu + 2 deletion markers; archive SHA-256 `621c708e…`, manifest SHA-256 `61a7bb38…`, riêng oracle test SHA-256 `7a2fac7a…`. Extract runner so toàn bộ 779 file và archive: 0 lệch. Chỉ dùng target `pos-cafe-perm-identity-20261009` API60021/DB60022 được giữ từ source-01. Sau restart, preflight đầu tiên gặp `FIXTURE_AUTH_IDENTITY_REQUIRED` vì JWT Auth fixture synthetic cũ hết hạn; lệnh `refresh` giới hạn target tạo JWT mới từ refresh token private, không sửa app/SQL. Preflight trước run sau refresh PASS: 12 service, 16 migration, marker và API↔DB. Runner Linux Node24.16.0/Vitest4.1.11, package lock hash `fa532f12…` bằng dependency tree có sẵn.

Source-02 discovery35; `vitest.owner-pin-server.config.ts` chạy 2 files/35 tests: **35 PASS, 0 fail/skip/retry/expected-failure**, exit0, hookErrors0. Preflight hậu kiểm PASS, legacy phase được restore. [Safe receipt source-02](D:/Workspace/pos-cafe/artifacts/permission-pin-identity-close1/receipt-source-02.json) chỉ ghi số đếm/hash/metadata; discovery, results, actual-options và raw log ở thư mục private mode0700, file evidence/env/control mode0600, không sao chép secret vào docs. Sau run, đúng 12 container 600xx đã stop và verify running0; volume/network/config còn nguyên. G1/G2a/G2b/G2c và hosted không đụng tới.

Runtime source-02 chứng minh assertion mới đã chạy và PASS, **review lại ID-SQL-01/02 vẫn PENDING**. Không nâng TC-PIN, final candidate hoặc release gate trước verdict non-author.
