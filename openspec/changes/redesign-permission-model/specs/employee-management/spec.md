# Delta employee-management

## ADDED Requirements

### Requirement: Bất biến của bản ghi chủ quán

Mã: **PERM-13**.

Mỗi store SHALL có đúng một employee owner active. Mọi đường app MUST chặn tạo owner thứ hai, đổi owner sang role khác, promote người khác lên owner, xóa/tombstone/disable owner hoặc reset PIN owner bởi người khác. Non-owner vẫn có thể thấy bản ghi owner khi có quyền đọc danh bạ quản trị nhưng không sửa bất kỳ trường nào của owner. Owner cũng không được self role/override edit hoặc self-disable. Owner được sửa tên mình và tự đổi PIN qua PERM-21; recovery ngoài app chỉ theo PERM-22. Không có chức năng xóa cứng employee mới trong change.

#### Scenario: Quản lý được ủy quyền vẫn không reset owner

- **GIVEN** manager có employee.manage, employee.permission.edit, settings.manage và mọi grant cho phép
- **WHEN** reset PIN owner hoặc gửi trực tiếp patch tên/role/active owner
- **THEN** OWNER_PROTECTED, dữ liệu/phiên owner không đổi; không có override vượt ràng buộc.

#### Scenario: Owner không tự bỏ vai trò

- **WHEN** owner gửi role=manager, isActive=false hoặc override của chính mình
- **THEN** từ chối tương ứng SELF_PERMISSION_EDIT_FORBIDDEN/SELF_DISABLE_FORBIDDEN, owner active vẫn duy nhất.

### Requirement: Không tự khóa tài khoản đang đăng nhập

Mã: **PERM-14**.

Actor MUST NOT tự disable/tombstone bản ghi đang dùng. Actor MUST NOT sửa/reset role hoặc overrides của mình, kể cả thao tác giảm quyền hay owner. Khóa phiên bằng nút khóa/đổi nhân viên vẫn cho phép; đó không phải disable employee. Không dùng cảnh báo xác nhận để cho qua self-edit.

#### Scenario: Tự giảm quyền

- **WHEN** manager có employee.permission.edit gửi deny payment.take cho mình
- **THEN** SELF_PERMISSION_EDIT_FORBIDDEN; không lưu, không đổi revision.

#### Scenario: Khóa thiết bị

- **WHEN** nhân viên bấm khóa phiên
- **THEN** xóa token/cache client và thu hồi phiên theo baseline, không đổi isActive/role/overrides.

### Requirement: Danh bạ hiển thị quyền hiệu lực của từng nhân viên

Mã: **PERM-15**.

Actor có employee.manage hoặc employee.permission.edit SHALL đọc danh bạ quản trị cùng store gồm nhân viên active/inactive, role, revision và nguồn quyền default/grant/deny. UI SHALL phân biệt quyền nền, owner-only và quyền chỉ owner có mặc định. Phần sửa trường hiển thị theo quyền thực hiện, không theo quyền đọc. Roster chọn PIN trước employee login SHALL chỉ chứa id/name của nhân viên active có role đang bật; không trả role/overrides/PIN hash/session/audit. Actor chỉ có employee.permission.edit vẫn mở được danh bạ để chọn target và sửa quyền, không tự có quyền tạo/đổi tên/reset PIN.

#### Scenario: Tra quyền bị thiếu

- **GIVEN** actor có employee.manage nhưng không employee.permission.edit
- **WHEN** mở target có deny payment.take
- **THEN** thấy quyền thiếu do deny; không thấy nút chỉnh overrides; vẫn cần ceiling khi sửa các trường mình có quyền.

### Requirement: Trần quyền trước và sau thao tác quản trị

Mã: **PERM-16**.

Ngoài phiên/tenant và quyền thao tác, non-owner SHALL chỉ quản trị target khi configuredEffective(targetBefore) ⊆ effective(actor) và configuredEffective(targetAfter) ⊆ effective(actor). Create dùng before=null và chỉ kiểm after. Reset PIN, unlock, deactivate, đổi tên/role/override cùng áp trần; inactive target không được tính tập rỗng. Owner với non-owner được miễn hai phép subset, không miễn owner/baseline/self-edit/validation/OCC. Chỉ owner được tác động owner theo phạm vi PERM-13/PERM-21.

Server SHALL khóa target FOR UPDATE trước snapshot, giữ ổn định actor/session/catalog trong transaction theo thứ tự design. Tính after trên kết quả cuối: đổi role thật xóa overrides cũ, rồi áp bộ overrides mới nếu request gửi tường minh; chỉ đổi role thì overrides=null. Cùng role và thiếu overrides giữ tùy chỉnh hiện tại. Payload trộn tên/role/active với overrides cần cả employee.manage và employee.permission.edit. Role đổi và reset overrides bắt buộc do role đổi vẫn thuộc employee.manage, được kiểm after ceiling; không lách bằng reset chủ động chỉ gửi role no-op. Không có API batch employee công khai trong change; nhiều request mỗi target là nhiều transaction, không hứa atomic cả danh sách. Clear/seed nội bộ dùng khóa nhiều target được quy định riêng.

#### Scenario: Target trước mạnh hơn actor

- **GIVEN** manager thiếu report.view, cashier target được grant report.view
- **WHEN** manager muốn đổi target về waiter hoặc reset PIN/unlock target
- **THEN** PERMISSION_CEILING_EXCEEDED, missingPermissions chứa report.view; không thay target dù after có thể thấp hơn actor.

#### Scenario: Target sau mạnh hơn actor

- **GIVEN** manager có employee.permission.edit nhưng bị deny order.voidPaid
- **WHEN** grant order.voidPaid hoặc đổi target sang role mặc định chứa quyền đó
- **THEN** PERMISSION_CEILING_EXCEEDED, không thay đổi/audit applied.

#### Scenario: Hai quản trị viên đồng thời

- **WHEN** A sửa B và B sửa A với revision cùng đã đọc
- **THEN** serialization/locks ngăn snapshot không ổn định; request sau dùng quyền hiện hành và OCC, không deadlock hoặc ghi đè im lặng.

## MODIFIED Requirements

### Requirement: Tạo và chỉnh sửa nhân viên

Mã: **PERM-17**.

Tạo nhân viên và sửa name/role/isActive/reset PIN SHALL cần employee.manage; sửa/reset overrides chủ động SHALL cần employee.permission.edit. Tên trim dài 1–120 Unicode code points, giữ giới hạn RPC hiện có; PIN chính xác sáu chữ số ASCII; confirm PIN trùng ở UI. Server không nhận role/permission actor do client tự khai. Request gồm UUID requestId, targetId khi update, expectedRevision không âm và patch có trường được cho phép; không cho client ghi trực tiếp employee để né audit/ceiling. Create UUID lấy ở client, name/role/PIN bắt buộc, overrides tùy chọn.

Mỗi request một target SHALL nguyên tử, audit theo PERM-05. Reset PIN khác PIN cũ hoặc active→inactive SHALL revoke tất cả session target cùng transaction; unlock không khôi phục token cũ. Role/override/name thay đổi không revoke token; tăng employee revision và phát signal phù hợp. Đổi role thật xóa overrides cũ, sau đó áp overrides mới gửi cùng request nếu có; bước cấp mới vẫn cần employee.permission.edit và kiểm after ceiling. No-op không đổi revision; stale expectedRevision trả EMPLOYEE_VERSION_CONFLICT, yêu cầu tải lại trước submit khác. Gửi lại cùng requestId không tạo nhân viên/reset PIN/ghi audit lần hai.

Form đang bẩn SHALL hỏi xác nhận khi người dùng tự rời/chọn target khác; đóng do thu hồi quyền theo PERM-25 không được bị chặn bởi xác nhận này.

#### Scenario: Tạo cashier

- **GIVEN** owner hợp lệ gửi UUID mới, name “Mai”, role cashier, PIN sáu số và requestId mới
- **WHEN** server hoàn tất
- **THEN** một employee active theo default cashier, một audit applied, revision khởi tạo; không trả PIN/hash.

#### Scenario: PIN không đúng hợp đồng

- **WHEN** gửi PIN 5 số, 7 số, ký tự không phải ASCII digit hoặc confirm không khớp
- **THEN** UI báo “PIN phải gồm đúng 6 chữ số.” hoặc “Xác nhận PIN không khớp.”; server từ chối PIN sai định dạng, không ghi employee.

#### Scenario: Đặt lại PIN

- **GIVEN** actor có employee.manage, target non-owner khác actor và cả before/after qua trần Q2
- **WHEN** đặt PIN sáu số mới khác PIN cũ
- **THEN** target đăng nhập được bằng PIN mới, PIN cũ và tất cả phiên cũ không dùng được; một audit applied cùng transaction.

#### Scenario: Rời form khi chưa lưu

- **WHEN** người quản trị còn quyền tự chuyển target hoặc chọn tạo mới khi form bẩn
- **THEN** cần xác nhận trước khi bỏ nháp; nếu quyền bị thu hồi thì forced close theo Q10, không để hộp xác nhận giữ phần trái quyền.

#### Scenario: Phiên bản form đã lỗi thời

- **GIVEN** target revision=8, form dùng expectedRevision=7
- **WHEN** submit patch
- **THEN** EMPLOYEE_VERSION_CONFLICT, actualAfter vẫn revision=8; không tự resubmit form theo revision mới.

## REMOVED Requirements

### Requirement: Bảo vệ quyền quản trị của cửa hàng

Mã: **PERM-18**.

**Reason:** Ít nhất một admin không diễn đạt một owner active duy nhất.
**Migration:** PERM-13/PERM-14/PERM-06 thay thế; inactive/admin cũ được preflight, không xóa dữ liệu để thỏa constraint.

### Requirement: Cảnh báo khi tự sửa quyền của mình

Mã: **PERM-19**.

**Reason:** Q2 cấm self role/override edit thay vì cảnh báo rồi cho thực hiện.
**Migration:** PERM-14/PERM-16 thay thế cho cả tăng và giảm quyền; không có owner hoặc màn xác nhận bypass.
