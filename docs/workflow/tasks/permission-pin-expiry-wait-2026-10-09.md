# G2c — Phiên hết hạn khi completion đang chờ khóa

## Trạng thái, quyền và phạm vi

Ngày 09/10/2026, session nguồn `01a10b60-e6db-7692-831c-584eee63cda3`. **Checkpoint cuối:** G2c source-04 đã chạy một Chromium/Auth/REST case 1/1 PASS, repo+harness typecheck và clock3/reporter9 controls PASS, clock restore và G1/G2a/G2b preservation PASS. Candidate-02 SEC privacy finding đã sửa, rerun; **SEC và COV đều APPROVE exact candidate-03** SHA-256 `9492512b2af199b1699e5277863e1e79730e66e1a51d3887b2735d4d85af7d98`. [Log chi tiết và lịch sử findings](../../implementation-log/permission-pin-expiry-wait-2026-10-09.md), [biên bản review](../../reviews/2026-10-09-permission-pin-expiry-wait.md). **Chưa owner acceptance/release.** Các phần bên dưới ghi phạm vi/quyết định/kế hoạch đã dùng, không phải kết quả cho mọi bước.

Người dùng xác nhận **“ok, xử lý giúp, có câu hỏi không? nếu cần cứ tạo session mới nhé (làm tiếp trên đó nếu cần bỏ session hiện tại)”** sau đề nghị kiểm **phiên hết hạn khi đang chờ khóa**. Các yêu cầu còn hiệu lực: scope nhỏ, auto test và UI thật, subagent/model cân bằng chi phí, kỹ thuật ghi trên nhánh docs để dùng cho rubric. Hồ sơ ghi quyền hiện có, không mở rộng quyền.

Scope G2c chỉ **một completion restricted đã vào PostgreSQL, còn hạn lúc chờ identity lock, rồi hết hạn đúng tại `expiresAt` trước khi khóa được nhả**. Được làm test/tooling/harness và fixture local riêng, controlled clock riêng cho test, chạy auto/UI và docs/review. Không đổi source ứng dụng `src/`, candidate SQL hoặc grants để làm test xanh. Không mở toàn TTL−1/0/+1 ms, recovery, staleRevision hợp lệ hoặc full lifecycle-generation matrix. Chưa có câu hỏi nghiệp vụ cần chặn; nếu lỗi đòi sửa hợp đồng/ứng dụng hoặc tác động target cũ, hỏi đúng phần đó trước.

Không hosted Supabase/Vercel, credential/dữ liệu thật, email hoặc dịch vụ trả phí. Không reset/stash/switch/commit/push/deploy; giữ mọi dirty changes có từ trước. Mở session mới theo quyền người dùng vì phải tách thời gian DB, thời gian UI và lifecycle cleanup trong hội thoại nguồn dài. Session mới phụ trách hoàn tất G2c; đây là chuyển việc đang làm, không nhận kết quả hoàn tất.

## Đầu vào và baseline

- Authoritative AGENTS/CLAUDE, [quy trình](../README.md), [SPEC-STANDARD](../../../openspec/SPEC-STANDARD.md), [G2b handoff](permission-pin-completion-race-2026-10-09.md), [log/review G2b](../../implementation-log/permission-pin-completion-race-2026-10-09.md), bộ `force-default-pin-change`, đặc biệt [TC-PIN-08](../../../openspec/changes/force-default-pin-change/testplan.md:76) và [PIN-02/PIN-04](../../../openspec/changes/force-default-pin-change/specs/employee-session/spec.md:15).
- Main `D:/Workspace/pos-cafe` HEAD `ef2c372aec60d8362549e47b7aedb27126129479`, docs `D:/Workspace/pos-cafe-docs` HEAD `e47862b1dfed68d783dc07a2a1fd51ecdabc1b19`; khảo sát trước ghi file này 371 main/106 docs dirty entries. Kiểm lại và freeze actual source, không coi HEAD là đầy đủ phiên bản.
- G2b [candidate-02](D:/Workspace/pos-cafe/artifacts/permission-pin-completion-race/candidate-02.json), SHA256 `ff3db5afc074342ce1cc0b7febca88000426903df4f05cdea4e4d45b828f99d1`: hai ordering Chromium/Auth/REST 2/2, tooling12/12, repo+targeted harness typecheck, preservation G1/G2a PASS, hai non-author APPROVE. Parent đã đối chiếu 740 source entries, 19 artifact hashes và docs snapshots không drift; chỉ metadata review cập nhật sau freeze. Đây là evidence lịch sử G2b, không đóng G2c.
- Bảo toàn **cả ba** target: G1 `pos-cafe-perm-t04-20260916` API59421/DB59422; G2a `pos-cafe-perm-g2a-20261009` API59521/DB59522/Vite5179; G2b `pos-cafe-perm-g2b-20261009` API59621/DB59622/Vite5180. Không thay clock, marker, config, roles, grants, catalog, graph/Auth/Storage/data hoặc chạy reset/legacy globalSetup trên chúng.

## Khảo sát chỉ đọc: điểm dễ nhận PASS sai

Hai investigator Sol/high kiểm transaction/clock/catalog và UI timer/generation; chọn reasoning cao vì sai phối hợp clock có thể tạo bằng chứng giả. Không sửa file/runtime hoặc đọc private env/raw logs; không phải reviewer implementation cuối.

| Nguồn | Phát hiện |
| --- | --- |
| [clock production](D:/Workspace/pos-cafe/supabase/migrations/014_write_identity_and_ledger.sql:9) | `private.write_clock()` SQL VOLATILE, invoker, search_path pg_catalog, gọi clock_timestamp(). Clock override chỉ là fixture test riêng, phải chứng minh cài đúng và phục hồi đầy đủ. |
| [completion](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:347) | Identity lock trước reread; `expires_at <= private.write_clock()` tại dòng 353, session error trước receipt/audit/registry/update PIN. |
| [test cũ](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:181) | Direct SQL và clock300s; chỉ flag/revision, không thay real REST/UI/no-effects đầy đủ. Không chạy legacy setup/reset của suite lên target cũ. |
| [owner barrier](D:/Workspace/pos-cafe/tests/supabase/permissionPinRaceLocks.ts:43), [wait graph](D:/Workspace/pos-cafe/tests/supabase/permissionPinRaceLocks.ts:96) | Controller giữ owner row, REST giữ đúng store mutex rồi chờ controller. Phase winner đủ cho một request; hai mẫu ổn định và backend PID cần khớp trước/sau advance. Helper không nhận expectedWinnerPid ở phase winner, phải so PID riêng. |
| [timer UI](D:/Workspace/pos-cafe/src/app/screens/RequiredPinChangeScreen.tsx:98), [callback](D:/Workspace/pos-cafe/src/app/screens/RequiredPinChangeScreen.tsx:129) | Timer tự về login ngay cả khi submitting; generation đổi có thể bỏ response thật. Chỉ thấy notice hết phiên không chứng minh server đã kiểm TTL sau wait. |
| [observer G2a](D:/Workspace/pos-cafe/tests/supabase/permissionPinAckObserver.ts:73) | sessionActive chỉ đếm unrevoked, không xét expiry. Expired không tự revoked: row/token/revokedAt giữ nguyên; cần validity projection riêng. Không sửa nghĩa helper G2a/G2b. |
| [Playwright Clock API đang cài](D:/Workspace/pos-cafe/node_modules/playwright-core/types/types.d.ts:18977) | `setFixedTime` cố định Date nhưng timer vẫn chạy; không fastForward browser5 phút hoặc pause toàn clock rồi giả nhận RPC denial. Version investigator đọc là1.62.1, session mới kiểm native dependency parity. |

## Quyết định và kế hoạch thực thi

### DEC-G2c-01 — New target, clock hook nhỏ và có phục hồi

AI chọn G2c project/profile/volume/network/marker/port block riêng vì override write_clock tác động toàn database. Dựng từ migrations/candidate source trên DB trống, strict contract2, một quán blank `seedDemo:false`. Guard exact project/config/CLI/images/12services/loopback/network/volume/marker/migrations/activation/API↔DB/owned graph, thêm live catalog proof; không chỉ tin marker lưu hash source.

Root khảo sát WSL available≈9.617 MiB; ports5972x/5181 chưa xuất hiện trong `ss`. Chưa reserve/provision, cần đọc lại trước tạo. Giữ target cũ; nếu thiếu tài nguyên phải dừng/sửa chúng hoặc tăng chi phí/quyền/phạm vi, hỏi trước phần đó. Các Edge cũ exited15 do WSL shutdown không phải lỗi sản phẩm; không start Edge cũ để phục vụ G2c. Có thể dùng source tooling G2b làm mẫu nhưng không nới guard hoặc thay nó.

Trước install, xác nhận live production clock đúng body/definition/metadata dự kiến; capture kín definition/identity/result/language/OID/owner/ACL/volatility/securityDefiner/strict/leakproof/parallel/cost/rows/proconfig/support. Cài private singleton clock cell T0 gần wall clock, helper/bảng không có quyền PUBLIC/anon/authenticated/service_role. CREATE OR REPLACE cùng clock signature/attributes, chỉ allowlist exact test clock delta và fixture objects thuộc G2c; mọi candidate function/ACL khác giữ nguyên. Source candidate SQL không sửa. Không thêm runtime patch completion để tạo counterexample trong lát này; phép kiểm actual REST và source-bound order cùng negative controls của clock/observer là phạm vi được chọn, không mở thêm hành vi RPC.

Finally phải giải phóng barrier, drain route handlers và đóng browser trước restore clock; restore definition cùng toàn metadata/ACL, drop đúng fixture clock/snapshot objects, verify catalog baseline. Cleanup/restore lỗi thành FAIL. Không reset thời gian về wall clock trước old-token assertions: T1 đang tương lai có thể làm token expired trở lại còn hạn nếu reset quá sớm.

### DEC-G2c-02 — Tách browser clock để quan sát response server

DB ở T0, browser `page.clock.setFixedTime(T0)` trước navigation/login; Auth/JWT dùng service time thật, T0 gần wall clock để không phá pairing. Timer chạy thật, case budget dưới120s so với TTL300s; chỉ DB clock tiến lên. Không sửa/mock response REST. Trước giao ACK denial, phải quan sát forced form còn mounted, submitting/nút disabled “Đang đổi PIN...”, chưa passcode/notice/protected shell. Sau giao response thật mới thấy notice session-ended. Đây là chứng minh UI outcome không do local timer tự kết thúc.

## Một ca acceptance và auto controls

1. Preflight, bootstrap UI blank store, đặt pending K synthetic đúng schema/24h. Restricted login/proof qua Auth/REST thật; token memory-only, TTL đúng300000, revision hiện hành. Capture baseline trước completion: exact hash/employee/session/evidence/K/business rows so kín trong DB hoặc opaque handle, không raw diff.
2. Capture đúng một UI completion, giữ owner-row controller, forward request thật. Observer độc lập xác nhận exact store advisory holder, owner-row wait/blocker đúng controller, hai mẫu cùng PID; DB clock `< expires_at`, restricted còn hiệu lực. Requests/sessions/hash/PIN không vào wait diagnostics.
3. Commit DB clock cell đến **chính session.expires_at lấy trong PostgreSQL**, không tính từ browser; assert clock equality, TTL300000. Quan sát lại same backend/PID vẫn chờ cùng controller; flag/revision/hash/sessions/evidence/K chưa đổi. `oldExpired=1, oldValid=0, oldRevoked=0`; existing unrevoked count vẫn1.
4. Nhả controller; REST thật phải trả HTTP success với `{ok:false,error:{code:'EMPLOYEE_SESSION_REQUIRED'}}`. Observer trước ACK kiểm exact unchanged hash/flag/revision/session rows/issuedAt/expiresAt/purpose/revision/revokedAt, zero audit/receipt/signal effects, K và business rows giữ nguyên. Trạng thái expired không gọi revoked.
5. Giữ ACK cho assertion chống timer ở trên, rồi fulfill nguyên response. DOM login và notice **“Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.”**, forced form rời, protected shell/nav/receipt không có; completion UI1 lần qua focus/reconnect/barrier, không auto K/payment/receipt/print/seed.
6. DB vẫn T1: old-token complete/check probes chủ ý bị session error/no-effects, đếm riêng UI. Set browser fixed time T1 trước fresh login; proposed PIN `INVALID_PIN`, temporary PIN trả **restricted mới** với token khác/TTL5m/revision giữ nguyên, không shell/financial/print. Tách session mới có chủ ý khỏi no-effects của completion. Không tự retry completion mới trong scope này.
7. Finally bounded settlement/restore/catalog proof; postflight riêng bảo toàn G1/G2a/G2b. Không gọi newlogin là normal authority hoặc claim credential changed.

Auto controls tập trung time equality/expired-vs-unrevoked classification, wrong/unstable wait graph, narrow clock allowlist/privacy-safe failures và restore refusal; không tạo test chỉ sao chép implementation. Không runtime counterexample patch completion ở target cũ hoặc target mới. Nếu review phát hiện evidence thiết yếu còn thiếu, xử lý tooling có căn cứ hoặc hỏi scope phụ thuộc, không hạ expected hay miễn review.

## Evidence, hồ sơ và cổng hoàn tất

- Native Chromium/Auth/REST rendered UI một case acceptance, config riêng workers1/retries0/forbidOnly/strict Viteport/reuseExistingServerfalse, screenshot/trace/video off. Auto tooling/regression và repo+targeted harness typecheck trên cùng source/lockfile. Không UI layout audit mới khi không đổi interface, không baselineupdate.
- Lệnh/cwd/UTC/exit/discovery/options/body+hooks/counts/skip/retry/expectedfailure, runtime config/images/CLI/migration/activation/lockfile parity, safe clock/catalog before/during/restored proof, pre/post wait predicates/no-effects/UI verdict. Freeze exact source + recoverable bytes file mới/tests/config/deletionmarkers + docs snapshots + driver/reporter attestation; giữ mọi FAIL riêng theo source/attempt, không ghép fingerprint thành PASS.
- Private env/control/raw logs/backups/credentials/token/PIN/hash/MAC/DSN/StoreKey/StorageURL không model-read hoặc in chat/docs/report; script xử lý kín chỉ finite code/count/boolean. Reporter phải an toàn cả setup/teardown/uncaught failures. Baseline bí mật có thể lưu private test snapshot không cấp client quyền, drop/restore có guard.
- Code/tests/tooling trên main; prose/log/handoff/index và implementation pointers trong spec trên docs; requirement/steps/expected giữ nguyên. Hai reviewer non-author khác scope (clock/authority/transaction/isolation/privacy và coverage/UI/evidence/authorization/docs) explicit APPROVE exact frozen final candidate, mọi blocker đóng và substantivechange review lại. Investigator hiện tại không là final reviewer implementation; G1/G2a/G2b approvals không thay G2c.
- Native repo Playwright tự thoát; nếu MCPbrowser dùng thì browser_close và dừng đúng node/cmd @playwright/mcp sau dùng, không sửa/xóa cấu hình. Không external login/connectors.

Walkthrough đã chuẩn bị: restricted login → controller wait → DB clock boundary → after-lock denial → ACK/timer guard → unchanged rows → fresh restricted login → clock restore. Chưa có xác nhận owner đọc/hiểu/nghiệm thu. Runtime và hai review G2c source-04/candidate-03 đạt trong phạm vi **một case**. Toàn TC08/TTL±1ms/recovery/staleRevision/full lifecycle, G3/19TC/UIaudit33 và release vẫn mở.
