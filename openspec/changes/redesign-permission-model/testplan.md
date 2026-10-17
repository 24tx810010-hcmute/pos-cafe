# Kế hoạch kiểm thử — redesign-permission-model

**Checkpoint PERM60 12/10/2026:** [execution source-20](../../../docs/implementation-log/permission-perm60-2026-10-12.md) có đủ 27 stage/60 REQUIRED TC/726 mapped variants, strict discovery/results/options/observed profile, aggregate full exit0; case→run matrix và lịch sử FAIL/superseded được liên kết. 13 service candidate chung binding, service chạy tuần tự; unit1.173/build/typecheck và Storage preservation/stop PASS. Review SEC và EVC APPROVE exact candidate-01; hoàn tất kỹ thuật PERM60, hồ sơ verdict tại docs/reviews/2026-10-12-permission-perm60.md. Không đổi expected hoặc coi gói này đã đóng full PIN19/CLOSE-2/T15–T18 tổng/hosted/release; physical restore và metrics provider còn giới hạn ghi rõ.

Ngày 2026-09-17. **Tính năng phân quyền chưa hoàn tất, chưa nối UI và chưa phát hành.** T01–T07 đã có code và bằng chứng kiểm thử cách ly trong phạm vi kỹ thuật; không phải các phần sản phẩm đã bàn giao. [Biên bản T07](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md) giữ kết quả 919 unit/component, 120 SQL/Auth/REST, typecheck/build và regression T01–T06 của candidate ngày16/09; chưa chứng minh bản đang triển khai. Chủ dự án yêu cầu làm trọn luồng và đã xác nhận cập nhật `https://pos-cafe-azure.vercel.app`, Supabase `kfqjdfwxhkdwihjobpny`, **giữ nguyên dữ liệu hiện có**. Xem [bàn giao triển khai trọn luồng](../../../docs/workflow/tasks/redesign-permission-model.md).

## 1. Phạm vi và cách đọc

Giữ ID TC-PERM-01 đến TC-PERM-60. Mỗi TC có mã/tên, truy vết, mức, tiền điều kiện, dữ liệu, các bước, kết quả mong đợi và nơi hiện thực. Các đường dẫn phía dưới vẫn **dự kiến** ngoại trừ phần T01–T03 được biên bản và từng TC chỉ rõ. Test phase27 tồn tại không có nghĩa assertion candidate đã được viết. Không đánh dấu toàn feature xong từ tài liệu này.

Bốn nhóm bắt buộc được chỉ ra ở từng TC: luồng chính, ngoại lệ, biên, bảo mật/quyền. Một TC có thể thuộc nhiều nhóm. Các lượt tham số hóa hoặc chạy lặp vẫn thuộc cùng ID TC, phải báo số TC và số execution riêng. Danh mục hiện có 5 TC đơn vị, 8 TC giao diện, 42 TC tích hợp và 5 TC E2E; đây là phân loại kế hoạch, không phải số test đã pass.

Truy vết PERM-12 trong TC31/33 kiểm việc thay limitation cũ bằng revision/timing/lifetime. Đây là kiểm chứng phần Migration của requirement bị bỏ, không tạo thêm hành vi nghiệp vụ. TC57 không có UC vì kiểm ràng buộc kiến trúc/tài liệu; vẫn có oracle và phải được ghi ngoại lệ trong [traceability](traceability.md).

## 2. Fixture chung F0

Mọi UUID/PIN dưới đây là dữ liệu synthetic cho môi trường cách ly. Không lấy hoặc ghi PIN/hash/token của cửa hàng thật. Mỗi TC/biến thể dựng lại fixture; chỉ ca race mới cố ý dùng nhiều connection trên cùng fixture. Các ca dùng Auth/REST tạo token hợp lệ qua start-session; không hard-code token thật và không ghi token vào báo cáo. T01 chỉ dùng observer DSN, không cần hoặc tạo employee token.

F0 dùng namespace store `10000000-…`, khác bộ fixture phase27 mà [preflight.ts:65](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:65) đang nhận. Profile permissions phải khai báo chính xác S1/S2 cùng các store bổ sung của TC. T01 kiểm observer-side database/marker/engine/store_ids/checksum/schema guards; chỉ gate thực sự dùng Auth/API mới chứng minh API/observer dùng cùng deployment/DB và fixture. Không đổi UUID ngầm hoặc bỏ kiểm tra fixture để tái sử dụng harness. Fixture setup/cấp phiên là bước có mutation riêng trước mốc snapshot của công cụ chỉ đọc.

| Alias | Giá trị cụ thể / trạng thái |
| --- | --- |
| S1 / S2 | 10000000-0000-4000-8000-000000000001 / 10000000-0000-4000-8000-000000000002 |
| O — Lan | 20000000-0000-4000-8000-000000000001; owner tại S1 |
| M — Minh | 20000000-0000-4000-8000-000000000002; manager tại S1 |
| C — Chi | 20000000-0000-4000-8000-000000000003; cashier tại S1 |
| W — Mai | 20000000-0000-4000-8000-000000000004; waiter tại S1 |
| A — An, fixture chỉ xem | 20000000-0000-4000-8000-000000000005; waiter tại S1; grants=[orderHistory.view,report.view], denies=[order.create,order.update]; effective=[floor.view,orderHistory.view,report.view]. Không phải role hoặc default mới |
| KITCH | 20000000-0000-4000-8000-000000000006; kitchen, enabled=false; không phải thao tác K |
| M2 / C2 | 20000000-0000-4000-8000-000000000007: manager S1; 20000000-0000-4000-8000-000000000103: cashier S2 |
| Owner S2 | 20000000-0000-4000-8000-000000000101; bảo đảm fixture S2 cũng có đúng một owner |
| E-new | 20000000-0000-4000-8000-000000000009; chưa tồn tại trước create |
| Trạng thái quyền | Bốn role dùng được đều active; overrides=null ngoại trừ fixture A nêu trên; employee revision=7, catalog revision=11 trừ khi TC ghi khác |
| PIN fixture | 384729 là PIN cũ; 927416 là PIN mới; 384728 dùng làm PIN sai. Không log body của request chứa PIN |
| Clock | T0=2026-09-15T03:00:00.000Z; phiên cấp tại T0, hết hạn T0+12h; fake clock cho unit/UI, clock test được kiểm soát cho DB cách ly |
| I / bàn T | Item 30000000-0000-4000-8000-000000000101: Cà phê sữa, giá 40.000đ; bàn 30000000-0000-4000-8000-000000000201: Bàn 01 |
| P / X / V | Order 30000000-0000-4000-8000-000000000001 paid; 30000000-0000-4000-8000-000000000002 open; 30000000-0000-4000-8000-000000000003 void |
| Payment P | 40000000-0000-4000-8000-000000000001; cash; receipt hai phần 40.000đ, tổng 80.000đ; snapshot lưu tên/giá lúc thanh toán |
| K-pay / K-pending / K-old | 50000000-0000-4000-8000-000000000001 / 50000000-0000-4000-8000-000000000002 / 50000000-0000-4000-8000-000000000003. Mỗi action variant có K riêng; retry bắt buộc giữ đúng K và payload |
| R(n) | UUID request quản trị có dạng 60000000-0000-4000-8000-0000000000nn với nn là số TC hai chữ số; R(05)=60000000-0000-4000-8000-000000000005. Request mới trong cùng TC dùng suffix tiếp theo do fixture cấp; retry dùng lại chính ID đầu |
| G / PR1 / PR2 | Print grant 70000000-0000-4000-8000-000000000001; print request 80000000-0000-4000-8000-000000000001 / 80000000-0000-4000-8000-000000000002 |
| U | Upload handle 90000000-0000-4000-8000-000000000001, thuộc S1/I/M; key do gateway gắn store/item/uploadId, không do caller chọn arbitrary path |
| Dữ liệu mẫu/tự tạo | Mỗi loại menu/floor có một row seed_key=demo.permission.fixture và một row seed_key=null; demo employee M2 có seed_key=demo.permission.employee, owner không có seed_key |

Ở mỗi so sánh 'không đổi dữ liệu', harness đọc lại employee/active/role/overrides/revision, sessions, business rows, K/payload/R1 và audit theo phạm vi TC. Snapshot dùng canonical JSON với thứ tự field/row ổn định; so trường rõ và hash, không chỉ so row count. Hash dùng trong báo cáo không bao gồm PIN, passcode_hash, token hoặc MAC request. Kiểm hash PIN không đổi chỉ là assertion nội bộ, không xuất giá trị.

### D0 — oracle defaults viết độc lập

Bảng sau là dữ liệu mong đợi tĩnh, không được sinh bằng chính hàm tính quyền đang kiểm. O/M/C/W tương ứng owner/manager/cashier/waiter. A là fixture waiter có overrides, không phải cột default role.

| Mã quyền | O | M | C | W |
| --- | --- | --- | --- | --- |
| floor.view | Có | Có | Có | Có |
| order.create | Có | Có | Có | Có |
| order.update | Có | Có | Có | Có |
| order.voidOpen | Có | Có | Có | Không |
| payment.take | Có | Có | Có | Không |
| orderHistory.view | Có | Có | Có | Không |
| order.voidPaid | Có | Có | Không | Không |
| menu.manage | Có | Có | Không | Không |
| floor.manage | Có | Có | Không | Không |
| employee.manage | Có | Có | Không | Không |
| employee.permission.edit | Có | Không | Không | Không |
| report.view | Có | Có | Không | Không |
| settings.manage | Có | Không | Không | Không |
| data.clearDemo | Có | Không | Không | Không |
| receipt.reprint | Có | Có | Có | Không |
| **Tổng** | **15** | **12** | **7** | **3** |

Kitchen có 0 quyền và không mở phiên. floor.view là quyền nền không thể deny; mọi biến thể 'chỉ một quyền' thực tế vẫn giữ floor.view và thêm quyền cần kiểm. Không dùng fixture không hợp lệ deny floor.view để chứng minh action thiếu quyền; đó là input lỗi riêng.

### P0 — oracle dữ liệu và tác dụng phụ

| Nguồn | Dữ liệu được trả / điều phải chặn |
| --- | --- |
| Roster trước PIN | Chỉ id/name của active employee có role enabled; không role/overrides/audit/hash/token |
| Floor | Area/decor/table layout/status và open-order summary id/table/type/displayNo/total/createdAt; không paid/void history, items hoặc payment rows |
| Menu cho order.create/update | Món/options active và giá bán phục vụ thao tác; không tự mở editor hoặc quyền menu.manage |
| Open-order detail | Chỉ order open, lines/options/giá/notes/version; cần order.update OR order.voidOpen OR payment.take |
| Paid target cho void | Chỉ dữ liệu target paid tối thiểu/reason/version với order.voidPaid; không tự mở toàn lịch sử |
| History / report | History trả detail/snapshot paid/void; report chỉ projection aggregate theo ngày/trạng thái. Read không cho write |
| Employee admin / audit | Employee view sanitized; audit chỉ O hoặc employee.permission.edit cùng store, không target-ceiling cho quyền đọc audit |
| Initial / reprint | Initial grant issued gắn K/order/actor/session bên ngoài R1; authorize chỉ đọc, không tiêu hao grant. Preview initial còn mở cho mỗi click mới một PR mới khi còn payment.take; đọc initial cần payment.take OR orderHistory.view. Reprint cần quyền đọc nguồn và receipt.reprint. Không read hoặc print tự cấp execute/cancel K |
| Storage | Bytes staging private; origin GET chỉ phục vụ published record sau DB finalization commit. URL immutable ổn định; ảnh published dùng Cache-Control: private, max-age=60, must-revalidate; lỗi/chưa published dùng no-store. Browser có thể giữ byte tối đa60s trước revalidate; không hứa thu hồi byte đã tải. Legacy public GET giữ; direct store-JWT writes bị chặn |
| Signal | Chỉ store/topic/revision/eventId/targetId cần thiết; không name/total/overrides/receipt/R1/token |
| Mutation bị từ chối | Zero business effect; audit denied chỉ khi đủ xác minh theo PERM-05. Lỗi hạ tầng rollback cả audit/registry/signal |
| No-op / retry | No-op một audit, không revision/signal mới; retry cùng ID/payload không thêm audit hoặc effect, vẫn kiểm quyền đọc/thao tác hiện hành |

### M0 — catalog thông báo và oracle exact-text

Bảng này sao đầy đủ 50 dòng đã phân loại của [design mục 9](design.md), giữ cùng ID/context/câu chữ. Trạng thái mã và câu chữ là hai thuộc tính riêng; “Có” không có nghĩa mọi consumer mới đã được kiểm. Mỗi TC sở hữu kiểm đúng code, ngữ cảnh và nguyên câu; không chỉ kiểm có toast. Các nguồn code là baseline đọc được, các dòng mới/thay đổi vẫn là công việc tương lai.

| ID | Loại / ngữ cảnh | Mã | Trạng thái mã / câu chữ | Thông báo chính xác | Nguồn khai báo / chỗ thay hiện hành | TC sở hữu oracle |
| --- | --- | --- | --- | --- | --- | --- |
| PMSG-E01 | Lỗi: AUTH_REQUIRED / EMPLOYEE_SESSION_REQUIRED | AUTH_REQUIRED / EMPLOYEE_SESSION_REQUIRED | Có / Thay chuỗi hiện có | Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại. | [writeErrors:5–6](D:/Workspace/pos-cafe/src/core/writeErrors.ts:5) | TC02/TC28 |
| PMSG-E02 | Lỗi: FORBIDDEN | FORBIDDEN | Có / Có | Bạn không có quyền thực hiện thao tác này. | [writeErrors:8](D:/Workspace/pos-cafe/src/core/writeErrors.ts:8) | TC25/TC28 |
| PMSG-E03 | Lỗi: NOT_FOUND | NOT_FOUND | Có / Thay chuỗi hiện có | Không tìm thấy dữ liệu được phép truy cập. | [writeErrors:16](D:/Workspace/pos-cafe/src/core/writeErrors.ts:16) | TC22/TC28 |
| PMSG-E04 | Lỗi: Login: PIN sai hoặc employee inactive | INVALID_PIN | Có / Thay chuỗi hiện có | PIN không đúng. | [writeErrors:7](D:/Workspace/pos-cafe/src/core/writeErrors.ts:7); [errors:8](D:/Workspace/pos-cafe/src/adapters/supabase/errors.ts:8) | TC02 |
| PMSG-E05 | Lỗi: RECEIPT_UNAVAILABLE | RECEIPT_UNAVAILABLE | Có / Thay chuỗi hiện có | Không thể in hóa đơn này. Đơn chưa thanh toán hoặc đã bị hủy. | [writeErrors:28](D:/Workspace/pos-cafe/src/core/writeErrors.ts:28) | TC38 |
| PMSG-E06 | Lỗi: OPEN_ORDERS_BLOCK_CLEAR_DEMO | OPEN_ORDERS_BLOCK_CLEAR_DEMO | Có / Thay chuỗi hiện có | Còn đơn đang mở. Hãy hoàn tất các đơn trước khi xóa dữ liệu mẫu. | [uiError:87](D:/Workspace/pos-cafe/src/features/integration/uiError.ts:87) | TC12 |
| PMSG-E07 | Lỗi: WRITE_PROTOCOL_UNSUPPORTED | WRITE_PROTOCOL_UNSUPPORTED | Có / Thay chuỗi hiện có | Ứng dụng cần được cập nhật trước khi tiếp tục. | [writeErrors:27](D:/Workspace/pos-cafe/src/core/writeErrors.ts:27) | TC51 |
| PMSG-E08 | Lỗi: OPERATION_NOT_FOUND | OPERATION_NOT_FOUND | Có / Thay chuỗi hiện có | Không tìm thấy thao tác được phép truy cập. | [writeErrors:11](D:/Workspace/pos-cafe/src/core/writeErrors.ts:11) | TC54 |
| PMSG-E09 | Lỗi: OPERATION_EXPIRED | OPERATION_EXPIRED | Có / Thay chuỗi hiện có | Thao tác đã hết hạn. Hãy kiểm tra đơn trước khi tạo thao tác mới. | [writeErrors:12](D:/Workspace/pos-cafe/src/core/writeErrors.ts:12) | TC54 |
| PMSG-E10 | Lỗi: IDEMPOTENCY_KEY_REUSED | IDEMPOTENCY_KEY_REUSED | Có / Thay chuỗi hiện có | Mã thao tác đã được dùng cho nội dung khác. | [writeErrors:10](D:/Workspace/pos-cafe/src/core/writeErrors.ts:10) | TC54 |
| PMSG-E11 | Lỗi: Bootstrap: input sai | INVALID_WRITE_REQUEST | Có / Thay chuỗi hiện có | Thông tin khởi tạo cửa hàng không hợp lệ. | [writeErrors:9](D:/Workspace/pos-cafe/src/core/writeErrors.ts:9); [UC-PERM-14](usecases.md) chỉ ngữ cảnh bootstrap | TC52 |
| PMSG-E12 | Lỗi: WRITE_RESULT_UNKNOWN | WRITE_RESULT_UNKNOWN | Có / Thay chuỗi hiện có | Chưa xác định được kết quả. Hãy tra cứu thao tác trên server. | [writeErrors:25](D:/Workspace/pos-cafe/src/core/writeErrors.ts:25) | TC54 |
| PMSG-E13 | Lỗi: INVALID_EMPLOYEE_REQUEST | INVALID_EMPLOYEE_REQUEST | Mới / Mới | Thông tin nhân viên không hợp lệ. Kiểm tra các trường được đánh dấu. | [UC-PERM-02](usecases.md) / [UC-PERM-04](usecases.md) | TC19/TC24/TC59 |
| PMSG-E14 | Lỗi: EMPLOYEE_ROLE_UNAVAILABLE | EMPLOYEE_ROLE_UNAVAILABLE | Mới / Mới | Vai trò này chưa được hỗ trợ trên ứng dụng. | [UC-PERM-01](usecases.md) | TC02 |
| PMSG-E15 | Lỗi: OWNER_PROTECTED | OWNER_PROTECTED | Mới / Mới | Không thể thay đổi chủ quán bằng thao tác này. | [UC-PERM-02](usecases.md) / [UC-PERM-03](usecases.md) | TC05/TC14 |
| PMSG-E16 | Lỗi: SELF_DISABLE_FORBIDDEN | SELF_DISABLE_FORBIDDEN | Mới / Thay chuỗi hiện có | Bạn không thể tự tạm khóa tài khoản đang dùng. | [UC-PERM-05](usecases.md); thay guard cũ [EmployeesDrawer:154](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:154) | TC14 |
| PMSG-E17 | Lỗi: SELF_PERMISSION_EDIT_FORBIDDEN | SELF_PERMISSION_EDIT_FORBIDDEN | Mới / Mới | Bạn không thể tự sửa vai trò hoặc quyền của mình. | [UC-PERM-03](usecases.md) / [UC-PERM-04](usecases.md) | TC14 |
| PMSG-E18 | Lỗi: OWNER_ONLY_PERMISSION | OWNER_ONLY_PERMISSION | Mới / Mới | Quyền này chỉ dành cho chủ quán. | [UC-PERM-04](usecases.md) | TC04 |
| PMSG-E19 | Lỗi: PERMISSION_BASELINE_REQUIRED | PERMISSION_BASELINE_REQUIRED | Mới / Mới | Quyền xem sơ đồ bàn luôn được cấp và không thể tắt. | [UC-PERM-04](usecases.md) | TC04 |
| PMSG-E20 | Lỗi: PERMISSION_CEILING_EXCEEDED | PERMISSION_CEILING_EXCEEDED | Mới / Mới | Không thể quản lý nhân viên này vì vượt quyền của bạn. Quyền còn thiếu: {danh sách tên quyền}. | [UC-PERM-02](usecases.md) / [UC-PERM-04](usecases.md) | TC15/TC16/TC17 |
| PMSG-E21 | Lỗi: EMPLOYEE_VERSION_CONFLICT | EMPLOYEE_VERSION_CONFLICT | Mới / Mới | Thông tin nhân viên đã thay đổi. Tải lại trước khi lưu. | [UC-PERM-03](usecases.md) | TC20/TC42/TC59 |
| PMSG-E22 | Lỗi: PERMISSION_CATALOG_STALE | PERMISSION_CATALOG_STALE | Mới / Mới | Danh mục quyền đã thay đổi. Tải lại trước khi lưu. | [UC-PERM-03](usecases.md) / [UC-PERM-04](usecases.md) | TC20 |
| PMSG-E23 | Lỗi: ADMIN_REQUEST_REUSED | ADMIN_REQUEST_REUSED | Mới / Mới | Mã yêu cầu đã được dùng cho nội dung khác. | [UC-PERM-02](usecases.md) / [UC-PERM-10](usecases.md) | TC12/TC23 |
| PMSG-E24 | Lỗi: PERMISSION_UPDATE_UNAVAILABLE | PERMISSION_UPDATE_UNAVAILABLE | Mới / Mới | Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại. | [UC-PERM-02](usecases.md) / [UC-PERM-07](usecases.md) / [UC-PERM-08](usecases.md) | TC10/TC11/TC12/TC21/TC59 |
| PMSG-E25 | Lỗi: PERMISSION_REFRESH_UNAVAILABLE | PERMISSION_REFRESH_UNAVAILABLE | Mới / Mới | Chưa xác minh được quyền. Kiểm tra kết nối và thử lại. | [UC-PERM-01](usecases.md) / [UC-PERM-12](usecases.md) | TC03/TC32/TC59 |
| PMSG-E26 | Lỗi: OWNER_MIGRATION_REVIEW_REQUIRED | OWNER_MIGRATION_REVIEW_REQUIRED | Mới / Mới | Chưa xác định được chủ quán. Cần xác minh ánh xạ trước khi chuyển đổi. | [UC-PERM-14](usecases.md) | TC49 |
| PMSG-E27 | Lỗi: OWNER_RECOVERY_REVIEW_REQUIRED | OWNER_RECOVERY_REVIEW_REQUIRED | Mới / Mới | Chưa đủ căn cứ khôi phục chủ quán. Cần xác minh hồ sơ hỗ trợ. | [UC-PERM-08](usecases.md) | TC58 |
| PMSG-E28 | Lỗi: BOOTSTRAP_CONFLICT | BOOTSTRAP_CONFLICT | Mới / Mới | Cửa hàng đã được khởi tạo; không thể thay chủ quán bằng thao tác này. | [UC-PERM-14](usecases.md) | TC52 |
| PMSG-E29 | Lỗi: Owner self-change: currentPin sai | INVALID_PIN | Có / Mới | PIN hiện tại không đúng. | [UC-PERM-07](usecases.md) | TC10/TC59 |
| PMSG-E30 | Lỗi: Ảnh sai loại | UNKNOWN | Có / Có | Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP. | [menuImagePort:24](D:/Workspace/pos-cafe/src/adapters/supabase/menuImagePort.ts:24); [menuImageDraft:25](D:/Workspace/pos-cafe/src/features/admin/menuImageDraft.ts:25) | TC45 |
| PMSG-E31 | Lỗi: Ảnh quá 5MiB | UNKNOWN | Có / Có | Ảnh món tối đa 5MB. | [menuImagePort:28](D:/Workspace/pos-cafe/src/adapters/supabase/menuImagePort.ts:28); [menuImageDraft:29](D:/Workspace/pos-cafe/src/features/admin/menuImageDraft.ts:29) | TC45 |
| PMSG-E32 | Lỗi: Field name rỗng | INVALID_EMPLOYEE_REQUEST; field name | Mới / Có | Tên nhân viên không được để trống. | [employeeDrawerFlow:102](D:/Workspace/pos-cafe/src/features/admin/employeeDrawerFlow.ts:102) | TC19/TC59 |
| PMSG-E33 | Lỗi: Field name quá 120 code points | INVALID_EMPLOYEE_REQUEST; field name | Mới / Mới | Tên nhân viên tối đa 120 ký tự. | Design2.2; [UC-PERM-02](usecases.md) | TC19/TC59 |
| PMSG-E34 | Lỗi: Field PIN không đúng sáu số ASCII | INVALID_EMPLOYEE_REQUEST; field pin | Mới / Thay chuỗi hiện có | PIN phải gồm đúng 6 chữ số. | [employeeDrawerFlow:108](D:/Workspace/pos-cafe/src/features/admin/employeeDrawerFlow.ts:108) hiện là 4–6 chữ số | TC09/TC19/TC59 |
| PMSG-E35 | Lỗi: Confirm PIN không khớp | Validation UI; field confirmPin | Không áp dụng / Có | Xác nhận PIN không khớp. | [employeeDrawerFlow:110](D:/Workspace/pos-cafe/src/features/admin/employeeDrawerFlow.ts:110) | TC19/TC59 |
| PMSG-S01 | Trạng thái: No-op thường | — | Không áp dụng / Thay chuỗi hiện có | Không có thay đổi để lưu. | [MenuEditorDrawer:248](D:/Workspace/pos-cafe/src/app/drawers/admin/MenuEditorDrawer.tsx:248); [FloorEditorDrawer:239](D:/Workspace/pos-cafe/src/app/drawers/admin/FloorEditorDrawer.tsx:239) hiện là Không có thay đổi cần lưu. | TC20/TC59 |
| PMSG-S02 | Trạng thái: PIN mới trùng PIN hiện tại | — | Không áp dụng / Mới | PIN mới trùng PIN hiện tại; không có thay đổi. | [UC-PERM-07](usecases.md) | TC10/TC59 |
| PMSG-S03 | Trạng thái: Nút in lại disabled: đơn void, actor đủ quyền | — | Không áp dụng / Mới | Đơn đã hủy không thể in lại hóa đơn. | [PERM-04](specs/access-control/spec.md); [UC-PERM-11](usecases.md) | TC38 |
| PMSG-S04 | Trạng thái: Thu hồi quyền làm đóng phần đang thao tác | — | Không áp dụng / Mới | Quyền của bạn đã thay đổi. Phần đang thao tác không còn được phép đã đóng; dữ liệu chưa lưu của phần đó đã được bỏ. | [PERM-25](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md) | TC34/TC59 |
| PMSG-S05 | Trạng thái: Mất quyền in, preview vẫn có quyền đọc | — | Không áp dụng / Mới | Quyền in hóa đơn đã thay đổi. Bạn vẫn có thể xem hóa đơn. | [UC-PERM-11](usecases.md) / [UC-PERM-12](usecases.md); Q15 | TC36/TC60 |
| PMSG-OK01 | Thành công: Create employee applied | — | Không áp dụng / Thay chuỗi hiện có | Đã tạo nhân viên. | [EmployeesDrawer:189](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:189) hiện thiếu dấu chấm; [UC-PERM-02](usecases.md) | TC05/TC56/TC59 |
| PMSG-OK02 | Thành công: Lưu tên/role employee applied | — | Không áp dụng / Thay chuỗi hiện có | Đã lưu nhân viên. | [EmployeesDrawer:212](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:212) hiện thiếu dấu chấm; [UC-PERM-03](usecases.md) | TC06/TC59 |
| PMSG-OK03 | Thành công: Lưu overrides applied | — | Không áp dụng / Mới | Đã cập nhật quyền nhân viên. | [UC-PERM-04](usecases.md) | TC07/TC56 |
| PMSG-OK04 | Thành công: Tạm khóa employee applied | — | Không áp dụng / Mới | Đã tạm khóa nhân viên. | [UC-PERM-05](usecases.md); [EmployeesDrawer:212](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:212) trước dùng thông báo lưu chung | TC08 |
| PMSG-OK05 | Thành công: Mở khóa employee applied | — | Không áp dụng / Mới | Đã mở khóa nhân viên. | [UC-PERM-05](usecases.md); [EmployeesDrawer:212](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:212) trước dùng thông báo lưu chung | TC08 |
| PMSG-OK06 | Thành công: Reset PIN nhân viên khác applied | — | Không áp dụng / Thay chuỗi hiện có | Đã đặt lại PIN. Nhân viên cần đăng nhập lại. | [EmployeesDrawer:212](D:/Workspace/pos-cafe/src/app/drawers/admin/EmployeesDrawer.tsx:212) trước gộp Đã lưu nhân viên và đặt lại PIN; [UC-PERM-06](usecases.md) | TC09/TC59 |
| PMSG-OK07 | Thành công: Owner tự đổi PIN applied | — | Không áp dụng / Mới | Đã đổi PIN. Vui lòng đăng nhập lại. | [UC-PERM-07](usecases.md); [PERM-21](specs/employee-session/spec.md) | TC10/TC59 |
| PMSG-OK08 | Thành công: Clear demo applied | — | Không áp dụng / Thay chuỗi hiện có | Đã xóa dữ liệu mẫu. | [ClearDemoDialog:29](D:/Workspace/pos-cafe/src/app/drawers/admin/ClearDemoDialog.tsx:29) trước là Đã đặt lại dữ liệu mẫu; Q3 / [UC-PERM-10](usecases.md) | TC12 |
| PMSG-OK09 | Thành công: Lưu thay đổi module thành công theo UC09 | — | Không áp dụng / Thay chuỗi hiện có | Đã lưu thay đổi. | [UC-PERM-09](usecases.md); [MenuEditorDrawer:261](D:/Workspace/pos-cafe/src/app/drawers/admin/MenuEditorDrawer.tsx:261) / [FloorEditorDrawer:251](D:/Workspace/pos-cafe/src/app/drawers/admin/FloorEditorDrawer.tsx:251) / [GeneralSettingsDrawer:99](D:/Workspace/pos-cafe/src/app/drawers/admin/GeneralSettingsDrawer.tsx:99) / [PaymentSettingsDrawer:56](D:/Workspace/pos-cafe/src/app/drawers/admin/PaymentSettingsDrawer.tsx:56) | TC25/TC56 |
| PMSG-OK10 | Thành công: Print command đã dispatch tới browser | — | Không áp dụng / Mới | Đã gửi lệnh in. | [UC-PERM-11](usecases.md); design5.3/Q15 | TC60 |

Phân công variant: T12 kiểm consumer employee cho TC05–10/14/19/20/59; T13 kiểm consumer module/clear cho TC12/25/56; T11 kiểm refresh/thu hồi cho TC03/32/34/59; T14 kiểm receipt cho TC36/38/60. T09 kiểm hai lỗi ảnh trong TC45, T13 nối consumer ảnh. Các error RPC/provisioning/preflight còn lại do TC được ghi ở bảng và task cung cấp endpoint chịu trách nhiệm; test API không thay cho variant message UI nếu flow có UI. T15/T16 chỉ nhận toàn TC PASS sau khi mọi variant bắt buộc đã chạy trên đúng source/profile.

TC59 giữ nguyên truy vết UC02/03/06/07/12, chỉ kiểm các dòng gắn TC59; không nhận thông báo của UC04/05/09/10/11 vào TC59 để lấp coverage. TC57 kiểm ID/dòng phân loại giữa design/M0 và các nguồn UC/delta được chỉ định, không gom mọi chuỗi ngoặc kép như tên Mai/Cà phê An hoặc nhãn Thử lại. Với PMSG-E20, fixture đặt nhãn report.view là Xem báo cáo và thay danh sách theo code tăng dần; không đưa quyền target khác store hoặc secret vào details/UI.

## 3. Gate tương lai và giới hạn bằng chứng

**Trạng thái hiện tại:** T01–T03 đã nghiệm thu theo phạm vi đầu tài liệu; T04 trở đi chưa bắt đầu. Full Supabase dùng cho bridge và SQL/core parity, Storage/Realtime mới có health, chưa chạy hành vi gateway/hội tụ. Chưa commit/push/live-store operation.

| Gate | Môi trường / phạm vi | Điều kiện đánh giá |
| --- | --- | --- |
| Unit/giao diện | Node 24.16.0; fake timer, mock ports, fresh QueryClient | TC01/04/19/31/57 và các TC giao diện; chứng minh logic/timing xác định, không chứng minh DB/Realtime/Storage thật |
| Observer T01 | Chỉ PostgreSQL thật cách ly qua DSN + profile/marker; không API URL/anon key/store JWT/employee token, không Auth/REST calls | TC48 phần preflight, TC49 và expected-only oracle TC50; database/marker/engine/store_ids/checksum/private-schema guards, snapshot trước/sau chỉ đọc |
| DB/Auth/REST | Profile legacy/bridge/candidate/transition cách ly có marker; đúng DB/Auth/REST mà ca sử dụng và service binding đã xác minh | RPC, grants, raw SELECT/DML, transactions, audit, migration, concurrency và protocol v1; không áp yêu cầu Auth/REST này cho observer-only T01 |
| Storage | Runtime cách ly có Storage API và gateway thật | TC45–47; HTTP bypass và object GET/list/publication thật; thiếu service → BLOCKED, TC NOT RUN |
| Realtime | Runtime cách ly có Realtime thật, positive subscription control | TC29/30/55 theo service cần dùng; payload WebSocket, tenant ACL và hội tụ. Runtime WSL phase 27 thiếu Realtime không đáp ứng |
| E2E candidate | Full local Supabase cách ly, client thuộc cùng sourceFingerprint; backend đúng executionProfile | Các TC E2E; backend type/URL/project marker được kiểm, không chạy mock rồi báo Supabase PASS |
| Biên bản operator | Runbook và hồ sơ synthetic trong cách ly | TC11/58 chỉ kiểm contract; xác minh người thật/bàn giao PIN thật phải có bằng chứng vận hành riêng khi được phép |

Môi trường mục tiêu cho gate service là **full local Supabase CLI/image phiên bản cố định trên Docker-compatible runtime trong WSL2**, có PostgreSQL, Auth, PostgREST, Storage, Realtime và Edge runtime thật. Đã provision trong T02 theo [biên bản T02](../../../docs/implementation-log/permission-t02-catalog-bridge-2026-09-15.md). T02 giao manifest CLI/image/config/ports/project/volume, fixture/marker và service health; T09 thêm gateway candidate và kiểm HTTP/Storage roundtrip trong chính task đó; T10 kiểm Realtime positive control hai client. Các bằng chứng này có trước gate tổng T15, không đòi gateway chưa được viết ở T02. Không gọi catalog shell Storage phase27 là API thật. [Tài liệu CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) dùng DB mặc định `postgres`, trong khi [parser hiện tại:59](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:59) chỉ nhận `pos_cafe_idem_test_*`: profile Supabase cần proof cách ly tương đương qua project/container/volume riêng, loopback, marker/fixture và checksum/schema guards. T01 chỉ kiểm DB observer; service gate mới cần API/observer cùng DB. Không bỏ gate tên DB tổng quát hoặc dùng identity chưa xác minh.

Trước và sau mỗi gate, lưu riêng hai lớp bằng chứng:

| Lớp | Field và quy tắc |
| --- | --- |
| sourceFingerprint | Code SHA; hash bytes nguồn kể cả dirty files được phép; test, scripts, migration/service/client bundle bytes và dependency lockfiles. Một candidate dùng một nguồn đã khóa; thêm/sửa script cũng tạo nguồn mới |
| executionProfile | Loại static/unit/legacy/bridge/candidate/transition; runtime/backend/project/config identity; applied migration hashes, catalog hashes, fixture và command thực tế. Không chứa secret. Static/unit ghi backend không áp dụng, không giả metadata của DB chưa chạy |
| TC → execution manifest | Mỗi TC và variant trỏ sourceFingerprint cùng executionProfile hợp lệ, trạng thái, report và assertion thực tế. Transition ghi từng pha trước/sau và bundle thực thi; khác trạng thái DB theo pha không được gọi là khác source |

TC49 dùng legacy; TC50 dùng bridge; TC48/51/53/54 có biến thể transition, TC52 kiểm bootstrap trong candidate/transition theo bước. Những ca protected read/write/raw bypass dùng candidate có đúng ACL của task phụ trách đã áp cho fixture. T05/T07/T08/T09 chịu trách nhiệm tạo/áp phần DDL candidate cần cho nghiệm thu cách ly; không đợi activation live. Một TC chỉ được đánh PASS khi mọi biến thể bắt buộc đã chạy trên đúng profile; component/new-consumer hoặc preflight riêng chỉ là bằng chứng một phần.

T15 gom **55 TC: TC01–47, TC49/50, TC55–60** với cùng sourceFingerprint và executionProfile tường minh; TC48/51–54 toàn phần ghi PENDING-T16. T16 bổ sung activation scripts làm sourceFingerprint đổi, nên phải chạy lại gate đầy đủ **TC01–60** trên nguồn mới và profile đúng từng ca. Không yêu cầu một DB trạng thái cố định chạy cả legacy, bridge và candidate. Các execution service/security trong gate tổng dùng cùng full Supabase candidate deployment và fixture lineage được ghi nhận; không ghép DB/Auth/REST native cũ với Storage/Realtime của backend khác để tuyên bố đủ gate. Source drift, sai profile/backend hoặc report cũ đều làm gate không hợp lệ.

Manifest phải liệt kê TC bắt buộc và từng biến thể. Gate thất bại khi thiếu file/test bắt buộc, có skip/only/retry/expected-failure, thiếu execution report hoặc số liệu không khớp. Đếm TC unique, executions và assertions từ dữ liệu thật; chạy lặp chẩn đoán không tăng số TC nghiệp vụ. Báo cáo nêu phạm vi coverage đo được và phần không đo; không dùng coverage dòng làm chứng minh mọi scenario nhạy cảm.

DB fixture reset không chạy song song trên cùng DB. Chỉ ca race có connection đồng thời, do một harness kiểm soát barrier/timeout và cleanup. Xác minh marker/environment trước reset; không dùng .env.local hoặc smoke:supabase lên cửa hàng thật. Không dựng runtime chỉ để hoàn thiện spec.

Tái sử dụng parser/env loader, hash nguồn, caseManifest/discovery/verify-results và các kiểm tra thuần của harness phase27. Không gọi nguyên [preflight():108](D:/Workspace/pos-cafe/tests/contracts/preflight.ts:108) trong công cụ T01 chỉ đọc: nó cấp phiên rồi thu hồi ở dòng127. Tách ObserverEnvironment/parser và observerPreflight dùng chung; giữ parse/API behavior phase27 trong wrapper hiện tại. T01 không cần hoặc nhận khóa Auth/REST, không probe cấp/revoke session. Fixture setup có mutation là bước riêng trước snapshot. Observer checks giữ current_database, marker/engine/store_ids, file migration checksums so marker, không store ngoài fixture và private-schema guards. Checksum khớp marker không chứng minh schema/grants hiện hành chưa bị sửa ngoài migration; vẫn đọc catalog/schema inventory thật. Chỉ các service gate mới kiểm API/observer binding. Output mới dùng field whitelist, không serialize toàn row/exception: [redactor cũ:7](D:/Workspace/pos-cafe/scripts/idempotency-redact-artifacts.mjs:7) chưa tự bảo đảm lọc mọi PIN/hash/MAC.

Output T01 dự kiến ở `artifacts/permissions/t01/<runId>/{inventory,preflight,bridge-oracle,manifest}.json`, mỗi file có schemaVersion/runId, sourceFingerprint, executionProfile, fixture/store identity, trạng thái/lý do, evidence source và kết quả từng biến thể; không PIN/hash/token/DSN/MAC thô. T01 chỉ nghiệm thu phần preflight của TC48, TC49 và bộ expected độc lập 6.144 hồ sơ của TC50; không đánh TC48/50 toàn phần PASS. Preflight/mapping cửa hàng thật thuộc chuẩn bị phát hành được yêu cầu riêng sau rehearsal, không lấy mapping synthetic này thay bằng chứng vận hành.

### Negative controls bắt buộc cho các ràng buộc nhạy cảm

| Mutation có chủ đích trong kiểm thử cách ly | TC phải phát hiện |
| --- | --- |
| Tin actorId/role từ body hoặc bỏ auth cuối sau chờ | TC28/39/40/41 |
| Bỏ ceiling-before, ceiling-after hoặc tính inactive target là tập rỗng | TC15/16/17 |
| Role no-op xóa denies, hoặc normalize theo catalog cũ | TC04/20 |
| Ghi audit rồi RAISE rollback denied; bỏ transaction audit/effect | TC21/22/23 |
| Cấp SELECT raw hoặc publish order/payment payload | TC26/27/29 |
| Nhận purpose=initial hoặc tạo grant mới từ K replay | TC37/60 |
| Tiêu hao grant sau authorize, chặn PR mới trong preview còn quyền, hoặc callback PR đã dispatch in lần nữa | TC37/60 |
| Public staging trước finalize, bỏ auth sau staging hoặc nhận key arbitrary | TC45/46/47 |
| Bỏ session generation/revision check, chỉ invalidate cache thay vì purge | TC32/33/34/36/60 |
| Lấy authority SHARE trước business lock trong financial | TC40/44 |
| UUID tie-break owner hoặc restore backup làm mất giao dịch mới | TC49/53 |

Đây là mutation/negative-control dự kiến, chưa chạy; không sửa code production để giữ mutation. Một control phải khiến assertion tương ứng fail, không chỉ khiến test timeout ngẫu nhiên.

### Bằng chứng phase 27 có thể kế thừa làm baseline

[writeConcurrency.contract.test.ts:107](D:/Workspace/pos-cafe/tests/contracts/writeConcurrency.contract.test.ts:107) là nguồn tình huống revoke khi chờ lock. [ReceiptPrintLifecycle.test.tsx:45](D:/Workspace/pos-cafe/src/app/components/ReceiptPrintLifecycle.test.tsx:45) là nguồn bảo vệ callback in theo lifetime. [menuImagePort.ts:6](D:/Workspace/pos-cafe/src/adapters/supabase/menuImagePort.ts:6) xác nhận loại ảnh và giới hạn 5MiB hiện hành. Các nguồn này không chứng minh implementation mới đã pass và không được tính như execution của 60 TC bên dưới.

## 4. Danh sách test case

### TC-PERM-01 — Đối chiếu năm vai trò và ma trận 15 quyền

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-02](specs/access-control/spec.md), [PERM-10](specs/access-control/spec.md), [PERM-11](specs/access-control/spec.md); [UC-PERM-01](usecases.md) |
| **Mức** | đơn vị |
| **Nhóm** | chính |
| **Tiền điều kiện** | Catalog của candidate đã được nạp vào fixture F0; chưa áp dụng overrides. |
| **Dữ liệu thử** | Năm role candidate; D0 ở trên có 60 ô cho bốn role hoạt động, cộng 15 ô Không của kitchen thành 75 ô; fixture A có overrides được kiểm riêng, không tính thành role thứ sáu. |

**Các bước**

1. Đọc role, permission và defaults từ catalog cần kiểm tra.
2. Tính quyền cấu hình của từng role không có overrides; so từng mã với các tập D0 đã viết độc lập.
3. Kiểm selectable/enabled và tìm các mã nằm ngoài D0.

**Kết quả mong đợi**

- Đúng 5 role và 15 mã. Owner có 15, manager 12, cashier 7, waiter 3; kitchen có tập rỗng và không được chọn hoặc mở phiên.
- Mọi ô khớp D0; không có role accountant hoặc default gắn role đó; không có data.wipe, store.key.rotate hoặc quyền chuyển bàn, gộp bàn, giảm giá tương lai. Không chỉ kiểm tổng số quyền.

**Nơi hiện thực:** T03: [permissionCatalog.test.ts](D:/Workspace/pos-cafe/src/core/permissionCatalog.test.ts:1) kiểm75 ô/defaults/role flags; [permissionFoundation.contract.test.ts](D:/Workspace/pos-cafe/tests/contracts/permissionFoundation.contract.test.ts:1) so seed và catalog SQL thực. T02 còn [SQL bridge test](D:/Workspace/pos-cafe/tests/contracts/permissionBridge.contract.test.ts:1). Entry point đăng nhập role mới thuộc T04/TC02, không lấy unit/mock thay server gate.

### TC-PERM-02 — Đăng nhập, danh sách trước PIN và authority trước app shell

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-15](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md); [UC-PERM-01](usecases.md) |
| **Mức** | E2E |
| **Nhóm** | chính, ngoại lệ, bảo mật |
| **Tiền điều kiện** | Store S1 đã ghép; chạy riêng từng biến thể C active, C inactive và nhân viên KITCH role kitchen. |
| **Dữ liệu thử** | PIN thử 384729; PIN sai 384728; promise tải authority được giữ lại bằng barrier. |

**Các bước**

1. Đọc roster khi chưa có employee session, rồi thử đăng nhập C với PIN đúng và sai.
2. Dựng lại C inactive, rồi gọi start session trực tiếp; làm tương tự với KITCH. Trên fixture khác, cấp token khi C active rồi deactivate/revoke C và gọi protected RPC bằng token cũ.
3. Với C hợp lệ, giữ response authority chưa trả và quan sát shell/cache; sau đó trả snapshot, tải lại trang và khóa phiên.

**Kết quả mong đợi**

- Roster chỉ có id/name của nhân viên active thuộc role enabled; không có role, overrides, hash hoặc token.
- C đúng PIN chỉ vào shell sau authority đã xác minh. Sai PIN hoặc bắt đầu phiên khi C inactive nhận INVALID_PIN; KITCH nhận EMPLOYEE_ROLE_UNAVAILABLE. Protected request dùng token cũ đã bị thu hồi nhận EMPLOYEE_SESSION_REQUIRED, không nhầm với lỗi bắt đầu phiên.
- Trong lúc authority chờ không render dữ liệu được bảo vệ. Reload hoặc khóa phiên về màn PIN, không hiện cache của phiên trước.

**Nơi hiện thực:** T07 floor baseline + minimal summary, không paid/items/payment. UI navigation còn T13. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-03 — Sơ đồ nền và điều hướng theo quyền

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-03](specs/access-control/spec.md), [PERM-04](specs/access-control/spec.md), [PERM-10](specs/access-control/spec.md), [PERM-11](specs/access-control/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-09](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | chính, bảo mật |
| **Tiền điều kiện** | Mỗi biến thể dùng QueryClient và authority đã xác minh riêng của F0. |
| **Dữ liệu thử** | A theo overrides F0; C bị deny sáu quyền tùy biến mặc định; C được grant menu.manage; M đang mở report rồi bị deny report.view.; refresh authority quá timeout 5 giây hoặc lỗi mạng khi mở module. |

**Các bước**

1. Đăng nhập từng fixture và kiểm nav, nội dung được mount, query được gọi.
2. Thử gọi action trực tiếp khi nút tương ứng bị ẩn.
3. Áp snapshot mới của M khi đang mở report.
4. Giữ snapshot authority không trả quá 5 giây, rồi trả lỗi mạng; quan sát module và hành động.

**Kết quả mong đợi**

- A thấy sơ đồ, lịch sử và báo cáo; không sửa sơ đồ hoặc in lại. C chỉ còn floor.view vẫn xem sơ đồ, không có nút ghi đơn/thanh toán.
- Menu editor chỉ mở cho fixture được cấp menu.manage; quyền đó không mở employee/settings. Thiếu quyền thì phần tử không tồn tại trong DOM.
- Mất report.view đóng report, xóa dữ liệu không còn được đọc và trở về sơ đồ; không đổi phiên hoặc tự logout.
- Authority không xác minh được nhận PERMISSION_REFRESH_UNAVAILABLE theo M0; không mount hoặc gửi protected query/action mới, không coi lỗi mạng là logout.

**Nơi hiện thực:** T07 getStoreDisplay/floor operational không mở admin projection; consumer menu/UI còn T13. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-04 — Chuẩn hóa overrides và biên payload

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-08](specs/access-control/spec.md); [UC-PERM-04](usecases.md) |
| **Mức** | đơn vị |
| **Nhóm** | biên, bảo mật |
| **Tiền điều kiện** | Catalog revision 11; các tập mặc định D0 được dùng làm oracle độc lập. |
| **Dữ liệu thử** | Patch không có overrides; null; {}; {grants:[],denies:[]}; hai grant order.voidPaid trùng; grant và deny cùng mã; array 100/101 phần tử; mã x.invalid; giá trị sai kiểu. |

**Các bước**

1. Chuẩn hóa từng payload; so quyền cấu hình và sources với kết quả viết sẵn cho từng biến thể.
2. Thử grants/denies không phải array, phần tử không phải string, object thiếu arrays, array vượt 100 phần tử.
3. Thử deny floor.view và grant data.clearDemo cho C.

**Kết quả mong đợi**

- Thiếu trường patch giữ nguyên; null là reset; arrays rỗng hợp lệ. {} không phải object có đủ hai arrays nên INVALID_EMPLOYEE_REQUEST. Trùng mã được khử và sắp xếp; grant/deny cùng mã không tạo quyền hiệu lực.
- 100 phần tử đầu vào được khử trùng trước giới hạn 15 mã; 101 phần tử bị từ chối. Sai kiểu/mã lạ nhận INVALID_EMPLOYEE_REQUEST.
- Deny floor.view nhận PERMISSION_BASELINE_REQUIRED; grant quyền owner-only sai role nhận OWNER_ONLY_PERMISSION. Không lưu overrides bị cấm rồi bỏ qua ở UI.

**Nơi hiện thực:** T03: [permissionOverrides.test.ts](D:/Workspace/pos-cafe/src/core/permissionOverrides.test.ts:1), [permissionInputs.test.ts](D:/Workspace/pos-cafe/src/core/permissionInputs.test.ts:1), [permissionFoundation.contract.test.ts](D:/Workspace/pos-cafe/tests/contracts/permissionFoundation.contract.test.ts:1) kiểm normalization/shape/presence/bounds và parity SQL. Mutation composition/field authority/audit server tiếp ở T05; UI về sau.

### TC-PERM-05 — Tạo nhân viên với snapshot trước bằng null

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-05](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-15](specs/employee-management/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-18](specs/employee-management/spec.md); [UC-PERM-02](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính |
| **Tiền điều kiện** | O có phiên hợp lệ tại S1; E-new chưa tồn tại. |
| **Dữ liệu thử** | E-new; tên Mai; role cashier; PIN mới 927416; request R(05). Biến thể request mới yêu cầu role owner. |

**Các bước**

1. Gọi create_employee_admin không gửi overrides.
2. Đọc bản ghi nhân viên, revision và audit bằng O.
3. Gửi lại nguyên request sau khi mô phỏng mất ACK lần đầu.
4. Trên fixture sạch, thử create_employee_admin với role owner khi S1 đã có O.

**Kết quả mong đợi**

- Chỉ có một E-new, active=true, role cashier, overrides=null, permission_revision=0 và quyền mặc định D0-C.
- Chỉ một audit applied, before=null; actualAfter là nhân viên vừa tạo. Output/audit không có PIN, hash hoặc MAC.
- Replay không thêm nhân viên, audit hoặc hiệu ứng khác; UI chỉ thông báo tạo thành công khi outcome đã được xác nhận.
- Tạo thêm owner bằng CRUD nhận OWNER_PROTECTED; E-new không được tạo, O giữ nguyên, không có cửa hàng hai owner.

**Nơi hiện thực:** T05 kiểm create/replay, role owner/kitchen/unknown, trần after và collision; UI form T12 chưa nối. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-06 — Đổi vai trò thực sự đặt lại overrides

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-08](specs/access-control/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-03](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính |
| **Tiền điều kiện** | O quản trị C tại S1; C revision 7, grant report.view và deny payment.take. |
| **Dữ liệu thử** | Patch role=waiter; expectedRevision=7; expectedCatalogRevision=11; R(06). |

**Các bước**

1. Gửi cập nhật role qua RPC.
2. Đọc lại nhân viên, quyền hiệu lực, phiên C, audit và signal.

**Kết quả mong đợi**

- C thành waiter, overrides=null, đúng D0-W gồm floor.view/order.create/order.update; revision tăng từ 7 lên 8.
- Phiên C còn hợp lệ; role change không tự revoke token. Audit ghi đúng before/proposedAfter/actualAfter và một signal thay đổi.
- Ceiling dùng tập quyền sau reset và áp bộ mới (nếu có), không dùng tập quyền từ form trước khi đổi role.
- Biến thể cùng lần lưu role=waiter, overrides mới grant report.view/deny order.create: xóa tùy chỉnh cũ, chuẩn hóa bộ mới theo waiter; actor cần cả employee.manage và employee.permission.edit; before/after ceiling vẫn bắt buộc.

**Nơi hiện thực:** T05 kiểm reset overrides cũ khi role đổi, áp bộ mới rõ trong cùng lần lưu, ceiling và revision/signal nguyên tử; UI T12 còn lại. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-07 — Ủy quyền quản trị và cấp riêng quyền in lại cho nhân viên chỉ xem

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-05](specs/access-control/spec.md), [PERM-08](specs/access-control/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-04](usecases.md), [UC-PERM-11](usecases.md) |
| **Mức** | E2E |
| **Nhóm** | chính, bảo mật |
| **Tiền điều kiện** | O, A và M mở các tab riêng; mỗi tab đã xác minh authority; P đã paid. |
| **Dữ liệu thử** | O grant receipt.reprint cho A; grant employee.permission.edit và settings.manage cho M; hai request riêng. |

**Các bước**

1. O gửi từng yêu cầu cấp quyền và chờ hội tụ theo gate Q9.
2. A mở lịch sử P, chọn in lại chủ động; thử thanh toán và execute/cancel một K.
3. M mở phần chỉnh quyền và settings; kiểm quyền các nhân viên khác.

**Kết quả mong đợi**

- A xem và in lại P sau khi được grant, nhưng không có payment.take và không tiếp quản/execute/cancel K thanh toán.
- M mở editor quyền và settings nhưng vẫn không có data.clearDemo. Không nhân viên khác nào được thay defaults hoặc overrides.
- Không in tự động do signal, refresh hoặc receipt response.

**Nơi hiện thực:** T05 kiểm override normalization, mixed field authority và trần quyền; UI chọn/reset quyền T12 còn lại. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-08 — Khóa, mở khóa và hiệu lực phiên đã thu hồi

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-14](specs/employee-management/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md); [UC-PERM-05](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính, bảo mật |
| **Tiền điều kiện** | O quản trị C active có hai phiên C-s1/C-s2 tại S1. |
| **Dữ liệu thử** | Hai request đổi isActive=false rồi true, mỗi request dùng revision hiện hành. Biến thể expectedRevision=6 khi target revision 7; fault injection insert audit trước commit. |

**Các bước**

1. Khóa C và thử read/write được bảo vệ bằng cả hai token cũ.
2. Mở khóa C; thử lại hai token cũ.
3. Đăng nhập lại C bằng PIN đúng và dùng token mới.
4. Trên các fixture sạch, gửi active patch với revision stale; sau đó dùng revision đúng nhưng làm audit insert lỗi.

**Kết quả mong đợi**

- Khóa C thu hồi cả hai phiên. Mở khóa không bỏ revoked_at, nên cả hai token cũ vẫn nhận EMPLOYEE_SESSION_REQUIRED.
- Role và overrides không đổi. Mỗi lần active thực sự đổi có đúng một audit và một lần tăng revision.
- Sau mở khóa, login mới thành công và token mới hoạt động; không tự đăng nhập lại target từ màn quản trị.
- Revision stale nhận EMPLOYEE_VERSION_CONFLICT và không đổi active/sessions. Lỗi audit nhận PERMISSION_UPDATE_UNAVAILABLE, rollback active, revision, revoke sessions, registry và signal; không audit applied mồ côi.

**Nơi hiện thực:** T05 kiểm active patch/OCC/audit, revoke mọi phiên khi khóa và không phục hồi phiên cũ khi unlock. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-09 — Đặt lại PIN non-owner nguyên tử và không lặp hiệu ứng

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md); [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính |
| **Tiền điều kiện** | M có employee.manage và quyền trần bao trùm C; C revision 7 có hai phiên. |
| **Dữ liệu thử** | PIN cũ 384729, PIN mới 927416; R(09). Biến thể PIN mới '12345' hoặc expectedRevision=6 khi target revision 7. |

**Các bước**

1. M reset PIN C, rồi kiểm PIN cũ/PIN mới và hai token đã cấp trước reset.
2. Đọc audit/revision bằng O.
3. Replay nguyên R(09) sau mất ACK giả lập.
4. Trên fixture sạch, lần lượt gửi PIN sai định dạng và request có revision stale.

**Kết quả mong đợi**

- PIN mới đăng nhập được, PIN cũ nhận INVALID_PIN; cả hai token cũ bị thu hồi. Không tự mở phiên cho C.
- Một reset, một audit applied, một lần tăng revision. Replay không băm PIN lại, không đổi hash và không thu hồi thêm phiên mới.
- PIN/hash/token/MAC không xuất hiện trong output, audit hoặc log thu thập của harness.
- PIN năm số nhận INVALID_EMPLOYEE_REQUEST với câu field 'PIN phải gồm đúng 6 chữ số.'; revision stale nhận EMPLOYEE_VERSION_CONFLICT. Cả hai giữ PIN, phiên và revision, không echo PIN.

**Nơi hiện thực:** T05 kiểm reset non-owner, ceiling, PIN no-op, replay không đổi hash/revoke lần hai, OCC và audit. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-10 — Owner tự đổi PIN sau khi xác minh PIN hiện tại

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md), [PERM-21](specs/employee-session/spec.md); [UC-PERM-07](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính, ngoại lệ |
| **Tiền điều kiện** | O revision 7 có hai phiên; mỗi biến thể bắt đầu từ fixture mới. |
| **Dữ liệu thử** | currentPin=384729/newPin=927416; currentPin sai 384728; biến thể newPin=currentPin. Biến thể PIN năm số; expectedRevision=6; token đã revoked; fault injection audit insert. |

**Các bước**

1. Gửi self-change với currentPin sai.
2. Dựng lại fixture, đổi PIN đúng rồi thử PIN và mọi token cũ.
3. Dựng lại fixture, gửi PIN mới trùng PIN hiện tại và replay cùng request.
4. Trên fixture riêng cho từng biến thể, gọi self-change với PIN sai định dạng, revision stale hoặc token revoked; cuối cùng làm audit insert lỗi trong một request hợp lệ.

**Kết quả mong đợi**

- Sai currentPin nhận INVALID_PIN với câu 'PIN hiện tại không đúng.'; không đổi PIN, revision hoặc phiên.
- Đổi đúng ghi audit applied và thu hồi mọi phiên O cũ; giữ role/overrides/owner identity.
- PIN trùng trả noop, một audit noop, không đổi hash/revision/phiên; thông báo 'PIN mới trùng PIN hiện tại; không có thay đổi.'.
- Các biến thể trả lần lượt INVALID_EMPLOYEE_REQUEST, EMPLOYEE_VERSION_CONFLICT, EMPLOYEE_SESSION_REQUIRED và PERMISSION_UPDATE_UNAVAILABLE. Không đổi PIN/revision hoặc thu hồi thêm phiên; lỗi hạ tầng rollback cả audit/registry/signal.

**Nơi hiện thực:** T04 kiểm self PIN RPC, currentPin sai, noop, denied audit, replay, invalid/stale/revoked và rollback audit/signal/registry; mock/adapter và generation cũng có unit tests. UI thuộc T12. [Suite T04](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md).

### TC-PERM-11 — Khôi phục owner qua operator có hồ sơ xác minh

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md), [PERM-22](specs/employee-session/spec.md); [UC-PERM-08](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính |
| **Tiền điều kiện** | Role hạ tầng thử nghiệm được grant đúng recovery contract trên DB cách ly; O là owner active duy nhất. |
| **Dữ liệu thử** | operatorRef=op-test; caseRef=case-test-001; hồ sơ fixture đã xác minh; newPin=927416; R(11). Biến thể audit insert lỗi trước commit. |

**Các bước**

1. Gọi recovery bằng role hạ tầng với đúng store/owner/operator/case.
2. Replay nguyên request.
3. Đọc owner, trạng thái các phiên cũ, audit và hash dữ liệu tài chính/ledger.
4. Trên fixture sạch, inject lỗi audit insert rồi gọi recovery hợp lệ và đọc lại PIN/sessions/owner.

**Kết quả mong đợi**

- Chỉ một thay đổi PIN và một audit actorType=operator, ghi op-test/case-test-001; không giả actor là employee owner.
- Phiên cũ bị thu hồi; owner role, overrides, S1, tài chính, K và R1 giữ nguyên.
- Kết quả chứng minh contract DB với hồ sơ synthetic; không chứng minh đã xác minh con người hoặc bàn giao PIN cửa hàng thật.
- Lỗi audit trả PERMISSION_UPDATE_UNAVAILABLE; rollback PIN và mọi revoke/revision, không ghi kết quả recovery thành công hoặc audit applied mồ côi.

**Nơi hiện thực:** T04 kiểm recovery bằng role operator synthetic, replay không đổi PIN lần hai, rollback và giữ business/ledger. Chưa xác minh con người hoặc bàn giao PIN thật. [Suite T04](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md).

### TC-PERM-12 — Xóa dữ liệu mẫu và giữ rào chắn đơn mở

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-05](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-10](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính, ngoại lệ |
| **Tiền điều kiện** | O; F0 có demo/custom entities, demo cashier active, owner chính, tài chính và ledger; X còn open. |
| **Dữ liệu thử** | Hai lượt clear: khi X open và sau khi X được đóng bằng protocol hợp lệ. Biến thể token O đã revoked; lỗi audit trong lượt clear có thay đổi identity. |

**Các bước**

1. Chụp toàn bộ bảng liên quan; gọi clear_demo_data khi X open.
2. Đóng X theo protocol fixture, chụp baseline mới rồi gọi clear.
3. So custom entities, owner, finance/K/R1/audit và phiên demo trước/sau.
4. Trên fixture không còn open order, thử token O revoked; với token hợp lệ inject lỗi audit khi clear deactivate demo employee.
5. Dùng requestId R(12) cho một lần clear thành công, retry nguyên body/ID sau mất ACK; thử lại cùng ID với confirmation thay đổi và không tạo request mới.

**Kết quả mong đợi**

- Lượt đầu nhận OPEN_ORDERS_BLOCK_CLEAR_DEMO và không có dữ liệu nào bị clear.
- Lượt thành công chỉ tombstone/deactivate đúng dữ liệu mẫu theo baseline; custom entities và owner giữ nguyên.
- Finance, K, R1 và audit cũ giữ nguyên byte/ngữ nghĩa; audit identity mới được thêm nguyên tử. Phiên nhân viên demo bị deactivate được revoke.
- Token revoked nhận EMPLOYEE_SESSION_REQUIRED, không clear. Audit lỗi nhận PERMISSION_UPDATE_UNAVAILABLE; mọi tombstone/deactivate/revoke/revision/registry/signal cùng transaction đều rollback, tài chính và ledger giữ nguyên.
- Retry R(12) nguyên body không thêm effect/audit; cùng ID khác canonical body nhận ADMIN_REQUEST_REUSED, không sửa outcome đầu. Request mới dùng ID khác, không dùng retry để clear thêm dữ liệu mới phát sinh.

**Nơi hiện thực:** [DB contract TC12](D:/Workspace/pos-cafe/tests/contracts/permissionClearDemo.contract.test.ts:1), config `vitest.permission-clear-demo.config.ts`; [browser candidate](D:/Workspace/pos-cafe/tests/supabase/permissionCandidate.spec.ts:1). Đang hoàn thiện trên22/09; kết quả từng lượt và thiếu sót ở [checkpoint](../../../docs/implementation-log/permission-completion-2026-09-22.md). Chưa dùng PASS từng phần để đóng TC12.

### TC-PERM-13 — Quyền xem lịch sử tách khỏi quyền in lại

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-04](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md), [PERM-27](specs/receipt-printing/spec.md); [UC-PERM-11](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính, bảo mật |
| **Tiền điều kiện** | A theo overrides F0 tại S1; P paid chưa void. |
| **Dữ liệu thử** | A có orderHistory.view nhưng không receipt.reprint; sau đó grant rồi deny receipt.reprint. |

**Các bước**

1. Đọc lịch sử và get_payment_receipt(P); gọi prepare_receipt_reprint(P).
2. O grant reprint cho A; sau hội tụ A gọi lại và bấm In.
3. O thu hồi reprint; gọi RPC lại sau commit.

**Kết quả mong đợi**

- A theo overrides F0 đọc được snapshot lịch sử/receipt; prepare-reprint nhận FORBIDDEN và nút in lại bị ẩn.
- Sau grant, A in lại được qua nguồn lịch sử; sau revoke server từ chối request mới.
- Không cấp payment.take, không tạo order/payment/K và không mở quyền tiếp quản thao tác.

**Nơi hiện thực:** T07 receipt read predicate hiện hành/immutable snapshot/void unavailable; print authorization và UI ở T14. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-14 — Bất biến owner và cấm tự sửa quyền

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-13](specs/employee-management/spec.md), [PERM-14](specs/employee-management/spec.md), [PERM-18](specs/employee-management/spec.md), [PERM-19](specs/employee-management/spec.md); [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md), [UC-PERM-05](usecases.md), [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M được cấp mọi mã có thể ủy quyền cho non-owner; O là owner duy nhất. |
| **Dữ liệu thử** | Target O; self M/O; patch tên/role/overrides/active/PIN; create hoặc promote owner thứ hai. |

**Các bước**

1. M gọi mọi admin endpoint và overload công khai còn tồn tại với target O.
2. O và M thử tự sửa role/overrides, tự khóa và self reset qua endpoint quản trị.
3. Thử tạo owner thứ hai hoặc đổi non-owner thành owner.

**Kết quả mong đợi**

- M không sửa được bất kỳ trường owner; nhận OWNER_PROTECTED. Owner vẫn không được tự đổi role/overrides hoặc tự khóa.
- Self role/override nhận SELF_PERMISSION_EDIT_FORBIDDEN; self-disable nhận SELF_DISABLE_FORBIDDEN. Self reset qua admin endpoint nhận FORBIDDEN; self PIN phải dùng contract xác minh currentPin.
- Không nút xác nhận nào vượt được guard server. Sau mọi lần từ chối vẫn đúng một owner active và dữ liệu target không đổi.

**Nơi hiện thực:** T05 kiểm mọi trường owner/self, name-only tự sửa hợp lệ; tạo/promote owner RPC trả OWNER_PROTECTED, giữ đúng một owner active. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-15 — Trần quyền trước thao tác chặn quản trị người mạnh hơn

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-16](specs/employee-management/spec.md); [UC-PERM-03](usecases.md), [UC-PERM-05](usecases.md), [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M bị deny report.view; C được grant report.view. Biến thể unlock dùng C inactive nhưng giữ nguyên tập quyền cấu hình. |
| **Dữ liệu thử** | Đổi C thành waiter, reset PIN C, mở khóa C; ba fixture độc lập. |

**Các bước**

1. M gửi từng thao tác với quyền trường và revision hợp lệ.
2. Đọc C, các phiên và audit bằng O.

**Kết quả mong đợi**

- Cả ba thao tác nhận PERMISSION_CEILING_EXCEEDED với quyền thiếu report.view, kể cả candidate-after yếu hơn M.
- Không đổi tên/role/overrides/PIN/active/phiên. Mỗi request được xác minh cùng store có một audit denied, actualAfter=before.
- Thông báo nêu 'Quyền còn thiếu: Xem báo cáo.' theo nhãn catalog; không lấy expected từ hàm ceiling đang kiểm.

**Nơi hiện thực:** T05 kiểm before ceiling trên role/reset/unlock; target inactive vẫn có configured rights, audit missingPermissions. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-16 — Trần quyền sau thao tác chặn tăng quyền qua create và role

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-08](specs/access-control/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M được grant employee.permission.edit nhưng deny order.voidPaid; C mặc định. |
| **Dữ liệu thử** | Grant order.voidPaid cho C; đổi C thành manager; tạo E-new role manager. |

**Các bước**

1. Gửi ba request riêng, mỗi request có đủ quyền theo trường và revisions.
2. Chạy lại cùng candidate bằng O trên fixture mới.
3. So nhân viên, audits và hiệu ứng tạo mới.

**Kết quả mong đợi**

- M nhận PERMISSION_CEILING_EXCEEDED vì candidate-after có order.voidPaid ngoài quyền M; không thêm/sửa nhân viên.
- Không thể né trần bằng create hoặc role change thay vì editor overrides.
- O được miễn trần với target non-owner và thực hiện candidate hợp lệ; invariants, input và quyền owner-only vẫn được kiểm.

**Nơi hiện thực:** T05 kiểm after ceiling qua override/role/create và owner exemption với non-owner. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-17 — Target inactive vẫn giữ quyền cấu hình khi tính trần

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-05](usecases.md), [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M deny report.view; C inactive, grant report.view. |
| **Dữ liệu thử** | Reset PIN, mở khóa và đổi role C về waiter; mỗi biến thể dùng fixture sạch. |

**Các bước**

1. Gửi từng request từ M.
2. So tập quyền trước/sau trong audit với D0 và overrides của C.

**Kết quả mong đợi**

- Mọi request bị PERMISSION_CEILING_EXCEEDED vì C vẫn có report.view trong ConfiguredEffective.
- Không dùng executable guard trả false khi inactive để coi tập quyền target là rỗng.
- C vẫn inactive với PIN/role/overrides/phiên cũ; audit denied không giả actualAfter là candidate được đề nghị.

**Nơi hiện thực:** T05 kiểm quyền theo presence trường, explicit null, role reset và mixed request cần hai quyền. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-18 — Quyền theo trường và request có nhiều loại thay đổi

**Bổ sung T08 theo quyết định ngày 2026-09-16:** manager được grant settings.manage, timezone hiện hành Asia/Ho_Chi_Minh. Gửi tên mới + cùng timezone thì thành công; tên mới + America/New_York thì FORBIDDEN và cả hai trường không đổi; owner gửi cùng request thì thành công. Kiểm RPC trực tiếp và mock; UI control owner-only ở T13. Chưa chạy trong T07.

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-15](specs/employee-management/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C được grant employee.permission.edit, không employee.manage; M giữ defaults; target W. |
| **Dữ liệu thử** | C grant order.voidOpen cho W; C gửi mixed name+overrides hoặc reset PIN; M đổi W thành cashier rồi gửi explicit reset overrides. |

**Các bước**

1. C đọc danh bạ và sửa overrides W trong phạm vi ceiling.
2. C thử cập nhật tên kèm overrides và thử reset PIN W.
3. M đổi role W thật với revision đúng; trên fixture khác, M gửi riêng overrides=null.

**Kết quả mong đợi**

- C đọc danh bạ/editor và cấp order.voidOpen cho W được, nhưng không sửa tên/PIN hoặc request trộn thiếu employee.manage.
- M đổi role hợp lệ được; reset overrides bắt buộc do role đổi không tự đòi employee.permission.edit.
- Explicit reset overrides từ M nhận FORBIDDEN. Request trộn không được áp phần có quyền rồi bỏ phần còn lại.

**Nơi hiện thực:** T05 kiểm legacy employee overload cùng table/column privileges và raw bypass bằng owner session; các endpoint nghiệp vụ khác theo task cung cấp. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-19 — Biên tên, PIN, vai trò và revision

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-02](specs/access-control/spec.md), [PERM-08](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md) |
| **Mức** | đơn vị |
| **Nhóm** | biên |
| **Tiền điều kiện** | Chạy validator DTO/UI và hợp đồng request ở mức đơn vị; không gọi DB thật trong TC này. |
| **Dữ liệu thử** | Tên rỗng/space/1/120/121 Unicode code points; thêm tên có ký tự ngoài BMP để phân biệt code points với UTF-16 code units; PIN 5/6/7 ký tự và chữ số Unicode; role owner/kitchen/accountant/x.invalid; revision null/-1/'7'. |

**Các bước**

1. Đưa từng giá trị vào validator và kiểm DTO được gửi hoặc lỗi trường.
2. Kiểm request không bị ép kiểu string thành number và không gửi khi UI validation thất bại.
3. Đối chiếu danh sách input sai với các biến thể RPC thật của TC-PERM-25/26.

**Kết quả mong đợi**

- Tên sau trim từ 1 đến 120 Unicode code points hợp lệ; 121 không hợp lệ, không tự cắt tên legacy dài 101–120. UI/DTO đếm code points nhất quán với DB, không dùng số UTF-16 code units. PIN chỉ đúng sáu chữ số ASCII; giới hạn array overrides 100 và audit limit 100 giữ riêng, không đổi theo tên.
- Role create/update chỉ ba lựa chọn manager/cashier/waiter; không chấp nhận owner/kitchen/accountant/custom role. Gửi role đã loại trực tiếp trả INVALID_EMPLOYEE_REQUEST, không đổi dữ liệu.
- Invalid type/revision nhận INVALID_EMPLOYEE_REQUEST ở contract; lỗi field theo bảng thông báo. TC này không được báo đã kiểm DB bypass.

**Nơi hiện thực:** T05 kiểm server/mock và adapter projection, giữ Unicode/legacy name khi đọc; parser T03 đã có, UI form T12 chưa nối. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-20 — OCC, role không đổi và reset overrides chủ động

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-08](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | biên, ngoại lệ |
| **Tiền điều kiện** | O quản trị C revision 8, role cashier, deny payment.take. |
| **Dữ liệu thử** | ExpectedRevision=7 stale; same role cashier không overrides với revision 8; explicit overrides=null với revision hiện hành. Biến thể catalog: expectedCatalogRevision=11 nhưng DB đã ở revision 12. |

**Các bước**

1. Gửi stale patch rồi kiểm dữ liệu và audit.
2. Trên các fixture riêng, tăng catalog lên 12 rồi gửi reset/overrides và patch role=waiter từ cashier với expectedCatalogRevision=11; target expectedRevision vẫn đúng8.
3. Gửi same-role no-op bằng request mới.
4. Gửi explicit reset đủ quyền và revision.

**Kết quả mong đợi**

- Stale patch nhận EMPLOYEE_VERSION_CONFLICT, một audit denied, không ghi đè dữ liệu.
- Same-role giữ deny payment.take, hash dữ liệu và revision 8; một audit noop, không phát signal quyền.
- Explicit reset bỏ deny, tăng revision đúng một và audit applied. UI không tự gửi lại form stale bằng revision vừa tải.
- Catalog stale nhận PERMISSION_CATALOG_STALE trước normalize/lưu; overrides/revision target không đổi, audit denied ghi revision thực tế. Không normalize theo defaults cũ.
- Biến thể đổi role cũng nhận PERMISSION_CATALOG_STALE; C vẫn cashier và deny payment.take, không reset overrides như thể đổi role đã thành công.

**Nơi hiện thực:** T05 kiểm OCC/catalog-stale trước normalize, no-op/replay, sources lịch sử không tính lại theo catalog mới. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-21 — Rollback toàn bộ khi audit, signal hoặc registry lỗi

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md), [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | ngoại lệ |
| **Tiền điều kiện** | DB cách ly có fault injection riêng cho test; O có quyền hợp lệ. |
| **Dữ liệu thử** | Ba điểm lỗi: insert audit, update signal, ghi private request registry; thao tác đổi role hoặc reset PIN C. |

**Các bước**

1. Chụp employee, sessions, revisions, audit, signal và registry bằng quyền harness.
2. Kích hoạt một điểm lỗi, gọi mutation và đọc toàn bộ trạng thái sau khi transaction kết thúc; lặp trên fixture sạch cho từng lỗi.
3. Kiểm envelope trả về và thông báo UI của caller.

**Kết quả mong đợi**

- Nhận PERMISSION_UPDATE_UNAVAILABLE; không có hiệu ứng lên employee/PIN/session/revision/signal/registry.
- Không có audit mồ côi hoặc row applied đi cùng mutation bị rollback. UI không báo thành công.
- Lỗi hạ tầng được phân biệt với denied nghiệp vụ đã commit audit; không tuyên bố đã lưu audit khi transaction rollback.

**Nơi hiện thực:** T05 kiểm fault audit/signal/registry rollback effect, revision, sessions và request; signal transport T10 chưa chạy. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-22 — Audit lần từ chối và bảo vệ target khác cửa hàng

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md); [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md), [UC-PERM-13](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật, ngoại lệ |
| **Tiền điều kiện** | M hợp lệ nhưng thiếu report.view; C cùng S1 được grant report.view; C2 thuộc S2. |
| **Dữ liệu thử** | Reset PIN vượt ceiling; token không hợp lệ; target C2; UUID không tồn tại. |

**Các bước**

1. Gửi từng request với requestId riêng.
2. O đọc audit S1; harness kiểm employee và audit cả hai store.
3. So nội dung lỗi công khai cho target khác store và target không tồn tại.

**Kết quả mong đợi**

- Denied đã xác minh actor/target cùng S1 có outcome=denied, reason, details và actualAfter=before. ProposedAfter lưu đề nghị khi tính được từ shape/field hợp lệ và catalog hiện hành, kể cả FORBIDDEN/owner/self/OCC; null cho input không thể chuẩn hóa hoặc catalog stale, không chứa raw patch/PIN. Create collision cùng store before=null, actualAfter=snapshot row hiện có.
- Invalid session/foreign/unknown target không tạo snapshot target giả hoặc tiết lộ quyền/danh tính khác store; lỗi theo hợp đồng auth/NOT_FOUND.
- Audit denied nghiệp vụ tồn tại sau response; không bị RAISE rollback. Không thay target hoặc phiên của target.

**Nơi hiện thực:** T05 kiểm durable denied/noop, proposedAfter khi hợp lệ và actualAfter tách biệt, không audit foreign/unknown target. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-23 — Retry quản trị, payload khác và MAC chỉ ở private registry

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-04](usecases.md), [UC-PERM-06](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật, ngoại lệ |
| **Tiền điều kiện** | M được ủy quyền employee.permission.edit, có employee.manage; target W; R(23) đã terminal applied. Owner sẽ thu hồi quyền thao tác của M ở biến thể replay. |
| **Dữ liệu thử** | Cùng requestId/payload; cùng ID nhưng role hoặc PIN khác; replay sau revoke; SELECT registry/MAC/key từ app. |

**Các bước**

1. M thực hiện một request rồi mô phỏng mất ACK; gửi lại đúng nội dung.
2. Gửi lại cùng ID với canonical payload khác; chạy riêng biến thể PIN để xác minh MAC bao gồm phần secret mà không xuất secret.
3. O revoke quyền thao tác cần thiết của M rồi M replay; thử đọc các bảng/key private bằng token app.

**Kết quả mong đợi**

- Replay hợp lệ không thêm mutation/audit/revision. Payload khác nhận ADMIN_REQUEST_REUSED, giữ kết quả đầu.
- Replay sau revoke phải kiểm authority hiện hành và không trả snapshot nhạy cảm hoặc cho làm lại thao tác.
- Registry lưu MAC cùng key version, không lưu PIN/payload plaintext; app không SELECT được registry/key. Audit/output/log không có MAC, PIN hoặc hash PIN.

**Nơi hiện thực:** T05 kiểm canonical request, omitted/null, cross-kind namespace, current authority khi replay và MAC rotation append-only. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-24 — Quyền đọc audit, phân trang và retention toàn bộ

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md), [PERM-26](specs/multi-device-sync/spec.md); [UC-PERM-13](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | biên, bảo mật |
| **Tiền điều kiện** | F0 có audit applied/denied/noop với actor employee/operator, target owner/non-owner ở S1 và S2. |
| **Dữ liệu thử** | O; M được grant employee.permission.edit; M mặc định; cursor S1/S2; limit 1/50/100/0/101; clock tiến thêm 13 tháng.; token M đã revoked sau lần đọc hợp lệ. |

**Các bước**

1. Đọc audit, lọc outcome/target và phân trang bằng từng actor; thử cursor thuộc store/filter khác.
2. Thử INSERT/UPDATE/DELETE raw audit bằng app token.
3. Tiến clock 13 tháng, chạy clear demo hợp lệ và so các audit cũ theo id/hash.
4. Thu hồi token M rồi thử lấy trang tiếp bằng cursor vừa cấp.

**Kết quả mong đợi**

- O và M có permission.edit đọc toàn bộ audit S1, kể cả target owner; M mặc định bị FORBIDDEN, S2 không đọc được S1.
- Limit 1/50/100 hợp lệ; 0/101 hoặc cursor/filter sai nhận INVALID_EMPLOYEE_REQUEST. Các trang hợp lệ không thiếu hoặc trùng row.
- Không GC, sửa hoặc xóa audit cũ qua app/clear demo. Audit mới do clear được thêm riêng; mọi row không chứa PIN/hash/token/MAC.
- Token đã revoked nhận EMPLOYEE_SESSION_REQUIRED, không trả thêm audit; cursor không thay thế việc xác minh phiên hiện hành.

**Nơi hiện thực:** T07 roster/admin/audit đọc đúng quyền sau raw SELECT closure; UI nhân viên còn T12. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-25 — Ma trận quyền, projection và hành động ở mọi endpoint

**Bổ sung T07 theo quyết định ngày 2026-09-16:** paid_at 2026-09-15T17:30:00Z, business_date 2026-09-15, timezone Asia/Ho_Chi_Minh → giờ 00 trong báo cáo ngày 2026-09-15. Đổi timezone sang America/New_York đổi nhãn giờ nhưng không đổi business_date; kiểm paid-only/paid-void, fallback created_at và trung bình 3/2 làm tròn thành 2. Kiểm cùng input ở mock và SQL, không phụ thuộc timezone thiết bị.

**Bảng đơn báo cáo đã được duyệt:** tạo hơn20 paid orders qua nhiều business_date, thêm open/void và đơn ngoài range; actor chỉ có report.view (ngoài floor nền) gọi listReportOrders phải nhận đúng tối đa20 paid summaries trên toàn range theo ngày/số đơn/id giảm dần, đúng7 trường whitelist. Không nhận món/receipt/payment/employee; gọi history detail hoặc get_payment_receipt vẫn FORBIDDEN. Kiểm tên bàn/mang đi, hai biên ngày, range rỗng, thiếu/hết phiên/sai store và forged limit/page/status/actor. Không dùng giới hạn20 mỗi ngày.

Input filter sai hoặc field dư trả `INVALID_WRITE_REQUEST`: “Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra.”; không trả projection và không thay dữ liệu.

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-02](specs/access-control/spec.md), [PERM-03](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md); [UC-PERM-09](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Runtime cách ly có REST/Auth/DB candidate; inventory mục 3 design được xuất thành manifest endpoint. |
| **Dữ liệu thử** | Mỗi endpoint chạy allowed/missing/expired/cross-store; fixture actor chỉ giữ quyền nền và quyền tối thiểu cần thiết. Với floor.view, negative dùng session invalid vì quyền nền không được deny. |

**Các bước**

1. Với từng endpoint trong manifest, gọi trực tiếp qua REST bằng actor tối thiểu, rồi chạy các negative variants.
2. So danh sách field, row, trạng thái order và dữ liệu trước/sau với projection oracle mục P0.
3. Đưa các input sai của TC-PERM-19 vào create/update/overrides RPC; thêm positive control cùng endpoint, gồm tên 120 code points và negative tên 121 với ký tự ngoài BMP để kiểm DB và UI cùng quy tắc đếm.

**Kết quả mong đợi**

- Không endpoint hoặc permission nào bị bỏ khỏi manifest. Floor chỉ có layout/status/open summary được cho phép; không closed history, items hoặc payments.
- Action reads chỉ trả trạng thái/field phục vụ thao tác; history không ghi, report không trả raw detail; grant một quyền không mở endpoint khác.
- Input sai bị từ chối ở server dù bypass UI. Mọi denied mutation có zero business effect; audit denied chỉ theo phạm vi đã chốt.

**Nơi hiện thực:** T07 13 read contracts với allowed/missing/expired/cross-store/forged matrix, input bounds/projection, no-write fingerprint, report timezone và max20 summaries; write menu/floor/settings còn T08. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-26 — Raw SELECT/DML và private helpers không vượt projection RPC

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md); [UC-PERM-09](usecases.md), [UC-PERM-13](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | PostgREST và role authenticated thật trong profile candidate cách ly; DDL đóng surface của T05/T07/T08 đã áp cho fixture, các RPC tương ứng có positive control. Không phụ thuộc activation live hoặc script chuyển legacy ở T16 để chuẩn bị schema candidate này. |
| **Dữ liệu thử** | Raw orders/order_items/order_item_options/payments/employees/store_settings/employee_admin_audit; các cột employee từng được grant; catalog/defaults; private helpers. |

**Các bước**

1. Gọi SELECT raw và column selection bằng store JWT, sau đó bằng từng phiên O/M/C.
2. Thử INSERT/UPDATE/DELETE và gọi private helper trực tiếp; thử ghi catalog/defaults.
3. Gọi projection/RPC hợp lệ bằng cùng actor để phân biệt bị chặn quyền với backend không chạy.

**Kết quả mong đợi**

- Những raw surface đã chọn RPC trong design bị đóng, không chỉ lọc theo store. App owner cũng không financial DML hoặc sửa/xóa audit.
- App không ghi catalog/defaults và không execute private helpers; grants không còn đường vòng qua cột từng được cấp riêng.
- Positive RPC trả schema/rows đúng; denied mutation không thay business data. Chỉ giữ raw read nào có bằng chứng không vượt projection và được ghi tường minh trong inventory.

**Nơi hiện thực:** T07 tự revoke raw table/column SELECT và view legacy nếu tồn tại; fixture cố mở grants trước DDL, actual SQL bypass/private calls cùng REST positive controls. Nonfinancial DML T08, Storage/Realtime T09/T10 còn lại. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-27 — Mọi overload cũ và financial DML tiếp tục bị đóng

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-29](specs/write-idempotency/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-09](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | DB candidate cách ly với ACL đích đã áp bằng setup fixture do task phụ trách cung cấp; harness có inventory pg_proc/grants gắn sourceFingerprint và executionProfile. Đây không phải yêu cầu chạy script chuyển legacy T16 trước gate T15. |
| **Dữ liệu thử** | Mọi signature thực tế của legacy submit/pay/split/void và private helpers; caller anon/authenticated; wrapper thử nghiệm không có employee identity. |

**Các bước**

1. Liệt kê overload thực tế và so với manifest bắt buộc.
2. Gọi từng legacy signature và financial INSERT/UPDATE/DELETE từ anon/authenticated.
3. Thử wrapper đặc quyền không cung cấp employee session rồi chạy register/execute K hợp lệ làm positive control.

**Kết quả mong đợi**

- Không overload cũ hoặc DML nào cho app bypass protocol/authority; thiếu signature trong manifest làm gate thất bại.
- Protocol v1 hợp lệ vẫn hoạt động. Wrapper server không được giả employee chỉ nhờ service role bypass RLS.
- Không mở grants cũ để khiến client legacy chạy; kiểm trực tiếp dữ liệu chứng minh các lời gọi bị chặn không sinh hiệu ứng.

**Nơi hiện thực:** T07 read endpoints không overload tin actor, raw sensitive SELECT đóng; legacy nonfinancial writes còn T08. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-28 — Giả actor, ghép sai store và phiên hết hạn trong lúc chờ

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-20](specs/employee-session/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-09](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C có phiên tại S1; C2 có phiên S2; target hợp lệ trong S1. |
| **Dữ liệu thử** | Body actorId=O, role=owner, permissions=toàn bộ; store JWT S2 kèm token C; token expired/revoked; session hết hạn khi request đang đợi.; request không có store Auth JWT. |

**Các bước**

1. Gọi endpoint thiếu quyền bằng C nhưng chèn thông tin actor giả.
2. Thay cặp store JWT/employee token và thử read/write.
3. Giữ lock trước authorization cuối, cho session hết hạn rồi nhả lock.
4. Dùng danh tính anon của runtime cách ly, không có store Auth JWT hoặc employee token, rồi gọi get_write_capabilities và get_write_operation(K-pay).

**Kết quả mong đợi**

- Body giả không cấp quyền: C gọi report bằng phiên thật của mình nhận FORBIDDEN. RPC quản trị có actorId/permissions ngoài patch whitelist nhận INVALID_EMPLOYEE_REQUEST; field role được kiểm như role target, không phải role actor.
- Sai cặp store/session và expired/revoked nhận EMPLOYEE_SESSION_REQUIRED; target ngoài scope nhận NOT_FOUND theo contract.
- Không foreign data, quyền target hoặc audit actor giả. Sau chờ phải đọc clock/session mới, không dùng kết quả xác minh sớm.
- Thiếu store Auth nhận AUTH_REQUIRED với thông báo chung của UC; không trả dữ liệu hoặc tạo audit actor giả.

**Nơi hiện thực:** T07 session/actor/catalog fresh sau order wait, state paid/open/void mới; mutation control bỏ post-lock guard bị phát hiện. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-29 — Realtime chỉ phát metadata được phép

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-26](specs/multi-device-sync/spec.md); [UC-PERM-09](usecases.md), [UC-PERM-12](usecases.md), [UC-PERM-13](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Runtime cách ly có Realtime thật; cùng harness phải nhận positive signal của S1. |
| **Dữ liệu thử** | Subscriber S1 quyền thấp và S2; thay đổi employee, paid order, audit, catalog; các topic order/payment/table, menu và floor mà adapter hiện hành subscribe; biến thể chỉ đổi menu-item/option-group join link, không đổi row menu khác. |

**Các bước**

1. Subscribe signal và thử các raw table/publication route; từ S2 gửi filter cố nhắm S1.
2. Phát lần lượt các mutation có signal đã biết, thu payload WebSocket trước callback ứng dụng.
3. Đối chiếu payload, tenant ACL và refetch RPC của từng actor.
4. Với biến thể join-only, giữ kết nối ổn định, không mutate parent row hoặc gây resubscribe; kiểm không có kỳ vọng invalidate riêng từ join, rồi refresh chủ động để đọc quan hệ mới. Đối chiếu riêng positive control của các topic adapter hiện hành.

**Kết quả mong đợi**

- Chỉ nhận metadata store/topic/revision/eventId/targetId cần thiết; không có tổng tiền, tên nhân viên, overrides, PIN/hash/token, receipt hoặc R1.
- S2 không nhận signal S1 dù filter client nhắm S1. Không dùng việc callback bỏ qua raw payload làm bằng chứng bảo mật.
- Negative chỉ được kết luận sau positive signal hoạt động; invalidation của các topic adapter hiện hành được giữ qua metadata signal. [realtimePort.ts:32](D:/Workspace/pos-cafe/src/adapters/supabase/realtimePort.ts:32) subscribe `public.store_change_signals`, rồi refetch projection cho topic order/payment/table, menu và floor; không subscribe business rows hoặc join. Publication hiện có không tự chứng minh client invalidate join. Biến thể join-only vẫn cần refresh chủ động, không coi đây là lỗi hoặc âm thầm triển khai `add-modifier-link-realtime-subscription` (proposal độc lập, chưa nằm trong mốc Git phân quyền này). Thiếu Realtime thật: gate BLOCKED, kết quả TC NOT RUN.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/integration/permissions/realtimeSecurity.test.ts`.

**Bổ sung static guard ngày13/10/2026:** [permissionInventory.tool.test.ts:178](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:178) đối chiếu source subscription đúng `store_change_signals`; [exact-set assertion:193](D:/Workspace/pos-cafe/tests/contracts/permissionInventory.tool.test.ts:193) yêu cầu tập publication của riêng adapter bằng đúng `[public,store_change_signals]`. Guard này không thay SQL/RLS/WebSocket positive/negative gate. Mapping aggregate hiện hành TC29 có `tests/contracts/permissionSignals.contract.test.ts`, stage `candidate-signals-database`; câu “chưa viết” ở trên là ghi chép kế hoạch cũ, không phải trạng thái hiện tại. [Biên bản source34/npm](../../../docs/implementation-log/permission-npm-remediation-2026-10-13.md) ghi bằng chứng mới riêng với lịch sử source31.

### TC-PERM-30 — Catalog toàn cục đổi mà employee row không đổi

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-07](specs/access-control/spec.md), [PERM-24](specs/multi-device-sync/spec.md), [PERM-26](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | chính |
| **Tiền điều kiện** | Hai cashier ở S1/S2 đã có authority catalog revision 11; employee revisions giữ nguyên. |
| **Dữ liệu thử** | Maintenance xóa order.voidOpen khỏi default cashier, catalog 11→12; một client mất global signal. |

**Các bước**

1. Thực hiện maintenance qua transaction catalog được phép, không update employee.
2. Quan sát client nhận signal và client phải dùng poll revision tuple.
3. Trả thử snapshot employee mới ghép catalog 11 hoặc response catalog 11 về muộn.

**Kết quả mong đợi**

- Cả hai client hội tụ về catalog 12, không cần employee event; quyền order.voidOpen bị thu hồi theo default mới.
- Snapshot áp dụng luôn nhất quán employee/catalog revision; tổ hợp stale bị bỏ. App không được ghi catalog.
- Sau test khôi phục fixture trước test khác; sự thay đổi default trong test không phải thay quyết định D0 của release.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/integration/permissions/catalogRefresh.test.ts`.

### TC-PERM-31 — Một poll 30 giây và trần dự phòng 35 giây có điều kiện

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-12](specs/access-control/spec.md), [PERM-24](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md) |
| **Mức** | đơn vị |
| **Nhóm** | biên |
| **Tiền điều kiện** | Fake monotonic clock; tab visible/online; signal bị chặn; authority ban đầu đã verified. |
| **Dữ liệu thử** | Poll bắt đầu t=0 và t=30s; commit t=0+1ms; revision RPC 2s, snapshot+apply 3s; biến thể hai RPC mỗi 5s. |

**Các bước**

1. Tiến clock đến 29.999s rồi 30s; ghi thời điểm bắt đầu mọi poll.
2. Hoàn tất chuỗi revision/snapshot/apply trong tổng 5s; chèn nhiều signal trùng để kiểm lịch không bị dời.
3. Chạy biến thể tổng request 10s và kiểm timeout/đánh giá gate.

**Kết quả mong đợi**

- Khoảng cách bắt đầu poll không quá 30s; chỉ một scheduler authority cho tab, không một poll mỗi drawer.
- Biến thể tổng 5s áp quyền muộn nhất t=35s; signal trùng không trì hoãn fallback.
- Biến thể 10s không được báo đạt trần 35s; client timeout theo ngân sách 5s và chuyển unavailable. Đây là bằng chứng timer, không phải latency Realtime thật.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/features/integration/permissionRefresh.test.ts`.

### TC-PERM-32 — Tab ẩn, reconnect và cổng authority khi timeout

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-20](specs/employee-session/spec.md), [PERM-24](specs/multi-device-sync/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-12](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M đang xem report đã cache; mạng ngắt; authority timer và các query được quan sát riêng. |
| **Dữ liệu thử** | Hidden 10 phút; visible/focus/reconnect; chain 4.999s, đúng 5s, và vượt 5s. |

**Các bước**

1. Ẩn tab 10 phút và đếm riêng các request authority.
2. Hiện tab/reconnect, giữ response authority chưa hoàn tất và kiểm DOM/query report.
3. Hoàn tất ở các mốc biên; với timeout, bấm Thử lại và chỉ trả authority hợp lệ ở lần sau.

**Kết quả mong đợi**

- Không có authority polling khi hidden; không khẳng định các polling nghiệp vụ khác đều dừng.
- Trước xác minh, không render protected cache hoặc chạy protected query. Hoàn tất trong ngân sách mới mở lại; vượt ngân sách nhận PERMISSION_REFRESH_UNAVAILABLE.
- Giữ token khi lỗi mạng, không auto login lại hoặc replay K. Retry chỉ đọc; không dùng snapshot cũ làm authority đã verified.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionResumeGate.test.tsx`.

### TC-PERM-33 — Bỏ response cũ khi revision hoặc phiên đã đổi

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-12](specs/access-control/spec.md), [PERM-20](specs/employee-session/spec.md), [PERM-24](specs/multi-device-sync/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-26](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Employee A tại S1, generation 1; sau đó đăng nhập C generation 2. QueryClient và store được quan sát. |
| **Dữ liệu thử** | Response revision 11 về sau 12; response A về sau C; chuyển store; signal trùng. |

**Các bước**

1. Khởi động hai refresh rồi resolve theo thứ tự 12 trước, 11 sau.
2. Giữ request A pending, chuyển employee hoặc store, rồi trả response A.
3. Kiểm authority, currentEmployee, query cache, DOM, toast và preview.

**Kết quả mong đợi**

- Revision 11 không ghi đè 12; response sai store/employee/generation không được áp dù revision lớn hơn.
- Không cache/DOM/receipt của A xuất hiện ở C, không toast hoặc logout tác động lên phiên mới.
- Signal trùng không tăng session generation hoặc mở lại preview; kiểm đủ context tuple lẫn revision.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionLateResponse.test.tsx`.

### TC-PERM-34 — Thu hồi chỉ bỏ nháp bị ảnh hưởng và giữ K

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-03](specs/access-control/spec.md), [PERM-04](specs/access-control/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-10](usecases.md), [UC-PERM-12](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M có menu/order/payment draft tùy biến thể; K đã register hoặc ACK chưa rõ; mọi fixture dùng coordinator riêng. |
| **Dữ liệu thử** | Lần lượt thu menu.manage, order.update, order.create, payment.take; dirty confirmation đang mở. |

**Các bước**

1. Ở từng fixture, giữ nháp phần không liên quan rồi áp authority thu hồi đúng một action.
2. Resolve request đọc cũ và dirty dialog sau forced close.
3. Kiểm nháp/cache/coordinator/DB K; cấp lại quyền và quan sát không tự submit.

**Kết quả mong đợi**

- Drawer không còn quyền thao tác đóng không chờ xác nhận; chỉ nháp và cache thuộc quyền bị thu hồi bị bỏ. Hiện đúng câu PERM-25 trong bảng thông báo. Receipt preview có quyền đọc độc lập áp TC36/60: chỉ mất quyền in thì ẩn nút/hủy pending, không buộc đóng preview.
- Nháp phần khác còn nguyên. K, frozen payload, expiry và trạng thái server không đổi; không tự cancel/reject hoặc sinh K khác.
- K mất ACK vẫn giữ định danh để tra cứu đúng khi đủ quyền; không hiển thị payload/kết quả cho actor thiếu action và không tự replay khi được cấp lại.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionDraftRevocation.test.tsx`.

### TC-PERM-35 — Refresh không đổi quyền không ngắt payment đang chờ

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-20](specs/employee-session/spec.md), [PERM-24](specs/multi-device-sync/spec.md), [PERM-25](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | chính |
| **Tiền điều kiện** | C có payment execute đang await; phiên và quyền payment.take còn hợp lệ. |
| **Dữ liệu thử** | Revision không đổi; signal trùng; refresh chỉ thay tên employee nhưng giữ quyền. |

**Các bước**

1. Gửi nhiều refresh trong lúc execute chưa trả.
2. Kiểm generation/coordinator/cache sau mỗi response.
3. Trả kết quả payment hợp lệ trong cùng lifetime.

**Kết quả mong đợi**

- employeeSessionVersion không tăng chỉ vì profile/authority refresh; coordinator không leave khi action còn quyền.
- Không bỏ nháp/cache khác hoặc tạo K mới. Kết quả payment được xử lý đúng một lần trong phiên hiện tại.
- Không nhầm name-only revision với thay phiên, và không vô hiệu hóa mọi pending request chỉ vì object currentEmployee đổi.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionNoopRefresh.test.tsx`.

### TC-PERM-36 — Kiểm quyền ở Lịch sử, Tra cứu và nút In của preview

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-04](specs/access-control/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-27](specs/receipt-printing/spec.md); [UC-PERM-11](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C có quyền đọc nguồn và receipt.reprint; P paid; ba fixture tương ứng ba entry point. |
| **Dữ liệu thử** | Thu reprint trước mở, sau mở, khi prepare RPC đang chờ hoặc timer print chưa chạy; cấp lại reprint khi còn quyền đọc nguồn; thu quyền đọc nguồn hoặc revoke session trên fixture riêng. |

**Các bước**

1. Mở từng entry point bằng thao tác người dùng; không dùng replay tự mở preview.
2. Thu hồi reprint, resolve response muộn và tiến clock qua timer print.
3. Gọi prepare_receipt_reprint trực tiếp sau commit revoke.
4. Cấp lại reprint khi preview còn mở và có quyền đọc, quan sát rồi bấm In chủ động. Trên fixture riêng, thu quyền đọc nguồn hoặc revoke session rồi resolve callback cũ.

**Kết quả mong đợi**

- Chỉ mất reprint thì nút In bị ẩn, pending authorize/timer bị hủy và callback cũ không gọi print; preview vẫn mở khi quyền đọc nguồn còn hợp lệ.
- Server nhận request mới sau revoke trả FORBIDDEN. Không chỉ dựa trạng thái disabled của nút.
- Quyền history read hoặc action K còn lại không bị thu hồi theo; không xóa payment hoặc K chỉ vì mất reprint.
- Cấp lại reprint hiện nút trong preview hợp lệ nhưng không tự in hoặc hồi sinh pending cũ. Mất quyền đọc nguồn hoặc phiên thì đóng preview, purge dữ liệu và bỏ callback muộn.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionReprint.test.tsx`.

### TC-PERM-37 — Initial print grant không trở thành đường vòng in lại

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-27](specs/receipt-printing/spec.md), [PERM-28](specs/receipt-printing/spec.md), [PERM-29](specs/write-idempotency/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-11](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C có payment.take, deny receipt.reprint; K-pay mới sẽ applied; K-old đã applied trước đó. |
| **Dữ liệu thử** | Grant G issued; printRequestId PR1/PR2; purpose=initial giả; phiên khác của C; actor M; grantId mới gắn K-old; revoke rồi cấp lại payment.take trong cùng preview còn quyền orderHistory.view. |

**Các bước**

1. Execute thanh toán chủ động lần đầu với G ngoài immutable payload; kiểm grant riêng và authorize G/PR1.
2. Retry authorize đúng G/PR1, rồi authorize G/PR2 cho click mới; so DB trước/sau từng authorize. Thử actor khác và session khác.
3. Replay K-pay hoặc get K-old với grantId/purpose giả; so payload/R1 trước/sau và trạng thái grant.
4. Thu payment.take, giữ orderHistory.view; gọi initial read và authorize. Cấp lại payment.take rồi gọi authorize G/PR2 chủ động khi preview vẫn hợp lệ. Trên fixture riêng, thu cả hai quyền đọc hoặc revoke session.

**Kết quả mong đợi**

- Chỉ transaction payment chuyển sang applied lần đầu tạo grant gắn K/order/executor/session; grant metadata ngoài R1, không sửa schema/fingerprint protocol v1.
- authorize_initial_receipt_print chỉ đọc eligibility hiện hành: grant issued gắn đúng K/order/actor/session, payment.take và paid. G/PR1 hợp lệ hoặc G/PR2 cho click mới trả authorized cùng echo grantId/printRequestId; không update/consume grant, không ghi ledger PR, không đổi DB hoặc R1. Retry PR1 cũng kiểm lại authority, không replay authorization đã cũ để vượt revoke.
- Sai actor/session không được dùng G: actor không khớp hoặc session hợp lệ khác binding nhận FORBIDDEN; session đã revoked/expired nhận EMPLOYEE_SESSION_REQUIRED. PR là correlation để client chặn dispatch trùng, không là ledger dedup hay bằng chứng số lần in vật lý.
- Replay/get K cũ và flag initial không cấp grant mới. Client đóng preview thì discard G, không persist hoặc khôi phục từ K/history; mất ACK payment không mở lại initial bằng recovery K. Đây là giới hạn vòng đời client được kiểm thêm ở TC60, không giả server nhận biết sự kiện đóng UI khi không có contract đó. Riêng mất ACK authorize trong preview chưa dispatch được retry chủ động cùng PR1, không phát grant mới hoặc tự in. Không tạo payment khác.
- Initial read cho phép payment.take OR orderHistory.view. Khi chỉ còn history, receipt vẫn đọc được nhưng initial authorize nhận FORBIDDEN; receipt.reprint được cấp riêng không đổi provenance initial. Cấp lại payment.take cho phép authorize mới khi preview/grant còn hợp lệ; không tự in. Mất cả quyền đọc hoặc phiên thì không cấp dữ liệu/authorization mới và client đóng/purge theo TC60.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/contracts/permissionInitialPrint.contract.test.ts`.

### TC-PERM-38 — Receipt lịch sử bất biến và trạng thái void trước khi in

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-27](specs/receipt-printing/spec.md), [PERM-28](specs/receipt-printing/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-11](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | P paid với snapshot hai phần 40.000đ, tổng 80.000đ; có thêm receipt legacy có marker. |
| **Dữ liệu thử** | Đổi tên/giá món hiện tại; void P sau khi đọc receipt nhưng trước authorize print. Biến thể receipt P còn paid nhưng token actor đã revoked. |

**Các bước**

1. Đọc/in lại P khi còn paid; lưu snapshot/R1 canonical.
2. Đổi menu rồi đọc lại snapshot; so metadata, tên, giá, số lượng và legacy marker.
3. Void P theo protocol, thử reprint/authorize initial; đọc terminal R1 bằng actor vẫn đủ quyền K.
4. Trên fixture P paid riêng, revoke token rồi gọi read receipt, reprint và initial authorization.

**Kết quả mong đợi**

- Receipt giữ hai phần 40.000đ và metadata lịch sử, không thay theo menu mới.
- P void nhận RECEIPT_UNAVAILABLE khi in; người có quyền thấy nút disabled với lý do đúng. Không dùng R1 cũ để né kiểm paid hiện hành.
- Terminal R1 giữ nguyên theo phase 27 và vẫn tra cứu được đúng quyền K; việc in/read không sinh giao dịch mới.
- Token revoked nhận EMPLOYEE_SESSION_REQUIRED, không trả snapshot hoặc authorization mới; receipt/R1 sẵn có không làm phiên trở lại hợp lệ.

**Nơi hiện thực:** T07 receipt không cho action/K/history bypass; stored snapshot/R1 giữ nguyên, revoke token hoặc void không đọc lại receipt; print callbacks/grants T14 chưa kiểm. [Suite T07](D:/Workspace/pos-cafe/tests/contracts/permissionRead.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t07-read-projections-2026-09-16.md).

### TC-PERM-39 — Thu hồi sau register không hủy K pending

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-12](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C hoặc actor được grant action cần thiết đã register K; O thu hồi action trước execute. |
| **Dữ liệu thử** | Năm action quyền POS: create/update/voidOpen/payment.take/voidPaid; payment.take chạy cả pay và split; hash payload H0. M giữ defaults để tiếp quản; A theo F0 được grant thêm receipt.reprint nhưng không có bất kỳ action POS nào trong ca này. |

**Các bước**

1. Với từng fixture, revoke rồi gọi execute/get/list/cancel bằng actor mất quyền.
2. So K, payload, expiresAt và business rows bằng harness.
3. M vẫn đủ action tiếp quản cùng K; thử A có quyền chỉ xem và reprint đọc hoặc tiếp quản K.

**Kết quả mong đợi**

- Actor mất quyền nhận FORBIDDEN khi execute/get/cancel; list không chứa K đó. Không tự đổi K thành rejected/cancelled, không sửa payload/expiry.
- M thực hiện cùng K với tối đa một hiệu ứng, initiator giữ actor ban đầu và executor là M.
- Quyền lịch sử/reprint không đủ takeover. Không tạo K thay thế để vượt lần register đã tồn tại.

**Nơi hiện thực:** T06 kiểm revoke sau register ở create/update/voidOpen/pay/split/voidPaid; không đọc/cancel/execute/list K trái action, history/reprint không thay quyền action; người đủ quyền takeover cùng K và initiator cũ. [Suite T06](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1), [regression](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md).

### TC-PERM-40 — Revoke commit khi execute còn chờ business lock

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Ba DB connection độc lập: L giữ order lock, E execute payment của C, R thực hiện admin revoke với actor O; C đã register K. R là alias connection, không phải fixture A chỉ xem. |
| **Dữ liệu thử** | Barrier xác nhận E đang chờ order; O deny payment.take; đồng hồ/harness ghi thứ tự lock và commit. |

**Các bước**

1. L khóa order X; E bắt đầu execute K và phải bị chặn trước final employee/session locks.
2. R commit deny payment.take trong khi L vẫn giữ order; xác minh commit hoàn tất trước khi nhả L.
3. Nhả L, đợi E và so order/payment/K/R1 với baseline.

**Kết quả mong đợi**

- Admin revoke không bị outer store-authority SHARE của financial chặn; commit diễn ra khi E vẫn chờ order.
- E đọc quyền mới ở checkpoint cuối, trả FORBIDDEN; zero payment/business effect và không có terminal R1 mới.
- Giữ semantics test phase 27 TC-IDEM-007; mutation bỏ post-lock auth phải làm TC thất bại.

**Nơi hiện thực:** T06 dùng barrier PostgreSQL chứng minh admin revoke commit khi execute còn chờ order, sau đó FORBIDDEN và K pending. Negative control bỏ kiểm quyền sau khóa bị detector phát hiện. [Suite T06](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1), [regression](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md).

### TC-PERM-41 — Catalog writer, snapshot sau chờ và phiên hết hạn

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-07](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md), [PERM-24](specs/multi-device-sync/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-12](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Harness ít nhất ba connection; writer catalog giữ EXCLUSIVE; executor đã khóa employee/session và đang chờ catalog SHARE. |
| **Dữ liệu thử** | Hai biến thể độc lập: catalog 11→12 bỏ action đang dùng; catalog chỉ tăng revision nhưng session hết hạn trong lúc đợi. |

**Các bước**

1. Giữ catalog writer và xác nhận executor đang chờ sau employee/session locks.
2. Ở biến thể quyền, commit default mới; ở biến thể expiry, tiến clock test qua expiresAt trước khi nhả writer.
3. Cho executor tiếp tục; ghi lock trace, revision đã đọc và outcome. Thêm lượt catalog writer đang xếp hàng cạnh admin update.
4. Trên fixture takeover, F do M execute K có initiator C; dừng F sau catalog SHARE. Cho W xếp hàng catalog EXCLUSIVE, rồi cho owner sửa tên C qua single-target admin. Kiểm admin chờ C vì F đã prelock mọi employee FK; nhả F, đợi W/admin hoàn tất.
5. Đảo lịch: admin giữ C trước F, F chưa được lấy catalog và đang chờ employee reference. Tiến clock qua session expiry hoặc K TTL trên các fixture riêng, rồi nhả admin; quan sát final check sau các khóa.

**Kết quả mong đợi**

- Biến thể mất action nhận FORBIDDEN; biến thể hết hạn nhận EMPLOYEE_SESSION_REQUIRED. Cả hai không có business effect hoặc R1 mới.
- Authorization dùng catalog/clock mới sau lần chờ cuối; không giữ snapshot từ STABLE/preliminary read.
- Writer catalog không khóa employee/session/business và không gọi admin flow; các request hoàn tất trong timeout harness, không vòng chờ catalog→employee ngược chiều.
- F đã prelock actor/initiator SHARE theo UUID trước session/catalog; INSERT order_events không phát sinh lần chờ employee FK mới sau final checkpoint. Admin một target không cần pos-write. Lịch đảo sau chờ C trả EMPLOYEE_SESSION_REQUIRED hoặc đánh K expired theo TTL, không business effect mới.
- Negative control bỏ prelock initiator phải bị test phát hiện qua lock trace/có chờ mới sau checkpoint hoặc timeout/deadlock; không phụ thuộc PostgreSQL bắt buộc tái hiện một thông báo deadlock cụ thể. Giữ TC40 chứng minh revoke trong lúc chờ order vẫn commit được.

**Nơi hiện thực:** T06 kiểm catalog mới và session expiry sau chờ; prelock initiator/executor trước catalog, catalog writer/admin queue, thứ tự đảo và mutation bỏ initiator prelock. Khóa tham chiếu không phát sinh sau checkpoint. [Suite T06](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1), [regression](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md).

### TC-PERM-42 — Hai nhân viên sửa lẫn nhau và catalog writer xếp hàng

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md); [UC-PERM-03](usecases.md), [UC-PERM-04](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M và M2 cùng quyền manager+employee.permission.edit; revision hai target đều 7; thay đổi tên không đổi quyền. |
| **Dữ liệu thử** | M sửa tên M2 thành 'Quản lý B'; M2 sửa tên M thành 'Quản lý A'; writer catalog chỉ đổi label và revision. |

**Các bước**

1. Khởi động đồng thời hai update tại barrier trước store-authority mutex.
2. Xếp catalog writer cạnh hai request; lần lượt nhả barrier theo lock order design.
3. Kiểm outcomes, employee revisions, tên, audit và lock trace; chạy lại với request đến sau dùng expectedRevision stale.

**Kết quả mong đợi**

- Hai cập nhật tên trên hai target khác nhau tuần tự qua mutex và đều applied nếu target revision đúng; mỗi target tăng 7→8 với đúng một audit applied.
- Catalog mới được đọc sau chờ; không deadlock/hang. Biến thể stale target revision nhận EMPLOYEE_VERSION_CONFLICT, actualAfter=before và một audit denied.
- Mọi quyền actor/target dùng dữ liệu hiện hành, không chỉ snapshot trước khi giành mutex.

**Nơi hiện thực:** T05 kiểm hai admin ngược chiều/catalog writer bằng barrier, mất action khi chờ mutex và hết phiên khi chờ catalog; không đổi expected để làm race xanh. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-43 — Race cấp phiên, reset PIN và revoke

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-17](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md), [PERM-21](specs/employee-session/spec.md); [UC-PERM-05](usecases.md), [UC-PERM-06](usecases.md), [UC-PERM-07](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | C có PIN cũ 384729 và phiên tồn tại; reset đổi sang 927416; start/reset dùng store-authority mutex. |
| **Dữ liệu thử** | Hai thứ tự: start(old PIN) linearize trước reset; reset commit trước start(old/new PIN); logout với token expired/revoked. |

**Các bước**

1. Dùng barrier tạo từng thứ tự start/reset và ghi token được cấp.
2. Sau reset commit, thử mọi token cũ cùng PIN cũ/PIN mới.
3. Gọi revoke/logout lặp bằng token đã expired hoặc revoked.

**Kết quả mong đợi**

- Nếu start cũ đi trước, session vừa cấp cũng nằm trong tập bị revoke khi reset commit. Nếu reset đi trước, start PIN cũ nhận INVALID_PIN; PIN mới cấp phiên hợp lệ.
- Không session cũ lọt giữa prelock và revoke; việc cấp session/PIN verify và revoke không đảo thứ tự employee→session.
- Logout idempotent, không yêu cầu current_employee còn valid mới cho revoke; không logout hoặc sửa phiên của người khác.

**Nơi hiện thực:** T05 nối admin reset non-owner vào hai thứ tự session issuance/PIN reset; T04 self/recovery cũng được regression. [Suite T05](D:/Workspace/pos-cafe/tests/contracts/permissionAdministration.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t05-employee-administration-audit-2026-09-16.md).

### TC-PERM-44 — Bulk clear và takeover không tạo vòng chờ khóa ngoại

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-09](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-29](specs/write-idempotency/spec.md); [UC-PERM-10](usecases.md), [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | K có initiator C, executor M; batch clear chạm demo C và M2; IDs input cố đưa ngược thứ tự tăng. |
| **Dữ liệu thử** | Financial đang chờ business lock; bulk clear/seed identity theo protocol nội bộ; order_events có FK initiator/executor. |

**Các bước**

1. Giữ business lock, khởi động financial takeover và bulk; quan sát bulk chờ pos-write trước khi khóa employee.
2. Nhả business lock để financial hoàn tất, rồi cho bulk tiếp tục; chạy thêm thứ tự bulk đi trước.
3. Thu lock trace và so owner/finance/K/audit/foreign keys.

**Kết quả mong đợi**

- Bulk đi store-authority→pos-write→business→employee UUID tăng→session→catalog; không giữ target employee rồi mới chờ pos-write.
- Không có vòng financial executor M chờ FK C trong khi bulk giữ C và chờ financial. Cả hai lượt hoàn tất hoặc nhận business denial hợp lệ, không deadlock/hang.
- Clear không xóa owner, finance, K hay R1; nếu còn order open, nhận OPEN_ORDERS_BLOCK_CLEAR_DEMO và không clear nửa chừng.

**Nơi hiện thực:** T06 mới kiểm financial takeover có initiator khác executor và FK employee trước catalog. Bulk clear/seed hai thứ tự cùng open-order blocker/retention chưa chạy, thuộc T08; TC44 chưa hoàn tất toàn bộ. [Suite T06](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1), [regression](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md).

### TC-PERM-45 — Storage HTTP bypass và biên ảnh

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md); [UC-PERM-09](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Full local Supabase cách ly có Storage/gateway candidate thật và policies T09 đã đóng direct writes; C không menu.manage, O có; legacy public image đã tồn tại; HTTP client có cache hoặc browser cách ly ghi được request/response headers. |
| **Dữ liệu thử** | File JPEG/PNG/WebP hợp lệ; ảnh hợp lệ có kích thước 5.242.880 và 5.242.881 byte; GIF; uploadId U-O=90000000-0000-4000-8000-000000000045 thuộc S1/I/O; path S2, ../ và upsert=true; A-new published có URL immutable ổn định, lượt GET cold rồi warm. |

**Các bước**

1. Gọi Storage upload/remove/update/copy trực tiếp bằng store JWT, kể cả kèm token O.
2. Qua gateway, C và O gửi các file biên; thử object key/path/upsert do caller tự chỉ định.
3. Kiểm object, private upload registry, response handle, GET staging và GET legacy public.
4. Trên positive fixture O hợp lệ, finalize U-O rồi đọc A-new qua URL gateway ổn định; đo response headers, số request đến gateway/origin, bytes và invocation khi có metric. Render lại cùng URL khi browser cache còn fresh, không đổi query token mỗi render; đo riêng client chưa có cache, cache fresh, revalidate304 và response có body để tách số request origin khỏi bytes.
5. Dùng browser img src và HTTP client không Authorization/apikey/employee token gọi menu-image-public GET A-new; thử unknown/unpublished assetKey, staging handle, arbitrary bucket/path và POST/PUT/PATCH/DELETE cùng URL. Gọi menu-image-gateway write/staging read lần lượt không JWT, JWT giả/hết hạn, JWT đúng nhưng thiếu/sai/revoked employee token. Kiểm config cả hai function từ service manifest.

**Kết quả mong đợi**

- Mọi direct write bị chặn; C gọi gateway nhận FORBIDDEN. O chỉ được JPEG/PNG/WebP không quá 5MiB. Loại sai dùng AppError UNKNOWN với 'Ảnh món chỉ hỗ trợ JPG, PNG hoặc WebP.'; quá 5MiB dùng UNKNOWN với 'Ảnh món tối đa 5MB.' theo contract ảnh hiện hành.
- Object key immutable gắn đúng S1/item/uploadId; caller không ghi path khác store hoặc upsert object cũ. Gateway chỉ trả upload handle, không credential hoặc public staging URL.
- Staging chưa công bố không đọc công khai được; legacy public GET giữ nguyên. Thiếu Storage service thật: TC NOT RUN, gate BLOCKED.
- menu-image-public verify_jwt=false chỉ cho anonymous GET published qua DB lookup, img src tải được không token trong URL; unknown/unpublished404 và method không hỗ trợ405/no-store, không đọc staging/list hoặc gây mutation. menu-image-gateway giữ verify_jwt=true; JWT thiếu/sai/hết hạn bị401 trước xử lý, JWT đúng nhưng employee thiếu/revoked hoặc không có menu.manage bị auth/permission error trước Storage I/O. Không tắt kiểm JWT write để làm ảnh tải được. Tắt guard employee hoặc thêm write route vào public function phải khiến negative test fail.
- GET published tại origin kiểm published record DB hiện hành, trả Cache-Control: private, max-age=60, must-revalidate. Chưa published/lỗi trả no-store; không public URL của private bucket. Cache fresh có thể giảm request mạng, nên không suy số render thành số Edge invocation; cũng không tuyên bố arbitrary Edge response tự có CDN. Report ghi headers/request/bytes quan sát được, chưa đặt performance SLA hoặc suy khoản phí từ số render.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/integration/permissions/storageAccess.test.ts`.

### TC-PERM-46 — Thu hồi quyền giữa staging và finalize

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md), [PERM-25](specs/multi-device-sync/spec.md); [UC-PERM-09](usecases.md), [UC-PERM-12](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | M có menu.manage; item I thuộc S1 đang dùng asset A-old; U đã upload xong vào bucket private và state ready. |
| **Dữ liệu thử** | O thu hồi menu.manage trước transaction apply_menu_changes final authorization. |

**Các bước**

1. Stage ảnh bằng M và giữ finalization tại barrier; ghi assetKey hiện hành.
2. O commit revoke rồi gọi hoặc nhả apply_menu_changes với handle U.
3. Kiểm DB item/upload state và thử GET asset mới qua gateway/public route.

**Kết quả mong đợi**

- Finalization trả FORBIDDEN; item vẫn A-old và U không thành published.
- Bytes đã stage vẫn ở private bucket, không public GET được và không tạo đường đọc asset mới qua gateway.
- Không tuyên bố DB rollback đã xóa bytes Storage. Cleanup riêng chỉ xử lý đúng handle; cache/nháp menu M bị đóng theo PERM-25.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/integration/permissions/storageRevocation.test.ts`.

### TC-PERM-47 — Lỗi Storage và cleanup không công bố hoặc xóa nhầm ảnh

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-09](specs/access-control/spec.md); [UC-PERM-09](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Gateway/DB fault injection chỉ trong runtime cách ly; bucket staging private; có A-old published và object S2 làm đối chứng. |
| **Dữ liệu thử** | Lỗi upload I/O; lỗi transaction finalization trước commit; lỗi cleanup sau từ chối; upload handle U; A-old vừa GET thành công tại t0 rồi unlink commit tại t0+1s; thời điểm cache t0+59s/60s/61s; lỗi gateway hoặc DB lúc origin GET. |

**Các bước**

1. Inject từng điểm lỗi trên fixture mới và chạy upload/finalize.
2. Kiểm upload registry, item.assetKey, object tồn tại và public gateway GET.
3. Khi cleanup lỗi, đọc hồ sơ orphan rồi chạy cleanup operator với đúng U; thử thay key bằng object S2/A-old.
4. Trên fixture riêng, GET A-old để làm đầy cache rồi unlink. Kiểm HTTP/conditional GET và trace origin trước/sau mốc60s; kiểm thêm client chưa có cache. Inject gateway/DB failure ở origin và đọc headers lỗi; không dùng mock Storage để thay lượt HTTP này.

**Kết quả mong đợi**

- Không asset mới được public khi DB chưa commit published; upload lỗi không finalize, finalization lỗi không đổi assetKey.
- Cleanup thất bại để lại private orphan có hồ sơ xử lý, không giả giao dịch DB và Storage cùng rollback.
- Cleanup đúng U không xóa object S2 hoặc asset published khác; gateway không nhận arbitrary object key để làm thay quyết định đã được phép.
- Trước mốc60s, client có thể còn hiện byte cache của A-old đã tải; đây không phải bypass published check ở origin. Tại60s và sau đó response đã stale phải revalidate; origin thấy unlink thì không phục vụ object và trả no-store. Client chưa cache bị chặn ngay ở origin sau unlink. Không hứa xóa byte đã lưu/tải ngoài ứng dụng hoặc thu hồi ảnh legacy public.
- Gateway/DB lỗi không được coi là published hoặc tự fallback public bucket; lỗi dùng no-store, cache stale không được phục vụ tiếp vì must-revalidate. Revalidate vẫn là request tới origin; private cache chỉ giảm request khi client đã có bản fresh, không phải traffic limit cho function công khai. Report phân biệt browser cache với origin requests và ghi kết quả từng mốc; không suy từ unit fake timer thành TTL/HTTP runtime đã đạt.
- Biến thể consumer UI thuộc T13/T15: cho GET ảnh lỗi trong menu bán hàng, quan sát placeholder giữ kích thước ô món, tên/giá/nút chọn món vẫn dùng được; không chặn đặt món hoặc payment chỉ vì ảnh không tải. Phần HTTP/cache thuộc T09; thiếu UI variant không được đánh toàn TC47 PASS ở gate tổng.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/integration/permissions/storageFailure.test.ts`.

### TC-PERM-48 — Migration chọn primary và fallback có căn cứ

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-06](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-18](specs/employee-management/spec.md); [UC-PERM-14](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Profile legacy trên DB synthetic cách ly có database/marker/engine/store_ids/checksum/schema guards đã xác minh qua observer DSN; T01 không dùng Auth/REST keys hoặc service binding. L1 dùng storeId S1, L2 dùng storeId S2 trên fixture legacy riêng không gieo role owner candidate. L1 có primary admin active đã xác minh; L2 primary mất và một earliest active admin duy nhất. Fixture setup đã xong trước snapshot chỉ đọc. Phần activate dùng profile transition và bundle T16 cùng sourceFingerprint. |
| **Dữ liệu thử** | L1 thêm admin thứ hai; L2 có hai active admin với createdAt khác nhau; thêm admin inactive và overrides năm mã cũ. |

**Các bước**

1. Chạy preflight chỉ đọc qua observer với config cố ý không có API URL/anon key/store JWT; so mapping/candidate/provenance/rights diff và snapshot DB trước/sau, kiểm output whitelist/schema tại artifacts/permissions/t01/<runId>. Không gọi hàm preflight phase27 có cấp/revoke phiên bên trong hoặc fetch Auth/REST.
2. Đánh dấu mapping fixture đã được phê duyệt rồi activate trong cửa sổ cách ly.
3. So owner count, employee UUID/role/active/overrides và hash tài chính/K/R1.

**Kết quả mong đợi**

- L1 primary đã xác minh thành owner; L2 earliest active duy nhất thành owner. Admin còn lại thành manager; nhân viên inactive vẫn inactive.
- Mọi tăng/giảm quyền do default mới được báo riêng; không gọi activation là parity. Overrides theo mapping được duyệt, không âm thầm bỏ deny.
- Sau bước activation T16 mới kiểm đúng một owner active/store; UUID lịch sử và hashes tài chính/K/R1 không đổi. Phần preflight T01 không sửa dữ liệu, không tạo/revoke session và chạy được khi thiếu toàn bộ Auth/REST keys vì chỉ dùng observer. Các checksums được báo là khớp marker đã ghi, không phải chứng nhận schema chưa drift.
- T01 chỉ kiểm bước preflight và sinh mapping fixture, ghi variant đã đạt; chưa đánh toàn TC48 PASS trước khi bước activation/postflight T16 được chạy. Mapping fixture không xác nhận primary owner cửa hàng thật; preflight chỉ đọc trên môi trường phát hành phải được yêu cầu và duyệt mapping riêng trước mutation.

**Nơi hiện thực:** [Preflight legacy](D:/Workspace/pos-cafe/tests/contracts/permissionMigration.contract.test.ts:122) và [activation transition](D:/Workspace/pos-cafe/tests/contracts/permissionTransition.contract.test.ts:112). Transition chạy PASS22/09 trên fixture primary/fallback/inactive/overrides, bảo toàn UUID/tài chính/K/R1; reviewer APPROVE phạm vi đã hiện thực. Aggregate yêu cầu cả preflight profile legacy lẫn activation profile transition cùng nguồn cuối; không dùng mapping synthetic cho dữ liệu đích. Bằng chứng và giới hạn trong [checkpoint22/09](../../../docs/implementation-log/permission-completion-2026-09-22.md).

### TC-PERM-49 — Preflight mơ hồ không cấp điều kiện activation

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-06](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md); [UC-PERM-14](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Profile legacy, nhiều store synthetic cách ly qua observer DSN với database/marker/engine/store_ids/checksum/schema guards, trong đó ít nhất một store READY và một store cần xác minh; không yêu cầu Auth/REST keys/binding, không activate catalog candidate để chạy ca này. |
| **Dữ liệu thử** | Timestamp nhỏ nhất bằng nhau; thiếu timestamp; không active admin; primary inactive; UUID primary không đủ provenance; unknown overrides; tên owner-candidate hoặc employee legacy 121 Unicode code points; marker thiếu/sai, database hoặc engine không khớp, fixture IDs sai/store ngoài fixture, migration checksum không khớp marker và private schema bị mở cho anon/authenticated. |

**Các bước**

1. Chạy từng preflight chỉ đọc và kiểm kết quả eligibility khi còn một store blocked; không gọi activation script trong TC này.
2. Kiểm mọi bảng của store READY và blocked giữ nguyên sau preflight.
3. Cung cấp mapping/provenance được xác minh hoặc sửa dữ liệu fixture theo phê duyệt rõ, rồi chạy lại preflight.
4. Trên mỗi biến thể môi trường thiếu/sai bằng chứng cách ly, chạy công cụ và so trạng thái trước/sau; kiểm output không thu thập hoặc serialize PIN/hash/token/DSN/MAC. Bước sửa fixture ở bước3 nằm ngoài cửa sổ snapshot của từng lượt công cụ.

**Kết quả mong đợi**

- Mọi trường hợp mơ hồ nhận OWNER_MIGRATION_REVIEW_REQUIRED cùng căn cứ thiếu; không UUID tie-break hoặc tự bật inactive owner.
- Một store chưa giải quyết làm eligibility toàn bộ là BLOCKED; không phát chứng nhận READY từng phần. TC51 kiểm riêng activation thực sự từ chối khi còn store blocked.
- Chỉ mapping hợp lệ và xử lý mọi blocking condition mới qua gate; không xuất PIN/hash/token vào báo cáo.
- Tên legacy 121 code points được báo cần xử lý/xác minh trước activation, không tự cắt hoặc sửa; tên 101–120 hợp lệ không bị siết lại. Không mặc định mọi row legacy từng được UI/DB bảo đảm không quá 120.
- Database/marker/engine/fixture/checksum hoặc private-schema guard sai thì công cụ dừng ở preflight môi trường, không cấp chứng nhận READY và không mutation. Không có API để chứng minh binding trong TC49; config thiếu Auth/REST keys không phải lỗi nếu observer profile hợp lệ. Mỗi output có schemaVersion/runId/sourceFingerprint/executionProfile cùng evidence source; serializer chỉ lấy field whitelist. Toàn TC49 có thể nghiệm thu trên legacy sau khi đủ các biến thể; không cần activation script hoặc Storage/Realtime cho bước chỉ đọc này.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/contracts/permissionMigration.contract.test.ts`.

### TC-PERM-50 — Bridge tương đương năm quyền cũ trên ba vai trò

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-02](specs/access-control/spec.md), [PERM-06](specs/access-control/spec.md), [PERM-10](specs/access-control/spec.md), [PERM-11](specs/access-control/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-14](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Profile bridge pha B additive chưa activate catalog15; helper baseline được giữ để đối chiếu; expected oracle do T01 sinh độc lập, helper bridge T02 đã có mới chạy comparison. |
| **Dữ liệu thử** | Admin/cashier/kitchen × active/inactive × mọi tổ hợp 4 trạng thái grant/deny cho năm mã cũ: 3×2×4^5=6.144 hồ sơ. |

**Các bước**

1. Kiểm manifest expected độc lập đủ 6.144 hồ sơ, rồi đối chiếu role/default và override helper cũ/mới trên từng hồ sơ; kiểm riêng ConfiguredEffective và guard active.
2. Chạy các flow phase 27 hợp lệ, kiểm grants/RPC cũ vẫn đóng.
3. Mở UI bridge và kiểm chưa lộ role/default 15 quyền như activation.

**Kết quả mong đợi**

- Kết quả từng quyền cũ khớp baseline ở mọi hồ sơ; guard active=false từ chối, dù quyền cấu hình vẫn được tính riêng.
- Legacy admin có bridge entry nội bộ; không xóa guard trước khi chuyển consumer và không tự bật default mới rồi gọi là parity.
- Không hồi sinh legacy financial DML/overload. 6.144 là số hồ sơ tham số hóa của một TC, không được báo thành 6.144 TC nghiệp vụ độc lập.
- T01 chỉ tạo/kiểm bộ expected, chưa chạy helper thì TC50 chưa PASS. T02 và các gate tổng chạy comparison thật trên profile bridge; hash nguồn cùng candidate không có nghĩa catalog bridge phải giống catalog candidate đã activate.

**Nơi hiện thực:** [permissionBridge.contract.test.ts](D:/Workspace/pos-cafe/tests/contracts/permissionBridge.contract.test.ts:1) và [manifest 52 biến thể](D:/Workspace/pos-cafe/tests/contracts/permissionBridgeCases.json:1) đã chạy comparison đủ 6.144 hồ sơ, null/duplicate/unknown cases, Auth/REST thật và revert ở T02. Regression guard/module UI legacy cùng fingerprint đạt; chưa phải candidate UI/browser E2E hoặc nghiệm thu activation. [biên bản T02](../../../docs/implementation-log/permission-t02-catalog-bridge-2026-09-15.md) liên kết discovery/results/options/profile và nêu giới hạn gate.

### TC-PERM-51 — Activation nguyên tử và client không tương thích

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-06](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-20](specs/employee-session/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-14](usecases.md) |
| **Mức** | E2E |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Full local Supabase cách ly; client/activation bundle/test cùng sourceFingerprint, executionProfile transition ghi từng pha legacy→bridge→candidate; backup fixture đã xác minh, pending K có từ phase27. |
| **Dữ liệu thử** | Client cũ không hiểu permissionContractVersion mới; client candidate hiểu contract; stores đã có mapping được duyệt. |

**Các bước**

1. Dừng mutation fixture, chạy preflight recheck có khóa và activate; quan sát postflight.
2. Mở client cũ và client mới, thử protected read/mutation bằng cả hai.
3. Kiểm catalog, owner count, grants và xử lý K có trước activation.
4. Trên fixture khác còn một store chưa có mapping được xác minh, gọi activation script và so mọi bảng của cả store READY lẫn blocked trước/sau. Expected: OWNER_MIGRATION_REVIEW_REQUIRED, không có partial activation; mọi role/constraint/grant/data của cả hai store giữ nguyên.

**Kết quả mong đợi**

- Đúng 15 mã, một owner active mỗi store; không trạng thái trung gian zero owner được mở cho app.
- Client cũ bị gate cập nhật/WRITE_PROTOCOL_UNSUPPORTED; server vẫn chặn surface legacy độc lập lời khai version. Client mới dùng contract/projection đúng.
- Pending K không đổi payload và còn xử lý theo quyền hiện hành. Không mở DML/RPC cũ để giữ client cũ; đây không phải thao tác activation live trong session viết docs.
- Postflight xác nhận consumer candidate không còn cơ chế guard cũ và DB role enum/bridge teardown theo bundle T16 đã hoàn tất; migration lịch sử và fixture bridge vẫn được giữ làm bằng chứng. Report ghi applied migration/catalog hashes từng pha, không ghép một hash DB cố định cho cả transition.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `tests/permissions/activation.e2e.ts`.

### TC-PERM-52 — Bootstrap nguyên tử và retry không thay owner

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-13](specs/employee-management/spec.md), [PERM-23](specs/store-onboarding/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-14](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Store Auth fixture hợp lệ tại S-new, chưa bootstrap; flow identity hiện có được giữ ngoài owner email account. |
| **Dữ liệu thử** | S-new=10000000-0000-4000-8000-000000000003; owner mới=20000000-0000-4000-8000-000000000201; B1=60000000-0000-4000-8000-000000000052; storeNo101, displayName “Cà phê An”, address “”, seedDemo=false; retry B1, B1 với ownerId khác, field PIN tự chèn; fault insert owner/seed. |

**Các bước**

1. Bootstrap store mới rồi đọc store/settings/owner.
2. Replay đúng request, sau đó đổi ownerId; thử chèn PIN vào payload bootstrap dù contract không nhận PIN.
3. Trên fixture mới, inject lỗi tạo owner và kiểm rollback.
4. Dùng các fixture provisioning độc lập cho storeNo0/1/2147483647/vượt integer; displayName trim rỗng/1/120/121 Unicode code points gồm ký tự ngoài BMP; địa chỉ0/500/501; UUID zero; identity không khớp storeNo. Chỉ biên hợp lệ có Auth tương ứng mới được bootstrap.
5. Chạy seedDemo=true, inject lỗi seed sau bootstrap rồi retry seed dưới phiên owner; kiểm store/owner/Store Key không mất và không gọi lại bootstrap để reset PIN.

**Kết quả mong đợi**

- Store/settings/owner tạo trong một transaction; không tạo admin legacy sau activation, đúng một owner active.
- Replay giữ identity và PIN owner, không thêm owner hoặc phát lại secret. ownerId không tương thích nhận BOOTSTRAP_CONFLICT. PIN tự chèn/field ngoài whitelist và biên input không hợp lệ nhận INVALID_WRITE_REQUEST theo adapter mapping, không mutation; không coi bootstrap có tham số đổi PIN. Provisioning identity không khớp nhận FORBIDDEN.
- Lỗi insert owner nhận PERMISSION_UPDATE_UNAVAILABLE; không để lại store/settings dở dang hoặc store không có owner, không tạo kênh reset PIN qua bootstrap.
- Seed lỗi sau bootstrap giữ store/owner/Store Key trả về; cảnh báo và retry chỉ gọi seed có quyền hiện hành, không reset owner. Các biên hợp lệ tạo đúng một owner; chính sách PIN khởi tạo giữ baseline, chưa ép đổi.

**Nơi hiện thực:** T04 kiểm bootstrap candidate SQL, exact owner invariant, hai biên storeNo, Unicode, input strict, provisioning binding, retry/conflict và fault owner insert rollback. Seed flow T08, A→E và toàn UC14 T16 chưa chạy. [Suite T04](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md).

### TC-PERM-53 — Kiểm tra trước triển khai và rollback không làm mất giao dịch sau backup

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-06](specs/access-control/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-14](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Runtime cách ly có snapshot backup và runbook rollback; executionProfile transition ghi từng pha trước/sau của cùng bundle/sourceFingerprint, mỗi biến thể dùng fixture riêng. |
| **Dữ liệu thử** | Pha B additive chưa activation; pha D đã có payment Q sau thời điểm backup. Biến thể launcher dùng cấu hình giả lập project/backend A và B, reference hợp lệ/thiếu, kết nối chỉ tới fixture cách ly; không dùng thông tin xác thực hay dữ liệu live. |

**Các bước**

1. Rollback candidate trước activation và so grants/data baseline.
2. Ở pha D, tạo Q hợp lệ sau backup rồi đánh giá đề nghị restore backup cũ.
3. Thử gate dừng ghi/đối soát và phương án forward fix; so hashes K/R1.
4. Với launcher live-read-only do T16 đóng gói, chạy synthetic/dry-run trên fixture cách ly: đúng target/reference, sai project/backend và thiếu reference bắt buộc. Theo dõi thời điểm bắt đầu đọc dữ liệu nghiệp vụ, so snapshot DB trước/sau và kiểm output/log; không kết nối môi trường live.

**Kết quả mong đợi**

- Rollback B giữ nguyên data và guard/grants phase 27.
- Không restore backup cũ khi việc đó làm mất Q; phải dừng ghi và chứng minh không mất giao dịch hoặc đối soát/khôi phục đầy đủ trước restore.
- Forward fix/client-server tương thích là đường tiếp tục khi không đủ điều kiện restore. Không mở legacy grants hoặc rewrite K/R1 để rollback.
- Launcher dừng trước truy vấn dữ liệu nghiệp vụ khi sai target hoặc thiếu reference. Cấu hình hợp lệ chỉ chạy lõi preflight đọc và xuất báo cáo theo whitelist; DB trước/sau không đổi, không tạo/revoke phiên hoặc mutation khác, không lộ credential/PIN/hash/token/MAC. Biến thể này thuộc gate 60 TC của T16, chạy trên sourceFingerprint đã bao gồm launcher; T17 chỉ chạy launcher đã kiểm trên live sau khi có ủy quyền riêng.

**Nơi hiện thực:** [Fixture và assertions](D:/Workspace/pos-cafe/tests/contracts/permissionRollbackFixture.ts:1), ba file `permissionRollbackAdditive.contract.test.ts`, `permissionRollbackPreflight.contract.test.ts`, `permissionRollbackRecovery.contract.test.ts`; config `vitest.permission-rollback.config.ts`. Ba variant DB cách ly PASS22/09 theo [source/evidence riêng](../../../docs/implementation-log/permission-completion-2026-09-22.md); dùng logical fixture snapshot, không tuyên bố physical backup/PITR restore. Chưa có gate tổng cùng source cuối.

**Gate vận hành bổ sung cho DELIVERY-03, ngày28/09:** diễn tập release controller trên bản sao backup dưới actor `postgres` không superuser, không chỉ restore operator. Phải chứng minh: (1) đúng77 UUID và closure được duyệt bị xóa trong transaction,66 Auth users ngoài scope/Storage metadata còn nguyên; (2) cleanup và empty activation dùng cùng connection/transaction, lỗi fragment trả lại cả dữ liệu/catalog/sequence như trước; (3) sai source/bundle/backup/proof, catalog/FK/scope drift hoặc dữ liệu mới chặn trước hiệu ứng; (4) prepare catalog có provenance và probe REST pass-through, baseline sau prepare được kiểm cụ thể; (5) bootstrap legacy đã được nhận/đang đợi trước cutover không tạo quán admin/thiếu owner sau cutover; (6) rehearsal mặc định rollback và commit cần mode/binding rõ; (7) object Storage chỉ được xóa qua API sau DB commit, đúng hai payload đã backup, ngoài scope giữ nguyên, lỗi giữa chừng có journal có thể tiếp tục. Đây là gate release bổ sung; kết quả TC53 fixture lịch sử không thay nó. Không tự nhận PASS khi controller hoặc rehearsal chưa chạy.

### TC-PERM-54 — TTL, mất ACK và K có trước migration

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-29](specs/write-idempotency/spec.md), [PERM-30](specs/write-idempotency/spec.md); [UC-PERM-15](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Profile transition tạo K pending trước activation rồi chuyển candidate bằng bundle cùng sourceFingerprint; order đã mở hơn24h; K applied có R1 lịch sử. |
| **Dữ liệu thử** | Các mốc 23h59m, đúng 24h, 24h+1ms; mất ACK register/execute; actor B đủ quyền takeover; payload khác dùng cùng K. K-absent=50000000-0000-4000-8000-000000000099 chưa tồn tại; K-S2=50000000-0000-4000-8000-000000000102 chỉ tồn tại ở S2. |

**Các bước**

1. Activate fixture, chủ động get/execute/cancel đúng K trong từng mốc TTL.
2. Mô phỏng mất ACK và khôi phục bằng cùng K; gửi payload khác với ID đã dùng.
3. Đổi tên/giá/quyền rồi đọc lại terminal R1 bằng actor còn quyền.
4. Bằng phiên S1 còn quyền action, get/execute/cancel K-absent và K-S2.

**Kết quả mong đợi**

- Đúng ngưỡng 24h pending K hết hạn theo protocol, nhưng order không expire. OPERATION_EXPIRED không được diễn giải thành đóng order.
- Mất ACK dùng WRITE_RESULT_UNKNOWN khi chưa xác minh; không tự tạo K/payment mới. Payload khác nhận IDEMPOTENCY_KEY_REUSED.
- R1 và receipt lịch sử giữ nguyên; quyền action hiện hành vẫn áp cho lookup/takeover. Tối đa một hiệu ứng mỗi K.
- K chưa tồn tại trong store hiện hành nhận OPERATION_NOT_FOUND; response không tiết lộ K-S2 hoặc R1 của store khác. K tồn tại cùng store nhưng thiếu action vẫn là FORBIDDEN theo TC39.

**Nơi hiện thực:** T06 kiểm TTL biên, mất ACK, K terminal có trước fragment và immutable payload/R1/initiator/executor; order không hết hạn cùng K. Full activation bundle và mapping production thuộc T16, chưa chạy. [Suite T06](D:/Workspace/pos-cafe/tests/contracts/permissionFinancial.contract.test.ts:1), [regression](D:/Workspace/pos-cafe/tests/contracts/permissionFinancialRegression.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t06-financial-authority-2026-09-16.md).

### TC-PERM-55 — Gate Realtime thật với hai thiết bị

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-24](specs/multi-device-sync/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-26](specs/multi-device-sync/spec.md); [UC-PERM-12](usecases.md) |
| **Mức** | E2E |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Runtime cách ly có Auth/REST/Realtime thật; hai browser foreground; trace ghi server commit và monotonic clock từng client. |
| **Dữ liệu thử** | Mười chu kỳ cấp rồi thu hồi report.view cho C; global catalog event; reconnect; lost signal có kiểm soát. |

**Các bước**

1. Ghi tCommit, tSignal và tApplied, cùng thời lượng cả chuỗi revision/snapshot/apply.
2. Chạy mười chu kỳ cấp/thu, rồi global catalog update và reconnect; thu mọi execution record.
3. Chặn signal ở một client để kiểm fallback và phục hồi; không cấu hình retry để che lần vượt ngưỡng.

**Kết quả mong đợi**

- Với điều kiện ngân sách đáp ứng, mỗi tApplied−tSignal≤5s; fallback từ commit≤35s chỉ khi poll start≤30s và tổng chain≤5s.
- Không coi tCommit→tSignal luôn có trần hoặc mỗi RPC 5s là đủ. Lần không đạt điều kiện vẫn được báo cùng nguyên nhân, không bỏ khỏi thống kê.
- Thiếu Realtime thật thì TC NOT RUN và gate BLOCKED; fake timer không thay bằng chứng. Mười chu kỳ tạo 20 thay đổi, vẫn một TC tham số hóa.

**Nơi hiện thực:** [Realtime E2E](D:/Workspace/pos-cafe/tests/supabase/permissionRealtime.spec.ts:1), config `playwright.permission-realtime.config.ts`. Runtime Supabase/Realtime cách ly PASS22/09, 20 thay đổi/hai browser, catalog, mất signal có đối chứng và reconnect gate. [Checkpoint](../../../docs/implementation-log/permission-completion-2026-09-22.md) ghi số đo, snapshot nguồn và giới hạn; chưa có gate tổng cùng source cuối, không chứng nhận SLA Production.

### TC-PERM-56 — E2E vai trò và cấp/thu quyền trong ca

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-01](specs/access-control/spec.md), [PERM-02](specs/access-control/spec.md), [PERM-03](specs/access-control/spec.md), [PERM-04](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-16](specs/employee-management/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-27](specs/receipt-printing/spec.md); [UC-PERM-01](usecases.md), [UC-PERM-02](usecases.md), [UC-PERM-04](usecases.md), [UC-PERM-09](usecases.md), [UC-PERM-11](usecases.md) |
| **Mức** | E2E |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | F0 trên Supabase cách ly; bốn role đang bật; P paid và tablet dùng chung. |
| **Dữ liệu thử** | O/M/C/W theo defaults, thêm fixture A có overrides; A được cấp riêng reprint; M mặc định; response receipt còn chờ khi đổi employee. |

**Các bước**

1. Đăng nhập từng role, đối chiếu nav/action và các luồng UC-01/02/04/09/11 tương ứng.
2. A xem P, O cấp reprint, A in lại rồi thử payment/K; M thử cấp quyền owner-only hoặc vượt ceiling.
3. Giữ receipt response, khóa phiên và đăng nhập người khác; resolve response cũ.

**Kết quả mong đợi**

- Defaults 15/12/7/3 và UI/server khớp D0; kitchen0 chưa bật. A theo overrides F0 chỉ floor/history/report, không in; grant reprint không cấp payment.take.
- Không vượt owner invariant, quyền theo trường hoặc ceiling qua UI/RPC. Không dùng tên role thay tập quyền thực tế.
- Không receipt/DOM/cache từ employee trước lọt sang employee sau; không lệnh print do response muộn. Chỉ các UC được truy vết ở TC này được tính là coverage của TC.

**Nơi hiện thực:** [Role E2E](D:/Workspace/pos-cafe/tests/supabase/permissionRoles.spec.ts:158), config `playwright.permission-roles.config.ts`: PASS22/09 trên Supabase cách ly, đủ defaults15/12/7/3, overrides floor/history/report, cấp riêng reprint không cấp payment/K, ceiling qua UI/RPC và receipt response muộn khi đổi sang nhân viên cũng có history/reprint. Kiểm cache bằng QueryClient thật, baseline có dữ liệu rồi xác nhận cache A bị xóa. Print stub trả focus sau dispatch; không chứng minh giấy đã in hoặc hộp thoại native. Reviewer APPROVE slice, source/report/snapshot trong [checkpoint](../../../docs/implementation-log/permission-completion-2026-09-22.md); chưa phải gate tổng cùng source cuối.

### TC-PERM-57 — Kiến trúc, mã lỗi và tính toàn vẹn truy vết

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-07](specs/access-control/spec.md); Không có UC; ngoại lệ ràng buộc kiến trúc tại traceability.md |
| **Mức** | đơn vị |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Profile static/unit trên candidate source/docs đủ artifact; full variant của gate tổng sau cleanup consumer T13. T03 hoặc phần component/new-consumer tại T13 chỉ ghi variant đã kiểm, không báo toàn TC57 PASS khi còn consumer candidate dùng guard cũ. Không cần actor UI hoặc DB thật cho TC này. |
| **Dữ liệu thử** | Import graph, DTO/error union, mọi consumer catalog; manifest 30 PERM/15 UC/60 TC; danh sách cho phép migration lịch sử/fixture bridge và danh sách consumer candidate phải dọn. |

**Các bước**

1. Chạy architecture guard khi implementation được giao; scan nguồn role/default/module trùng lặp, phân biệt consumer candidate đang chạy với migration lịch sử và fixture bridge được phép giữ.
2. Parse các dòng PMSG đã phân loại trong design9/M0 thành record ID/type/context/code/codeStatus/textStatus/exactText/source/owningTC. Kiểm ID unique, tập ID và exact text/context hai bảng bằng nhau; đối chiếu nguồn thông báo UC/delta được từng dòng chỉ định và implementation của ngữ cảnh đó. Không quét mọi chuỗi trong dấu ngoặc kép: fixture name, địa chỉ trống, nhãn nút và trích dẫn giải thích đã được loại khỏi danh mục thông báo kết quả.
3. Chạy negative control tài liệu: bỏ hoặc đổi câu PMSG-OK08 ở M0, đổi context PMSG-E29 hoặc bỏ TC sở hữu phải làm kiểm tra thất bại; thêm tên fixture Mai trong dữ liệu không được tạo lỗi thiếu thông báo.
4. Đếm ID/link/requirement↔UC↔TC từ file thật; đối chiếu manifest và ngoại lệ PERM-07.

**Kết quả mong đợi**

- Domain/core/ports không có import cấm; DTO không lộ kiểu Supabase. Consumer candidate không dùng requireAdminActor/module map/defaults cũ song song catalog sau cleanup T13; không xóa migration lịch sử hoặc fixture bridge chỉ để scan không còn chữ legacy.
- Mọi code/message được phân loại đều tồn tại hoặc khai báo mới/thay đổi đúng design; catalog có 50 ID PMSG unique, design/M0 không thiếu hoặc lệch câu/context, mọi dòng có nguồn và TC sở hữu variant exact-text. Thêm thông báo mới phải đăng ký ID/source/TC; bộ kiểm không tự coi mọi chuỗi ngoặc kép là thông báo. Kiểm cấu trúc tài liệu không được báo consumer đã hiện thực hoặc runtime PASS.
- Requirement chưa có TC=0, UC chưa có TC=0; trường hợp không có UC có giải trình. Không lấy ba số viết tay làm bằng chứng; TC này không chứng minh runtime security.
- SQL enum/bridge teardown là postflight T16 được kiểm ở TC51, không giả TC57 unit đã kiểm DB hoặc đòi xóa bridge trước khi TC50 chạy. Manifest chỉ nhận full TC57 PASS khi mọi consumer candidate đã được đối chiếu, không lấy kết quả component T03 thay gate tổng.

**Nơi hiện thực:** T03: [architectureBoundaries.test.ts](D:/Workspace/pos-cafe/src/architectureBoundaries.test.ts:185) bổ sung candidate core/domain/ports không phụ thuộc legacy guards/SDK/seed; kiểm docs tại [biên bản T03](../../../docs/implementation-log/permission-t03-domain-ports-mock-2026-09-15.md). Cleanup toàn consumer và message-to-UI mapping vẫn thuộc T13/T15, không suy full TC57 PASS.

### TC-PERM-58 — Recovery hạ tầng không là endpoint vượt quyền cho app

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-05](specs/access-control/spec.md), [PERM-13](specs/employee-management/spec.md), [PERM-22](specs/employee-session/spec.md); [UC-PERM-08](usecases.md) |
| **Mức** | tích hợp |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Role hạ tầng thử nghiệm và app sessions O/M/C trong runtime cách ly; owner active đã biết. |
| **Dữ liệu thử** | Thiếu operatorRef/caseRef/proof; sai store/target; fault audit; caller authenticated app. |

**Các bước**

1. O/M/C gọi recovery trực tiếp, không qua UI.
2. Bằng role hạ tầng, thử từng hồ sơ thiếu căn cứ hoặc target không khớp; inject audit failure.
3. So PIN/session/owner/audit và mẫu biên bản operator ngoài DB.

**Kết quả mong đợi**

- App caller kể cả owner nhận FORBIDDEN. Hồ sơ thiếu căn cứ nhận OWNER_RECOVERY_REVIEW_REQUIRED, không can thiệp.
- Qua recovery contract, target cùng store nhưng không phải owner hợp lệ nhận OWNER_PROTECTED; target khác store/không tồn tại bị chặn ở bước xác minh runbook trước gọi DB. Không đổi PIN/role/active của target khác.
- Audit failure rollback PIN/session. Bằng chứng DB fixture không được báo thành xác minh con người hay bàn giao PIN thật; runbook giữ kiểm tra độc lập đó.

**Nơi hiện thực:** T04 kiểm role hạ tầng riêng, app/service_role không có grants, operator/case/proof reference, sai target/store và rollback audit. DB synthetic không thay bằng chứng xác minh hỗ trợ ngoài app. [Suite T04](D:/Workspace/pos-cafe/tests/contracts/permissionIdentity.contract.test.ts:1), [biên bản](../../../docs/implementation-log/permission-t04-identity-owner-sessions-2026-09-16.md).

### TC-PERM-59 — Thông báo, validation và dirty-exit

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-04](specs/access-control/spec.md), [PERM-17](specs/employee-management/spec.md), [PERM-21](specs/employee-session/spec.md), [PERM-25](specs/multi-device-sync/spec.md); [UC-PERM-02](usecases.md), [UC-PERM-03](usecases.md), [UC-PERM-06](usecases.md), [UC-PERM-07](usecases.md), [UC-PERM-12](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Form nhân viên, self PIN owner và menu đang có dữ liệu chưa lưu; callbacks/RPC có thể được giữ bằng barrier. |
| **Dữ liệu thử** | Tên rỗng/120/121 Unicode code points; PIN năm số; confirm không khớp; close tự nguyện; revoke khi form bẩn; outcome failed/noop/applied. |

**Các bước**

1. Submit từng input biên và so exact text với các dòng PMSG-E32–E35 gắn TC59 ở M0; mô phỏng các lỗi được TC59 sở hữu như revision/refresh và PIN hiện tại sai theo đúng ngữ cảnh.
2. Rời form tự nguyện rồi thử lại trường hợp authority thu hồi quyền khi dirty dialog mở.
3. Trả lần lượt RPC failure/noop/applied cho create employee, lưu tên/role, reset PIN người khác và owner self-change; so nguyên câu PMSG-OK01/OK02/OK06/OK07 và PMSG-S01/S02, không chỉ kiểm toast tồn tại. Kiểm form và dữ liệu nhạy cảm không bị echo.

**Kết quả mong đợi**

- Lỗi field đúng từng câu M0; không gửi PIN hoặc confirm vào thông báo/log.
- Dirty-exit thông thường yêu cầu xác nhận; forced close do quyền mới không cho dirty dialog veto và dùng đúng câu PERM-25.
- Không toast thành công sau RPC lỗi hoặc kết quả chưa xác nhận. Các outcome applied thuộc TC59 dùng đúng PMSG-OK01/OK02/OK06/OK07 kể cả dấu chấm; PIN no-op dùng PMSG-S02, không hiện PMSG-OK07. Các thông báo success khác do TC sở hữu tại M0 kiểm, không mở rộng truy vết TC59.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/permissionMessages.test.tsx`.

### TC-PERM-60 — Click in, timer và chuyển phiên

| Phần | Nội dung |
| --- | --- |
| **Truy vết** | [PERM-20](specs/employee-session/spec.md), [PERM-25](specs/multi-device-sync/spec.md), [PERM-27](specs/receipt-printing/spec.md), [PERM-28](specs/receipt-printing/spec.md); [UC-PERM-11](usecases.md), [UC-PERM-12](usecases.md) |
| **Mức** | giao diện |
| **Nhóm** | bảo mật |
| **Tiền điều kiện** | Fixture ReceiptPrintLifecycle có print port spy, promise authorize và timer iframe điều khiển được; C có payment.take và orderHistory.view, deny receipt.reprint; G issued từ payment chủ động thành công, preview initial còn mở. Fixture reprint riêng có quyền đọc nguồn và receipt.reprint. |
| **Dữ liệu thử** | Double-click pending; response/ACK/callback muộn; offline; revoke rồi grant lại reprint/payment.take; thu riêng/quét hết quyền đọc; đổi employee/store/session; initial G/PR1/PR2 và reprint P; Cancel browser print dialog. |

**Các bước**

1. Bấm In để tạo PR1, giữ authorize response hoặc print timer; bấm lần hai khi lần đầu đang xử lý và kiểm hai click được coalesce.
2. Trên các fixture riêng, thu đúng quyền in khi vẫn còn quyền đọc nguồn; resolve request/timer muộn. Cấp lại quyền in rồi quan sát trước khi bấm In chủ động lần nữa. Với initial, grant receipt.reprint trong lúc payment.take vẫn thiếu để kiểm provenance không đổi.
3. Trên fixture khác, thu hết quyền đọc hoặc đổi employee/store/session rồi resolve callback/timer. Chạy positive control không đổi lifetime.
4. Với C bị deny reprint, authorize G/PR1 rồi dispatch print và mô phỏng Cancel browser dialog. Giữ preview mở, bấm In lần tiếp theo tạo PR2, authorize lại quyền hiện hành và dispatch. Gửi lặp ACK/callback của PR1 và PR2.
5. Trên fixture chưa dispatch, làm mất ACK authorize PR1; bấm “Thử lại”, xác nhận request vẫn PR1 và chỉ một print sau ACK trong lifetime còn hợp lệ. Resolve thêm response gốc đến muộn.
6. Đóng preview chủ động, kiểm G và các PR/timer bị bỏ khỏi client. Reload, đọc K/history hoặc mở lại receipt bằng lịch sử; kiểm không phục hồi provenance initial, không tự mint G và không tự in.

**Kết quả mong đợi**

- Mỗi click mới được chấp nhận khi không pending có UUID PR mới và kiểm authorize hiện hành trước một print command. Double-click pending chỉ có một PR/authorization/dispatch; callback của PR đã dispatch không in lại. PR chỉ là correlation trong client, không chứng minh dedup máy in hoặc số tờ giấy.
- Sau dispatch hoặc Cancel browser dialog, preview vẫn mở và G không bị tiêu hao; C còn payment.take in tiếp bằng PR2 dù không receipt.reprint. Không có thông báo buộc mở lịch sử để in thêm chỉ vì đã dispatch một lần.
- Chỉ mất quyền in thì nút ẩn, hủy pending authorize/timer và bỏ response muộn; preview còn đọc hợp lệ vẫn giữ, hiện đúng “Quyền in hóa đơn đã thay đổi. Bạn vẫn có thể xem hóa đơn.”. Initial read dựa payment.take OR orderHistory.view: còn history nhưng mất payment.take vẫn xem, không In initial; receipt.reprint không đổi provenance. Cấp lại quyền in hiện nút khi preview còn hợp lệ nhưng không tự in hoặc hồi sinh PR cũ. Sau dispatch hợp lệ, thông báo đúng “Đã gửi lệnh in.”, không khẳng định đã in ra giấy.
- Mất mọi quyền đọc nguồn hoặc mất/đổi session/store/employee thì đóng/purge preview và callback/timer; không cho dữ liệu hoặc lệnh in sang lifetime mới. Việc cấp lại quyền không tự mở preview đã đóng.
- Retry do người dùng chọn trước dispatch giữ PR1; ACK hợp lệ chỉ dispatch một lần, response gốc/ACK/callback lặp không thêm lệnh. Không tự retry/in vì offline, reconnect, refresh, response muộn hoặc phiên mới.
- Đóng preview discard grant/PR trong bộ nhớ, không persist G và không reopen initial từ K/history; entry lịch sử tuân reprint. Chưa có contract server biết preview đóng, nên không giả một lệnh close/consume server hoặc oracle server-deny chỉ dựa đóng UI.

**Nơi hiện thực:** Chưa viết kiểm thử cho change này. Đường dẫn dự kiến: `src/app/components/ReceiptPrintLifecycle.test.tsx + test quyền mới dự kiến`.

### TC-PERM-53-NEW79 — subcase scope approval ngày13/10/2026

Truy vết PERM-06/PERM-30, UC-PERM-14; mức kiểm local file-only và một observation hosted READ ONLY được giao. Đây là subcase TC53, không tăng bộ60TC. Tiền điều kiện: baseline77 SHA đã pin, checkpoint exact2 và nguồn user đã xác minh, Storage manifest exact2 lịch sử, source31 không drift. Input/output private và lệnh tại [biên bản](../../../docs/implementation-log/permission-close3-scope79-2026-10-13.md).

Các bước/expected: (1) union chính xác79 chỉ trả SCOPE_ONLY_VALIDATED_RELEASE_BLOCKED; (2) thiếu1/thêm1/thay1 UUID dù vẫn count79, đổi path/hash/provenance, chỉ dùng77 cũ, thêm Auth ngoài79 hoặc object3, sửa path/hash object/FK/eligibility đều trả SCOPE_APPROVAL_MISMATCH; (3) actual loader source31 từ chối manifest scope-only bằng INVENTORY_SCOPE_INVALID, backup bảo toàn thật bằng BACKUP_PROOF_INVALID; comparison74/75 thật với envelope trước nó synthetic diagnostic chỉ để tới nhánh restore phải RESTORE_PROOF_INVALID; (4)812 entries source31 phải drift0. Không dùng synthetic envelope làm proof phát hành.

Đã chạy18/18 local, ghi trong biên bản; hosted read xác nhận79/145/66/3 và quan hệ nhưng không phải full-row proof. Gate vận hành TC53 ngày28/09 tiếp tục bắt buộc với scope79 thay77 khi đủ proof mới; exact66 Auth và object3 phải bảo toàn. SequenceFAIL, backup eligibilityfalse, provider/NOSUPERUSER rehearsal chưa có vẫn chặn. Không nhận18/18 này thay gate release/backup/controller rehearsal.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.


### SEC-01 — oracle globals đã kiểm LOCAL (14/10/2026, chờ review)

Candidate01/source39 bị SEC yêu cầu sửa: projection roles thiếu expiration/comment/security labels. Source40 đã bổ sung `rolvaliduntil`, shared comment/security-label catalog, cùng bốn bản `pg_dumpall --roles-only --no-role-passwords` từ source trước capture, source cuối cửa sổ, pristine và allocation clone. Cùng binary/flags/restrict-key ngẫu nhiên cho một run; so toàn văn, không bỏ dòng. Mọi artifact/command được pin và loader tự recompute ba check bắt buộc `catalog:complete-roles`, `catalog:probe-roles`, `catalog:roles-window`. Cửa sổ source lệch phải refuse `BACKUP_V2_CATALOG_WINDOW_DRIFT`. Password vẫn ngoài profile đã ghi; không suy ra hosted global actor control. Positive fixture có expiration/comment; negative sửa riêng từng thuộc tính trên clone mới và trong source window, cộng forged PASS proof. Đây là sửa completeness trong phạm vi backup được ủy quyền, không đổi nghiệp vụ hoặc mở phase2. Source39 và candidate01 giữ nguyên, không tái gán PASS.


## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
