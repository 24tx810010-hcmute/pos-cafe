# Delta access-control — mô hình quyền 15 mã

Áp sau delta phase 27 tại `add-idempotent-write-operations`; phần không sửa giữ nguyên. Mã PERM-* là ID truy vết, không thay tên Requirement của baseline. Các hợp đồng lỗi/dữ liệu chi tiết ở [design](../../design.md).

## ADDED Requirements

### Requirement: Bộ vai trò dựng sẵn

Mã: **PERM-01**.

Hệ thống SHALL lưu đúng năm role `owner`, `manager`, `cashier`, `waiter`, `kitchen` ở catalog. Bốn role đầu SHALL dùng được; `kitchen` không được chọn khi tạo/sửa hoặc mở phiên vận hành cho tới change bếp. Người dùng MUST NOT tạo role tùy chỉnh. Form tạo/chuyển role chỉ chọn manager/cashier/waiter; owner do bootstrap/migration tạo, không được chọn qua quản trị.

#### Scenario: Danh sách role khi tạo nhân viên

- **GIVEN** actor có employee.manage và phiên hợp lệ
- **WHEN** mở form tạo nhân viên
- **THEN** đúng ba lựa chọn manager/cashier/waiter hiện ra; gửi owner/kitchen/accountant/mã lạ trực tiếp bị từ chối. `accountant` đã bị loại theo quyết định ngày 2026-09-15, không seed hoặc giữ làm role disabled.

#### Scenario: Nhân viên được cấp quyền chỉ xem mở phiên

- **GIVEN** waiter active với grants=[orderHistory.view,report.view], denies=[order.create,order.update]
- **WHEN** xác minh PIN thành công
- **THEN** xem được sơ đồ, báo cáo và lịch sử; không tạo/sửa đơn, thanh toán hoặc in lại hóa đơn.

### Requirement: Danh mục quyền hành động lưu ở tầng dữ liệu

Mã: **PERM-02**.

Hệ thống SHALL enforce đúng 15 mã trong bảng sau. Mặc định lấy từ catalog; client/domain MUST NOT giữ một bảng role→permission khác. Cột Có biểu thị grant mặc định. `kitchen` có tập rỗng và chưa bật. `floor.view` là quyền nền không thể deny của bốn role đang dùng; request deny quyền nền MUST bị từ chối trước lưu, không phá quy tắc denies thắng của payload hợp lệ.

| Mã | Owner | Manager | Cashier | Waiter |
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

`data.clearDemo` MUST chỉ owner; không cấp/grant cho non-owner. `employee.permission.edit`, `settings.manage`, `receipt.reprint` được ủy quyền theo PERM-16. Catalog MUST NOT chứa `data.wipe`, `store.key.rotate` hoặc quyền chuyển/gộp/giảm giá chưa triển khai. Thêm quyền tương lai là migration dữ liệu và mapping endpoint tương ứng, không tự coi một mã catalog là đã có chức năng.

#### Scenario: Cố tắt quyền nền

- **WHEN** owner gửi denies chứa floor.view cho cashier
- **THEN** từ chối PERMISSION_BASELINE_REQUIRED, không đổi overrides/revision; audit denied theo PERM-05 nếu actor/target đã xác minh.

#### Scenario: Gán quyền xóa mẫu cho manager

- **WHEN** owner gửi grants chứa data.clearDemo cho manager
- **THEN** từ chối OWNER_ONLY_PERMISSION; owner không được bỏ qua ràng buộc này.

#### Scenario: Quyền chỉ có mặc định ở owner vẫn ủy quyền được

- **WHEN** owner grant settings.manage và employee.permission.edit cho manager hợp lệ
- **THEN** hai quyền được thêm; không thêm role owner hoặc data.clearDemo.

### Requirement: Điều hướng suy ra từ quyền hành động

Mã: **PERM-03**.

Điều hướng SHALL suy từ catalog module/permission và quyền hiệu lực đã xác minh, không từ role rank. Sơ đồ là home/fallback chung do floor.view luôn có. Quản trị sơ đồ cần floor.manage; xem sơ đồ không cấp quyền đó. Các lối vào đơn, payment, lịch sử, báo cáo, menu, nhân viên, settings, Tra cứu và in lại SHALL dùng mapping ở design, với dữ liệu đọc tối thiểu phục vụ từng thao tác. Quyền action không tự cấp history/report. Quyền receipt.reprint riêng không tự mở lịch sử hoặc Tra cứu.

#### Scenario: Mất module đang mở

- **WHEN** manager mất report.view trong lúc đang xem báo cáo
- **THEN** phần báo cáo đóng theo PERM-25 và về sơ đồ; không tự đăng xuất hay cấp quyền khác.

#### Scenario: Chỉ còn quyền nền

- **GIVEN** cashier hợp lệ bị deny mọi quyền tùy biến còn lại
- **WHEN** snapshot mới được áp dụng
- **THEN** sơ đồ vẫn hiện, không còn nút thao tác không có quyền; không hiển thị màn “không có module” do thu hồi quyền nền.

### Requirement: Ẩn phần tử điều khiển khi thiếu quyền

Mã: **PERM-04**.

Thiếu quyền SHALL không render lối vào/nút/editor tương ứng. Trạng thái nghiệp vụ không cho thao tác nhưng actor có quyền SHALL giữ nút disabled cùng lý do. Mọi đường action và server MUST kiểm lại dù nút bị ẩn; không cho dirty-exit hoặc callback cũ vượt việc đóng phần mất quyền.

#### Scenario: Nhân viên chỉ xem không có quyền in lại

- **GIVEN** waiter được grant orderHistory.view/report.view và deny order.create/order.update, chưa có receipt.reprint
- **WHEN** nhân viên này xem một đơn paid
- **THEN** nội dung lịch sử được đọc nhưng nút in lại không render.

#### Scenario: Đơn đã hủy

- **GIVEN** actor có quyền đọc lịch sử và receipt.reprint
- **WHEN** chọn đơn void
- **THEN** nút in lại hiện disabled, lý do “Đơn đã hủy không thể in lại hóa đơn.”

### Requirement: Nhật ký thay đổi quyền

Mã: **PERM-05**.

Quản trị nhân viên/role/overrides/PIN/active SHALL ghi audit với actor thật hoặc operator recovery, store, target, requestId, kind, outcome, reason, timestamp server, revisions, actorEffective, targetBefore, proposedAfter và actualAfter. PIN/hash/token/bí mật MUST NOT xuất hiện. Applied SHALL nguyên tử với thay đổi. Denied sau xác minh actor session và target cùng store SHALL được lưu, actualAfter=before; từ chối không tiết lộ target khác store. Lỗi hạ tầng/audit write SHALL rollback toàn transaction và không giả đã lưu audit. Known denial SHALL trả envelope thay vì raise rollback audit đã ghi.

No-op hợp lệ SHALL ghi một row outcome=noop, không tăng employee/catalog revision hay phát signal thay đổi quyền. Retry cùng requestId/payload SHALL không thêm hiệu ứng/audit; đổi payload cùng requestId SHALL bị từ chối. Conflict revision SHALL ghi denied, không ghi đè. Bản chụp proposedAfter không bao gồm PIN hoặc dấu vết xác định PIN.

Owner hoặc employee.permission.edit SHALL đọc audit chi tiết cùng store, không bị giới hạn theo target ceiling; người khác/direct DML sửa/xóa SHALL bị từ chối. Audit SHALL giữ toàn bộ, không GC, không bị clear demo xóa; không thêm màn audit trong change. Realtime MUST NOT phát row audit chi tiết.

#### Scenario: Manager bị trần quyền từ chối

- **GIVEN** manager thiếu report.view, target cashier được grant report.view
- **WHEN** manager hợp lệ reset PIN target
- **THEN** một audit denied chứa missingPermissions=[report.view], actualAfter=before; PIN/session/role/overrides không đổi.

#### Scenario: Lưu audit thất bại

- **WHEN** thao tác update role gặp lỗi insert audit
- **THEN** role/overrides/revision/signal đều rollback; client nhận PERMISSION_UPDATE_UNAVAILABLE, không thông báo thành công.

#### Scenario: Retry và no-op

- **WHEN** actor gửi lại cùng requestId và cùng payload no-op đã hoàn tất
- **THEN** vẫn chỉ một row no-op, không tăng revision; phải kiểm lại quyền đọc hiện hành trước trả dữ liệu audit/snapshot.

#### Scenario: Người được ủy quyền đọc nhật ký

- **GIVEN** manager có employee.permission.edit
- **WHEN** đọc audit cùng store, kể cả audit target owner
- **THEN** đọc được; query store khác hoặc UPDATE/DELETE audit bị từ chối.

### Requirement: Chuyển đổi quyền có preflight và chủ sở hữu xác định

Mã: **PERM-06**.

Migration SHALL kiểm toàn bộ store trước activation, xuất mapping oldRole/newRole, overrides trước/sau, owner candidate và căn cứ. Ưu tiên admin gốc khi có căn cứ bootstrap và active; khi gốc không còn/đã đổi role, chọn admin active có created_at sớm nhất duy nhất. ID suy từ store không tự chứng minh nguồn gốc. Thiếu provenance, primary inactive, timestamp thiếu/trùng, không có active admin hoặc mapping mâu thuẫn SHALL chặn store và toàn activation, yêu cầu mapping đã xác minh; không tự chọn theo UUID hoặc bật lại nhân viên khóa.

Một owner active/store SHALL được thiết lập nguyên tử; admin khác thành manager; cashier/kitchen giữ role, active/inactive và dữ liệu lịch sử được bảo toàn. Overrides năm mã cũ được chuẩn hóa theo PERM-08, không âm thầm bỏ deny. Các chênh lệch quyền do role mới/owner-only phải xuất thành báo cáo được duyệt, không gọi là tương đương phase bridge. Đơn/payment/K/R1/audit lịch sử MUST không sửa. Preflight không tự sửa dữ liệu thật.

Preflight SHALL là công cụ chỉ đọc, không cấp/revoke session như tác dụng phụ của kiểm môi trường; báo cáo chỉ serialize field được phép, không PIN/hash/token/MAC. T01 kiểm fixture synthetic; preflight toàn store thật và duyệt mapping là bước chuẩn bị phát hành riêng trước cửa sổ mutation. Tên vượt hợp đồng hiện có 120 code points nếu được tìm thấy phải báo NEEDS_REVIEW, không cắt tên hoặc tự sửa dữ liệu.

#### Scenario: Admin gốc có bằng chứng

- **GIVEN** store có primary admin active được xác minh cùng một admin khác
- **WHEN** migration áp mapping đã duyệt
- **THEN** primary thành owner duy nhất, admin kia thành manager; UUID nhân viên và dữ liệu tài chính giữ nguyên.

#### Scenario: Không chọn được owner

- **GIVEN** hai active admin có timestamp nhỏ nhất bằng nhau hoặc không còn active admin
- **WHEN** chạy preflight
- **THEN** OWNER_MIGRATION_REVIEW_REQUIRED, báo các candidate và căn cứ thiếu; không đổi dữ liệu hoặc activate một phần.

### Requirement: Ranh giới kiến trúc và nguồn catalog duy nhất

Mã: **PERM-07**.

Domain/core/ports SHALL không phụ thuộc React/app/features/adapters/Supabase. Ports SHALL khai báo DTO camelCase cho catalog, authority, quản trị và signal; cả mock và Supabase SHALL cùng contract. Core dùng dữ liệu catalog truyền vào, không hằng số role→module/quyền. Catalog write chỉ qua đường migration/maintenance được kiểm soát, không qua employee app; thay default toàn cục SHALL tăng catalog revision và làm mới mọi phiên liên quan theo PERM-26.

#### Scenario: Thay mặc định toàn cục

- **WHEN** operator cập nhật default qua transaction catalog được phép
- **THEN** backend và client cùng catalog revision sau hội tụ, không cần sửa bảng hằng số code; layer test vẫn không phát hiện import cấm.

## MODIFIED Requirements

### Requirement: Ghi đè quyền theo từng nhân viên

Mã: **PERM-08**.

ConfiguredEffective(e) SHALL bằng (defaults(role) ∪ grants) − denies với denies thắng. Tập dùng cho ceiling SHALL không biến thành rỗng khi target inactive; active/session được kiểm riêng khi thực thi. Missing trường update giữ nguyên; null hoặc explicit reset biểu diễn overrides mặc định; arrays rỗng hợp lệ, duplicate được khử, mã không tồn tại/sai kiểu/owner-only/baseline deny bị từ chối. Chỉ loại grant trùng default và deny vốn không có grant/default khi việc đó không đổi ý nghĩa hiện tại; catalog revision gắn snapshot để không chuẩn hóa theo catalog cũ.

Đổi role thật SHALL xóa overrides cũ, rồi áp bộ overrides mới nếu request gửi rõ trong cùng lần lưu; thiếu bộ mới thì dùng mặc định role mới. Ceiling tính trên kết quả cuối sau cả hai bước. Giữ nguyên role MUST NOT tự xóa overrides khi request thiếu trường này. Gửi overrides mới/reset riêng cần employee.permission.edit; request trộn role và overrides cần cả hai quyền quản trị. Actor không tự sửa/reset role/overrides.

#### Scenario: Deny thắng grant

- **WHEN** cùng một mã vừa thuộc grants vừa thuộc denies
- **THEN** deny thắng; normalize giữ đúng tập quyền và nguồn chặn cần thiết.

#### Scenario: Cấp thêm quyền cho một thu ngân

- **GIVEN** owner, hoặc manager đã được cấp employee.permission.edit, có phiên hợp lệ và qua cả hai trần Q2 đối với target
- **WHEN** grant order.voidPaid cho một cashier cụ thể
- **THEN** chỉ cashier đó có quyền hủy paid; cashier khác giữ mặc định không có quyền.

#### Scenario: Lưu đúng mặc định vai trò

- **GIVEN** actor có employee.permission.edit và qua invariants/trần quyền
- **WHEN** đưa quyền target về đúng mặc định rồi lưu
- **THEN** overrides chuẩn hóa thành null; quyền hiệu lực đúng defaults, audit/no-op và revision theo PERM-05.

#### Scenario: Grant và deny trùng nhau

- **WHEN** cashier có order.voidPaid trong grants và denies
- **THEN** không có order.voidPaid; lưu chuẩn hóa giữ kết quả deny và snapshot minh bạch.

#### Scenario: Role no-op không xóa deny

- **GIVEN** cashier bị deny payment.take
- **WHEN** actor gửi role=cashier, không gửi overrides
- **THEN** deny payment.take giữ nguyên; reset chủ động là request riêng có kiểm quyền.

### Requirement: Chốt quyền ở luồng nghiệp vụ và guardrail phía database

Mã: **PERM-09**.

Mọi bề mặt trong inventory 15 quyền ở design SHALL kiểm actor từ phiên server active, cùng store và quyền hiện hành; không tin employeeId/role/permission list/print-purpose từ client. Server SHALL bảo vệ projection đọc và hành động ghi qua RPC, direct SELECT/DML, Storage và Realtime. Client guard chỉ phục vụ trải nghiệm.

Đọc floor operational projection SHALL được floor.view cho phép; không trả toàn bộ payment/receipt/chi tiết nhân viên/settings bí mật. orderHistory.view cho đọc đơn đã kết thúc; report.view cho projection báo cáo; settings.manage/menu.manage/floor.manage/employee.manage/employee.permission.edit cấp dữ liệu cần để thực hiện chính thao tác. Quyền xem không tự cho ghi. Catalog public read khi có phiên và roster PIN tối thiểu là ngoại lệ đọc đã nêu tường minh trong design, không mở overrides/hash/audit.

Quyết định bổ sung ngày 2026-09-16: biểu đồ doanh thu theo giờ SHALL dùng múi giờ cấu hình của cửa hàng; mặc định UTC+7 (`Asia/Ho_Chi_Minh`, dữ liệu cũ `Asia/Saigon` tương đương). Ngày doanh thu vẫn là `business_date` đã lưu. Chỉ owner SHALL được thay đổi giá trị múi giờ; ủy quyền `settings.manage` không cấp quyền sửa trường này. Request non-owner chứa múi giờ bằng giá trị hiện hành được phép xử lý các trường khác; nếu đổi múi giờ SHALL trả `FORBIDDEN` và không ghi một phần request. Server kiểm giá trị dưới khóa trong T08; UI tương ứng ở T13.

Quyền `report.view` SHALL cho phép đọc tối đa 20 đơn `paid` mới nhất trong toàn khoảng ngày báo cáo, kể cả khi thiếu `orderHistory.view`. Projection chỉ gồm `id` để định danh dòng, số đơn, business_date, loại tại bàn/mang đi, tên bàn hiện hành hoặc null, tổng tiền và trạng thái paid. Thứ tự business_date/orderNo/id giảm dần; giới hạn 20 do server quyết định, không nhận page/limit/status từ client. Endpoint này MUST NOT trả món, payment, receipt, nhân viên hoặc lockVersion, và MUST NOT cấp quyền mở history detail/receipt từ bảng báo cáo. UC đọc và TC-PERM-25 kiểm riêng quyền báo cáo với quyền lịch sử.

#### Scenario: Báo cáo theo múi giờ cửa hàng

- **GIVEN** cửa hàng dùng `Asia/Ho_Chi_Minh`, đơn paid có `paid_at=2026-09-15T17:30:00Z` và `business_date=2026-09-15`
- **WHEN** nhân viên có `report.view` đọc báo cáo ngày 2026-09-15 từ các thiết bị khác múi giờ
- **THEN** doanh thu của đơn thuộc nhãn giờ `00` trên mọi thiết bị, vẫn thuộc báo cáo ngày 2026-09-15.

#### Scenario: Người được ủy quyền cài đặt đổi múi giờ

- **GIVEN** manager có `settings.manage`, cửa hàng đang dùng `Asia/Ho_Chi_Minh`
- **WHEN** manager gửi thay đổi tên cửa hàng và múi giờ `America/New_York` trong cùng request
- **THEN** trả `FORBIDDEN`, không đổi tên hoặc múi giờ; owner có thể thực hiện request này.

Ngoại lệ ảnh thực đơn đã công bố: anonymous GET chỉ trả bytes ảnh published qua function public được giới hạn trong design6.1; không trả registry/roster/tenant metadata, không đọc staging hoặc cho ghi. Legacy public GET giữ hiện trạng. Đường upload/delete/staging read vẫn bắt buộc store JWT và employee authority/menu.manage; không tắt kiểm JWT của write gateway để hỗ trợ img src. Published state kiểm ở origin, cache60s và byte đã tải có giới hạn nêu trong design.

Mọi mutation phải kiểm lại sau chờ khóa; cập nhật quyền đã commit trước authorization cuối SHALL có hiệu lực, dù UI còn cũ. Read request mới sau revocation commit SHALL không trả dữ liệu bị thu hồi. Dữ liệu đã được nhận trước đó không thể thu hồi khỏi bản sao ngoài app; client xử lý cache trong phạm vi PERM-25.

#### Scenario: Bypass UI bằng SELECT

- **WHEN** nhân viên không có quyền lịch sử/báo cáo gọi SELECT trực tiếp bảng tài chính
- **THEN** không nhận raw rows vượt projection được phép, kể cả cùng store.

#### Scenario: Gọi thẳng vào database khi thiếu quyền

- **WHEN** nhân viên không có payment.take gọi RPC thanh toán trực tiếp
- **THEN** database FORBIDDEN, không tạo payment hoặc thay trạng thái K vì thiếu quyền.

#### Scenario: Cashier không có order.voidPaid gọi thẳng DB để hủy

- **WHEN** cashier mặc định có phiên thật gọi thẳng void_order qua K
- **THEN** server từ chối theo quyền hiện hành, không hủy đơn paid; legacy overload không mở đường vòng.

#### Scenario: Không đọc dữ liệu ngoài quyền qua raw table

- **GIVEN** waiter không có report.view/orderHistory.view
- **WHEN** gọi trực tiếp REST bảng orders/payments, RPC report/history hoặc kênh dữ liệu lịch sử
- **THEN** không lấy được projection báo cáo/lịch sử; cùng store không đủ để qua authorization.

#### Scenario: Upload ảnh khi không có quyền menu

- **WHEN** cashier gọi Storage upload/delete trực tiếp hoặc gateway ảnh mà không có menu.manage
- **THEN** bị từ chối, không tạo/xóa object; không dùng Store Key auth làm quyền quản trị menu.

#### Scenario: Ảnh đã công bố tải bằng img src

- **WHEN** browser không gửi Authorization tải URL ảnh published, rồi thử URL staging và method ghi trên function public
- **THEN** chỉ ảnh published được GET; staging/unknown không lộ bytes, ghi/list không được phép; không cần hoặc đặt token vào URL, write gateway vẫn kiểm JWT và menu.manage.

#### Scenario: Revoke trong lúc chờ

- **GIVEN** payment execute đang chờ business lock, owner commit deny payment.take
- **WHEN** khóa được nhả
- **THEN** execute kiểm quyền mới và trả FORBIDDEN, không payment mới, không thay K thành giao dịch khác.

## REMOVED Requirements

### Requirement: Hai trục kiểm soát truy cập độc lập

Mã: **PERM-10**.

**Reason:** Bảng role→module độc lập không phù hợp quyền per-employee.
**Migration:** Thay bằng PERM-02/PERM-03; xóa guard cũ sau khi mọi consumer chuyển và bridge gate qua, không xóa trước.

### Requirement: Bộ quyền hành động được enforce

Mã: **PERM-11**.

**Reason:** Năm mã hard-code không đủ catalog đã chốt.
**Migration:** Thay bằng PERM-02/PERM-09 với **15** mã gồm receipt.reprint; không gồm data.wipe/Store Key rotate/quyền chưa có feature. Bridge vẫn phải giữ nghĩa năm mã cũ trước activation.

### Requirement: Giới hạn đã biết của mô hình quyền hiện tại

Mã: **PERM-12**.

**Reason:** Snapshot UI cũ và SELECT chỉ theo store là giới hạn cần thay; không phủ nhận server phase 27 đã kiểm quyền hiện hành ở các bề mặt được bảo vệ.
**Migration:** Thay bằng PERM-09/PERM-24/PERM-25/PERM-26, với timing/gate và giới hạn mạng rõ, không hứa realtime tuyệt đối.

### Làm rõ vận hành PERM-06 / DELIVERY-03-NEW79, 13/10/2026

Với nhánh cleanup TEST đã được owner chọn thay mapping di trú, scope SHALL là exact77 UUID gốc cộng đúng2 UUID trong frozen checkpoint được người dùng xác nhận; xem [quyết định](../../../../../docs/workflow/tasks/permission-close3-scope79-2026-10-13.md). Không dùng live count hoặc timestamp để mở scope. Chỉ Auth cùng ID và closure được xác minh thuộc79;66 Auth ngoài scope SHALL được giữ. Storage deletion SHALL giữ exact2 object lịch sử; object3 ngoài79 SHALL bảo toàn metadata/payload/version. Manifest scope-only MUST NOT được dùng thay inventory/backup/restore/provider proof. Drift store/object/row/catalog/FK SHALL chặn bước phụ thuộc. Backup13/10 vẫn preservation-only và strict74/75FAIL; quyền bổ sung không đổi kết quả đó.

Truy vết UC-PERM-14 → TC-PERM-53-NEW79 (subcase vận hành của TC53); không thêm TC thứ61 hoặc bỏ gate full-row/locked recheck/rehearsal.

## Delta BACKUP-AB-14 — 14/10/2026

[Quyết định owner](../../../../../docs/workflow/tasks/permission-backup-v2-2026-10-14.md) đã chấp nhận A cho B/I + B cho C/Storage. [Contract v2 và pre-run matrix](../../../../../docs/runbooks/permission-backup-v2-2026-10-14.md) là phần normative của PERM-06/PERM-30 → UC-PERM-14 → TC-PERM-53-V2 (các subcase, không thêm TC), design8.2.1 và T17/T18. Archive fidelity, allocation safety, concurrency observations và C/L tách rõ; không full64/global sequence no-drift mặc định chỉ để dump. Full-row locked recheck, ngoài scope66Auth/object3, exact79 provenance, exact2 Storage delete và live restore assessor giữ nguyên. Knonempty chặn empty-target cleanup; không bypass ledger/FK. Gate executionReady/cleanupEligible vẫn false khi thiếu C/Storage/provider capability. Các số77,74/75 và checkpoint trước đây là lịch sử, không được đổi thành proof79/PASS. Phạm vi này chỉ triển khai/kiểm chứng LOCAL; không cấp quyền hosted/window/release. Kết quả và review hiện hành được ghi trong handoff/implementation-log được liên kết. Scope/số30requirements,15UC,60TC không đổi.


### SEC-01 — oracle globals đã kiểm LOCAL (14/10/2026, chờ review)

Candidate01/source39 bị SEC yêu cầu sửa: projection roles thiếu expiration/comment/security labels. Source40 đã bổ sung `rolvaliduntil`, shared comment/security-label catalog, cùng bốn bản `pg_dumpall --roles-only --no-role-passwords` từ source trước capture, source cuối cửa sổ, pristine và allocation clone. Cùng binary/flags/restrict-key ngẫu nhiên cho một run; so toàn văn, không bỏ dòng. Mọi artifact/command được pin và loader tự recompute ba check bắt buộc `catalog:complete-roles`, `catalog:probe-roles`, `catalog:roles-window`. Cửa sổ source lệch phải refuse `BACKUP_V2_CATALOG_WINDOW_DRIFT`. Password vẫn ngoài profile đã ghi; không suy ra hosted global actor control. Positive fixture có expiration/comment; negative sửa riêng từng thuộc tính trên clone mới và trong source window, cộng forged PASS proof. Đây là sửa completeness trong phạm vi backup được ủy quyền, không đổi nghiệp vụ hoặc mở phase2. Source39 và candidate01 giữ nguyên, không tái gán PASS.


## Hosted path — thiết kế kế tiếp, 14/10/2026

[Task được giao mới](../../../../../docs/workflow/tasks/permission-hosted-path-2026-10-14.md) và [contract/profile/action plan hosted](../../../../../docs/runbooks/permission-hosted-path-2026-10-14.md) bổ sung phạm vi chuẩn bị PERM-06/30 → UC-PERM-14 → TC-PERM-53-V2-HP → T17/T18, tham chiếu PIN-T07. Đây là scoped normative design, chưa implementation, chưa có supported hosted profile/control hoặc quyền capture/window/cutover. Matrix ghi fresh SELECT exact79/66/3/K0/closure33 và giới hạn actor/consumers/Storage/deployment; không nhận chúng là backup hoặc locked full-row proof. Schema3 reserve/adapter/trust anchor/errors/mandatory checks và test matrix ở runbook; LOCAL v2/source40 và 60TC/19PIN không đổi. Eligibility/release vẫn BLOCKED; kế hoạch tests không là runtime PASS. Không nới C/L, không thay scope hay no-push. Khi owner giao implementation phải mở source mới và kiểm affected+mandatory gates trước action hosted.



### HP1 — implementation LOCAL được giao ngày14/10/2026

[Ủy quyền HP1](D:/Workspace/pos-cafe-docs/docs/workflow/tasks/permission-hosted-hp1-2026-10-14.md) triển khai [contract successor](D:/Workspace/pos-cafe-docs/docs/runbooks/permission-hosted-hp1-2026-10-14.md) theo TC53-V2-HP, PERM06/30→UC14→T17/T18 và PIN-T07. Normative schema/check/error/guard/negative matrix tham chiếu runbook và [biên bản pre-run](D:/Workspace/pos-cafe-docs/docs/implementation-log/permission-hosted-hp1-2026-10-14.md). Không thay requirement/usecase/60TC/19PIN hoặc acceptance. Producer/comparator/loader v3 đã hiện thực và kiểm LOCAL nguồn56; registry certified hosted vẫn rỗng. LOCAL_PASS không là provider certification. Các checkpoint “chưa giao implementation” trước đây giữ lịch sử; ủy quyền mới chỉ HP1, STOP trước HP2/hosted capture/backup/cutover/deploy, không push. Runtime nguồn56 đạt mandatory execution gates theo receipts trong biên bản; package/teardown đã hoàn tất LOCAL, chờ SEC→EVC cùng final candidate trước bàn giao. Không suy certification hoặc release từ execution PASS.
