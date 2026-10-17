# Use cases — PIN owner tạm

Usecases chốt22/09, giữ nguyên input/output/luồng/expected. **Cập nhật08/10:** có executable liên quan nhưng19TC chưa đủ current acceptance; [matrix paths/gaps/evidence](../../../docs/implementation-log/permission-pin-gate-inventory-2026-10-08.md) phân biệt code/test đã có và phần chưa chứng minh. Mọi lỗi dưới đây có câu chữ chính xác tại bảng thông báo [design](design.md#ma-loi-va-thong-bao); đó là một phần của từng luồng ngoại lệ, không được hiện raw SQL/network error. Usecase không tự nhận đã nghiệm thu/phát hành.

## UC-PIN-01 — Owner đổi PIN tạm

**Tác nhân:** owner. **Mục tiêu:** đặt PIN riêng trước vận hành. **Tiền điều kiện:** quán đã ghép; owner active có cờ true; thiết bị có contract mới và kết nối online.

| Đầu vào | Kiểu / bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| employeeId | UUID / có | Owner của quán đang ghép, khác zero | `20000000-0000-4000-8000-000000000001` |
| temporaryPin | secret string / có khi login | Đúng 6 chữ số ASCII, xác minh với hash hiện tại | `123456` |
| requestId | UUID / có khi đổi | Khác zero, tạo một lần cho lần gửi | `40000000-0000-4000-8000-000000000001` |
| expectedRevision | integer / có | 0–9007199254740991, lấy từ restricted session | `0` |
| newPin | secret string / có | Đúng 6 chữ số ASCII, khác PIN hiện tại | `384729` |
| confirmPin | secret string / có ở UI | Bằng newPin, không gửi server | `384729` |

**Luồng chính:**

1. Owner chọn tên và nhập PIN tạm. Server trả restricted session, không authority.
2. UI hiện “Bạn cần đổi PIN tạm trước khi sử dụng quán.” và hai ô PIN.
3. Owner nhập PIN mới/xác nhận. UI kiểm định dạng/khớp rồi gửi request một lần.
4. Server kiểm token/cờ/revision sau khóa; commit hash/cờ/revision/revoke/audit/signal cùng transaction.
5. UI xóa token và input, hiện “Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.”
6. Owner nhập PIN mới; server cấp normal session, UI xác minh authority rồi mở ứng dụng.

**Luồng thay thế:** Đăng xuất hoặc đổi quán xóa bộ nhớ rồi gửi revoke khi online. Reload trước commit về login; đúng PIN tạm lại nhận restricted. Focus/reconnect chỉ chạy proof-only check, giữ UI chặn tới khi check thành công. Hết hạn phải login lại, không gia hạn tự động. Workflow seed chờ đi theo UC-PIN-03 sau bước 6.

**Luồng ngoại lệ:** `INVALID_PIN`, `AUTH_REQUIRED`, `WRITE_PROTOCOL_UNSUPPORTED` khi login; `INVALID_EMPLOYEE_REQUEST` cho payload sai; `PIN_CONFIRMATION_MISMATCH` chỉ UI; `PIN_REUSE_NOT_ALLOWED`; `EMPLOYEE_SESSION_REQUIRED` cho token hết hạn/revoke; `EMPLOYEE_VERSION_CONFLICT` cho revision sai của phiên còn hiệu lực; `ADMIN_REQUEST_REUSED` nếu ID của request đã có receipt được xác thực mà payload khác; `PERMISSION_UPDATE_UNAVAILABLE` theo context đổi PIN. Bypass route nghiệp vụ nhận `PIN_CHANGE_REQUIRED`. Các thông báo chính xác trong design. Mất ACK không chứng minh rollback: UI yêu cầu login PIN mới, nếu không được thử PIN tạm; normal/restricted response mới quyết định bước tiếp. Không gọi replay bằng token đã revoke.

| Đầu ra | Kiểu / ràng buộc | Tác động |
| --- | --- | --- |
| restricted login | `{kind:'required_pin_change', token, storeId, employeeId, name, employeeRevision, issuedAt, expiresAt}` | UUID cùng tenant, name 1–120 Unicode code points theo employee contract, revision safe integer; ISO timestamps; expiry = issuedAt + 300 giây; không role/quyền |
| complete success | `{outcome:'applied', credentialChanged:true, pinChangeRequired:false, employeeRevision}` | Revision trước +1; không token/secret; không hứa `replayed` cho phiên đã revoke |
| normal login | DTO authority PERM-20, `kind:'normal'`, `pinChangeRequired:false` | Chỉ login mới thành công cấp token 12 giờ |
| audit/signal | Một audit applied và một permission signal | Không PIN/hash/token; mọi token owner cũ bị thu hồi |

**Tiêu chí chấp nhận:** trước bước 6 không đọc/ghi nghiệp vụ; PIN tạm không còn đúng sau commit; audit lỗi rollback toàn bộ; UI không vượt gate bằng cache/reload/response cũ; secret không persist/log. **Truy vết:** PIN-01/02/03/04/07; TC-PIN-01–09/17/18.

## UC-PIN-02 — Operator khôi phục PIN owner

**Tác nhân:** operator hạ tầng được chỉ định, owner nhận PIN. **Mục tiêu:** cho owner thiết lập lại PIN riêng. **Tiền điều kiện:** hồ sơ hỗ trợ và kênh bàn giao được xác minh ngoài app theo PERM-22; role `pos_owner_recovery`; không giả employee owner.

| Đầu vào | Kiểu / bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| requestId/storeId/targetId | UUID / có | Khác zero; target owner active thuộc store được xác minh | R2 / S1 / O1 trong testplan |
| operatorRef/caseRef/proofRef | string / có | Mỗi trường trim còn 1–200 Unicode code points; mã bằng chứng ngoài DB, không secret | `op-test`, `case-test-001`, `proof-test-001` |
| newPin | secret string / có | Đúng 6 chữ số ASCII, là PIN tạm; được phép bằng PIN hiện tại | `927416` |

**Luồng chính:**

1. Operator xác minh hồ sơ/store/target/kênh nhận; cấp requestId mới cho một ca thực sự mới.
2. Operator mở công cụ recovery riêng trên `127.0.0.1`, nhập mã mở phiên do người vận hành đặt ngoài repo, điền payload và xác nhận đã kiểm hồ sơ/store/target/kênh nhận. Backend giữ kết nối PostgreSQL; trình duyệt không có DB credential. Chỉ backend đã `SET ROLE pos_owner_recovery` gửi payload bằng đường hạ tầng được phép.
3. Server khóa và áp transition recovery trong design: cờ true, revision +1, revoke toàn bộ, audit/signal, receipt nguyên tử.
4. Operator bàn giao PIN qua kênh đã xác minh; owner thực hiện UC-PIN-01.

**Luồng thay thế:** Cùng PIN vẫn áp transition. Retry cùng request/payload trả receipt lịch sử, không đổi lại cờ/PIN/revision dù owner đã đổi PIN sau đó. Trạng thái receipt không phải trạng thái owner hiện tại. Mất ACK giữ nguyên requestId/payload trong memory để operator thử lại có chủ ý; reload mất context và yêu cầu kiểm audit/hồ sơ trước khi tạo request mới.

**Luồng ngoại lệ:** `OWNER_RECOVERY_REVIEW_REQUIRED` cho thiếu hồ sơ/refs; `FORBIDDEN` cho mọi app role hoặc sai role hạ tầng; `INVALID_EMPLOYEE_REQUEST` cho PIN sai dạng; `NOT_FOUND` target không tồn tại; `OWNER_PROTECTED` target không là owner active; `ADMIN_REQUEST_REUSED` đổi payload; `PERMISSION_UPDATE_UNAVAILABLE` nếu transaction lỗi. Tất cả dùng nguyên văn design. Không bàn giao bí mật khi chưa xác minh kênh.

| Đầu ra | Kiểu / ràng buộc | Tác động |
| --- | --- | --- |
| outcome | `applied` hoặc `replayed` | Replay là receipt lịch sử, không command mới |
| credentialChanged | boolean | True chỉ khi hash PIN thực sự đổi |
| pinChangeRequired/employeeRevision | true / safe integer tại lúc áp | Receipt replay giữ giá trị lịch sử, không ghi đè state hiện tại |
| audit | actorType `operator`, refs, request, transition | Một bản ghi cho request mới, không có secret |

**Tiêu chí chấp nhận:** transition table đầy đủ; app không gọi được; công cụ chỉ bind loopback và đòi mã mở phiên + CSRF; browser không nhận DB credential; response/log/artifact/storage/URL không có PIN; lỗi theo đúng câu design; race recovery/complete có thứ tự hợp lệ; replay không reforce; audit lỗi rollback PIN/cờ/session. Operator vẫn xác minh hồ sơ và bàn giao PIN ngoài công cụ. **Truy vết:** PIN-01/04/06/07; TC-PIN-05/07/08/09/18.

## UC-PIN-03 — Tạo quán, lưu Key và seed sau đổi PIN

**Tác nhân:** người tạo quán, sau đó owner. **Mục tiêu:** giữ thông tin truy cập và tiếp tục dữ liệu mẫu an toàn. **Tiền điều kiện:** contract 2/write protocol 1, Auth theo Store Key hiện có; không có pending create khác trong lifecycle.

| Đầu vào | Kiểu / bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| displayName | Unicode string / có | Trim, 1–120 code points; không tự thay rỗng thành tên mặc định | `Cà phê Mây` |
| address | Unicode string / không | Bỏ trống chuẩn hóa `''`; trim, 0–500 code points | `12 Nguyễn Huệ` |
| seedDemo | boolean / có trong DTO | Mặc định UI false; không nhận string/null | `true` |
| keyLossAcknowledged | boolean / UI, có | Phải true sau đọc cảnh báo hard reload; không gửi bootstrap | `true` |
| createAttemptId / ownerId / bootstrap requestId | UUID / hệ thống sinh | Khác zero, giữ ổn định trong context; owner/bootstrap IDs theo Auth storeId | A1 / O1 / R1 |
| storeNo | integer / reservation sinh | 1–2147483647; stable cho createAttemptId | `101` |
| Store Key | secret string / hệ thống sinh | `<storeNo>-<secret>`; phần số 1–10 chữ số ASCII, giá trị 1–2147483647; formatter pad tối thiểu 4 chữ số, parser nhận leading zero trong giới hạn 10 chữ số; secret 4–64 ký tự ASCII chữ/số, normalize uppercase như hiện tại. Parser phải được mở từ giới hạn cũ 8 chữ số; không do người dùng nhập khi tạo | Chỉ dùng fixture secret ở runtime, không ghi report |

**Luồng chính:**

1. UI hiện “Store Key chỉ hiển thị trong lần tạo quán này. Nếu tải lại hoặc đóng trang trước khi lưu mã, bạn có thể mất quyền truy cập quán.” Người dùng chọn “Tôi hiểu và sẽ lưu Store Key trước khi rời trang.”
2. App tạo context ở provider sống ngoài màn/gate, đóng băng input/IDs/secret rồi reserve số quán, tạo Auth, bootstrap store/settings/owner cờ true/workflow seed cùng transaction.
3. UI hiện storeNo/Store Key và “PIN tạm thời: 123456. Bạn phải đổi PIN trước khi sử dụng quán.”
4. Người dùng lưu mã và chọn “Tôi đã lưu Store Key.” App xóa Key/context bí mật rồi tới login PIN tạm, UC-PIN-01.
5. Sau normal owner login, app đọc workflow. Nếu `pending` chưa từng claim và seedDemo=true, server claim auto một lần và chạy employee → menu → floor.
6. Mỗi stage commit kèm receipt; hoàn tất hiện “Đã thêm dữ liệu mẫu.” Owner vào quán.

**Luồng thay thế:** Blank (`seedDemo=false`) có workflow `skipped`, không gọi seed. Trong cùng lifecycle, mất ACK reserve/signup/bootstrap dùng cùng context theo design; không phát sinh số/Auth/store/owner mới. Compatibility gate giữ completed Key chưa ACK và che dữ liệu protected. Seed `in_progress` cũ/`needs_retry` chỉ hiển thị trạng thái; owner chọn “Thử lại dữ liệu mẫu” để claim lần mới, bỏ qua stages đã commit. Owner được vào quán và chỉnh dữ liệu đã có dù seed chưa xong.

**Luồng ngoại lệ:** `INVALID_WRITE_REQUEST` cho name/address/seedDemo/IDs sai; `AUTH_REQUIRED` theo context tạo quán; `WRITE_PROTOCOL_UNSUPPORTED` trước và sau gate; `BOOTSTRAP_CONFLICT` cho canonical payload thay hoặc entity xung đột; `PERMISSION_UPDATE_UNAVAILABLE` theo context tạo quán/seed. Seed từ restricted nhận `PIN_CHANGE_REQUIRED`, từ non-owner normal nhận `FORBIDDEN`; target ID/seed key bị chiếm nhận `ENTITY_ID_CONFLICT`; run generation bị thay nhận `INITIAL_SEED_ATTEMPT_STALE`. Không bootstrap lại vì seed lỗi. Hard reload làm mất context/Key thật sự; không tuyên bố có recovery server. Nếu đã lưu Key thì pair/login lại; nếu chưa lưu thì dừng tự tạo lại và hiện cảnh báo giới hạn.

| Đầu ra | Kiểu / ràng buộc | Tác động |
| --- | --- | --- |
| bootstrap result | `{outcome:'applied'|'replayed', storeId:UUID, ownerId:UUID, storeNo:int, seedRequested:boolean, seedWorkflowId:UUID}` | storeId = Auth user ID; ownerId/number phải khớp context; một store/settings/owner/workflow |
| completed create | bootstrap IDs + `storeKey:string`, `temporaryPin:'123456'` trong memory | Key chỉ hiển thị đến ACK, không nằm trong bootstrap receipt/log |
| workflow status | `skipped|pending|in_progress|needs_retry|completed`, workflowRevision safe integer, autoEligible boolean | Projection read-only, không tự seed; không PIN/Key |
| stage receipts | Ba stages `employee/menu/floor`, status `pending|committed`, stable stageId, nullable committedAt | Chỉ thông tin tiến độ, không overwrite stage committed |
| seed completion | status `completed`, receipts cả ba committed | Không reset owner/cashier đã đổi sau stage employee |

**Tiêu chí chấp nhận:** input/DTO cụ thể; no normal session/seed trước đổi PIN; same-context ACK recovery không duplicate; Key sống qua unmount nhưng giới hạn reload được nói thật; committed stages không chạy lại kể cả hai thiết bị; seed lỗi không chặn vận hành. **Truy vết:** PIN-02/03/05/07; TC-PIN-02/10–16/18.

## UC-PIN-04 — Operator activation trên đích rỗng

**Tác nhân:** operator phát hành. **Mục tiêu:** bật contract mới không suy backfill quán cũ. **Tiền điều kiện:** backup xác minh, scoped cleanup đã được review/thực hiện theo DELIVERY-03, source/client/DB release gates đạt; chưa có tuyên bố cleanup đã xảy ra trong spec này.

| Đầu vào | Kiểu / bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| expectedEmptyStoreSet | boolean / có | True opt-in chế độ logic empty-target; giữ execution mode của công cụ | `true` |
| binding / sourceFingerprint / backupEvidence | object, SHA-256 string, evidence refs / có | Khớp target đã duyệt, schema/migration/source thực tế; không secrets | Target test cách ly trong TC-PIN-19 |
| storeIds / mappings | UUID[] / mapping[] / có | Cả hai rỗng, chỉ mode empty-target | `[]` |

**Luồng chính:** (1) Dry-run xác nhận rỗng. (2) Loại trừ ghi và lấy khóa theo design. (3) Recheck tất cả business tables dưới khóa. (4) Activation nguyên tử, postflight contract/schema; release khóa. (5) Bootstrap postflight trong scope đã duyệt phải nhận restricted owner.

**Luồng thay thế:** Không có migration owner cũ, không tạo mapping giả. Recovery/rollback theo runbook phát hành chung, không tự xóa dữ liệu mới để ép rỗng.

**Luồng ngoại lệ:** Preflight `RELEASE_TARGET_NOT_EMPTY` và activation `ACTIVATION_TARGET_NOT_EMPTY` → “Đích phát hành còn dữ liệu quán. Đã dừng kích hoạt.”; `TARGET_STORE_SET_MISMATCH`/`ACTIVATION_STORE_SET_MISMATCH` → “Dữ liệu đích đã thay đổi. Đã dừng kích hoạt.”; `TARGET_TENANT_SCHEMA_MISMATCH`/`ACTIVATION_TENANT_SCHEMA_MISMATCH` → “Lược đồ dữ liệu quán đã thay đổi. Đã dừng để rà soát.”; `INVALID_TARGET_CONFIG` → “Cấu hình đích phát hành không hợp lệ.” Các mã công cụ không gửi qua AppError UI; declared trong design. Bất kỳ drift/fault nào rollback activation, giữ dữ liệu ngoài allowlist.

| Đầu ra | Kiểu / ràng buộc | Tác động |
| --- | --- | --- |
| evidence | manifest/report không secret | Bound target/source, counts trước/dưới khóa/sau, exit code, postflight |
| activation | atomic success hoặc rollback | Không giả owner/mapping, không xóa project/schema/config/unrelated Auth/Storage |

**Tiêu chí chấp nhận:** zero recheck gồm employees/business rows dù không còn stores; writer cạnh tranh không lọt cửa kiểm; unrelated identities/assets được giữ; code/runtime chưa chạy phải ghi NOT RUN. **Truy vết:** PIN-06/07; TC-PIN-19.
