# Delta employee-session — áp trên phiên phase 27

## MODIFIED Requirements

### Requirement: Chọn nhân viên và xác minh PIN

Mã: **PERM-20**.

Giữ PIN sáu số, phiên normal opaque 12 giờ, memory-only và reload/lock về PIN của phase 27. Với normal login khi không có cờ bắt buộc đổi PIN, client SHALL có authority snapshot gồm store/employee/session generation, employee revision, catalog revision, role và quyền hiệu lực trước khi mount phần dữ liệu bảo vệ. **Delta ngày 22/09/2026:** owner mới tạo hoặc vừa được operator recovery có `pinChangeRequired=true` chỉ nhận restricted session 5 phút, không authority; phải hoàn tất [PIN-01–04](../../../force-default-pin-change/specs/employee-session/spec.md) rồi login mới. Delta này thay phát biểu đúng PIN luôn cấp authority/12 giờ trong phạm vi trên. Target inactive hoặc role chưa bật không được mở app. Thay role/overrides không bắt login lại; reset PIN/deactivate thu hồi phiên, response của phiên cũ không thay phiên mới.

#### Scenario: Snapshot chưa xác minh

- **WHEN** login hoặc focus/reconnect đang tải authority
- **THEN** không mount/render dữ liệu cache được bảo vệ; không tự gửi mutation, không coi loading là phiên hợp lệ đầy quyền.

#### Scenario: Phiên bị khóa

- **WHEN** target bị deactivate sau khi mở app
- **THEN** request mới bị server từ chối; client xóa dữ liệu phiên bị ảnh hưởng và về PIN khi xác nhận phiên không còn hợp lệ, không xóa phiên mới do response cũ.

#### Scenario: Nhập PIN đúng

- **WHEN** chọn employee active có role enabled, không còn cờ bắt buộc đổi PIN và nhập đúng PIN sáu số
- **THEN** server cấp normal opaque session 12 giờ; client chỉ mở app shell sau khi authority snapshot đã xác minh. Owner có cờ true đi theo restricted flow PIN-02, không mở app shell.

#### Scenario: Nhập PIN sai

- **WHEN** nhập PIN sai
- **THEN** INVALID_PIN, giữ màn PIN, không mở phần dữ liệu được bảo vệ.

#### Scenario: Nhân viên bị tạm khóa

- **WHEN** target inactive tìm cách đăng nhập
- **THEN** không có trong roster và server trả INVALID_PIN kể cả gọi thẳng start session, giữ oracle phase27; EMPLOYEE_SESSION_REQUIRED dành cho request dùng phiên không còn hợp lệ, không thay mã lỗi nhập PIN của inactive.

#### Scenario: Nhập đúng PIN rồi reload

- **WHEN** đăng nhập đúng rồi reload
- **THEN** về PIN vì token chỉ ở memory; đăng nhập lại cùng/khác employee đủ quyền vẫn tra cứu K server. Khóa chủ động xóa memory ngay và gửi revoke khi online; mất ACK không phải bằng chứng server đã revoke.

## ADDED Requirements

### Requirement: Chủ quán tự đổi PIN có xác minh PIN hiện tại

Mã: **PERM-21**.

Owner active trong normal session SHALL được tự đổi PIN bằng currentPin/newPin sáu chữ số và confirm khớp ở UI. Server xác minh actor thật chính là owner target và currentPin trong transaction; không dùng reset employee của manager. Đổi PIN thành công SHALL atomically lưu hash mới, revoke mọi session owner và ghi audit; client khóa phiên hiện tại để đăng nhập PIN mới. PIN cũ sai không đổi dữ liệu/session; PIN mới giống PIN hiện tại là no-op có thông báo, không giả có revoke. Không lưu PIN/hash/token trong audit hoặc response. **Delta ngày 22/09/2026:** phát biểu cũ “Không thêm forced-default-change” được thay riêng cho owner bootstrap/operator recovery bằng [PIN-03](../../../force-default-pin-change/specs/employee-session/spec.md), bắt buộc PIN mới khác PIN tạm. Normal self-PIN no-op và non-owner reset giữ nguyên; email recovery vẫn ngoài phạm vi.

#### Scenario: Đổi PIN thành công

- **WHEN** owner gửi đúng currentPin và newPin khác hợp lệ
- **THEN** PIN mới dùng được, PIN cũ và mọi token cũ không dùng được; chỉ một audit applied, hiện “Đã đổi PIN. Vui lòng đăng nhập lại.”

#### Scenario: Sai PIN hiện tại

- **WHEN** owner gửi currentPin sai
- **THEN** INVALID_PIN, hiện “PIN hiện tại không đúng.”; không đổi hash, revoke hoặc revision.

### Requirement: Khôi phục PIN owner qua quy trình hạ tầng chuyển tiếp

Mã: **PERM-22**.

Trước email recovery, operator hạ tầng được chỉ định SHALL chỉ khôi phục sau khi xác minh độc lập hồ sơ hỗ trợ ngoài app. Không thêm recovery_contact hoặc endpoint app reset owner. Runbook SHALL có operator reference, case/reference bằng chứng, store/target được xác minh, requestId và kênh bàn giao PIN an toàn; không ghi bí mật vào báo cáo/audit.

Recovery SHALL đổi PIN, revoke session và audit operator nguyên tử, retry không reset lần hai. **Delta ngày 22/09/2026:** mỗi request recovery mới đặt `pinChangeRequired=true`, revision +1, một signal/audit applied và revoke mọi phiên kể cả PIN/cờ đã giống; `credentialChanged` chỉ phản ánh hash thực sự đổi. Replay chỉ là receipt lịch sử, không ép đổi lại sau khi owner đã hoàn tất; xem [transition PIN-04](../../../force-default-pin-change/design.md). Audit lỗi phải rollback PIN/cờ/session/revision. Đường hạ tầng không giả actor là employee owner; app roles/grants không gọi được. Kiểm kỹ thuật ở DB cách ly; xác minh con người/bàn giao bí mật bằng biên bản quy trình. Dừng runbook chuyển tiếp khi email recovery được kiểm chứng và vận hành; quyền hạ tầng đủ mạnh vẫn là ranh giới tin cậy, audit DB không chống người toàn quyền DB.

#### Scenario: Ca chưa đủ căn cứ

- **WHEN** hồ sơ chỉ có recovery contact tự khai hoặc không xác minh store/target/operator
- **THEN** OWNER_RECOVERY_REVIEW_REQUIRED, không can thiệp DB và không đưa PIN ra kênh chưa xác minh.

#### Scenario: Recovery nguyên tử và đường app bị chặn

- **WHEN** operator được phép thực hiện ca hợp lệ rồi thử lại cùng requestId
- **THEN** một lần đổi PIN, một audit với actorType=operator; token cũ bị revoke. Cùng thao tác từ role authenticated/app, kể cả owner session, bị từ chối.
