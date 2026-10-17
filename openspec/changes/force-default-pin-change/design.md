# Thiết kế — PIN owner tạm

Thiết kế chốt22/09. Các lựa chọn kỹ thuật PIN-D03–05 do AI chọn trong phạm vi chủ dự án giao; spec đã có review candidate02 theo [tasks](tasks.md). **Cập nhật08/10:** code/test liên quan đã có, nhưng coverage/gate19TC còn một phần; [matrix hiện hành](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) ghi actual paths/gaps và evidence lịch sử khác current66. Design giữ bất biến/giải pháp, không tự chứng nhận runtime/full acceptance.

## Khảo sát tại mốc spec22/09 — lịch sử

Bảng này giữ nhận định và địa chỉ source của lần khảo sát ban đầu. File hiện tại có thể đã đổi và số dòng cũ không chứng minh hành vi hôm nay; xem matrix08/10 cho code/test/evidence hiện hành. Không dùng các nhãn “chưa có/phải bổ sung” trong bảng lịch sử làm trạng thái triển khai hiện tại.

| Nguồn được trích ở mốc22/09 | Nhận định khảo sát khi đó |
| --- | --- |
| [permission-identity.sql:171](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:171), [:251](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:251) | Start session/current self-PIN hiện tại; phải bổ sung purpose/cờ, giữ normal self-PIN same-PIN no-op |
| [permission-identity.sql:221](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:221), [:274](D:/Workspace/pos-cafe/supabase/candidate/permission-identity.sql:274) | Recovery dùng cơ chế changed/noop chung; chưa có transition mới của change này |
| [authRepo.ts:41](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:41), [:45](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:45), [:68](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:68) | Mỗi create gọi allocation/signup; chưa có pending context/recovery mất bootstrap ACK; không được nói recovery này đã tồn tại |
| [authRepo.ts:77](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:77) | Đăng nhập PIN 123456 để seed trước trả kết quả; phải bỏ |
| [seedRepo.ts:12](D:/Workspace/pos-cafe/src/adapters/supabase/seedRepo.ts:12), [:34](D:/Workspace/pos-cafe/src/adapters/supabase/seedRepo.ts:34) | Attempt chỉ memory và ID mới sau reload/session khác; không bảo đảm resume bền vững |
| [permission-seed.sql:40](D:/Workspace/pos-cafe/supabase/candidate/permission-seed.sql:40), [:64](D:/Workspace/pos-cafe/supabase/candidate/permission-seed.sql:64), [:68](D:/Workspace/pos-cafe/supabase/candidate/permission-seed.sql:68) | Seed employee có thể reset cashier PIN 111111; menu upsert ghi đè. Phải có receipt chặn chạy lại stage đã commit |
| [permission-release-preflight.mjs:27](D:/Workspace/pos-cafe/scripts/permission-release-preflight.mjs:27), [permission-activation-bundle.mjs:27](D:/Workspace/pos-cafe/scripts/permission-activation-bundle.mjs:27) | Config hiện đòi storeIds không rỗng; cần mode empty-target tường minh và locked recheck, không fake mapping |

## Schema, contract và phiên

- `employees.pin_change_required boolean NOT NULL DEFAULT false`, constraint true chỉ cho role owner. Bootstrap set true rõ ràng. Không auto backfill dữ liệu cũ; rollout chỉ trên đích rỗng đã duyệt. Fixture owner normal set false tường minh.
- Session purpose `normal|required_pin_change`. Restricted token opaque, memory-only, gắn storeId/employeeId/revision, TTL 300 giây; normal giữ 12 giờ. Không persist token/PIN/Key vào localStorage/sessionStorage/IndexedDB/URL hoặc report. Hash token trong DB giữ quy ước identity hiện có.
- `startSession` discriminated union theo usecases; restricted không có role/permission snapshot. `permission_get_authority`/revision nghiệp vụ và mọi normal guard đều yêu cầu purpose normal **và** cờ false hiện hành; check lại sau chờ khóa. Một token normal cũ không vượt gate khi recovery vừa đặt true.
- Version DTO là **runtime `permissionContractVersion:2`**, `writeProtocolVersion:1`. Catalog schema `contractVersion:1`, shape/defaults và 15 quyền không đổi. Không nhầm runtime compatibility với version của catalog. Client runtime contract 1 và server runtime contract 1 không được suy hiểu union mới; fail closed qua compatibility protocol. Bộ runtime contract/activation/client được phát hành cùng candidate; tests compatibility hiện tại version 1 không phải bằng chứng runtime contract 2 đã đạt.
- Private validator restricted không là public boolean bypass. Chỉ 3 public routes cho token restricted: `permission_complete_required_pin_change(jsonb)`, `permission_revoke_session()`, `permission_check_required_pin_session()`.
- Proof-only check không nhận payload/target. Auth tenant + token hash + purpose + expiry + active owner + cờ true + revision phiên được kiểm lại dưới cùng lock order identity. Thành công `{ok:true,data:{valid:true,purpose:'required_pin_change',employeeRevision,expiresAt}}`; failure `EMPLOYEE_SESSION_REQUIRED`. Không cấp normal token, không trả role/quyền/store data/receipt; không gia hạn TTL. Focus/reconnect giữ form chặn đến khi check xong; lỗi mạng giữ chặn, expired/revoked về login. Response cũ chỉ được áp nếu generation/store/employee của client còn khớp.
- Roster/contract/store pairing metadata chỉ giữ projection tối thiểu đã có; không được thêm owner authority hoặc seed payload vào metadata trước PIN.

## Complete-required-PIN và mất ACK

`permission_complete_required_pin_change(p_request)` nhận object whitelist **chỉ** `{requestId,expectedRevision,newPin}`. UUID khác zero, revision integer 0–9007199254740991, PIN string `^[0-9]{6}$`; confirmPin chỉ UI. Target/store lấy từ Auth + restricted token, không nhận client target/role/cờ.

1. Xác minh Auth/shape; lấy khóa identity đúng thứ tự hiện hành. Không thêm lock order ngược với recovery, seed hoặc catalog.
2. Sau khóa kiểm token/revoked/TTL (`now >= expiresAt` là hết hạn), purpose/cờ/owner active và revision hiện hành. Phiên revoked/expired trả `EMPLOYEE_SESSION_REQUIRED` **trước tra receipt**. expectedRevision sai với phiên còn hợp lệ trả `EMPLOYEE_VERSION_CONFLICT`.
3. So hash newPin với PIN hiện tại, bằng nhau trả `PIN_REUSE_NOT_ALLOWED`; không thay credential/revision/cờ/session. Semantic denial được ghi audit/receipt denied theo protocol admin; syntax/auth rejection không có authority để ghi audit actor.
4. Một transaction ghi hash mới/cờ false/revision +1, revoke mọi session của owner, audit applied, signal permission và terminal receipt. Registry lưu keyed MAC payload, không plaintext PIN/hash PIN. Audit/signal/receipt lỗi rollback toàn bộ.
5. Trả `{ok:true,outcome:'applied',data:{credentialChanged:true,pinChangeRequired:false,employeeRevision}}`, **không** normal token.

Receipt được giữ để kiểm toán/chống tái áp dụng, nhưng change này **không có route đọc completion receipt bằng normal token**. Sau success token cũ revoked; mọi lần gọi lại, kể cả ID/payload đúng, trả `EMPLOYEE_SESSION_REQUIRED`. Không hứa `replayed` cho completion thành công. ID đã có receipt denied + phiên vẫn hợp lệ: cùng payload trả denial lịch sử, payload khác `ADMIN_REQUEST_REUSED`. Request ID mới dùng cho chỉnh input sau denial.

Mất ACK: xóa credential/input cũ, hiển thị thông báo context đổi PIN và yêu cầu login PIN mới; nếu không được thử PIN tạm. Server trả normal nếu commit thành công và không có recovery mới, restricted nếu trạng thái hiện tại còn tạm. Không kết luận rollback từ network error; không tự gửi lại đổi PIN. Recovery cạnh tranh có thể làm cả hai PIN người dùng đang biết không còn đúng; giữ login và hướng dẫn dùng PIN tạm vừa được operator cấp, không ghi lại state từ response cũ.

## Recovery transition đầy đủ

### Công cụ operator local-only — quyết định PIN-D07 (11/10)

UI recovery là một trang riêng do Node backend cục bộ phục vụ trên **`127.0.0.1`**; không gắn vào AppShell/POS, không cấp `EXECUTE` cho `anon`, `authenticated`, `service_role` hay owner token. Backend nhận DSN PostgreSQL từ file credential nằm ngoài repo và chỉ chấp nhận target host được cấu hình trước. Backend không tự `GRANT` role: connection login phải được hạ tầng cấp khả năng `SET ROLE pos_owner_recovery`, nếu không thì dừng thao tác. Mỗi recovery dùng transaction `BEGIN` → `SET LOCAL ROLE` → gọi `private.permission_recover_owner(jsonb)` → `COMMIT` hoặc rollback; không ghép SQL từ input.

Operator cung cấp mã mở phiên dài tối thiểu 20 ký tự qua môi trường riêng lúc khởi động. Trang không đưa mã này vào URL/storage. Unlock bằng POST tạo session random ngắn hạn trong HttpOnly/SameSite cookie, CSRF random chỉ giữ trong memory của trang; backend kiểm `Origin`/`Host`, giới hạn kích thước body, tốc độ unlock và recover. `Cache-Control:no-store`, CSP chặn nguồn ngoài/frame, không log body/DB exception. Trang đòi operator xác nhận đã kiểm hồ sơ/store/owner/kênh nhận **ngoài app**; checkbox chỉ là attestation, không tự chứng minh hồ sơ. Browser gửi `{requestId,storeId,targetId,operatorRef,caseRef,proofRef,newPin}` đã validate theo UC-PIN-02. Response whitelist chỉ `{ok,outcome,credentialChanged,pinChangeRequired,employeeRevision}` hoặc `{ok:false,error:{code,message}}`; không phản chiếu payload/PIN/SQL. Mọi lỗi không biết chuyển câu an toàn theo context, không trả backend text.

Form PIN masked và giữ memory cho đến khi operator xác nhận bàn giao; không local/session storage, IndexedDB, URL, telemetry hay clipboard tự động. Mất ACK không tự tạo ID/PIN mới; operator có thể bấm thử lại với cùng request/payload nếu trang còn sống. Nếu reload/mất phiên thì yêu cầu kiểm hồ sơ/audit trước thao tác mới. Thành công `replayed` phải được gắn nhãn **receipt lịch sử**, không khẳng định owner hiện đang ở trạng thái tạm. UI hiển thị đúng câu design cho `OWNER_RECOVERY_REVIEW_REQUIRED`, `OWNER_PROTECTED`, `NOT_FOUND`, `FORBIDDEN`, `ADMIN_REQUEST_REUSED`, `PERMISSION_UPDATE_UNAVAILABLE / recovery` và lỗi PIN; các context khác giữ message an toàn theo mã. Không tự bàn giao PIN bằng email/SMS.

Lựa chọn này giữ nguyên bất biến “app không gọi được”. Một màn trong POS cần đổi mô hình quyền và bị loại theo quyết định của chủ dự án. Kênh trình duyệt trực tiếp tới PostgreSQL hoặc service-role bị loại vì sẽ đặt credential/quyền recovery trong client. Công cụ này chỉ là source local candidate; chưa xác nhận cấu hình hạ tầng/credential đích thật hay quyền phát hành.

Một **requestId mới**, đúng role/operator refs/hồ sơ, luôn biểu diễn một lần phát hành credential tạm mới. Vì là một sự kiện vô hiệu hóa authority, revision tăng 1 cả khi hash/cờ đã giống và không còn live session. Đây là delta kỹ thuật chủ ý so với no-op thông thường, không đổi normal self-PIN/non-owner reset.

| PIN operator so với hiện tại | Cờ trước | Live sessions trước | credentialChanged | Cờ sau / outcome | Revision / signal / revoke / audit |
| --- | --- | --- | --- | --- | --- |
| Khác | false | 0 | true | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Khác | false | >0 | true | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Khác | true | 0 | true | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Khác | true | >0 | true | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Giống | false | 0 | false | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Giống | false | >0 | false | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Giống | true | 0 | false | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Giống | true | >0 | false | true / applied | +1 / một signal / revoke mọi session / một audit applied |
| Replay cùng request/payload đã áp | Bất kỳ | Bất kỳ | Giá trị lịch sử | Không đổi hiện tại / replayed | Không tăng / không signal / không revoke mới / không audit thứ hai |

Hash không viết lại khi PIN giống. Revoke idempotent trên session cũ, không giả số session được thu hồi >0. Receipt recovery luôn là lịch sử, kể cả `pinChangeRequired:true`; replay sau owner đổi xong không ghi true trở lại. Payload khác cùng ID: `ADMIN_REQUEST_REUSED`. Xác minh role trước receipt, nên app không đọc được receipt operator. Fault rollback cả credential/cờ/revision/sessions/audit/signal/registry. Lock serialize recovery/complete: recovery thắng thì token complete cũ chết; complete thắng thì recovery mới đặt true lại và PIN cuối là PIN do operator cấp.

## Pending create context và Store Key

**Ghi chú thiết kế22/09: phần này cần hiện thực mới, chưa có recovery context ở mốc khảo sát.** Đối chiếu08/10: [authRepo.ts:51](D:/Workspace/pos-cafe/src/adapters/supabase/authRepo.ts:51) đã có context/coalescing và reconciliation; [test:29](D:/Workspace/pos-cafe/src/adapters/supabase/ownerPinOnboarding.test.ts:29) có assertions liên quan, nhưng TC11/12 còn gap theo matrix. Provider sống ngoài CreateStoreScreen/compatibility gate giữ một context gồm createAttemptId, input canonical bất biến, secret tạo client, stage và kết quả được xác nhận. Khởi tạo context **trước** reserve số/Auth/signup/bootstrap. Chỉ có một pending context; double-click cùng promise, không cho đổi payload hoặc tạo context thứ hai khi kết quả chưa rõ.

| Stage | Cách gọi / retry trong cùng lifecycle |
| --- | --- |
| reserve | Bổ sung `permission_reserve_store_no(createAttemptId)` idempotent: request UUID → một storeNo 1–2147483647; unique receipt server. Gọi lặp cùng ID nhận cùng số. Không dùng `get_next_store_no` không idempotent khi ACK mất. Allocation chưa có Store Key/employee authority, giữ mô hình tạo quán hiện có; không thêm secret vào reservation |
| signup | Email/secret gắn số đã reserve, không sinh lại. Mất ACK: thử signIn bằng **cùng** email/secret; nếu chưa xác nhận được thì giữ pending và cho explicit retry cùng credentials. Không allocate số/email mới. Chỉ tiếp tục khi Auth user ID/session được xác nhận; Auth retry phải chứng minh không tạo user thứ hai |
| bootstrap | ownerId = deterministic UUID từ Auth storeId + `owner.primary`; requestId từ storeId + `permission.bootstrap.v1`; payload canonical gồm ownerId/storeNo/name/address/**seedDemo**. Retry cùng Auth/store/request/payload; server receipt không PIN/Key. Không gọi seed trong createStore |
| completed | Kiểm IDs khớp; giữ completed result/Key trong provider qua unmount/gate. Không xóa do screen cleanup. Hiển thị một lần tới ACK “Tôi đã lưu Store Key.” rồi xóa secret và chuyển PIN login |

`displayName` trim 1–120 Unicode code points; address trim 0–500; seedDemo boolean bắt buộc server. Đồng bộ quy tắc trim frontend/server theo `permission_trim`, không dùng length UTF-16 cho boundary; không normalization âm thầm làm đổi text. Bootstrap atomic store/settings/owner true/workflow, receipt replay giữ lựa chọn seed ban đầu; canonical payload khác trả `BOOTSTRAP_CONFLICT`.

Store Key phải roundtrip toàn miền storeNo 1–2147483647 đã quy định cho bootstrap/reservation. Tại mốc khảo sát22/09, parser chỉ nhận 1–8 chữ số; yêu cầu thiết kế là mở thành 1–10 chữ số ASCII và kiểm integer trong miền trên, không chỉ kiểm >0. Formatter kiểm cùng miền trước khi pad tối thiểu 4 chữ số; secret/trim/uppercase giữ tương thích hiện hành. Giá trị 99999999, 100000000 và 2147483647 phải format→parse→pair được; 0, âm, phân số, 2147483648 và chuỗi phần số hơn10 chữ số bị từ chối `AUTH_REQUIRED`/thông báo Store Key hiện có. Đây là sửa khớp miền số đã có, không đổi cách xác thực quán. Đối chiếu08/10: [parser:3](D:/Workspace/pos-cafe/src/adapters/supabase/storeKey.ts:3) và [:21](D:/Workspace/pos-cafe/src/adapters/supabase/storeKey.ts:21) đã hỗ trợ pattern 1–10/int32; [unit roundtrip:15](D:/Workspace/pos-cafe/src/adapters/supabase/storeKey.test.ts:15) có các biên trên, chưa chứng minh chuỗi pair Auth/REST đầy đủ của TC10.

Hard reload/tab close/process crash làm mất context/Key/PIN/token. Browser Auth session tự persist không có nghĩa lấy lại được secret. Cảnh báo + xác nhận trước create và ACK sau lưu Key theo UC-PIN-03. `beforeunload` là hỗ trợ, không bảo đảm trên mọi browser. Sau reload app không tự tạo lại, không dò/persist secret; nếu người dùng đã lưu Key thì pair lại khi cần. Phục hồi Key chưa lưu ngoài scope, thông báo đúng giới hạn. Không lưu `completedKey` vào localStorage để che giới hạn này.

Đính chính kỹ thuật 22/09 sau kiểm UI: không còn memory context thì app không biết lần tạo trước đã ACK hay chưa. Dùng navigation timing `type=reload` chỉ để nhận biết trang vừa tải lại; trên luồng trước đăng nhập nhân viên hiện thông báo có điều kiện “Nếu bạn vừa tạo quán…”, không khẳng định đã mất Key. Không thêm marker bền vững, không tự unpair hoặc cản đăng nhập quán đã ghép; nếu browser không cung cấp navigation timing thì vẫn giữ cảnh báo trước create. Kiểm thử không được đòi khôi phục một trạng thái ACK đã bị xóa khỏi bộ nhớ.

## Workflow seed ban đầu bền vững

Chọn ba stages, không dùng “thử lại toàn bộ seed”. Thêm private `initial_seed_workflows` unique storeId (workflowId UUID, requested boolean, templateVersion=1, status, workflowRevision, autoClaimedAt, runGeneration, lastErrorCode, timestamps) và `initial_seed_stages` unique `(workflowId,stage)` (stage employee/menu/floor, stageId UUID, status pending/committed, committedAt, receipt không secret). IDs stage và IDs thực thể từ `(storeId,templateVersion,stage/seedKey)` ổn định qua reload/device/retry. Bootstrap tạo cả workflow/stages; blank có status skipped, không stage mutation.

| Trạng thái / thao tác | Hợp đồng |
| --- | --- |
| Read `permission_get_initial_seed_status()` | Normal owner cùng tenant; read-only. Trả workflow status/revision, autoEligible, stage statuses/IDs/committedAt, lastErrorCode whitelist. Không seed, không reset cờ/PIN, không dữ liệu mẫu bí mật |
| Auto claim `permission_begin_initial_seed({mode:'initial',expectedWorkflowRevision})` | Chỉ pending + chưa autoClaimedAt. Dưới mutex store, set in_progress, autoClaimedAt, generation +1/revision +1; trả acquired/runGeneration. Hai devices chỉ một acquired. Không gọi tự động cho in_progress/needs_retry/completed/skipped |
| Explicit retry `permission_begin_initial_seed({mode:'retry',expectedWorkflowRevision})` | Chỉ normal owner, chỉ sau bấm “Thử lại dữ liệu mẫu”. Dưới mutex, compare revision; thay generation/revision và set in_progress cho workflow chưa xong. Cho retry in_progress không có ACK; old runner generation hết hiệu lực. Conflict trả `INITIAL_SEED_ATTEMPT_STALE` để chỉ đọc lại status, không tự retry |
| Apply `permission_run_initial_seed_stage({runGeneration,stage})` | Whitelist stage, generation safe integer. Lấy mutex workflow/store trước resource lock theo identity protocol; kiểm normal owner/cờ/session sau chờ. Chỉ stage pending kế tiếp; earlier stage phải committed. Committed stage chỉ trả receipt sẵn, **không gọi helper ghi**. Sai generation/thứ tự trả `INITIAL_SEED_ATTEMPT_STALE` |
| Stage commit | Các insert demo + audit/signal nếu cần + receipt committed + workflow revision/status cùng transaction. Stage cuối set completed. Dùng insert-only với deterministic IDs; collision ID/seedKey không có receipt của workflow trả `ENTITY_ID_CONFLICT`, không upsert dữ liệu đã tồn tại |
| Stage lỗi / ACK chưa rõ | Lỗi nghiệp vụ/audit trước commit rollback toàn bộ stage; outer exception block ghi needs_retry + sanitized lastErrorCode, không receipt committed. Lỗi kết nối không biết commit: client dừng; server có thể vẫn in_progress hoặc committed. Client chỉ GET status rồi chờ explicit retry; không coi network error là rollback |

Một invocation auto đã claim được phép đi tuần tự ba stages trong cùng lifecycle. Nếu lifecycle mất hoặc một bước lỗi thì không tự bắt đầu lại sau login/focus/reconnect. Retry kiểm receipt và chỉ chạy pending stages. Reclaim generation serialize sau stage đang chạy; stage đó hoặc commit trọn rồi được bỏ qua, hoặc rollback, không có hai lần commit cùng stage.

Tại mốc khảo sát22/09, các RPC seed_demo_employee/menu/floor được gọi độc lập; yêu cầu là phải được đóng grants/đổi thành helper private của stage runner; không giữ đường bypass để reapply sau receipt. Đối chiếu08/10: [permission-seed.sql:202](D:/Workspace/pos-cafe/supabase/candidate/permission-seed.sql:202) đã DROP ba public standalone RPC; việc có DDL không thay bằng chứng denial thật của TC16. Khi stage employee đã commit rồi owner đổi cashier PIN, retry menu/floor không chạy employee và không reset PIN về 111111. Menu/floor chỉnh sau commit cũng giữ nguyên. Recovery owner giữa stages dừng vì session revoke; lần normal login sau đó chỉ hiển thị retry, không tự chạy seed. Không thêm chức năng reset/reseed toàn quán.

## Activation đích rỗng

Thêm chế độ logic `empty-target` được opt-in bằng `expectedEmptyStoreSet:true` với `storeIds:[]`, `mappingFiles:[]`; giữ tên execution mode hiện có của từng công cụ. Flag thiếu/false vẫn theo đường mapping cũ, không chấp nhận arrays rỗng. Preflight xác minh target binding/source/backup/cleanup evidence và zero rows ở stores, employees, settings, menu/options/floor, orders/items/payments/write ledgers, audit/signals, bootstrap/seed receipts và mọi bảng tenant khác từ schema inventory đã review. Catalog/global config không phải tenant data và phải được giữ.

Dry-run rỗng chưa đủ. Activation lấy khóa loại trừ ghi trên toàn bộ bảng tenant được inventory (table lock theo thứ tự cố định; không chỉ advisory mà writer legacy có thể bỏ qua), khóa các registry cần thiết và recheck **trong cùng transaction** trước DDL/activation. Writer đến trước khiến recheck thấy row và dừng; writer đến sau phải chờ/không vượt qua schema contract mới. Schema inventory drift hoặc business row không còn parent store vẫn chặn. Hoàn tất DDL/guards/contract postflight rồi commit trước khi mở lại tạo quán. Không tạo mapping/owner giả, không DROP schema để làm sạch.

Cleanup là runbook riêng của root theo DELIVERY-03: 77 quán TEST và dữ liệu liên quan đã duyệt; backup verified, allowlist + drift check. Giữ project/schema/config và 66 Auth/1 Storage không liên quan đã kiểm kê; con số là snapshot, không cớ xóa đối tượng mới. Spec này không thực hiện cleanup. Không backfill môi trường còn quán chưa được phân loại.

<a id="ma-loi-va-thong-bao"></a>
## Mã lỗi và thông báo

Bổ sung vào `AppErrorCode`: `PIN_CHANGE_REQUIRED`, `PIN_REUSE_NOT_ALLOWED`, `PIN_CONFIRMATION_MISMATCH` (UI-only), `INITIAL_SEED_ATTEMPT_STALE`. Mã còn lại dùng AppError/permission/write contract hiện có; khi implementation phát hiện thiếu union phải thêm đồng bộ, không thay bằng UNKNOWN. Các mã tool activation ở cuối không là AppError.

| Mã / context | Câu chữ UI chính xác |
| --- | --- |
| INVALID_PIN / login | PIN không đúng. Vui lòng thử lại. |
| AUTH_REQUIRED / phiên quán | Phiên cửa hàng không còn hợp lệ. Vui lòng ghép quán lại. |
| AUTH_REQUIRED / tạo quán | Chưa xác nhận được tài khoản cửa hàng. Giữ trang này và thử lại. |
| AUTH_REQUIRED / định dạng Store Key | Store Key không đúng định dạng. |
| WRITE_PROTOCOL_UNSUPPORTED | Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục. |
| PIN_CHANGE_REQUIRED | Bạn cần đổi PIN tạm trước khi sử dụng quán. |
| PIN_REUSE_NOT_ALLOWED | PIN mới phải khác PIN tạm đang dùng. |
| PIN_CONFIRMATION_MISMATCH | Hai lần nhập PIN mới chưa khớp. |
| INVALID_EMPLOYEE_REQUEST / PIN | PIN mới phải gồm 6 chữ số. |
| INVALID_EMPLOYEE_REQUEST / payload khác | Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại. |
| EMPLOYEE_SESSION_REQUIRED | Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại. |
| EMPLOYEE_VERSION_CONFLICT | PIN hoặc trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại. |
| ADMIN_REQUEST_REUSED | Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng tạo yêu cầu mới. |
| PERMISSION_UPDATE_UNAVAILABLE / đổi PIN | Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm. |
| PERMISSION_UPDATE_UNAVAILABLE / recovery | Chưa xác nhận được việc khôi phục PIN. Kiểm tra hồ sơ trước khi thử lại cùng yêu cầu. |
| PERMISSION_UPDATE_UNAVAILABLE / proof check | Chưa kiểm tra được phiên. Vui lòng thử lại khi có kết nối. |
| PERMISSION_UPDATE_UNAVAILABLE / tạo quán | Chưa xác nhận được việc tạo quán. Giữ trang này và thử lại để tiếp tục cùng yêu cầu. |
| PERMISSION_UPDATE_UNAVAILABLE / seed | Chưa hoàn tất dữ liệu mẫu. Bạn vẫn có thể vào quán hoặc chọn thử lại. |
| OWNER_RECOVERY_REVIEW_REQUIRED | Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ. |
| OWNER_PROTECTED | Tài khoản cần khôi phục phải là chủ quán đang hoạt động. |
| NOT_FOUND | Không tìm thấy tài khoản cần khôi phục. |
| FORBIDDEN | Bạn không có quyền thực hiện thao tác này. |
| INVALID_WRITE_REQUEST / onboarding | Tên quán phải có 1–120 ký tự, địa chỉ tối đa 500 ký tự và lựa chọn dữ liệu mẫu phải hợp lệ. |
| BOOTSTRAP_CONFLICT | Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán. |
| ENTITY_ID_CONFLICT / seed | Dữ liệu hiện có trùng với dữ liệu mẫu. Đã dừng để giữ các thay đổi của quán. |
| INITIAL_SEED_ATTEMPT_STALE | Tiến trình dữ liệu mẫu đã thay đổi. Kiểm tra trạng thái trước khi thử lại. |
| Giới hạn hard reload, thông báo không giả server recovery | Trang đã tải lại. Nếu bạn vừa tạo quán, hãy dùng Store Key đã lưu để ghép quán khi cần. Hệ thống không thể hiển thị lại Store Key chưa được lưu. |
| RELEASE_TARGET_NOT_EMPTY / tool mới | Đích phát hành còn dữ liệu quán. Đã dừng kích hoạt. |
| TARGET_STORE_SET_MISMATCH / tool hiện có | Dữ liệu đích đã thay đổi. Đã dừng kích hoạt. |
| TARGET_TENANT_SCHEMA_MISMATCH / release preflight mới | Lược đồ dữ liệu quán đã thay đổi. Đã dừng để rà soát. |
| ACTIVATION_TARGET_NOT_EMPTY / activation mới | Đích phát hành còn dữ liệu quán. Đã dừng kích hoạt. |
| ACTIVATION_STORE_SET_MISMATCH / activation hiện có | Dữ liệu đích đã thay đổi. Đã dừng kích hoạt. |
| ACTIVATION_TENANT_SCHEMA_MISMATCH / activation mới | Lược đồ dữ liệu quán đã thay đổi. Đã dừng để rà soát. |
| INVALID_TARGET_CONFIG / tool hiện có | Cấu hình đích phát hành không hợp lệ. |

Release preflight dùng namespace `TARGET_*`/`RELEASE_TARGET_NOT_EMPTY`; activation dùng `ACTIVATION_*`. Store ID set khác đích mong đợi trả store-set mismatch; employees/orphan/tenant rows còn lại trả target-not-empty; inventory schema drift trả tenant-schema mismatch. Đây đều là mã công cụ, không AppError của ứng dụng.

## Trade-offs và giới hạn

Purpose session tái dùng tenant/token/revoke/lock nhưng buộc audit toàn bề mặt guard. TTL 5 phút giới hạn thời gian credential hạn chế; hết hạn login lại, không khóa tài khoản. Proof-only route giải quyết focus/reconnect mà không lộ authority. Forced completion không phục hồi receipt cho caller revoked tránh thêm đường xác thực yếu; mất ACK dùng PIN mới xác minh trạng thái hiện tại. Stage receipts phức tạp hơn loop seed ở mốc khảo sát22/09 nhưng giữ được chỉnh sửa sau partial success. Memory context giải quyết retry trong lifecycle, không giải quyết mất bí mật sau crash. Chống brute-force/email recovery không được tuyên bố đã giải quyết. Ghi chú tại mốc thiết kế22/09: tất cả thiết kế trên cần implementation và kiểm thực tế. Đối chiếu08/10: đã có code và executable liên quan; coverage/evidence19TC còn một phần theo matrix, chưa đạt full gate hiện hành.

### Tham chiếu BACKUP-AB-14, 14/10/2026

Phần activation đích rỗng/PIN-06/PIN-T07 tiếp tục tham chiếu [backup v2 B/I/C/L](../../../docs/runbooks/permission-backup-v2-2026-10-14.md), PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2. Đây là cập nhật dependency vận hành theo quyết định owner; không đổi forced-PIN,19TC hoặc empty-target behavior. Old77 và74/75FAIL là lịch sử; phạm vi mới EXACT79 có private provenance. Knonempty chặn cleanup, ngoài66Auth/object3 giữ; chưa C/Storage/provider receipt thì release vẫn BLOCKED.
