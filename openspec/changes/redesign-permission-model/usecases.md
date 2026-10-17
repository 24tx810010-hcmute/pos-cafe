# Use case — redesign-permission-model

Ngày 2026-09-15. **Dự kiến, chưa triển khai.** Mọi luồng dùng phiên active/cùng store, quyền hiện hành và error contract [design](design.md). Các mã lỗi mới được khai báo tại đó. Request quản trị dùng requestId UUID; UI không tự gửi lại khi mất ACK. PIN trong ví dụ là dữ liệu kiểm thử cách ly, không phải PIN cửa hàng thật.

Cấu hình A chỉ dùng cho kiểm thử: nhân viên role waiter được grant orderHistory.view/report.view và deny order.create/order.update; quyền hiệu lực là floor.view, orderHistory.view, report.view. Đây là overrides trên role có sẵn, không phải role mới hoặc custom role.

Thông báo chung áp cho các ngoại lệ được dẫn ở từng UC: AUTH_REQUIRED/EMPLOYEE_SESSION_REQUIRED → “Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.”; FORBIDDEN → “Bạn không có quyền thực hiện thao tác này.”; NOT_FOUND → “Không tìm thấy dữ liệu được phép truy cập.”; PERMISSION_UPDATE_UNAVAILABLE → “Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.”. Dữ liệu target khác store dùng NOT_FOUND, không nêu danh tính/quyền target.

## UC-PERM-01 — Đăng nhập và mở phần được cấp quyền

**Tác nhân:** nhân viên thuộc role đang bật. **Mục tiêu:** vào đúng phần việc được phép.
**Tiền điều kiện:** store đã ghép; employee active, catalog đã activate.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| employeeId | UUID, có | ID chọn từ roster cùng store |
| pin | string, có | Chính xác 6 chữ số ASCII; ví dụ fixture 384729 |
| store session | opaque, có | Identity ghép store hiện tại; không ghi log |
| catalog/employee revision | integer, server trả | Không âm; client không tự quyết quyền |

**Luồng chính**
1. Người dùng chọn employee và nhập PIN.
2. Server xác minh, cấp employee session 12h và authority nhất quán.
3. Client giữ token trong memory, mở floor home và nav theo catalog.
4. Người dùng mở module; server cấp projection đúng quyền.

**Luồng thay thế:** nhân viên chỉ xem theo cấu hình A mở lịch sử/báo cáo; cashier bị deny mọi quyền tùy biến vẫn xem floor.
**Luồng ngoại lệ:** INVALID_PIN → “PIN không đúng.”; EMPLOYEE_ROLE_UNAVAILABLE → “Vai trò này chưa được hỗ trợ trên ứng dụng.”; PERMISSION_REFRESH_UNAVAILABLE → “Chưa xác minh được quyền. Kiểm tra kết nối và thử lại.”; AUTH_REQUIRED/EMPLOYEE_SESSION_REQUIRED theo thông báo chung.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| authority | AuthoritySnapshot theo design | Đúng store/employee/session, revision không âm |
| session | opaque memory-only, TTL 12h | Không audit token hoặc cache bền |
| module | tập module suy từ 15 quyền | Không mutation hoặc auto replay lúc login |

**Tiêu chí chấp nhận:** floor có cho cả bốn role đang dùng; không mount protected cache trước xác minh; quyền không có thì ẩn; reload về PIN; role kitchen không mở shell.
**Truy vết:** PERM-01,02,03,04,10,11,20.

## UC-PERM-02 — Tạo nhân viên

**Tác nhân:** owner hoặc người có employee.manage. **Mục tiêu:** thêm nhân viên với quyền không vượt thẩm quyền.
**Tiền điều kiện:** actor active/cùng store; owner đã tồn tại; quyền candidate qua ceiling.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, id | UUID, có | Hai UUID client sinh; employee id chưa tồn tại |
| name | string, có | Trim 1–120 Unicode code points; “Mai” |
| role | string, có | manager/cashier/waiter |
| pin, confirmPin | string, có ở UI | 6 chữ số ASCII, khớp; confirm không cần gửi server |
| overrides | null hoặc object, không | Contract grants/denies; nếu gửi tùy biến cần employee.permission.edit |

**Luồng chính**
1. Actor chọn Tạo nhân viên, nhập và xác nhận.
2. UI kiểm dữ liệu/quyền trường; server khóa, kiểm current actor và candidate-after.
3. Server insert employee active, revision ban đầu và audit applied nguyên tử.
4. Client refetch danh bạ, chọn bản ghi mới.

**Luồng thay thế:** không gửi overrides dùng role default; retry cùng requestId đọc kết quả đã có.
**Luồng ngoại lệ:** INVALID_EMPLOYEE_REQUEST → “Thông tin nhân viên không hợp lệ. Kiểm tra các trường được đánh dấu.”; PERMISSION_CEILING_EXCEEDED → “Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: {danh sách tên quyền}.”; OWNER_PROTECTED → “Không thể thay đổi chủ quán bằng thao tác này.”; ADMIN_REQUEST_REUSED → “Mã yêu cầu đã được dùng cho nội dung khác.”; FORBIDDEN/PERMISSION_UPDATE_UNAVAILABLE theo thông báo chung.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| employee | EmployeeAdminView, không PIN/hash | 1 bản ghi cùng store, active=true |
| audit | 1 applied theo requestId | before=null, after đầy đủ không bí mật |
| UI | danh bạ mới | “Đã tạo nhân viên.” |

**Tiêu chí chấp nhận:** không tạo owner/kitchen/custom role; không nhân đôi khi retry; tạo yếu hơn actor vẫn cần employee.manage.
**Truy vết:** PERM-01,05,13,15,16,17,18.

## UC-PERM-03 — Sửa tên hoặc vai trò nhân viên

**Tác nhân:** actor có employee.manage. **Mục tiêu:** cập nhật thông tin/role đúng thẩm quyền.
**Tiền điều kiện:** đã đọc target/revision; target cùng store.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, targetId | UUID, có | Một target/request |
| expectedRevision | integer, có | ≥0, bằng revision hiện hành; ví dụ 7 |
| expectedCatalogRevision | integer, bắt buộc nếu patch có role hoặc overrides | ≥0, catalog lúc mở form; ví dụ 11; name-only có thể bỏ |
| name | string, tùy chọn | Trim 1–120 Unicode code points; thiếu giữ nguyên |
| role | string, tùy chọn | Ba role manager/cashier/waiter; thiếu giữ nguyên |
| overrides | null hoặc {grants:string[],denies:string[]}, tùy chọn | Gửi rõ cần thêm employee.permission.edit; áp sau khi xóa tùy chỉnh cũ do đổi role, chuẩn hóa theo role mới |

**Luồng chính**
1. Actor mở target, sửa tên/role rồi lưu.
2. Server khóa target và actor/session, chốt catalog, kiểm before/after và OCC.
3. Role đổi thật xóa overrides cũ, rồi áp overrides mới được gửi rõ (nếu có) theo quyền employee.permission.edit; ghi employee revision+audit+signal nguyên tử.
4. UI tải dữ liệu mới, bỏ dirty state.

**Luồng thay thế:** owner sửa tên mình; role giữ nguyên không xóa overrides; patch không đổi gì trả no-op.
**Luồng ngoại lệ:** EMPLOYEE_VERSION_CONFLICT → “Thông tin nhân viên đã thay đổi. Tải lại trước khi lưu.”; PERMISSION_CATALOG_STALE → “Danh mục quyền đã thay đổi. Tải lại trước khi lưu.”; SELF_PERMISSION_EDIT_FORBIDDEN → “Bạn không thể tự sửa vai trò hoặc quyền của mình.”; OWNER_PROTECTED, PERMISSION_CEILING_EXCEEDED theo UC-02; INVALID_EMPLOYEE_REQUEST, NOT_FOUND, FORBIDDEN, PERMISSION_UPDATE_UNAVAILABLE.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| employee/revision | bản ghi sanitized | Tăng 1 khi có thay đổi |
| overrides | Role đổi thật: null nếu không gửi bộ mới; nếu gửi thì chuẩn hóa theo role mới | Audit ghi đề nghị cuối cùng và before/after; kiểm cả hai quyền quản trị khi request trộn |
| sessions | không revoke vì name/role | “Đã lưu nhân viên.”; no-op: “Không có thay đổi để lưu.” |

**Tiêu chí chấp nhận:** kiểm before lẫn after; role đổi và overrides mới cùng lần lưu không giữ tùy chỉnh cũ; role no-op thiếu overrides giữ deny; form stale không tự merge/resubmit; actor không tự đổi role.
**Truy vết:** PERM-05,08,13,14,16,17,19.

## UC-PERM-04 — Cấp, chặn hoặc đặt lại overrides

**Tác nhân:** owner/người có employee.permission.edit. **Mục tiêu:** chỉnh quyền riêng của target.
**Tiền điều kiện:** đã đọc catalog/target cùng revision; không self-edit.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, targetId | UUID, có | Cùng store, target khác actor |
| expectedRevision, expectedCatalogRevision | integer, có | ≥0, phải khớp snapshot |
| overrides | object hoặc null, có | {grants:string[],denies:string[]}; null đặt về defaults |
| phần tử | permission code | Thuộc 15 mã; deny floor.view bị cấm; non-owner không nhận data.clearDemo |

**Luồng chính**
1. Actor xem nguồn quyền default/grant/deny và quyền nền khóa chỉnh.
2. Actor chọn thay đổi, UI gửi explicit overrides hoặc reset.
3. Server chuẩn hóa, kiểm ceiling trước/sau và quyền trường.
4. Commit overrides+audit+revision+signal; target hội tụ không login lại.

**Luồng thay thế:** cấp receipt.reprint cho nhân viên chỉ xem theo cấu hình A; actor ủy quyền settings.manage; array trùng khử duplicate.
**Luồng ngoại lệ:** PERMISSION_BASELINE_REQUIRED → “Quyền xem sơ đồ bàn luôn được cấp và không thể tắt.”; OWNER_ONLY_PERMISSION → “Quyền này chỉ dành cho chủ quán.”; PERMISSION_CATALOG_STALE → “Danh mục quyền đã thay đổi. Tải lại trước khi lưu.”; SELF_PERMISSION_EDIT_FORBIDDEN/EMPLOYEE_VERSION_CONFLICT/INVALID_EMPLOYEE_REQUEST/FORBIDDEN/PERMISSION_CEILING_EXCEEDED/PERMISSION_UPDATE_UNAVAILABLE như trên.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| effective/source | PermissionSnapshot | Denies thắng cho payload hợp lệ |
| audit | applied/denied/noop | Snapshot không PIN/hash/token |
| UI | refreshed quyền | “Đã cập nhật quyền nhân viên.” |

**Tiêu chí chấp nhận:** không tự edit; reset chủ động cần permission.edit; không tăng quyền gián tiếp; request lỗi không đổi actualAfter.
**Truy vết:** PERM-02,04,05,08,14,15,16,17,19,24.

## UC-PERM-05 — Tạm khóa hoặc mở khóa nhân viên

**Tác nhân:** actor có employee.manage. **Mục tiêu:** kiểm soát khả năng đăng nhập target.
**Tiền điều kiện:** target cùng store, không owner, không self, trước/sau qua ceiling.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, targetId | UUID, có | Target xác minh |
| expectedRevision | integer, có | ≥0, hiện hành |
| isActive | boolean, có | false khóa, true mở; không nhận string/null |

**Luồng chính**
1. Actor chọn trạng thái và lưu.
2. Server khóa target/các session, kiểm ceiling bằng quyền cấu hình kể cả target đang khóa.
3. Khi active→false, revoke tất cả session target cùng audit/revision.
4. Khi false→true, cho đăng nhập mới, không phục hồi token cũ.

**Luồng thay thế:** cùng trạng thái là no-op.
**Luồng ngoại lệ:** SELF_DISABLE_FORBIDDEN → “Bạn không thể tự tạm khóa tài khoản đang dùng.”; OWNER_PROTECTED/PERMISSION_CEILING_EXCEEDED/EMPLOYEE_VERSION_CONFLICT/FORBIDDEN/PERMISSION_UPDATE_UNAVAILABLE.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| isActive | boolean đã commit | “Đã tạm khóa nhân viên.” hoặc “Đã mở khóa nhân viên.” |
| sessions | revoked khi khóa | Không sinh token mới khi mở |
| audit | một outcome/request | Mất quyền không xóa order/K |

**Tiêu chí chấp nhận:** inactive không biến ceiling thành rỗng; owner/self bị chặn; unlock cần login mới.
**Truy vết:** PERM-05,13,14,16,17,20.

## UC-PERM-06 — Đặt lại PIN nhân viên khác

**Tác nhân:** actor có employee.manage. **Mục tiêu:** giúp non-owner đăng nhập lại.
**Tiền điều kiện:** target non-owner cùng store, khác actor, ceiling qua.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, targetId | UUID, có | Target một nhân viên khác |
| expectedRevision | integer, có | ≥0, hiện hành |
| newPin, confirmPin | string, có ở UI | Chính xác 6 số ASCII, khớp; ví dụ 927416 |

**Luồng chính**
1. Actor nhập PIN mới và xác nhận.
2. Server khóa target/sessions, kiểm actor/ceiling/OCC và PIN format.
3. Đổi hash, revoke toàn bộ phiên target và ghi audit nguyên tử.
4. UI không giữ PIN sau hoàn tất.

**Luồng thay thế:** gửi lại cùng requestId không reset thêm; PIN không đổi xử lý no-op theo design.
**Luồng ngoại lệ:** OWNER_PROTECTED; INVALID_EMPLOYEE_REQUEST với lỗi trường “PIN phải gồm đúng 6 chữ số.”; confirm sai UI “Xác nhận PIN không khớp.”; PERMISSION_CEILING_EXCEEDED/EMPLOYEE_VERSION_CONFLICT/FORBIDDEN/PERMISSION_UPDATE_UNAVAILABLE.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| employee | sanitized revision | “Đã đặt lại PIN. Nhân viên cần đăng nhập lại.” |
| PIN/hash | không có trong output/audit | PIN cũ không dùng được khi đã đổi |
| sessions | mọi token cũ revoked | Không tự đăng nhập dưới danh tính target |

**Tiêu chí chấp nhận:** manager không reset owner dù full grants; mất ACK không reset lặp; audit lỗi PIN không đổi.
**Truy vết:** PERM-05,13,16,17,20.

## UC-PERM-07 — Owner tự đổi PIN

**Tác nhân:** owner đang đăng nhập. **Mục tiêu:** thay PIN mình khi còn biết PIN hiện tại.
**Tiền điều kiện:** phiên owner active/cùng store; không dùng employee reset endpoint.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId | UUID, có | Một lần tự đổi |
| currentPin, newPin, confirmPin | string, có ở UI | 6 số ASCII; new/confirm khớp |
| expectedRevision | integer, có | ≥0, owner revision đang đọc |

**Luồng chính**
1. Owner mở Đổi PIN, nhập PIN hiện tại và PIN mới.
2. Server kiểm actor chính là owner và verify currentPin trong transaction.
3. Đổi PIN+revoke mọi token+audit nguyên tử.
4. Client khóa phiên, yêu cầu PIN mới.

**Luồng thay thế:** newPin=currentPin là no-op, hiện “PIN mới trùng PIN hiện tại; không có thay đổi.”; không revoke.
**Luồng ngoại lệ:** INVALID_PIN → “PIN hiện tại không đúng.”; INVALID_EMPLOYEE_REQUEST; EMPLOYEE_VERSION_CONFLICT; EMPLOYEE_SESSION_REQUIRED; PERMISSION_UPDATE_UNAVAILABLE. Quên PIN chuyển quy trình UC-08, không nới kiểm currentPin.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| outcome | applied/noop | “Đã đổi PIN. Vui lòng đăng nhập lại.” khi applied |
| audit | một row không bí mật | Actor owner thật, không fake operator |
| client/session | màn PIN, tokens revoked | Role/overrides giữ nguyên |

**Tiêu chí chấp nhận:** sai PIN không đổi/revoke; không self role/override; không force-default-change/email.
**Truy vết:** PERM-05,13,20,21.

## UC-PERM-08 — Operator khôi phục owner quên PIN

**Tác nhân:** operator hạ tầng được chỉ định, owner cung cấp căn cứ. **Mục tiêu:** khôi phục truy cập khi chưa có email recovery.
**Tiền điều kiện:** ca hỗ trợ xác minh ngoài app, quyền hạ tầng được kiểm, runbook kỹ thuật đã thử cách ly.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| requestId, storeId, ownerId | UUID, có | Đúng owner active duy nhất; không tự suy UUID |
| operatorRef, caseRef | string, có | 1–200 ký tự; mã hồ sơ bên ngoài, không secret |
| verification record | hồ sơ ngoài app, có | Xác minh độc lập; người thực hiện/kênh bàn giao được ghi |
| newPin | string secret, có | 6 số ASCII; nhập qua kênh operator, không log |

**Luồng chính**
1. Operator kiểm hồ sơ, store/owner và quyền can thiệp.
2. Chạy contract recovery hạ tầng có requestId, khóa/audit nguyên tử.
3. Bàn giao PIN qua kênh đã xác minh, không ghi vào biên bản công khai.
4. Đối chiếu audit operator/case, xác nhận token cũ vô hiệu và owner đăng nhập mới.

**Luồng thay thế:** retry cùng requestId chỉ đối chiếu lần đã làm; ca không đủ bằng chứng dừng.
**Luồng ngoại lệ:** OWNER_RECOVERY_REVIEW_REQUIRED → “Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ.”; OWNER_PROTECTED nếu target không khớp bất biến; FORBIDDEN cho app caller; PERMISSION_UPDATE_UNAVAILABLE khi audit/hạ tầng lỗi.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| audit | actorType=operator, caseRef | Không giả owner employee, không PIN/hash/token |
| outcome | applied/noop/rejected | Hồ sơ ghi kết quả thật, không giả đã test live |
| DB/client | PIN mới, token cũ revoked | Giữ role/tenant/order/K/R1; không endpoint bypass app |

**Tiêu chí chấp nhận:** rollback nếu audit lỗi; app không gọi được; external verification khác DB test; exit runbook khi email recovery verified.
**Truy vết:** PERM-05,13,20,22.

## UC-PERM-09 — Đọc hoặc quản trị một module theo quyền

**Tác nhân:** nhân viên active. **Mục tiêu:** xem/làm đúng phần được cấp.
**Tiền điều kiện:** authority hiện hành; mapping projection/action trong design.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| module/purpose | mã catalog hoặc RPC đã công bố, có | floor/history/report/menu/floor-editor/employees/settings |
| filters/cursor | DTO riêng, tùy chọn | Dates YYYY-MM-DD, limit 1–100, cùng store, không tự chỉ actor |
| mutation patch | DTO theo module, nếu ghi | Giữ business validation/OCC baseline; trường whitelist |
| imageFile / itemId / uploadId | File + UUID + UUID, khi upload ảnh | JPEG/PNG/WebP tối đa5MiB; item cùng store, uploadId client tạo; không bucket/path/upsert do caller chọn |
| published assetKey | opaque key do server trả, khi hiển thị ảnh | Chỉ dùng URL public ổn định trỏ published record; không token trong URL; staging dùng local blob hoặc fetch đã auth |

**Luồng chính**
1. UI hiển thị module/action theo authority.
2. Adapter gọi projection/RPC tương ứng với token thật.
3. Server kiểm tenant, session, quyền hiện hành và điều kiện nghiệp vụ.
4. Trả đúng dữ liệu được phép hoặc commit mutation; UI refetch.

**Luồng thay thế:** floor đọc cho mọi role đang dùng; settings.manage grant cho cashier chỉ mở settings, không tự mở employee/audit.

**Bổ sung ngày 2026-09-16:** giờ báo cáo dùng timezone cửa hàng, mặc định UTC+7; `businessDate` vẫn lọc ngày doanh thu đã lưu. Khi sửa cài đặt, timezone là trường chỉ owner được thay đổi. Non-owner có settings.manage gửi cùng timezone hiện hành được lưu trường khác; thay timezone cùng tên cửa hàng trả `FORBIDDEN`, không có thay đổi từng phần. Rào chắn ghi và control tương ứng thuộc T08/T13.

Báo cáo còn có bảng tối đa20 đơn paid trong toàn khoảng từ ngày–đến ngày (cả hai biên tính vào). Sắp ngày/số đơn/id giảm dần. Có report.view nhưng thiếu history vẫn đọc bảng; mở chi tiết/history hoặc receipt bị kiểm riêng và từ chối khi thiếu quyền. Field dư, page/limit/status hoặc range sai trả `INVALID_WRITE_REQUEST`; không có tác dụng phụ.

Đầu vào bổ sung cho bảng đơn báo cáo:

| Trường | Kiểu/bắt buộc | Ràng buộc |
| --- | --- | --- |
| fromDate | string, có | Gregorian YYYY-MM-DD, năm0001–9999; ≤ toDate |
| toDate | string, có | Gregorian YYYY-MM-DD, năm0001–9999; ≥ fromDate |

Đầu ra là array0–20 dòng, mỗi dòng đúng các trường sau:

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| id | string UUID | ID đơn cùng cửa hàng, dùng làm khóa dòng |
| orderNo | number nguyên | Số đơn đã lưu, không âm |
| businessDate | string YYYY-MM-DD | Ngày doanh thu đã lưu, trong khoảng yêu cầu |
| orderType | enum | dine_in hoặc takeaway |
| total | number nguyên | VND, không âm |
| status | literal string | Luôn paid |
| tableName | string hoặc null | Tên bàn hiện hành cùng store; null nếu không có bàn |
Ảnh published tải anonymous qua function chỉ đọc; upload/delete/staging read đi qua function xác thực và RPC kiểm menu.manage. Lỗi GET ảnh dùng placeholder, giữ ô món/tên/giá và thao tác bán hàng; không thay lỗi permission của mutation thành ảnh lỗi để bỏ qua chặn.
**Luồng ngoại lệ:** FORBIDDEN/NOT_FOUND/EMPLOYEE_SESSION_REQUIRED; PERMISSION_REFRESH_UNAVAILABLE khi chưa xác minh; lỗi nghiệp vụ baseline giữ nguyên, không đổi sang “thiếu quyền”.
Upload ảnh sai loại/quá5MiB giữ UNKNOWN với “Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP.” / “Ảnh món tối đa 5MB.”; không ghi object hoặc finalize khi input bị từ chối. GET ảnh lỗi dùng placeholder, không dùng cảnh báo đã lưu thành công.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| projection | DTO whitelist theo design | Không raw payment/hash/audit qua floor hoặc roster |
| mutation | kết quả business baseline | “Đã lưu thay đổi.” khi thành công thực sự |
| security | direct SELECT/DML/Storage/Realtime cùng ranh giới | Không chỉ dựa UI; không grant chéo |

**Tiêu chí chấp nhận:** mọi 15 quyền có mapping; read không cho write; denied dữ liệu khác store không bị lộ qua lỗi.
**Truy vết:** PERM-02,03,04,09,12,15,26.

## UC-PERM-10 — Owner xóa dữ liệu mẫu

**Tác nhân:** owner. **Mục tiêu:** dọn dữ liệu demo.
**Tiền điều kiện:** có data.clearDemo, phiên hiện hành; điều kiện không có đơn mở của baseline.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| confirmation | boolean, có | Người dùng xác nhận true sau mô tả phạm vi |
| requestId | UUID, có | Sinh một lần cho thao tác clear; mất ACK/retry giữ cùng ID; không tái dùng ID cho lần clear mới |
| store context | server identity, có | Không nhận store của client làm authority |

**Luồng chính**
1. Owner mở dialog xóa mẫu, xem dữ liệu sẽ giữ.
2. Server lấy khóa bulk, kiểm owner/quyền/đơn mở sau chờ.
3. Tombstone dữ liệu seed theo baseline; deactivate demo non-owner phù hợp, ghi audit các thay đổi identity.
4. Refetch dữ liệu, giữ owner và dữ liệu tự tạo.

**Luồng thay thế:** không còn demo thì không phát sinh xóa dữ liệu tự tạo; hủy dialog không gửi RPC.
**Luồng ngoại lệ:** OPEN_ORDERS_BLOCK_CLEAR_DEMO → “Còn đơn đang mở. Hãy hoàn tất các đơn trước khi xóa dữ liệu mẫu.”; ADMIN_REQUEST_REUSED → “Mã yêu cầu đã được dùng cho nội dung khác.”; FORBIDDEN/EMPLOYEE_SESSION_REQUIRED; PERMISSION_UPDATE_UNAVAILABLE nếu phần audit/transaction lỗi.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| seed entities | tombstone như baseline | “Đã xóa dữ liệu mẫu.” |
| preserved | owner/custom/finance/K/R1/audit | Không TRUNCATE, không xóa toàn bộ |
| sessions | demo bị deactivate revoked | Audit/signal cùng transaction thay identity |

**Tiêu chí chấp nhận:** non-owner kể cả injected grant không gọi được; giữ ledger và receipt; gate open-order còn nguyên.
**Truy vết:** PERM-02,05,09,13,17,29.

## UC-PERM-11 — Xem và in hóa đơn theo quyền

**Tác nhân:** nhân viên có quyền đọc hóa đơn ở nguồn tương ứng. **Mục tiêu:** xem hoặc in bản đã được phép.
**Tiền điều kiện:** cùng store; hóa đơn paid chưa void khi in; reprint cần receipt.reprint.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| orderId | UUID, có | Đơn đã thanh toán thuộc store |
| entry point | enum UI, có | initial-payment/history/recovery; không làm bằng chứng server |
| printGrantId | UUID, chỉ initial | Client sinh khi payment ban đầu; server đã cấp grant gắn K/order/actor/session, ngoài R1 |
| printRequestId | UUID, chỉ authorize initial | Mỗi click mới một ID, giữ nguyên khi retry authorize mất ACK trước dispatch; PR1/PR2 fixture, double-click pending gộp |
| print click | sự kiện chủ động | Không tự chạy do replay/reconnect |

**Luồng chính**
1. Nhân viên mở lịch sử đơn bằng orderHistory.view, xem snapshot.
2. Nếu có receipt.reprint, chọn In lại.
3. Server prepare-reprint kiểm quyền đọc/in lại/session/trạng thái hiện hành.
4. Preview và nút In kiểm lifetime/quyền trước gọi browser print.

**Luồng thay thế:** initial payment dùng payment.take, không cần receipt.reprint; recovery dùng action permission giữ nguyên và thêm reprint; nhân viên cấu hình A chưa grant reprint chỉ xem.

Theo Q15, preview initial giữ mở sau dispatch/Cancel và cho bấm In tiếp nếu còn payment.take. Grant không tiêu hao bởi authorize; mỗi click mới kiểm server với PR mới, không tạo payment/K/R1 mới. Mất ACK authorize trước dispatch cho bấm “Thử lại” cùng PR, không tự in; callback/ACK lặp của PR đã dispatch không in thêm. Sau dispatch hiện “Đã gửi lệnh in.”, không khẳng định máy đã in giấy. Đóng preview bỏ grant client, mở lại từ lịch sử/Tra cứu theo quyền reprint; không tái tạo initial từ K cũ.

Chỉ mất quyền in thì ẩn nút In và hủy request/timer chưa dispatch. Giữ preview nếu còn quyền đọc receipt, hiện “Quyền in hóa đơn đã thay đổi. Bạn vẫn có thể xem hóa đơn.”; initial cần payment.take để in, có thể tiếp tục xem bằng orderHistory.view. Reprint cần receipt.reprint và quyền đọc nguồn. Mất quyền đọc hoặc phiên đóng/purge theo UC12. Cấp lại quyền hiện nút nếu preview còn hợp lệ, không tự in và không đổi nguồn initial/reprint để vượt quyền.
**Luồng ngoại lệ:** FORBIDDEN; RECEIPT_UNAVAILABLE → “Không thể in hóa đơn này. Đơn chưa thanh toán hoặc đã bị hủy.”; EMPLOYEE_SESSION_REQUIRED; response/timer stale bị bỏ, không toast đè phiên mới.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| receipt | ReceiptSnapshot v1/historical legacy marker | Tên/giá/thu ngân theo snapshot, không catalog mới |
| print | một lệnh gọi app mỗi click còn hợp lệ | Không hứa số bản giấy hoặc chống copy ngoài app |
| business state | không đổi | Không payment/order/K mới, không rewrite R1 |

**Tiêu chí chấp nhận:** nhân viên cấu hình A chưa được cấp reprint không in; grant riêng hiện nút; void disabled; revoke ngăn timer, chỉ mất quyền in không đóng preview còn quyền đọc; Cancel initial cho click mới, PR cũ không dispatch lại; initial/replay giữ K/R1 phase27.
**Truy vết:** PERM-02,04,09,25,27,28,29.

## UC-PERM-12 — Thiết bị nhận thay đổi quyền

**Tác nhân:** actor đổi quyền và target trên thiết bị đang mở. **Mục tiêu:** giao diện đúng quyền mới mà không login lại.
**Tiền điều kiện:** authority có revisions; signal/poll chung đang hoạt động khi foreground.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| signal | DTO tối thiểu, tùy thời điểm | eventId/store/topic/revision, không quyền chi tiết |
| revision tuple | hai integer ≥0, có khi poll | Employee và catalog revision |
| visibility/connection | state trình duyệt | visible/hidden, online/offline |
| generation | integer local | Phân biệt phiên mới và request cũ |

**Luồng chính**
1. Signal hoặc poll phát hiện revision đổi.
2. Client tải snapshot nhất quán, bỏ response sai context/cũ.
3. Áp quyền, đóng dữ liệu/nháp mất quyền theo Q10; chỉ mất quyền in thì ẩn nút/hủy timer và giữ preview còn quyền đọc theo Q15; giữ phần khác.
4. Client tiếp tục phiên, không tự gửi mutation.

**Luồng thay thế:** lost signal được poll bù; focus/reconnect gate trước render/query; duplicate không có side effect.
**Luồng ngoại lệ:** PERMISSION_REFRESH_UNAVAILABLE với thông báo UC-01; EMPLOYEE_SESSION_REQUIRED xác nhận phiên mất hiệu lực thì về PIN cho đúng phiên; timeout không được giả đã kiểm quyền.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| authority | revision mới nhất đúng context | Session token/generation không đổi chỉ vì role/override |
| cache/draft | giữ hoặc xóa theo quyền | Thông báo PERM-25 khi có phần bị đóng |
| timing | signal ≤5s, fallback ≤35s có điều kiện | Gate thật chưa chạy; không hứa offline SLA |

**Tiêu chí chấp nhận:** một poll30s visible-only; full chain≤5s cho35s; global catalog đổi hội tụ; no-op không ngắt payment; cache cũ không quay lại.
**Truy vết:** PERM-03,04,12,20,24,25,26,29.

## UC-PERM-13 — Đọc audit quản trị

**Tác nhân:** owner hoặc employee.permission.edit. **Mục tiêu:** đối chiếu ai đã thay đổi hoặc bị từ chối.
**Tiền điều kiện:** phiên active cùng store; dùng endpoint server, chưa thêm màn audit.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| cursor, limit | opaque cursor/integer, tùy chọn | limit 1–100, default50; cursor gắn store/filter |
| targetId, outcome | UUID/enum, tùy chọn | outcome applied/denied/noop; không dò store khác |
| store context | server identity | Không bypass bằng query storeId |

**Luồng chính**
1. Actor yêu cầu trang audit/filter.
2. Server kiểm quyền đọc hiện hành và scope store.
3. Trả snapshot sanitized cùng outcome/reason và cursor.
4. Người đối chiếu phân biệt proposedAfter/actualAfter.

**Luồng thay thế:** có thể đọc audit target owner theo Q13; target ceiling không hạn chế đọc audit.
**Luồng ngoại lệ:** FORBIDDEN/EMPLOYEE_SESSION_REQUIRED/NOT_FOUND; INVALID_EMPLOYEE_REQUEST cho filter/cursor sai. UPDATE/DELETE trực tiếp bị từ chối.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| rows/cursor | AuditPage typed | Không PIN/hash/token/fingerprint nhạy cảm |
| retention | giữ toàn bộ | Không sửa/xóa, không GC/clear-demo |
| UI | không màn mới trong change | API không gửi email hoặc thông báo ngoài app |

**Tiêu chí chấp nhận:** quyền đọc đúng Q13; rollback/denied/no-op phân biệt được; không phát audit detail qua Realtime.
**Truy vết:** PERM-05,09,26.

## UC-PERM-14 — Preflight, chuyển đổi và tạo store sau activation

**Tác nhân:** người triển khai và chủ dự án xác minh mapping; flow tạo store hiện có. **Mục tiêu:** chuyển role không chọn nhầm owner hoặc phá giao dịch.
**Tiền điều kiện:** spec được duyệt trước triển khai; backup/migration bundle và runtime cách ly sẵn sàng.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| baseline fingerprint | object, có | Source fingerprint riêng; execution profile ghi pha, migration/catalog đã áp, runtime/backend/fixture/command |
| owner mapping | map store UUID→employee UUID, có khi mơ hồ | Active, chứng cứ/operator approvalRef, không đoán |
| fixture/live inventory | snapshot, có | Role/active/created_at/provenance/overrides/K; không xuất PIN/hash/token |
| activation gate | boolean từ checks, có | Mọi blocking store resolved, bridge/DB/client tests PASS |
| bootstrap requestId / ownerId | UUID, bắt buộc ở nhánh tạo store | Khác zero, retry cùng request giữ ownerId; ví dụ B1 và owner mới trong TC52 |
| storeNo | integer, bắt buộc bootstrap | 1–2147483647, khớp provisioning identity đã xác minh; ví dụ 101 |
| displayName / address | string, bắt buộc bootstrap | Trim tên1–120 Unicode code points, địa chỉ0–500; ví dụ “Cà phê An” / “” |
| provisioning auth | store Auth do flow hiện có xác minh, bắt buộc bootstrap | Server lấy storeId, kiểm khớp storeNo; không nhận actor/storeId tự khai hoặc cần employee session trước bootstrap |
| seedDemo | boolean, tùy chọn flow tạo store | Mặc định false; true seed sau bootstrap dưới phiên owner thật, không atomic toàn bundle |

Bootstrap không nhận trường PIN từ caller; giữ chính sách cấp PIN hiện có, chưa triển khai force-default-pin-change. PIN tự chèn là input sai, không phải đề nghị đổi PIN hợp lệ.

**Luồng chính**
1. Operator xuất preflight không ghi DB, rà candidate và chênh lệch quyền.
2. Chủ dự án/owner có căn cứ xác nhận mapping mơ hồ; không đủ thì dừng.
3. Dựng bridge, kiểm tương đương cũ; chuẩn bị client/DB tương thích, backup.
4. Trong cửa sổ được cho phép, activate nguyên tử và kiểm postflight.
5. Store mới tạo owner trực tiếp, K cũ vẫn thực hiện theo protocol v1.

**Luồng thay thế:** một active primary admin có bằng chứng tự ánh xạ; fallback active admin earliest duy nhất khi gốc mất/đổi role.
**Luồng ngoại lệ:** OWNER_MIGRATION_REVIEW_REQUIRED → “Chưa xác định được chủ quán. Cần xác minh ánh xạ trước khi chuyển đổi.”; BOOTSTRAP_CONFLICT → “Cửa hàng đã được khởi tạo; không thể thay chủ quán bằng thao tác này.”; INVALID_WRITE_REQUEST → “Thông tin khởi tạo cửa hàng không hợp lệ.”; FORBIDDEN → “Bạn không có quyền thực hiện thao tác này.”; WRITE_PROTOCOL_UNSUPPORTED → “Ứng dụng cần được cập nhật trước khi tiếp tục.”; PERMISSION_UPDATE_UNAVAILABLE.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| preflight/postflight | report có fingerprint/mapping | Không chứa secret, không giả đã chạy live |
| roles/catalog | đúng 1 owner active/store,15 mã | Admin hết sau activation; kitchen không bật |
| financial/history | hash/payload/R1 không đổi | Không restore làm mất giao dịch mới |

**Tiêu chí chấp nhận:** tie/no admin/inactive primary chặn; no partial activation; client cũ bị chặn an toàn; bootstrap retry không thêm owner; không mở legacy grants.
**Truy vết:** PERM-01,02,06,13,18,23,30.

## UC-PERM-15 — Tiếp tục đúng thao tác K sau thay đổi quyền

**Tác nhân:** nhân viên còn đủ action permission hoặc người tiếp quản. **Mục tiêu:** xác định/thực hiện kết quả không ghi trùng.
**Tiền điều kiện:** K/payload đã register hoặc ACK chưa rõ; phiên hiện hành, online.

**Đầu vào**

| Trường | Kiểu/bắt buộc | Ràng buộc/ví dụ |
| --- | --- | --- |
| K | UUID, có | Giữ nguyên ID đã register, không sinh lại khi retry |
| action | enum, có | get/list/execute/cancel theo protocolv1 |
| actor session | opaque, có | Server suy actor; action permission hiện hành |
| payload | immutable DTO, khi cần | Cùng fingerprint sau register; không xây lại từ nháp |

**Luồng chính**
1. Người dùng mở Tra cứu chủ động, server lọc K theo action permission.
2. Người đủ quyền xem trạng thái, chọn tiếp tục hoặc cancel theo baseline.
3. Server kiểm lại quyền/session/TTL sau khóa, thực hiện đúng K.
4. UI nhận kết quả đúng phiên; không auto mở/in receipt từ recovery.

**Luồng thay thế:** B đủ quyền tiếp quản K của A; terminal replay trả R1 lịch sử nhưng không đổi giá/order hiện tại.
**Luồng ngoại lệ:** FORBIDDEN/EMPLOYEE_SESSION_REQUIRED; OPERATION_NOT_FOUND → “Không tìm thấy thao tác được phép truy cập.”; WRITE_RESULT_UNKNOWN → “Chưa xác định được kết quả. Hãy tra cứu thao tác trên server.”; OPERATION_EXPIRED → “Thao tác đã hết hạn. Hãy kiểm tra đơn trước khi tạo thao tác mới.”; IDEMPOTENCY_KEY_REUSED → “Mã thao tác đã được dùng cho nội dung khác.”.

**Đầu ra**

| Dữ liệu/trạng thái | Kiểu/ràng buộc | Thông báo/tác dụng phụ |
| --- | --- | --- |
| operation/R1 | protocolv1, quyền đọc hợp lệ | Không leak K giữa employee thiếu quyền |
| business effects | tối đa một theo K | Actor/executor thật, initiator giữ nguyên |
| permission denial | không đổi K/payload/order | Không auto cancel/reject hoặc K mới |

**Tiêu chí chấp nhận:** revoke lúc chờ lock bị nhìn thấy; pendingTTL24h không expire order; noauto replay/print; historical R1 không rewrite.
**Truy vết:** PERM-09,20,25,27,28,29,30.

**Tiến độ T04 ngày 2026-09-16:** [biên bản T04](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md) chứng minh server/adapter cho đăng nhập, authority, self PIN và recovery DB synthetic. Luồng UI chưa nối; UC quản trị, seed và bootstrap toàn flow chờ task phụ thuộc. Không dùng kết quả DB để xác nhận đã xác minh con người trong UC08.

**Tiến độ T05 ngày 2026-09-16:** [biên bản T05](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md) ghi 55 execution SQL/Auth/REST và full unit 815, build/regression cùng source. UC02–06/13 đã có server/adapter/mock tương ứng; UI form T12 chưa nối, retention qua clear-demo T08 và signal transport T10 chưa chạy. Giữ 30 requirement/15 UC/60 TC kế hoạch; không coi số execution là số TC đã hoàn tất toàn bộ.

**Tiến độ T06 ngày 2026-09-16:** [biên bản T06](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md) ghi 44 execution SQL/Auth/REST, full unit 815, build/regression cùng source. UC15 có financial authority sau khóa; UC10 bulk clear/seed còn T08. TC44 và TC54 được ghi rõ phần đã kiểm và phần chờ; giữ 30 requirement/15 UC/60 TC kế hoạch, không dùng số execution làm số TC đã đóng toàn bộ.

**Tiến độ T07 ngày 2026-09-16:** [biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) ghi 120 SQL/Auth/REST execution, 919 unit/component và build/regression cùng source. TC13/38 mới phần read, print T14; T08 ghi timezone owner-only chưa chạy. Giữ 30 requirement/15 UC/60 TC kế hoạch, không dùng số execution làm số TC đã đóng toàn bộ.

### UC-PERM-14 — bổ sung nhánh cleanup TEST ngày13/10/2026

Áp dụng [DELIVERY-03-NEW79](../../../docs/workflow/tasks/permission-close3-scope79-2026-10-13.md) cho bước chuẩn bị phát hành; giữ các nhánh mapping fixture/di trú khác là phạm vi riêng. Input: inventory77 immutable (SHA256 đúng64 hex), checkpoint frozen chứa đúng2 UUID bổ sung, câu trả lời user có message ID, manifest scope79 private dẫn xuất và exact2 Storage object refs (UUID/bucket/path/version/byte size/SHA256). Output: scope approval79 có hash, bảo toàn66 Auth và object3, trạng thái release BLOCKED. Không có tác dụng phụ hosted.

Luồng: đọc nguồn xác nhận → đối chiếu UUID/quan hệ → kiểm scope-only và negative → SEC/EVC review → báo rồi STOP. Scope drift hoặc proof thiếu giữ BLOCKED và dữ liệu nguyên; đây là gate vận hành, không tạo mã lỗi UI/AppError mới. Acceptance: exact union77+2, không mở rộng Auth/Storage, nguồn77 giữ nguyên, không nâng backupFAIL, hai review exact candidate. TC-PERM-53-NEW79 kiểm nhánh này; cutover vẫn đòi đầy đủ gate theo design8.2.1.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.



## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
