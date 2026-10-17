# Kế hoạch kiểm — PIN owner tạm

Testplan chốt22/09, cập nhật08/10. **Có executable liên quan cho19TC, nhưng coverage từngTC còn một phần; chưa có full current-source acceptance proof.** [Matrix paths/assertions/gaps/evidence](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) đối chiếu source66 hiện hành với PIN31/44/browser9 d1 và empty1 4ab lịch sử. Lượt inventory này không chạy auto/UI mới. Giữ nguyên mọi fixture/bước/expected dưới đây; không chạy mutation/reset/seed live để chứng minh test hoặc nhận PASS từ chỉ nhãnTC.

**Execution mới 12/10/2026:** [ma trận required variant→oracle→profile→result source-20](../../../docs/implementation-log/permission-pin19-source20-matrix-2026-10-12.md) và [biên bản full PIN19](../../../docs/implementation-log/permission-pin19-source20-2026-10-12.md) cập nhật trạng thái sau các checkpoint lịch sử bên dưới. Browser PIN-only54/54, SQL41/41, canary empty1/1, unit1.173, tooling79, operator browser2, build/typecheck và UI selftest23→audit16×3 đều exit0 trên source-20. Review security/oracle phát hiện 18.A thiếu quét PIN denial và artifact thực: **gate full PIN19 source-20 chưa đạt** dù runner xanh; review coverage/evidence chỉ APPROVE phạm vi riêng. Không dùng câu “phủ một phần” lịch sử ở từng mục dưới để phủ nhận execution mới, cũng không dùng lượt mới làm bằng chứng hosted/CLOSE-3.

**Checkpoint 12/10/2026 riêng TC01–09:** [ma trận biến thể](../../../docs/implementation-log/permission-pin-tc01-09-matrix-2026-10-12.md) và [biên bản execution](../../../docs/implementation-log/permission-pin-tc01-09-closeout-2026-10-12.md) cập nhật sau các đoạn “phủ một phần” lịch sử bên dưới. Source-09 có SQL41/41 và browser TC01–09 10/10 PASS; TC02 cache normal→recovery đã chạy cùng nguồn. Biên bản ghi giới hạn URL probe/response S1 và review. Không suy TC10–19, PERM60 hoặc toàn CLOSE-2 từ checkpoint này.

## Fixture, cách quan sát và evidence chung

Dùng backend Auth/REST/SQL thật cách ly với candidate contract 2, write protocol 1; mock cùng DTO. Hai stores synthetic S1=`10000000-0000-4000-8000-000000000001`, S2=`10000000-0000-4000-8000-000000000002`; owner O1=`20000000-0000-4000-8000-000000000001`, O2 suffix `002`; cashier C1 suffix `003`. R(n)=`40000000-0000-4000-8000-` + n đệm 12 số; A1=R(101); storeNo=101/102. PIN tạm 123456, mới 384729, recovery 927416, cashier ban đầu 111111, cashier sửa 246810. Đây là dữ liệu thử, không credential thật.

Fixture helper tạo trạng thái owner normal/restricted, workflow/stage receipts, role/grants và token cụ thể; mỗi biến thể rollback/reset fixture cách ly. Snapshot observer kiểm cờ/revision/hash equality (chỉ pass/fail, không xuất hash), sessions/revoked, audit/registry/signals, business rows, K/R1. Capture response/log phải redact token/PIN/hash/Key. Fault injection ở transaction/transport của test fixture, không sửa candidate production để bỏ guard. Barriers phải chứng minh request đã chờ lock trước đổi trạng thái; không dùng sleep làm bằng chứng race.

Executable hiện có: `tests/contracts/ownerPinServer.contract.test.ts` + `ownerPinServerRuntime.contract.test.ts`, `ownerPinSurface.contract.test.ts`, các unit/mock/component trong matrix, `tests/supabase/ownerPinOnboarding.spec.ts`, `permissionEmptyActivation.tool.test.ts` và `.contract.test.ts`. Config/lệnh thực và receipt lịch sử ở matrix; chưa có bộ full PIN evidence current66. Mỗi lần gate phải ghi **required variants, source fingerprint/snapshot, runtime/schema/fixture, command/UTC/exit/discovery/results/actual options và phần chưa chạy**. Không suy số automated tests từ sốTC; không đổi nhãn old reports thành aggregate.

## TC-PIN-01 — Bootstrap chỉ cấp restricted session

- **Truy vết:** PIN-01/02, UC-PIN-01/03. **Mức:** tích hợp SQL/Auth/REST + mock.
- **Tiền điều kiện:** S1 chưa có store, Auth user fixture S1 hợp lệ; contract mới; chưa bootstrap R1.
- **Dữ liệu thử:** owner O1, storeNo 101, name `Cà phê Mây`, address `''`, seedDemo=false, PIN 123456.
- **Các bước:** 1. Gọi bootstrap R1. 2. Observer đọc cờ/workflow. 3. Login O1/123456. 4. Login sai 999999; bỏ Auth và gọi lại.
- **Kết quả:** Một owner true; workflow skipped; đúng PIN trả kind restricted/expiry +300s, không role/permissions. Sai PIN `INVALID_PIN`. Thiếu Auth khi thực thi SQL function trả `AUTH_REQUIRED`; gọi REST bằng anon bị PostgREST chặn trước function với HTTP 401 / SQLSTATE `42501`. Cả hai lỗi không có token/authority. Normal token không được tạo cho bước seed. Phân biệt hai lớp theo quyết định người dùng ngày 11/10/2026 trong CLOSE-2; không mở grant anon để đổi dạng lỗi.
- **Nơi hiện thực:** [runtime:78](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:78), [Auth/REST/browser blank bootstrap](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:980), mock runtime/identity adapter và [CLOSE-2 ledger](../../../docs/implementation-log/permission-close2-evidence-2026-10-11.md). **Phủ một phần; ca blank/DTO/denial đã chạy 599xx nhưng các biến thể TC01 khác và full PIN gate cùng source vẫn mở.**

## TC-PIN-02 — Màn bắt buộc, proof-only check và response cũ

**Hiệu chỉnh cửa sổ quan sát13/10/2026:** biến thể cached normal→recovery ở `ownerPinOnboardingCloseout.spec.ts` trước tiên chứng minh normal floor đã đọc/cache, thực hiện recovery và chờ về passcode, xác minh floor/AppShell biến mất; từ trước restricted relogin mới bắt đầu đếm RPC protected và vẫn yêu cầu đúng0 đến hết focus/deep-link/history probes. Điều này khớp tiền điều kiện restricted của TC02. Diagnostic source33 ghi12floorRPC HTTP200 khi transaction recovery chưa commit (normal session vẫn hợp lệ),0trong restricted phase; observer cũ gộp các normal reads vào cấm restricted nên false-fail. Không đổi expected restricted, không đổi application/security guard,không loại RPC hoặc skip/retry. Source34 focused biến thể này1/1 exit0; full PIN19 execution đã đạt55browser/41SQL/1canary/2operator, review cuối ghi riêng trong biên bản. [Biên bản](../../../docs/implementation-log/permission-npm-remediation-2026-10-13.md) giữ source33FAIL và diagnostic.

- **Truy vết:** PIN-02/03/05, UC-PIN-01/03. **Mức:** giao diện + tích hợp.
- **Tiền điều kiện:** S1/O1 restricted, browser có cache nghiệp vụ từ normal fixture trước đó; generation g1.
- **Dữ liệu thử:** route POS/admin/reports/print; proof response g1 bị giữ; sau đó logout/login S2 generation g2.
- **Các bước:** 1. Login restricted và thử deep-link/back. 2. Blur/focus/reconnect; chặn mạng proof check. 3. Trả proof valid rồi expired/revoked. 4. Sau đổi quán S2, thả response g1. 5. Reload trước đổi PIN rồi login 123456.
- **Kết quả:** Không render cache/AppShell/khởi query protected; chỉ form bắt buộc/logout/đổi quán. Check chỉ đúng projection tối thiểu design, không gia hạn TTL. Lỗi mạng giữ gate/câu proof error; hết hạn về PIN. Response g1 không tác động g2. Reload không mất cờ true. Không nút bỏ qua.
- **Nơi hiện thực:** [restrictedAppGate](D:/Workspace/pos-cafe/src/app/restrictedAppGate.test.tsx:25), [form/lifecycle](D:/Workspace/pos-cafe/src/app/requiredPinChange.test.tsx:35), [browser:302](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboarding.spec.ts:302). **Phủ một phần; còn browser cache/deep-link/reload/proof và tenant-generation variants, chưa gate current.**

## TC-PIN-03 — Bypass toàn bề mặt protected

- **Truy vết:** PIN-02/07, UC-PIN-01. **Mức:** tích hợp bảo mật SQL/Auth/REST.
- **Tiền điều kiện:** S1 có rows synthetic menu/floor/order/payment/audit/K; O1 restricted; token normal cũ bị recovery revoke; roster/metadata vẫn được giữ đúng phạm vi.
- **Dữ liệu thử:** token restricted thật, đúng version headers; bỏ token, token S2, normal revoked. Inventory routes lấy từ candidate/grants, không chỉ từ UI.
- **Các bước:** 1. Lập danh sách RPC/projection/DML/Storage authorization hiện được cấp. 2. Gọi từng read menu/floor/settings/report/history/employee/audit; write admin/settings/menu/floor; financial/register/execute/get/list/cancel K; receipt initial/reprint; image upload/delete authorization. 3. Gọi trực tiếp bảng qua REST/SQL app role. 4. Gọi normal authority/revision bằng restricted. 5. Gọi đúng ba routes restricted cho phép.
- **Kết quả:** Valid restricted normal-route nhận `PIN_CHANGE_REQUIRED`; thiếu/sai/revoked token nhận `EMPLOYEE_SESSION_REQUIRED` hoặc tenant/SQL grant denial theo route (phải ghi chính xác trong executable inventory). Không protected body/row, không business/K/R1 mutation. Chỉ check/complete/revoke được chấp nhận theo payload riêng; metadata công khai không tăng projection. Route legacy seed không cho standalone mutation bypass.
- **Nơi hiện thực:** [surface inventory/42RPC:95](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:95), [oracle trước rollback:19](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurfaceOracle.ts:19), [SQL mutation negative control:143](D:/Workspace/pos-cafe/tests/contracts/ownerPinSurface.contract.test.ts:143), mock runtime. **G1 đã kiểm chứng 09/10 cùng source08: 47 SQL + 14 oracle + 9 reporter = 70 PASS; còn token/REST/Storage/allowed-projection variants.** [Log và giới hạn](../../../docs/implementation-log/permission-pin-oracle-2026-10-09.md); verdict cuối ở review liên kết từ log. Release vẫn cần inventory và đủ assertions/evidence; không PASS toàn TC03 chỉ từ 42 denials.

## TC-PIN-04 — Biên PIN, confirmation và payload

- **Truy vết:** PIN-03/04, UC-PIN-01. **Mức:** đơn vị/mock/UI + tích hợp.
- **Tiền điều kiện:** O1 true, restricted còn TTL, revision 0; reset fixture mỗi biến thể.
- **Dữ liệu thử:** `''`, `12345`, `1234567`, `１２３４５６`, `١٢٣٤٥٦`, `123 45`, ` 384729`, number 384729, null; trùng `123456`; hợp lệ `000000`, `111111`, `384729`. UUID zero/thiếu; revision -1/1.5/9007199254740992; field thừa targetId. confirm `384728`.
- **Các bước:** 1. Submit từng input tại UI rồi gọi trực tiếp RPC để bypass validation. 2. Submit confirm mismatch. 3. Submit PIN trùng. 4. Reset fixture và submit từng PIN hợp lệ khác PIN hiện tại.
- **Kết quả:** PIN sai `INVALID_EMPLOYEE_REQUEST`, confirmation mismatch `PIN_CONFIRMATION_MISMATCH` không gọi RPC, trùng `PIN_REUSE_NOT_ALLOWED`; đúng câu design, cờ/revision/session/credential không đổi (semantic denied audit được phép theo design). Không blacklist mới: 000000/111111 qua khi khác PIN hiện tại. Shape/UUID/revision/field thừa bị từ chối, không parse coercion.
- **Nơi hiện thực:** [forced input unit:27](D:/Workspace/pos-cafe/src/core/permissionIdentityInputs.test.ts:27), mock identity, [runtime denial:88](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:88). **Phủ một phần; còn confirmation/direct forcedRPC/full boundary/error/snapshot variants, chưa gate current.**

## TC-PIN-05 — Ma trận recovery và quyền operator

- **Truy vết:** PIN-01/04/06/07, UC-PIN-02. **Mức:** tích hợp SQL.
- **Tiền điều kiện:** S1/O1; dedicated operator role; refs đã xác minh synthetic; mỗi biến thể start revision 7.
- **Dữ liệu thử:** tám tổ hợp bảng design: PIN giống/khác × cờ false/true × live sessions 0/2. R(20..27), refs `op-test/case-test-001/proof-test-001`. Refs rỗng/201 ký tự, sai target/missing target, PIN `12345`.
- **Các bước:** 1. Gọi một request mới mỗi tổ hợp. 2. Observer so snapshot. 3. Lặp bằng authenticated owner/manager/cashier/override cao nhất/service_role không assume operator. 4. Gọi với refs/target/PIN sai.
- **Kết quả:** Mọi ca hợp lệ outcome applied, true, revision 8, đúng một signal/audit, revoke tất cả; credentialChanged chỉ true khi PIN khác và không rewrite hash khi giống. App/service không đủ role nhận FORBIDDEN. Thiếu refs `OWNER_RECOVERY_REVIEW_REQUIRED`; PIN sai `INVALID_EMPLOYEE_REQUEST`; target mất `NOT_FOUND`; target non-owner/inactive `OWNER_PROTECTED`, đúng messages. Ca bị từ chối không đổi state.
- **Nơi hiện thực:** [tám transitions:449](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:449), [operator auxiliary:121](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:121). **Phủ một phần; còn exact hashes/counts/denied callers/refs/targets/snapshots, chưa gate current.**

## TC-PIN-06 — Đổi thành công rồi normal login

- **Truy vết:** PIN-01/03/04, UC-PIN-01. **Mức:** E2E Auth/REST/browser + mock.
- **Tiền điều kiện:** O1 true revision 0 có 2 restricted tokens; pending K synthetic không được execute tự động.
- **Dữ liệu thử:** R30, 123456 → 384729, expectedRevision 0.
- **Các bước:** 1. Gửi complete. 2. Observer snapshot. 3. Dùng cả hai token cũ gọi check/complete/business. 4. Login 123456 rồi 384729. 5. Quan sát network/print calls.
- **Kết quả:** applied/credentialChanged true/cờ false/revision1, một audit/signal/receipt; mọi session cũ revoked. Old-token `EMPLOYEE_SESSION_REQUIRED`; PIN cũ `INVALID_PIN`; PIN mới normal 12h sau authority check. UI message success đúng design; không tự execute K/payment/print.
- **Nơi hiện thực:** [runtime:52](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:52), [form:45](D:/Workspace/pos-cafe/src/app/requiredPinChange.test.tsx:45), [browser:302](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboarding.spec.ts:302), administration REST. **Phủ một phần; còn integrated two-token/evidence/12h/pendingK/noauto variants, chưa gate current.**

## TC-PIN-07 — Rollback tại audit, signal, registry và stage receipt

- **Truy vết:** PIN-03/04/05/07, UC-PIN-01/02/03. **Mức:** tích hợp SQL fault injection.
- **Tiền điều kiện:** Snapshot sạch O1/workflow; fixture fault controls chỉ ở DB cách ly; mỗi điểm reset fixture.
- **Dữ liệu thử:** forced complete R31, recovery R32, stage employee/menu/floor; lỗi trước insert audit, signal, registry hoặc stage receipt.
- **Các bước:** 1. Inject từng fault. 2. Gọi operation một lần. 3. So toàn bộ snapshot sau. 4. Bỏ fault và thực hiện explicit retry hợp lệ.
- **Kết quả:** Complete/recovery `PERMISSION_UPDATE_UNAVAILABLE` với câu context, hash/cờ/revision/session/audit/signal/registry không partial. Seed stage data/receipt/audit/signal rollback; workflow có thể ghi needs_retry + sanitized error trong outer block như design, stages trước vẫn committed. Retry không reapply stages cũ. Không giả fault là PASS thành công.
- **Nơi hiện thực:** [complete/recovery/employee faults:204](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:204). **Phủ một phần; còn menu/floor fault/retry/prior-stage preservation/exact hash assertions, chưa gate current.**

## TC-PIN-08 — Race hai thiết bị, recovery và biên TTL

- **Truy vết:** PIN-02/04, UC-PIN-01/02. **Mức:** tích hợp SQL barriers.
- **Tiền điều kiện:** Hai kết nối owner restricted cùng revision 0; controlled clock và lock barriers; reset mỗi ordering.
- **Dữ liệu thử:** complete R40 PIN384729 / R41 PIN927416; recovery R42 PIN765432; thời gian expiry-1ms/expiry/expiry+1ms.
- **Các bước:** 1. Giữ identity lock, xếp hai complete chờ, thả từng thứ tự. 2. Lặp complete/recovery cả hai thứ tự. 3. Giữ lock trước expiry, cho clock qua expiry rồi thả. 4. Gọi expectedRevision sai bằng token còn hợp lệ.
- **Kết quả:** Chỉ một complete commit; token bên thua revoked nhận session error, không overwrite. Recovery thắng làm complete cũ thất bại; complete thắng rồi recovery đặt true/PIN765432/revision tiếp. Valid tới trước expiry, đúng tại/sau expiry hoặc qua hạn trong khi chờ đều bị chặn; không kiểm TTL chỉ trước khóa. Stale expectedRevision `EMPLOYEE_VERSION_CONFLICT`. Response muộn không mở authority.
- **Nơi hiện thực:** [two complete:110](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:110), [G2b two-device Auth/REST/Chromium hai ordering](D:/Workspace/pos-cafe/tests/supabase/permissionPinCompletionRace.spec.ts:366) với [wait graph](D:/Workspace/pos-cafe/tests/supabase/permissionPinRaceLocks.ts:96) và [evidence G2b](../../../docs/implementation-log/permission-pin-completion-race-2026-10-09.md); [G2c expiry trong wait Auth/REST/Chromium](D:/Workspace/pos-cafe/tests/supabase/permissionPinExpiryWait.spec.ts) với [controlled clock](D:/Workspace/pos-cafe/tests/supabase/permissionPinExpiryClock.ts) và [evidence G2c](../../../docs/implementation-log/permission-pin-expiry-wait-2026-10-09.md); adapter late completion. **G2b hai ordering 2/2 PASS trên source-02 lịch sử; G2c một exact-expiry-while-waiting case 1/1 PASS trên source-04 riêng và hai reviewer APPROVE exact candidate-03. Còn complete/recovery, toàn TTL−1ms/0/+1ms matrix, staleRevision còn valid và lifecycle-generation variants; chưa gate toàn TC08/current PIN.**

## TC-PIN-09 — Lost ACK, denied request reuse và replay recovery

- **Truy vết:** PIN-04/07, UC-PIN-01/02. **Mức:** tích hợp + browser.
- **Tiền điều kiện:** O1 restricted; transport proxy có thể drop response sau DB commit hoặc trước execute; operator refs hợp lệ.
- **Dữ liệu thử:** R50 complete384729; R51 denied samePIN123456; R52 recovery927416; R53 complete384729 sau recovery.
- **Các bước:** 1. Drop ACK của R50 sau commit; thử gọi lại token cũ rồi login mới. 2. Reset; drop trước execute, login mới thất bại, login tạm restricted. 3. R51 denied rồi cùng token/ID payload khác; cùng payload lần nữa. 4. Recovery R52 → owner complete R53 → replay R52 đúng rồi khác payload, app caller và tenant khác.
- **Kết quả:** Không auto replay complete; token cũ session error, UI đúng hướng dẫn; login mới xác minh commit. Pre-execute loss không xóa cờ. Denied same request trả denial lịch sử, payload khác `ADMIN_REQUEST_REUSED`. Recovery replay không đổi PIN/cờ/revision/session/signal/audit hiện tại; response historical có nhãn replayed. Sai actor/tenant không xem receipt. Không secret trong receipts.
- **Nơi hiện thực:** [denied reuse:88](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:88), recovery historical replay449, [UI noauto replay:61](D:/Workspace/pos-cafe/src/app/requiredPinChange.test.tsx:61), [G2a real Auth/REST/Chromium hai thứ tự ACK](D:/Workspace/pos-cafe/tests/supabase/permissionPinAckLoss.spec.ts) và [log/evidence](../../../docs/implementation-log/permission-pin-ack-loss-2026-10-09.md). **Hai bước ACK loss G2a PASS trên source-07; denied reuse và recovery→actual complete→replay matrix chưa chạy đủ; chưa gate toàn TC09/current PIN.**

## TC-PIN-10 — Input onboarding và bootstrap DTO

- **Truy vết:** PIN-05, UC-PIN-03. **Mức:** đơn vị + tích hợp.
- **Tiền điều kiện:** Mỗi biến thể có Auth store fixture chưa bootstrap; gọi UI và trực tiếp RPC.
- **Dữ liệu thử:** displayName `''`, space-only, `A`, 120/121 Unicode code points (gồm emoji để phân biệt UTF-16); address 0/500/501 code points; seedDemo false/true/`'true'`/null/thiếu; storeNo 0/1/2147483647/2147483648; UUID zero/valid; field thừa; canonical name có khoảng trắng hai đầu.
- **Các bước:** 1. Gửi từng biến thể sai. 2. Gửi biên hợp lệ. 3. Replay cùng R60 canonical payload; thay seedDemo/name/ownerId cùng ID. 4. Đổi Auth user của cùng request. 5. Với từng storeNo 1, 99999999, 100000000, 2147483647, tạo Auth fixture đúng email/số, format→parse Store Key rồi pair qua Auth/REST thật, kiểm cùng storeId/storeNo. 6. Kiểm formatter/parser từ chối 0, âm, phân số, 2147483648 và phần số11 chữ số; không phát network cho Key sai.
- **Kết quả:** Biên hợp lệ đúng IDs/number/seedRequested/workflowID, string trim nhất quán. Invalid bootstrap `INVALID_WRITE_REQUEST`, không partial entities; invalid Store Key `AUTH_REQUIRED` với “Store Key không đúng định dạng.”. Key 9–10 chữ số trong miền pair đúng quán, không bị parser giới hạn8 chữ số. Replay không nhân đôi, payload đổi `BOOTSTRAP_CONFLICT`, tenant không khớp `FORBIDDEN`. Response không PIN/Key; context client đối chiếu IDs trước hiển thị.
- **Nơi hiện thực:** [input:15](D:/Workspace/pos-cafe/src/core/permissionIdentityInputs.test.ts:15), StoreKey/onboarding unit, [SQL bootstrap:216](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:216), [browser TC10](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:451). **Checkpoint 11/10:** chín ca browser Auth/REST + 61 unit liên quan PASS trên candidate local; chi tiết source/fixture/review ở [biên bản TC10](../../../docs/implementation-log/permission-pin-tc10-closeout-2026-10-11.md). Gate tổng cùng candidate cuối và production binding vẫn mở.

## TC-PIN-11 — Mất ACK từng bước tạo quán trong lifecycle

- **Truy vết:** PIN-05/07, UC-PIN-03. **Mức:** E2E Auth/REST/browser.
- **Tiền điều kiện:** Browser mới, A1 context được tạo trước network; proxy ACK loss; instrumentation đếm allocation/user/bootstrap, không ghi secret.
- **Dữ liệu thử:** name `Cà phê Mây`, address `12 Nguyễn Huệ`, seedDemo true, warning ACK true; drop ACK lần lượt reserve/signup/bootstrap.
- **Các bước:** 1. Với mỗi stage, drop response sau server success. 2. Double-click/retry và thử sửa payload khi pending. 3. Xác minh cùng createAttemptId/email/secret identity/storeId/requestId/payload được dùng (boolean equality, không log giá trị secret). 4. Inject lỗi trước execute để retry cùng context. 5. Giả response bootstrap trả owner/storeNo sai.
- **Kết quả:** Một reservation/Auth/store/settings/owner/workflow trong mỗi run; payload bị khóa; signup ACK loss signIn cùng credential. Không tự xin số/email mới. Mismatch IDs fail closed, không hiển thị Key gắn quán sai. AUTH_REQUIRED/PERMISSION_UPDATE_UNAVAILABLE/BOOTSTRAP_CONFLICT hiển thị đúng context; chưa bootstrap lại vì seed.
- **Nơi hiện thực:** [browser Auth/REST closeout](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts), [adapter oracle](D:/Workspace/pos-cafe/src/adapters/supabase/ownerPinOnboardingCloseout.test.ts), [component pending submit](D:/Workspace/pos-cafe/src/app/createStoreCloseout.test.tsx). [Biên bản TC11 local](../../../docs/implementation-log/permission-pin-tc11-closeout-2026-10-11.md) ghi 9/9 browser PASS trên target cách ly và hai reviewer APPROVE exact candidate; đây là gate riêng TC11, chưa là PIN-T06 cùng candidate cuối.

## TC-PIN-12 — Store Key unmount, gate, ACK và hard reload

- **Truy vết:** PIN-03/05/07, UC-PIN-03. **Mức:** giao diện E2E.
- **Tiền điều kiện:** Completed context có Key chưa ACK; cảnh báo trước tạo đã được hiển thị; dữ liệu test không secret thật.
- **Dữ liệu thử:** force unmount/remount CreateStoreScreen, compatibility mismatch rồi compatible, hard reload trước/sau ACK.
- **Các bước:** 1. Thử tạo khi chưa ACK cảnh báo. 2. Tạo, unmount/gate/remount trước ACK lưu Key. 3. ACK “Tôi đã lưu Store Key.” 4. Kiểm memory/persistent storage. 5. Trên fixture khác reload trước ACK; dùng Key đã lưu ngoài app để pair.
- **Kết quả:** Chưa warning ACK không tạo; context trước network. Key còn qua unmount/gate, không app protected mount. ACK xóa Key/secret, chuyển PIN login. Reload thật mất context, hiện giới hạn có điều kiện đúng design khi navigation timing báo reload, không tự tạo quán thứ hai/không giả server lấy lại Key hoặc biết ACK trước reload. Quán đã ghép vẫn đăng nhập được, không bị tự unpair. Đã lưu Key pair lại được và vẫn restricted. Không Key ở persistent storage/URL/log; không thêm marker để dò trạng thái ACK đã mất.
- **Nơi hiện thực:** [browser Auth/REST closeout](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts), [component unmount/remount](D:/Workspace/pos-cafe/src/app/compatibilityCreateStore.test.tsx), [adapter ACK secret clear](D:/Workspace/pos-cafe/src/adapters/supabase/ownerPinOnboardingCloseout.test.ts), reloadRecoveryNotice. [Biên bản TC12 local](../../../docs/implementation-log/permission-pin-tc12-closeout-2026-10-11.md) ghi browser 4/4 và unit/component24/24 PASS trên target cách ly, hai reviewer APPROVE exact candidate; đây là gate riêng TC12, chưa là PIN-T06 cùng candidate cuối.

## TC-PIN-13 — Auto seed chỉ lần đầu và blank store

- **Truy vết:** PIN-02/05, UC-PIN-03. **Mức:** tích hợp + browser.
- **Tiền điều kiện:** S1 demo pending chưa autoClaimedAt; S2 blank skipped; normal owner sau đổi PIN; stages IDs cố định.
- **Dữ liệu thử:** seedDemo true/false; status pending/in_progress/needs_retry/completed/skipped.
- **Các bước:** 1. Login restricted rồi thử seed. 2. Đổi PIN/login normal S1, đọc status và auto claim/run ba stages. 3. Reload/login lại. 4. Dựng từng status còn lại rồi login/focus/reconnect. 5. Login normal S2.
- **Kết quả:** Restricted bị PIN_CHANGE_REQUIRED; pending chưa claim chạy một lần, cuối completed/3 receipts. GET status không write. In_progress/needs_retry không auto resume; completed/skipped không seed. Blank không tạo cashier/menu/floor. Không normal session tạm trước đổi PIN; completed owner chỉ một, không reset PIN.
- **Nơi hiện thực:** [SQL workflow:481](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:481), [mock:34](D:/Workspace/pos-cafe/src/adapters/mock/permissionInitialSeedRepo.test.ts:34), [lifecycle:47](D:/Workspace/pos-cafe/src/app/initialSeedLifecycle.test.tsx:47), [browser Auth/REST TC13](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts). **Checkpoint 11/10:** bốn ca browser bao phủ năm status, restricted denial, login/reload/focus/online, GET read-only đối chiếu snapshot workflow/stages/owner/seed graph/audit/signals; 4/4 PASS trên target local cô lập. [Biên bản TC13](../../../docs/implementation-log/permission-pin-tc13-closeout-2026-10-11.md) ghi source, fixture và giới hạn. Đây là gate TC13 local riêng; gate PIN toàn bộ cùng candidate cuối và production binding còn mở.

## TC-PIN-14 — Mất ACK từng stage và giữ chỉnh sửa đã có

- **Truy vết:** PIN-05/07, UC-PIN-03. **Mức:** tích hợp E2E.
- **Tiền điều kiện:** Demo workflow; transport có ACK loss; normal owner. Reset toàn fixture cho mỗi stage employee/menu/floor.
- **Dữ liệu thử:** Mỗi stage commit xong drop ACK. Sau employee, owner đổi cashier PIN 111111→246810; sau menu đổi tên/giá cà phê 29000→31000; sau floor đổi tên bàn thành `Sân 01`.
- **Các bước:** 1. Drop ACK sau commit stage đang kiểm, chặn gọi stage tiếp. 2. Sửa dữ liệu đã commit như trên qua route được phép. 3. Hard reload và normal login. 4. GET status, xác nhận không auto write. 5. Với employee/menu, workflow chưa xong: bấm retry trên thiết bị khác, chạy pending stages tới completed. Với floor, GET phải thấy completed: không nút retry, không claim hoặc mutation mới. 6. Gọi committed stage trực tiếp bằng current generation, xác nhận chỉ nhận receipt.
- **Kết quả:** Stage receipt/ID giữ nguyên; committed stage chỉ trả receipt, không gọi helper. Cashier PIN246810 còn đúng và 111111 sai; menu/floor giữ chỉnh sửa, không revive deleted rows. Không audit/signal/revision mutation thứ hai cho stage cũ. Số entity không tăng, owner/PIN không đổi, chỉ pending stages được chạy.
- **Nơi hiện thực:** [browser stage ACKloss:398](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboarding.spec.ts:398), [SQL edit/replay:519](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:519), mock stage edits. **Phủ một phần; chưa tổ hợp ACKloss→allowed-route edit→reload→seconddevice retry giữ edits, chưa gate current.**

## TC-PIN-15 — Seed lỗi, collision, hai thiết bị và stale generation

- **Truy vết:** PIN-05, UC-PIN-03. **Mức:** tích hợp SQL barriers + browser.
- **Tiền điều kiện:** Hai fixture tách biệt, mỗi fixture có two normal owner sessions: (A) workflow pending, chưa autoClaimedAt và chưa stage committed để kiểm initial claim; (B) đã initial claim, employee stage committed/menu pending để kiểm fault/retry/race. Fixture collision riêng có deterministic ID tồn tại trước stage tương ứng.
- **Dữ liệu thử:** hai auto claim cùng revision; retry A/B cùng revision; old/new runGeneration; menu entity ID có sẵn không có workflow receipt.
- **Các bước:** 1. Trên fixture A, race hai initial claims cùng revision, observer count. 2. Trên fixture B, fail menu trước commit; vào quán đổi cashier PIN246810. 3. Reconnect đọc status rồi explicit retry; race hai retries và stage đang giữ lock. 4. Gửi old generation/out-of-order stage. 5. Trên fixture collision, thử stage chưa committed rồi explicit retry. 6. Bỏ fault/collision có kiểm soát trong fixture rồi explicit retry.
- **Kết quả:** Một claim/commit per stage. Failure needs_retry không chặn vận hành; employee không chạy lại, cashier PIN giữ. Stale/thứ tự sai `INITIAL_SEED_ATTEMPT_STALE`, UI chỉ đọc lại status. Collision `ENTITY_ID_CONFLICT`, không overwrite; stage receipt chưa committed. GET/reconnect không auto replay. Đua reclaim chờ stage lock; committed stage được bỏ qua hoặc rollback trọn, không partial/duplicate.
- **Nơi hiện thực:** [browser Auth/REST và SQL barriers](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1292), [claim/retry contracts](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:343), SQL collision481/mock64/lifecycle. Năm ca browser TC15 trên target cô lập 599xx **5/5 PASS** cùng [manifest nguồn](D:/Workspace/pos-cafe/artifacts/permission-pin-tc15-close3/source-manifest.json) `3bbfb3b6…`; [biên bản](../../../docs/implementation-log/permission-pin-tc15-closeout-2026-10-11.md) ghi oracle, pre/postflight và hai APPROVE. **TC15 local đã đóng; chưa là full gate CLOSE-2 hoặc phát hành.**

## TC-PIN-16 — Seed qua recovery, tenant và quyền

- **Truy vết:** PIN-02/04/05/06, UC-PIN-02/03. **Mức:** tích hợp bảo mật.
- **Tiền điều kiện:** Employee committed/menu pending, normal owner token; cashier/manager đủ mọi overrides; S2 owner khác.
- **Dữ liệu thử:** recovery927416 giữa stages; old generation/token; calls get/begin/run bằng owner restricted, non-owner normal, tenant S2.
- **Các bước:** 1. Recovery O1 khi stage chưa được chạy tiếp. 2. Dùng token cũ run menu. 3. Owner đổi PIN/login normal; quan sát workflow. 4. Gọi get/begin/run bằng từng unauthorized caller và các legacy seed endpoints.
- **Kết quả:** Old token session error, không stage commit mới. Sau login normal chỉ GET/wait explicit retry, không auto. Restricted PIN_CHANGE_REQUIRED, non-owner FORBIDDEN, tenant S2 không đọc/ghi workflow S1. Legacy standalone seed mutation đã bị đóng. Owner cờ/PIN không bị seed đổi lại.
- **Nơi hiện thực:** [browser Auth/REST + SQL actor trên target cô lập](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts:1703), [SQL contracts](D:/Workspace/pos-cafe/tests/contracts/ownerPinServerRuntime.contract.test.ts:485). Hai ca TC16 [2/2 PASS](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/tc16-safe.json) trên [manifest nguồn](D:/Workspace/pos-cafe/artifacts/permission-pin-tc16-close2/source-manifest.json) `7ffeefa5…`; [biên bản](../../../docs/implementation-log/permission-pin-tc16-closeout-2026-10-11.md) ghi recovery, quyền, tenant, legacy denial và hai APPROVE. **TC16 local đã đóng; chưa là full gate CLOSE-2 hoặc phát hành.**

## TC-PIN-17 — Hồi quy normal PIN, non-owner và UI audit

- **Truy vết:** PIN-03/06, UC-PIN-01/02. **Mức:** đơn vị/tích hợp/giao diện.
- **Tiền điều kiện:** Owner false normal PIN384729; cashier non-owner; permission catalog hiện hành; UI ở desktop/tablet/mobile theo config.
- **Dữ liệu thử:** Normal self current=new384729; current sai; new927416; non-owner create/reset111111; client/server contract 1/2 combos.
- **Các bước:** 1. Thực hiện normal no-op và đổi thật, kiểm session/audit. 2. Create/reset cashier theo PERM, login. 3. Thử old/new compatibility combinations. 4. Chạy unit/build và regression permission bắt buộc. 5. Chạy `npm run ui-audit:selftest`, phải 23 findings + selftest OK, rồi audit state PIN và xem ảnh ở ba viewport.
- **Kết quả:** Normal cùng PIN giữ no-op/không revoke; current sai không đổi; normal đổi thật giữ PERM semantics. Cashier không tự có cờ true; 15 quyền/trần giữ nguyên. Contract lệch fail closed. Form masked, không overflow/overlay/0x0; findings được phân loại từ ảnh. Không chạy `ui-audit:update` để làm xanh.
- **Nơi hiện thực:** [browser Auth/REST và SQL evidence](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts), client/core PERM regression và [UI audit fixture](D:/Workspace/pos-cafe/ui-audit/required-pin-change.html). Candidate local TC17 [1/1 browser PASS trên close3](D:/Workspace/pos-cafe/artifacts/permission-pin-tc17-close3/tc17-safe.json): exact 15 mã catalog/7 quyền cashier, manager ceiling denial, header cũ bị chặn cả read/write, SQL gate cũ fail closed, client cũ/mới qua unit. PERM client/core 63/63, unit 1.161/1.161, build PASS, selftest 23/23, full audit 22 finding baseline/0 mới, màn PIN 0 ở cả ba viewport với ảnh đã xem. [Biên bản TC17](../../../docs/implementation-log/permission-pin-tc17-closeout-2026-10-11.md) ghi oracle, phân loại UI và giới hạn; hai reviewer khác scope **APPROVE exact main/docs pre-review candidate, TC17 local đã đóng**. Full PERM60 runtime, CLOSE-2/CLOSE-3 và phát hành vẫn mở.

## TC-PIN-18 — Secret, lỗi và audit projection

**Cập nhật 12/10:** Review full PIN19 source-20 phát hiện hai lỗ hổng oracle ở denial PIN và artifact sink; trạng thái TC18 trong checkpoint 11/10 bên dưới là lịch sử, không đóng gate source-20. [Finding và cách kiểm lại](../../../docs/implementation-log/permission-pin19-source20-2026-10-12.md#ket-luan-review-va-gioi-han).

**Kế hoạch kiểm lại được giao cùng ngày:** [task sửa oracle](../../../docs/workflow/tasks/permission-pin-tc18-oracle-fix-2026-10-12.md). Ca `complete:denial` phải quét `TEMP_PIN` thực đã gửi. Mỗi scenario đọc lại PNG/JSON từ đĩa; sau child exit, wrapper đọc log, reporter và toàn bộ output tree; đủ 20 scenario + operator và artifact bắt buộc, không skip/retry. Missing/unreadable hoặc PIN xuất hiện đều FAIL. Đối chứng chèn PIN vào từng sink, file PNG/JSON/log/reporter, JSON escape/base64 và ghi thêm sau projection sạch phải bị bắt mà không echo secret. Chạy bằng `node scripts/permission-pin-canary-run.mjs artifacts/<thư-mục-run-mới>` với `PIN_ONBOARD_ENV_FILE` explicit; config TC18 trực tiếp thiếu wrapper context phải từ chối. Không dùng raw JSON reporter. PNG quét bytes và form đã mask cùng DOM text; không tuyên bố OCR ảnh.

- **Truy vết:** PIN-07, UC-PIN-01/02/03. **Mức:** tích hợp + browser audit.
- **Tiền điều kiện:** Instrument capture đã redact output; registry/audit/signals observer quyền test; operations success/denied/fault/lost ACK/replay.
- **Dữ liệu thử:** Canary secrets runtime riêng cho PIN/Key/token; refs synthetic không secret; không đưa canary thật vào report.
- **Các bước:** 1. Chạy complete/recovery/bootstrap/seed và mọi lỗi design qua TC liên quan. 2. Kiểm raw audit/registry/signals/Realtime payload/browser storage/URL/console/error telemetry/log artifact bằng canary equality. 3. Kiểm screenshot form và message mapping không raw SQL. 4. Đảm bảo observer không xuất hash/secret khi assertion lỗi. 5. Chạy UI operator local-only qua backend, chứng minh bind loopback, unlock/session/CSRF/Origin/body limits, role không hợp lệ bị từ chối, exact recovery error messages, replay/lost ACK và không lộ credential/PIN; đối chiếu DB audit/registry sau thao tác. Không chạy trên hosted khi chưa có gate riêng.
- **Kết quả:** Chỉ keyed MAC trong registry cho secret payload, không hash PIN/plaintext PIN/token/Key. Proof/receipt không authority/data leak. Audit actor/target/request/outcome/credentialChanged/state đúng, registry không log secret khi denied. Mỗi mã design có TC trigger; unsupported messages hoặc raw backend text là FAIL. UI operator không mở quyền cho POS và không đưa DSN/PIN vào response, storage, URL, console hoặc artifact.
- **Nơi hiện thực và trạng thái 11/10:** [oracle và matrix](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryScenarioMatrix.ts), [reporter an toàn](D:/Workspace/pos-cafe/scripts/permission-pin-canary-reporter.mjs) gắn trong [config TC18 riêng](D:/Workspace/pos-cafe/playwright.pin-tc18.config.ts), [browser runtime](D:/Workspace/pos-cafe/tests/supabase/ownerPinOnboardingCloseout.spec.ts), [operator backend](D:/Workspace/pos-cafe/scripts/owner-recovery-operator-core.mjs), [operator UI](D:/Workspace/pos-cafe/operator/owner-recovery.html), [browser UI operator](D:/Workspace/pos-cafe/tests/operator/ownerRecoveryOperator.spec.ts) và [biên bản TC18](../../../docs/implementation-log/permission-pin-tc18-closeout-2026-10-11.md). Canary runtime 20 tình huống × 11 sink, browser TC18 7/7 bằng config chỉ xuất receipt an toàn, reporter/oracle 9/9 đối chứng âm trên target cô lập. `ENTITY_ID_CONFLICT / seed`, `ADMIN_REQUEST_REUSED` và `INVALID_EMPLOYEE_REQUEST / payload khác` đã sửa đúng câu với assertion; passcode, required PIN và sáu recovery contexts có exact checks. Operator local-only core 3/3, browser desktop/mobile 2/2 gồm response unavailable sau commit mơ hồ rồi replay cùng request, real PostgreSQL role/transition 1/1; không cấp recovery cho POS. Unit toàn app 1.170/1.170, build/typecheck, UI audit 16×3 không finding mới, postflight zero. Hai reviewer đã `APPROVE` [candidate](../../../docs/implementation-log/permission-pin-tc18-review-2026-10-11.md); target test đã dừng, volume/network giữ. **TC18 local technical PASS**; lượt full-file TC13 timeout vẫn ghi riêng, không suy mọi thông báo design đều được runtime trigger trong riêng TC18, không suy hosted/phát hành.

**Checkpoint sửa oracle TC18, 12/10:** Source-23 TC18 7/7, matrix20×11 + operator, quét48 file sau runner, tooling28/28 và hai typecheck đạt. [Biên bản](../../../docs/implementation-log/permission-pin-tc18-oracle-fix-2026-10-12.md) giữ ba lượt Realtime FAIL trước probe direct-client và giới hạn. Hai review candidate mới đang chờ; không thay FAIL source-20 hoặc nhận full PIN19/PERM60 source-23.

**Checkpoint mới TC18:** Security source-23 tìm SEC-03 numeric PIN. Source-25 execution7/7/matrix20×11/scan48, tooling40/40 và hai typecheck đạt sau sửa numeric/BigInt/leading-zero và array length. [Hồ sơ cuối](../../../docs/implementation-log/permission-pin-tc18-oracle-fix-2026-10-12.md#checkpoint-cuoi-sau-sec-03--source-25); review candidate-02 đang chờ, không nhận full gate mới.

## TC-PIN-19 — Empty-target activation, drift và bảo toàn ngoài scope

- **Truy vết:** PIN-06/07, UC-PIN-04. **Mức:** tích hợp/tooling release rehearsal cách ly.
- **Tiền điều kiện:** Bản sao cấu trúc backend, zero tenant rows, catalog/config còn nguyên; unrelated Auth66/Storage1 synthetic, backup manifest; không chạy live. Source fingerprint đồng nhất client/SQL/runner.
- **Dữ liệu thử:** `expectedEmptyStoreSet:true` với arrays rỗng; flag thiếu/false với arrays rỗng; store/employee/business orphan thêm riêng lẻ; writer race sau dry-run/trong locked recheck; fault sau DDL; target config sai.
- **Các bước:** 1. Kiểm config empty được nhận, ordinary empty bị từ chối. 2. Dry-run zero rồi insert từng loại row trước activation. 3. Dùng barriers để race legacy writer và activation lock. 4. Chạy clean activation/postflight và bootstrap synthetic new owner. 5. Inject fault trước commit, so schema/grants/source snapshot. 6. So unrelated Auth/Storage/config inventory trước/sau.
- **Kết quả:** Rỗng thật activation atomic không fake mapping/owner; new owner restricted. Còn employee/orphan/tenant row nhận RELEASE_TARGET_NOT_EMPTY hoặc ACTIVATION_TARGET_NOT_EMPTY theo công cụ; store-set drift TARGET_STORE_SET_MISMATCH/ACTIVATION_STORE_SET_MISMATCH; thêm bảng tenant ngoài inventory nhận TARGET_TENANT_SCHEMA_MISMATCH/ACTIVATION_TENANT_SCHEMA_MISMATCH; sai config INVALID_TARGET_CONFIG. Messages tool đúng design. Lock ngăn writer lọt recheck; fault rollback. Không xóa project/schema/config/unrelated objects. Report xác nhận counts dưới khóa, fingerprint, commands/exit/postflight; rehearsal không là live cleanup/deploy evidence.
- **Nơi hiện thực và trạng thái 11/10:** [tooling empty](D:/Workspace/pos-cafe/tests/contracts/permissionEmptyActivation.tool.test.ts), [runtime canary TC19](D:/Workspace/pos-cafe/tests/contracts/permissionCanaryEmptyRuntime.contract.test.ts), [biên bản local](../../../docs/implementation-log/permission-pin-tc19-closeout-2026-10-11.md). Lượt runtime cuối 1/1 trên fresh canary 598xx, release preflight thực và activation cùng source kiểm zero/flag, config/source/bundle/marker, store/employee/business orphan, schema drift, writer trước/sau lock, DDL fault rollback, catalog/config/66 Auth+1 Storage, owner restricted. Hai lượt trước FAIL do WSL shutdown giữa test; lịch sử giữ nguyên. **TC19 local rehearsal PASS sau review**, không là cleanup/live deployment hoặc full CLOSE-2/PERM60.

## Gate và phủ lỗi

Main: TC01/06/10/11/13/19. Exception: TC02/04/05/07/09/10/11/15/16. Boundary: TC04/05/08/10. Security: TC03/05/08/09/16/18/19. Mọi code ở design có trigger trong các ca này; mọi message context phải assertion cụ thể, không chỉ kiểm code.

Required gate: unit/build, real SQL/Auth/REST, browser, UI audit và regression permission hiện hành cùng candidate; Storage/Realtime thật nếu route bảo vệ phụ thuộc chúng. Runtime thiếu thành phần nào phải ghi NOT RUN/BLOCKED, không suy PASS. Hai reviewer độc lập phải APPROVE candidate cuối. Evidence không chứa secret, không ghép fingerprint khác thành full PASS.


### Tham chiếu BACKUP-AB-14, 14/10/2026

Phần activation đích rỗng/PIN-06/PIN-T07 tiếp tục tham chiếu [backup v2 B/I/C/L](../../../docs/runbooks/permission-backup-v2-2026-10-14.md), PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2. Đây là cập nhật dependency vận hành theo quyết định owner; không đổi forced-PIN,19TC hoặc empty-target behavior. Old77 và74/75FAIL là lịch sử; phạm vi mới EXACT79 có private provenance. Knonempty chặn cleanup, ngoài66Auth/object3 giữ; chưa C/Storage/provider receipt thì release vẫn BLOCKED.
