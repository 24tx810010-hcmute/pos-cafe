# Thiết kế — giao thức ghi và khôi phục online

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](proposal.md#thuat-ngu).

Ngày 2026-09-09. **Thiết kế để duyệt triển khai, chưa có trong main.** Yêu cầu sản phẩm đã đóng trong proposal; các thông số và cấu trúc dưới đây là lựa chọn kỹ thuật của analyst, không gán thành phát biểu của chủ dự án.

## 1. Hiện trạng và thay đổi có chủ đích

Mốc code: main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c. Đường dẫn code trong tài liệu tính từ gốc worktree main.

| Hiện trạng đã đọc | Bằng chứng | Thay đổi dự kiến |
| --- | --- | --- |
| Snapshot → draft tạo ID mới, draft tính giá từ menu; dirty signature bỏ ID/giá | src/features/pos/orderFlow.ts:66–107, 241–272 | Retained source ID/snapshot, new portion riêng; signature gắn ID |
| Add gộp theo món/options; picker chỉ chọn khi thêm | src/features/pos/orderFlow.ts:200–228; src/features/pos/useOrderModifierPicker.ts:9–30; src/app/drawers/pos/OrderDrawer.tsx:290–313 | Không gộp retained với new; không thêm sửa modifier cũ |
| Submit remove dòng cũ, chèn lại và lấy giá catalog | supabase/migrations/012_action_permission_guardrails.sql:655–679, 798–918 | Giữ nguồn cũ, validate tất cả trước ghi, chỉ chèn phần mới |
| Split đổi số nguồn, move/copy item rồi payment | cùng migration:238–401 | Giữ nghiệp vụ này trong transaction gắn K/result |
| Void dùng so sánh version có thể NULL | supabase/migrations/011_void_paid_order.sql:144–173 | Kiểm schema và version NOT NULL; OCC không bị ba-valued logic bỏ qua |
| PIN RPC trả employee, không credential riêng; admin/profile ghi trực tiếp | src/adapters/supabase/employeeRepo.ts:30–38; authRepo.ts:33–118 | Phiên nhân viên server + khóa nguồn quyền và bootstrap |
| Renderer/history tính option thiếu quantity, receipt RPC có đơn giá base | src/app/components/ReceiptPreview.tsx:12–24, 203–205; migration 012:409,1136 | Schema receipt thống nhất, kiểm DOM từng dòng |
| Báo cáo lọc business_date | src/adapters/supabase/reportRepo.ts:13–28 | Giữ chính sách ngày hiện tại, ghi paidAt riêng |

Đọc cùng các đoạn mã nguyên văn và đính chính trong tài liệu review 12/13; bản proposal trước khi viết bộ này được giữ nguyên tại evidence/2026-09-09-proposal-truoc-bo-spec.md. Đây không phải tuyên bố đã tái hiện lỗi trên cửa hàng thật.

## 2. Ranh giới kiến trúc và danh tính

### 2.1 Ports & Adapters

- domain: kiểu WritePayloadV1, OperationView, RetainedLine/NewLine, ReceiptSnapshot, actor audit; không Supabase hoặc React.
- core: validate DTO, tính preview từ snapshot, dirty detection theo nguồn; không tự quyết giá chính thức/quyền cuối.
- ports: thêm IWriteOperationRepo với register/execute/get/list/cancel/capabilities; IEmployeeRepo trả employee session và revoke. Không đưa header HTTP vào ports.
- features: điều phối xác nhận → register → execute; bộ nhớ lượt đang gửi; màn phục hồi và refetch hiện trạng; không gọi concrete adapter.
- Supabase adapter: camelCase↔snake_case, gửi header phiên, RPC/mapping lỗi; server quyết định giá/quyền/commit.
- Mock adapter: cùng contract và state machine, clock/fault seam cho unit test; chỉ trong bộ nhớ. Không tuyên bố mock sống qua reload hoặc hai browser context.
- App/runtime: composition tại runtimePorts; mode Supabase yêu cầu đủ config, không fallback mock cho luồng nghiệm thu.

### 2.2 Phiên nhân viên tối thiểu

Giữ Store Key + chọn nhân viên/PIN. Không tạo tài khoản email riêng cho nhân viên trong change này.

| RPC/field | Contract |
| --- | --- |
| start_employee_session(p_employee_id uuid, p_pin text) | Phiên store bắt buộc; khóa employee FOR SHARE trước đọc/so PIN và giữ đến sau INSERT session/commit; PIN đúng 6 chữ số; employee cùng store và active; trả employee an toàn + token + expiresAt |
| token | 32 byte ngẫu nhiên mật mã, base64url không padding (43 ký tự); chỉ trả tại cấp phiên; DB giữ SHA-256 token, không plaintext |
| private.employee_sessions | token_hash PK, store_id, employee_id, issued_at, expires_at=issued_at+12 h, revoked_at nullable; không SELECT/DML/RPC trực tiếp cho anon/authenticated |
| Header | x-pos-employee-token; adapter gắn vào request từ token trong bộ nhớ. Store lấy auth.uid(), employee lấy token; không lấy từ body |
| revoke_employee_session() | Idempotent đối với token hiện hành; đánh revoked_at một lần, không hủy Store session |
| Kiểm hiện hành | Token đúng store, chưa hết hạn/thu hồi; employee active. Đọc role/overrides hiện tại; (defaults ∪ grants) − denies |
| Đổi quyền | Không cần cấp lại token: execute đọc quyền mới. Reset PIN hoặc inactive thu hồi toàn bộ phiên nhân viên đó |
| Khóa/reload | Xóa token bộ nhớ ngay; online lock gửi revoke. Nếu ACK revoke mất, không khẳng định server đã thu hồi; token vẫn có hạn 12 h. Reload chỉ quay về PIN |
| Bảo mật dữ liệu | Không token/PIN/hash trong ledger, payload/result, telemetry hoặc lỗi; SELECT employees chỉ các cột an toàn được grant cụ thể |

Chọn 12 h cho phiên vì dùng theo ca và có thể đăng nhập lại để phục hồi; đây không phải thời hạn của đơn hay K. Hạn cố định, không gia hạn ngầm. Thay vì JWT nhân viên ký bằng khóa mới hoặc tài khoản Auth riêng, opaque token cho phép thu hồi trực tiếp và ít hạ tầng hơn; đổi lại có lookup DB cho request. Bảo vệ brute-force PIN và provisioning chủ quán hoàn chỉnh thuộc change auth tương ứng; không mô tả PIN demo là xác thực cấp ngân hàng.

### 2.3 Ma trận quyền giao thức

Tất cả endpoint yêu cầu store session + employee session hợp lệ. requiredPermission được suy ra từ kind/action bất biến, không do client chọn.

| Loại lệnh | register | execute | get/list | cancel |
| --- | --- | --- | --- | --- |
| submit/create | order.create | order.create | order.create | order.create |
| submit/update | order.update | order.update | order.update | order.update |
| submit/void_open | order.voidOpen | order.voidOpen | order.voidOpen | order.voidOpen |
| pay_order | payment.take | payment.take | payment.take | payment.take |
| pay_order_items | payment.take | payment.take | payment.take | payment.take |
| void_order | order.voidPaid | order.voidPaid | order.voidPaid | order.voidPaid |

Admin có 5 quyền mặc định, cashier 4 quyền trừ voidPaid, kitchen 0; deny thắng grant như src/core/guards.ts:69–89. Không thêm manager-only cho phục hồi/hủy lệnh. List lọc bỏ lệnh caller không có quyền; get K cùng store nhưng thiếu quyền trả FORBIDDEN. K không có hoặc của store khác trả OPERATION_NOT_FOUND. Caller đủ quyền biết K vẫn phải dùng payload đúng khi execute; takeover không thay initiator.

### 2.4 Đóng đường bypass và giữ onboarding/admin hoạt động

| Bề mặt | Policy/grant dự kiến |
| --- | --- |
| orders/items/options/payments, write_operations, order_events | Thu hồi INSERT/UPDATE/DELETE cho client; ledger/audit chỉ đọc qua RPC; SECURITY DEFINER helper không callable bởi client |
| tables | Giữ SELECT theo store. INSERT cho id UUID mới, store_id=auth.uid(), các cột layout/name/area/asset; status lấy default empty phía DB. UPDATE chỉ layout/name/area/asset, không id/store_id/status. Cả hai yêu cầu phiên admin cùng store và parent area cùng store. Status chỉ business helper; cấm hard delete |
| employees | SELECT whitelist không passcode_hash. INSERT/UPDATE cấu hình qua policy verified admin cùng store; không cho thay store_id/id; reset PIN kiểm admin, hash phía server. Không cho anon/store JWT trần tự cấp quyền |
| stores/store_settings | Không client hard-delete hoặc đổi store identity; cập nhật settings cần verified admin; không cascade xóa ledger/order |
| Catalog/groups/options/joins/floor config | Mutation cần verified admin + store RLS; không cho thao tác cross-store parent/reference |
| RPC cũ | REVOKE EXECUTE mọi overload submit_order_changes/pay_order/pay_order_items/void_order và helper ghi; không chỉ chữ ký mới nhất. UI cũ bị chặn, không route qua đường không K |
| verify_employee_pin/hash_employee_pin cũ | Không còn đường lấy hash hoặc ghi/thay PIN bỏ qua admin. Luồng employee/seed dùng endpoint hash/ghi đã xác thực; endpoint PIN mới không trả hash |
| bootstrap_store | Chỉ store JWT vừa tạo có auth.uid() chưa có stores; lấy storeId từ JWT. Transaction tạo stores/settings/admin đầu tiên. Nếu store đã tồn tại trả ENTITY_ID_CONFLICT, không reset PIN/role hay chèn admin lần 2 |
| bootstrap input | p_admin_id UUID; p_store_no integer>0 khớp định danh Store Auth hiện hành; p_display_name string 1..120, p_address string 0..500; trim như UI. PIN khởi tạo 123456 và giá trị trả UI giữ workflow demo hiện tại; hash tạo trong DB |
| Seed/create | authRepo sau bootstrap đăng nhập PIN admin hiện hành, dùng token tạm trong bộ nhớ cho seed, rồi xóa/quay màn PIN. Retry seed cần phiên admin, không chèn admin qua upsert public |
| clear_demo_data | Bắt verified admin, giữ guard có đơn mở; không xóa/tombstone orders/payment/ledger/audit. Chỉ cấu hình demo, giữ admin. Endpoint cũ không được là đường sửa lịch sử tài chính |

Những việc trên là phần tối thiểu để bảo đảm danh tính/quyền của giao thức không bị tự sửa. Phân quyền nhân viên cho toàn bộ SELECT báo cáo/menu, tài khoản chủ thật và mô hình role mới vẫn thuộc change khác. Khi implement phải inventory grants/functions theo pg_catalog, không chỉ tìm tên RPC trong adapter.

## 3. Input v1 và canonical payload

Tên JSON ở wire giữ camelCase. Register/execute nhận p_operation_id UUID, p_payload JSONB; credentials ở header. Mỗi payload có schemaVersion:1 và kind. Unknown field bị INVALID_WRITE_REQUEST, không silently bỏ qua. Chấp nhận object field order khác; so bằng JSONB equality, không hash tiền/tên làm khóa. Số 1 và 1.0 cùng giá trị JSONB; số chuỗi "1" sai schema. Không trim/canonicalize payload sau register. Optional note absent và null đều hợp lệ, là hai payload khác nhau; lúc ghi note có thể ánh xạ cả hai thành null.

### 3.1 Quy tắc chung

| Kiểu/trường | Ràng buộc |
| --- | --- |
| UUID | Chuỗi UUID chuẩn; ID mới sinh client; không nil; cùng entity không dùng ID trùng/cross-store |
| Money | Số JSON nguyên, 0..2147483647 VND; SQL tính bằng bigint, mỗi unit/line/order/result kiểm không vượt 2147483647 trước cast/ghi; không float/âm/NaN/string |
| Version | Integer 0..2147483647 không NULL cho đơn đã có. Tăng version vượt ngưỡng: INVALID_WRITE_REQUEST, không overflow SQL hoặc wrap |
| Payload size | octet_length(payload::text) ≤ 262144 byte sau JSONB parse; > ngưỡng INVALID_WRITE_REQUEST; giới hạn HTTP gateway thấp hơn nếu có phải báo là giới hạn môi trường, không false pass |
| Lines | Tối đa 200 active sau submit; mỗi mảng 0..200 theo loại; quantity mỗi line 1..999, retained cho 0..nguồn; tổng lượng không dùng để thay giới hạn số dòng |
| Options | Array 0..20; optionValueId duy nhất mỗi new line, quantity 1..99 mỗi đơn vị món; required group phải đủ, single ≤ 1 option/required single=1, multi cho phép nhiều option khác nhau, không có giới hạn riêng theo group trong mô hình hiện tại (src/domain/models.ts:70–75; vẫn chịu max 20 của payload) |
| note/reasonNote | Optional string 0..500 Unicode codepoints hoặc null; other reason bắt buộc trim không rỗng. Không normalize note trước so payload |
| expectedVersion create | Bắt buộc null; không chấp nhận absent/0 để ngầm đoán create |
| method | Chỉ literal cash; không bank_transfer/qr/other |

### 3.2 SubmitPayload

Common: schemaVersion=1, kind=submit_order_changes, action một trong create/update/void_open, orderId UUID.

| action | Field còn lại (tất cả bắt buộc trừ ghi ?) |
| --- | --- |
| create | expectedVersion:null; orderType:dine_in hoặc takeaway; tableId:UUID nếu dine_in/null nếu takeaway; newLines:NewLine[1..200] |
| update | expectedVersion:Version; retainedLines:RetainedLine[1..200]; newLines:NewLine[0..200]. Mọi active nguồn phải xuất hiện đúng 1 lần, kể cả quantity 0; kết quả phải còn ≥ 1 item |
| void_open | expectedVersion:Version; không nhận retainedLines/newLines/total/reason. Chỉ áp dụng đơn open với quyền voidOpen |

| NewLine field | Kiểu/ý nghĩa |
| --- | --- |
| id | UUID mới, giữ trong mọi retry |
| menuItemId | UUID cùng store, khả dụng ở execute |
| quantity | integer 1..999 |
| note? | string ≤ 500 hoặc null |
| quotedBasePrice | Money, chỉ quote để so; không được lấy làm giá ghi |
| options | NewOption[0..20] |
| NewOption.id | UUID mới cho snapshot option |
| NewOption.optionValueId | UUID thuộc group gắn với menuItemId ở execute |
| NewOption.quantity | integer 1..99, số option mỗi đơn vị món |
| NewOption.quotedPriceDelta | Money, so với giá option hiện hành |

RetainedLine chỉ có sourceItemId:UUID, quantity:integer 0..nguồn, note tùy chọn: string hoặc null. Không menuItemId/options/price/name/id thay thế. Execute lookup nguồn cùng store/order/active; source không còn do move/remove hoặc duplicate báo INVALID_ORDER_ITEMS. Omitted active ID cũng báo lỗi, không âm thầm xóa. Price/name/options giữ từ DB ngay cả catalog đã đổi, ngừng bán hoặc không còn group cũ. Có phần mới thì phần ấy phải thỏa catalog hiện tại.

Dấu cộng trên retained tạo NewLine với cấu hình option đã chọn của phần đó, quote hiện hành; nếu cấu hình không còn khả dụng thì báo OPTION_VALUE_UNAVAILABLE và yêu cầu chọn món mới. Không được tăng retained quantity quá nguồn. NewLine có thể gộp với NewLine chưa ghi nếu toàn bộ menu/options quantities/quotes/note giống và không mất provenance; không gộp vào retained, không gộp các source khác nhau dù cùng giá. Decrease tác động đúng ID được chọn; không chuyển lượng giữa các mức giá.

### 3.3 Payment/void payload

| kind | Fields ngoài schemaVersion/kind |
| --- | --- |
| pay_order | orderId:UUID, paymentId:UUID mới, expectedVersion:Version, method:cash, receivedAmount:Money |
| pay_order_items | orderId:UUID, newOrderId:UUID mới khác nguồn, paymentId:UUID mới, expectedVersion:Version, method:cash, receivedAmount:Money, lines:SplitLine[1..200] |
| SplitLine | orderItemId:UUID nguồn duy nhất, quantity:integer 1..nguồn, splitItemId:UUID mới. Nguyên dòng dùng source ID và không chèn splitItemId; vẫn reserve/check collision splitItemId trước execute. Partial tạo splitItemId, option snapshot IDs server sinh trong transaction đầu |
| void_order | orderId:UUID, expectedVersion:Version, reason:wrong_order/customer_request/out_of_stock/duplicate/other; reasonNote tùy chọn: string hoặc null |

Full selection trong split là lỗi INVALID_ORDER_ITEMS; UI quyết định pay trước register. Không tự route lại phía server. Phần thanh toán phải có tổng >0, giữ giới hạn flow/UI hiện hành (src/features/pos/orderFlow.ts:399; src/app/drawers/pos/PaymentDrawer.tsx:77,85): rỗng hoặc tổng 0 trả INVALID_ORDER_ITEMS (rejected tại execute); không bổ sung thanh toán toàn đơn 0 đ. Dòng/option 0 vẫn hợp lệ trong phần có tổng dương. Số tiền/lý do thiếu-sai kiểu thuộc INVALID_WRITE_REQUEST; reason other note thiếu/rỗng thuộc VOID_REASON_REQUIRED. Total không phải input ở bất kỳ loại nào.

## 4. Lược đồ và output

### 4.1 Ledger/audit

public.write_operations: PK(store_id, operation_id); kind/action/schema_version, required_permission, payload jsonb NOT NULL, registered_at timestamptz, expires_at=registered_at+24 h, initiated_by_employee_id, status enum pending/applied/rejected/cancelled/expired, result jsonb nullable, error jsonb nullable, executed_by_employee_id nullable, decided_at nullable, cancelled_by_employee_id nullable, replay_count bigint ≥ 0.

CHECK: pending không result/error/decidedAt; applied có result và executor/decidedAt, không error; rejected có error/decidedAt và executor null; cancelled có canceller/decidedAt; expired có decidedAt. Start-session và reset-PIN dùng cùng thứ tự employee → sessions: nếu start thắng, reset sau đó thu hồi cả token vừa cấp; nếu reset thắng, PIN cũ không cấp được token mới. Không durable executing: hàng bị lock khi thực thi, observer thấy pending cho đến commit. Payload/kind/initiator/registeredAt/expiresAt bất biến; terminal không mở lại. FK không ON DELETE CASCADE mất lịch sử.

Indexes: (store_id, registered_at DESC, operation_id DESC), (store_id, order_id, registered_at DESC, operation_id DESC), (store_id, status, expires_at); order_id là indexed projection của payload, không nguồn truth riêng. Unique số bill hiện hành vẫn giữ.

order_events append-only: id UUID, store_id, operation_id UNIQUE per store, action, source_order_id, result_order_id nullable, payment_id nullable, initiated_by, executed_by, occurred_at, before_version nullable, after_version, summary JSONB gồm IDs/giá trị kết quả. Không ghi một event cho mỗi replay hoặc mọi pending attempt; ledger giữ cancel/rejection. Split liên kết audit bất biến không tạo cascade chỉnh/hủy hai đơn.

orders thêm created_by_employee_id nullable, last_modified_by_employee_id nullable; không dùng employee_id hiện tại để suy diễn creator lịch sử. New create có creator; update chỉ lastModified; pay không ghi đè creator/last editor; payment.employee_id=executor. Legacy unknown hiển thị “Không xác định (dữ liệu cũ)”; không backfill tên người đoán. Split child creator=executor tạo child; source giữ creator; event giữ quan hệ nguồn.

### 4.2 Output có kiểu

| Kiểu | Field bắt buộc |
| --- | --- |
| OperationView | operationId:UUID, schemaVersion:1, kind, action:create/update/void_open hoặc null với kind khác submit, status, payload:WritePayloadV1, registeredAt/expiresAt:UTC ISO8601, initiatedByEmployeeId:UUID, decidedAt:timestamp hoặc null, executedByEmployeeId/cancelledByEmployeeId:UUID hoặc null, result:BusinessResult hoặc null, error:BusinessError hoặc null, replayCount:decimal string ≥ 0 |
| BusinessError | code trong bảng mục 7, message đúng câu tiếng Việt, details object hoặc null; PRICE_CHANGED details xem dưới |
| OrderSnapshot | id, storeId UUID; orderNo integer>0; businessDate YYYY-MM-DD; orderType dine_in/takeaway; tableId UUID/null; status open/paid/void; lockVersion:Version; subtotal, total:Money; createdAt, updatedAt timestamp; paidAt timestamp/null; createdByEmployeeId, lastModifiedByEmployeeId UUID/null; items:ItemSnapshot[] chỉ active, void_open trả []; void metadata như payload+actor/time hoặc null |
| ItemSnapshot | id, menuItemId UUID; name:string snapshot; quantity integer; baseUnitPrice:Money; note:string/null; options:OptionSnapshot[]; unitTotal:Money; lineTotal:Money; status=active trong OrderSnapshot. Raw DB có active/removed; tombstone giữ nguyên quantity/base/options cuối trước xóa, không ép quantity 0. Observer kiểm cả removed |
| OptionSnapshot | id, optionValueId UUID; name:string snapshot; priceDelta:Money; quantity integer per unit |
| PaymentSnapshot | id, orderId, employeeId UUID; method cash; amount, receivedAmount, changeAmount:Money; createdAt UTC timestamp |
| ReceiptSnapshot | schemaVersion 1; orderId, paymentId UUID; orderNo; businessDate; storeName/address/footer snapshot string; tableName snapshot string/null; paidAt; employeeName snapshot string; lines:ReceiptLine[]; total, receivedAmount, changeAmount |
| ReceiptLine | orderItemId, menuItemId UUID; name snapshot; quantity; baseUnitPrice; options (name, optionValueId, quantity, priceDelta); unitTotal; lineTotal; note:string/null |
| BusinessResult submit | {kind, action, order:OrderSnapshot} |
| BusinessResult pay | {kind, order:OrderSnapshot, payment:PaymentSnapshot, receipt:ReceiptSnapshot} |
| BusinessResult split | {kind, sourceOrder:OrderSnapshot, paidOrder:OrderSnapshot, payment:PaymentSnapshot, receipt:ReceiptSnapshot} |
| BusinessResult void | {kind, order:OrderSnapshot} |

Receipt lần đầu lưu cùng result, không dựng từ catalog sau đó. Payment mới lưu receipt_snapshot JSONB để history in lại khớp cả storeName/footer/actor name; legacy payment receipt_snapshot=null thì dựng bằng dữ liệu đơn đã lưu và metadata hiện có, có ghi giới hạn tên cửa hàng/nhân viên lịch sử chưa được snapshot. Không bịa metadata quá khứ.

unitTotal = baseUnitPrice + Σ(option.priceDelta × option.quantity); lineTotal = quantity × unitTotal; total = ΣlineTotal của các item active; removed không nằm trong order result/receipt. Receipt chỉ các item đã thuộc đơn paid ở thời điểm thanh toán. Renderer dùng unitTotal, không cộng options lần 2; hiển thị “Tên option × 2” khi quantity 2. Ví dụ 2 ly base 30 k + option 2 × 5 k: unit 40 k / line 80 k / nhận 100 k / thừa 20 k. Preview tạm tính dùng cùng cách tính tiền.

## 5. RPC và vòng đời

Tất cả RPC này là POST, VOLATILE; register/execute/get/cancel có kết quả wire {ok:true, operation:OperationView} hoặc {ok:false, error:BusinessError}. Terminal rejected vẫn ok:true/operation.status=rejected: transaction đã lưu kết quả nghiệp vụ bị từ chối. Auth/schema/mismatch/not found lỗi ở envelope ok:false, không làm đổi K đã có. Infrastructure có thể là HTTP/SQL transport error; adapter ánh xạ mục 7.

| RPC | Input | Hành vi |
| --- | --- | --- |
| get_write_capabilities() | không body | store+employee session; {writeProtocolVersion:1, maxPayloadBytes:262144, pendingTtlSeconds:86400}; không fallback |
| register_write_operation | p_operation_id, p_payload | Kiểm auth/schema/action; insert pending. Existing K: equality trước trả view; mismatch không đổi K; không validate business để đoán lại nội dung |
| execute_write_operation | p_operation_id, p_payload | Existing K phải đúng payload; không implicit register. Lấy khóa, xử lý terminal/expiry/business theo thứ tự bên dưới |
| get_write_operation | p_operation_id | Quyền hiện hành; lazy expire pending nếu đến hạn rồi trả view |
| list_write_operations | p_order_id UUID/null, p_kinds enum[]/null, p_statuses enum[]/null, p_registered_from/to timestamp/null, p_cursor string ≤ 512/null, p_limit integer 1..100(default 50) | Bộ lọc AND; newest first theo registeredAt, id. Cursor server base64 JSON cặp timestamp/UUID; bind filter/store, validate không coi như quyền. Quá hạn visible pending được chuyển trước lọc status để tìm expired chính xác. Trả {ok:true, page:{items:OperationView[], nextCursor:string/null, serverTime:timestamp}}; lỗi dùng {ok:false, error}. Không có lệnh trái quyền |
| cancel_write_operation | p_operation_id | Quyền hành động; pending còn hạn → cancelled; đã quá hạn → expired; terminal → giữ nguyên. Không so payload vì không tạo hiệu ứng của payload |

Mọi get/list/cancel giữ nguyên replayCount. List lazy expiry xử lý các pending visible quá hạn bằng cùng thứ tự store → K tăng dần UUID, rồi SELECT paginate; việc đọc là read intent của UI dù DB cập nhật trạng thái lệnh. Không business write hoặc cron. Không nhận storeId/callerId từ body.

### 5.1 Khóa và checkpoint

1. Xác thực sơ bộ, validate envelope. Acquire advisory transaction lock POS của store (giữ khóa store hiện hành để giảm thay đổi).
2. Lock K FOR UPDATE; đọc lại quyền hiện hành và equality. Với terminal: kiểm quyền caller, tăng count nếu execute, trả lịch sử ngay; **không kiểm lại version/giá/hạn K**.
3. Với pending execute: khóa các order/table nghiệp vụ theo UUID trong thứ tự cố định (order trước table), khóa cấp số store/businessDate nếu cần. Không cấp số trước checkpoint.
4. Submit có phần mới: acquire advisory catalog lock riêng của store; mọi INSERT/UPDATE/DELETE catalog/group/join lấy cùng catalog lock trong BEFORE STATEMENT trigger trước row lock. Không giữ catalog lock rồi đòi POS lock; clear demo lấy POS trước catalog.
5. Lock employee row FOR SHARE rồi session row FOR SHARE; PIN reset/inactive cũng khóa employee trước sessions. Đọc lại token/active/quyền **sau các khóa có thể chờ**. Các thay đổi quyền không cần POS lock, nên có thể commit trong lúc execute chờ order/table; nếu commit trước checkpoint thì bị chặn. Sau checkpoint, khóa employee/session giữ ổn định tới commit.
6. Hoàn tất mọi phép đọc/validation business và các khóa có thể chờ, giữ kết quả validation chưa tạo hiệu ứng. Sau đó lấy clock_timestamp() tại checkpoint ngay trước bắt đầu hiệu ứng: kiểm lại hạn phiên nhân viên bằng cùng thời điểm này (hết phiên trả EMPLOYEE_SESSION_REQUIRED, K giữ pending), rồi nếu >=expires_at của K thì chuyển expired; còn hạn thì trả rejection đã xác định hoặc bắt đầu áp dụng. Không đặt clock check trước vòng validation dài; nếu validation phát sinh thêm khóa thì checkpoint phải sau khóa ấy. Hàm con không được lấy khóa chưa nằm trong inventory này trước hiệu ứng đầu mà không recheck.
7. Commit business + event + applied/result cùng transaction. Timeout/SQL rollback không để applied giả. Nếu đã hợp lệ và bắt đầu hiệu ứng trước hạn, được commit sau hạn.

Register/cancel/get/list expiry dùng POS → K và kiểm auth hiện hành; cancel/expiry lấy clock sau mọi khóa cần thiết. Admin employee/config không được sửa financial tables. Trigger catalog không lấy POS lock để tránh vòng khóa. Không tuyên bố throughput: store serialization là đánh đổi chấp nhận cho đồ án một quán; tối ưu phải đo sau.

### 5.2 Terminal và lỗi

| Từ/trường hợp | K sau commit | Hiệu ứng |
| --- | --- | --- |
| register mới | pending | Chỉ ledger |
| execute hợp lệ | applied | Business+event+R1 cùng commit |
| Business không hợp lệ | rejected/error bền | Toàn bộ business rollback |
| Hạ tầng exception/deadlock/serialization | pending như trước | Rollback toàn bộ transaction execute |
| Cancel thắng, pending còn hạn | cancelled | Chỉ ledger canceller/time |
| Hết 24 h trước bắt đầu hiệu ứng | expired | Chỉ ledger |
| Execute vào terminal | terminal cũ + count 1 | Không business |
| Thiếu quyền hoặc khác payload | Không đổi K | Không business/counter |
| cancel/get/list terminal | terminal cũ | Không counter/business |

Known business failures bắt trong subtransaction có EXCEPTION, rollback effects rồi cập nhật rejected ở outer transaction và RETURN envelope. Không RAISE error sau khi lưu rejected, vì sẽ rollback cả ledger. Unexpected exception phải thoát, không biến thành rejected. Caller nhận unknown không tự đoán K pending: phải get/read fresh sau transaction kết thúc.

ReplayCount khởi tạo 0; chỉ execute hợp lệ nhìn thấy terminal đã tồn tại khi quyết định xử lý tăng 1; transition terminal đầu không tăng. Concurrent two execute: bên applied count 0, bên replay count 1; hai replay sau tăng 2. Counter ngoài result, bigint chuyển decimal string tránh JS precision; không thay timestamp/actor của nghiệp vụ.

### 5.3 Lệnh 24 h, giữ bền và hủy

24 h tính từ first registration server; retry register không gia hạn. Đơn không TTL. Applied trước hạn đọc 48 h vẫn R1. K expired/cancelled/rejected không tái dùng; muốn làm mới phải tải trạng thái và xác nhận mới. Không xóa bất kỳ terminal/payload/result trong bản đồ án; tăng dung lượng được ghi là hạn chế, không thêm pg_cron chưa biết bật.

Cancel không phải HTTP abort. Cancel not found không đặt tombstone chặn register tương lai: response muộn chỉ có thể tạo pending, vì UI lượt cũ không được tự execute; người dùng tra cứu/hủy sau hoặc đợi hết hạn. UI không ghi “đã hủy” khi chỉ đóng drawer. Không khóa một bàn vĩnh viễn do một K pending; OCC vẫn là cổng cho mọi thao tác mới có xác nhận riêng.

## 6. UI, draft, phục hồi và in

- Một ActiveAttempt trong bộ nhớ có K, payload bất biến, generation, startedAt, status. Tạo K tại xác nhận. Có thể giữ pointer tiện dụng nhưng **không phụ thuộc localStorage/sessionStorage** cho độ bền.
- Register ACK pending chỉ tiếp execute trong cùng lượt chủ động chưa timeout/chưa đóng drawer/chưa khóa phiên/chưa offline. Response đến muộn không kích hoạt mutation. Không auto-resume TanStack paused mutation; explicit online check trước nút và trong coordinator, retry:false cho ghi.
- Timeout 15 s kể từ mỗi request: hiển thị WRITE_RESULT_UNKNOWN. Polling mỗi 5 s: get/list/refetch được phép, không register/execute/cancel. Reconnect/focus chỉ read. Đóng drawer không cancel; báo có thể tra cứu lại.
- Lượt chưa rõ giữ payload cũ và chặn nút xác nhận mới của chính lượt ấy cho tới người dùng vào khôi phục; không ngăn toàn cửa hàng lập thao tác khác có chủ ý. Màn khôi phục chọn một K cụ thể, hiển thị đủ payload/actor/time/order/amount; tiền dự kiến của pending ghi rõ chưa ghi. Bấm tiếp tục chỉ dùng payload stored.
- Draft retained source identity; nguồn giá hiển thị khác nhau trên giỏ, chọn thanh toán, hóa đơn. Dấu cộng tạo phần mới; note/decrease giữ nguồn. Không có UI sửa modifier cũ. Thanh toán tổng 0 chưa thuộc phạm vi; UI/flow và DB cùng chặn INVALID_ORDER_ITEMS, nhưng có dòng 0 trong tổng dương vẫn xử lý bình thường. Snapshot refetch khi có draft dirty không được silently đè draft; báo conflict, cho xem lại/hủy draft trước K mới.
- PRICE_CHANGED có details:{lines:[{lineId, base:{quoted, current}, options:[{optionValueId, quoted, current}]}], proposedNewLinesTotal:Money}. Tính các giá/tổng đề xuất bằng bigint trước khi dựng details; nếu vượt Money thì rejected INVALID_WRITE_REQUEST, không trả PRICE_CHANGED với proposedNewLinesTotal ngoài miền. Giữ phần cũ, hiển thị quote mới và tổng dự kiến; không tự apply. Hết/menu inactive dùng unavailable, không đưa PRICE_CHANGED giả.
- R1 lịch sử và current order là hai vùng khác. Không patch current cache bằng R1. PaymentDrawer mở receipt chỉ initial success còn active+tùy chọn in; replay/recovery/late ACK không tự open preview, không window.print. Thao tác in lại explicit kiểm current paid; current void thì RECEIPT_UNAVAILABLE dù R1 còn.
- Bếp giữ seam hiện hành cho lần gửi chủ động. Không lưu/khôi phục đúng delta phiếu bếp; không in lặp theo K. Đánh dấu follow-up cho kitchen feature.

## 7. Error catalog

Mọi mã “mới” phải thêm AppErrorCode và mapping UI. Mã đã có tại src/core/appError.ts:1–18 được tái sử dụng trong phạm vi giao thức với câu chữ dưới đây; không bắt buộc đổi thông báo của module ngoài change.

| Mã | Trạng thái/nguồn | Thông báo chính xác |
| --- | --- | --- |
| AUTH_REQUIRED | đã có | Chưa ghép cửa hàng. Vui lòng đăng nhập lại. |
| EMPLOYEE_SESSION_REQUIRED | mới | Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN. |
| INVALID_PIN | đã có | PIN không đúng hoặc nhân viên không còn hoạt động. |
| FORBIDDEN | đã có | Bạn không có quyền thực hiện thao tác này. |
| INVALID_WRITE_REQUEST | mới | Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra. |
| IDEMPOTENCY_KEY_REUSED | mới | Mã thao tác đã gắn với nội dung khác. Hãy mở lại thao tác đã lưu. |
| OPERATION_NOT_FOUND | mới | Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy. |
| OPERATION_EXPIRED | mới | Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới. |
| OPERATION_CANCELLED | mới | Lệnh đã được hủy trước khi thực hiện. |
| ORDER_VERSION_CONFLICT | đã có | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |
| TABLE_OCCUPIED | mới | Bàn đã có đơn mở. Hãy mở đơn hiện tại của bàn. |
| NOT_FOUND | đã có | Không tìm thấy đơn trong cửa hàng này. |
| TABLE_NOT_FOUND | đã có | Bàn không còn khả dụng. Vui lòng chọn lại bàn. |
| ENTITY_ID_CONFLICT | mới | Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới. |
| MENU_ITEM_UNAVAILABLE | đã có | Món không còn khả dụng. Vui lòng chọn lại. |
| OPTION_VALUE_UNAVAILABLE | đã có | Tùy chọn không còn phù hợp với món. Vui lòng chọn lại. |
| INVALID_ORDER_ITEMS | đã có | Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn. |
| PAYMENT_AMOUNT_TOO_LOW | đã có | Tiền nhận chưa đủ để thanh toán phần đã chọn. |
| VOID_REASON_REQUIRED | đã có | Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác. |
| PRICE_CHANGED | mới | Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại. |
| WRITE_RESULT_UNKNOWN | mới, client | Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục. |
| WRITE_TEMPORARILY_UNAVAILABLE | mới, hạ tầng | Chưa thể hoàn tất yêu cầu. Hãy tra cứu và chỉ thử lại cùng thao tác. |
| WRITE_PROTOCOL_UNSUPPORTED | mới | Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng. |
| RECEIPT_UNAVAILABLE | mới | Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn. |

Phân loại cố định:
- Trước ledger: AUTH_REQUIRED, EMPLOYEE_SESSION_REQUIRED, FORBIDDEN, INVALID_WRITE_REQUEST, IDEMPOTENCY_KEY_REUSED, OPERATION_NOT_FOUND, WRITE_PROTOCOL_UNSUPPORTED → envelope error, không terminal hóa K.
- Tại execute: ORDER_VERSION_CONFLICT, TABLE_OCCUPIED, NOT_FOUND, TABLE_NOT_FOUND, ENTITY_ID_CONFLICT, MENU_ITEM_UNAVAILABLE, OPTION_VALUE_UNAVAILABLE, INVALID_ORDER_ITEMS, PAYMENT_AMOUNT_TOO_LOW, VOID_REASON_REQUIRED, PRICE_CHANGED và overflow phát hiện từ server → rejected bền. INVALID_WRITE_REQUEST do schema bắt trước register; cùng code do overflow business có thể rejected, caller phân biệt bằng OperationView.
- expired/cancelled là terminal statuses; adapter hiển thị OPERATION_EXPIRED/OPERATION_CANCELLED, không nói business failure hạ tầng.
- WRITE_RESULT_UNKNOWN là trạng thái client khi chưa biết commit; WRITE_TEMPORARILY_UNAVAILABLE là lỗi hạ tầng xác định hoặc SQL exception rollback. Cả hai chỉ retry chủ động cùng K sau tra cứu; không tự K mới.
- Thứ tự ưu tiên khi nhiều lỗi: xác thực → schema → lookup K/quyền K → equality → terminal replay → quyền/TTL tại checkpoint → order tồn tại/trạng thái/version → source/table/ID collisions → menu/options → kiểm miền số tiền bằng bigint (kể cả proposed quote) → quotes → thiếu tiền/reason → effect. Fixture testcase phải chỉ một lỗi nhằm đi đúng nhánh.

## 8. Migration, rollout và giới hạn

1. Chụp kiểm kê constraints/grants/functions+overloads, fixtures legacy; kiểm orphan/duplicate số bill/tiền âm/overflow trước migration. Dữ liệu bất hợp lệ làm migration dừng có báo cáo, không silently sửa tiền.
2. Add sessions/ledger/audit/receipt snapshots và helpers; preserve existing prices/IDs. Legacy creator unknown/null. Không đổi businessDate hoặc split numbering.
3. Bảo vệ nguồn quyền/bootstrap/admin/seed/catalog lock; test Store Key → PIN → seed → POS còn hoạt động.
4. Refactor bốn nghiệp vụ vào helper private; wrapper giao thức v1; revoke old overload+DML trong cùng migration activation. Không có cửa sổ chấp nhận lời gọi ghi cũ thiếu K.
5. App v1 có preflight capability. Deploy DB/app phối hợp trong cửa sổ dừng ghi ngắn, reload clients; app cũ bị từ chối chứ không rollback grants. Không chạy migration phá hoại dữ liệu trên remote trong lượt viết spec.
6. Rollback app sau DB activation chỉ được dừng ghi; không mở RPC cũ lại. Nếu cần rollback DB phải migration đã review bảo toàn ledger và effect, không DROP ledger.
7. Realtime vẫn signal-only; list polling là đường khôi phục, không thêm replay-on-reconnect. Không thu thập PIN/token. Log metadata K/kind/status/latency/error code không raw payload có ghi chú.

**Đánh đổi được ghi cho báo cáo:** hai RPC register/execute tăng latency và có pending không thực hiện, đổi lại máy khác tìm được lệnh trước apply; giữ payload/R1 tốn dung lượng, đổi lại không tái dùng khóa sau 24 h; store lock giảm song song, đổi lại thứ tự commit dễ kiểm; snapshot giá theo phần làm UI nhiều dòng, đổi lại giữ đúng cam kết 30 k/40 k; opaque employee session+RLS là công việc bắt buộc đi kèm, không thể xem Store JWT+employeeId là danh tính thật. Không bổ sung offline/payment gateway/kitchen engine/thu chi tiền vật lý.

## 9. Cơ sở kỹ thuật và cổng kiểm chứng

PostgREST chạy mỗi request trong transaction; POST VOLATILE cho phép ghi và headers nằm trong request settings. Vì vậy lazy expiry dùng POST và rejection bền phải RETURN thay vì RAISE ra ngoài. Tham khảo [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html).

PL/pgSQL EXCEPTION tạo vùng rollback cho thay đổi bên trong; dùng nó để rollback business mà giữ rejected ngoài vùng. Tham khảo [PostgreSQL control structures](https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING). Khiimplement kiểm search_path cố định, schema-qualified objects, owner/grants cho SECURITYDEFINER và RLS theo [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Các ý trên là cơ sở thiết kế, không phải bằng chứng migration đã chạy. Testplan quy định expected, backend/preflight/fault/clock/observer và manifest thực thi. Chỉ có log trên code triển khai mới được dùng để kết luận tính năng đạt.
