# Delta multi-device-sync — authority

## ADDED Requirements

### Requirement: Hội tụ quyền có revision và thời gian đo được

Mã: **PERM-24**.

Role/overrides SHALL hội tụ mà không đổi token hoặc employeeSessionVersion. Client SHALL dùng revision employee/catalog đơn điệu và một poll revision mỗi 30 giây khi tab hiển thị; poll chỉ đọc revision/validity, chỉ tải snapshot khi revision đổi hoặc snapshot chưa có. Không poll authority trong background, không mỗi feature một poll, không đổi nhịp polling dữ liệu vận hành của phase 27. Signal/focus/reconnect được gộp nhưng không đẩy lùi vô hạn hạn dự phòng.

Khi nhận signal, client SHALL áp authority mới/đóng phần mất quyền trong ≤5 giây trong gate online mà cả chuỗi tải và áp hoàn tất trong ngân sách đó. Nếu signal mất, target ≤35 giây từ commit có điều kiện: tab foreground, thời gian giữa các lần bắt đầu poll ≤30 giây, toàn chuỗi revision/snapshot/apply ≤5 giây. Không hứa trần khi mạng/server không đáp ứng. Test timer xác định và gate Realtime thật SHALL tách riêng, không coi mock chứng minh SLA thật.

Focus/reconnect/resume SHALL chuyển authority sang chưa xác minh trước render/query phần bảo vệ; đọc revision/snapshot hiện hành xong mới mở lại. Timeout/lỗi không biến snapshot cũ thành đã xác minh. Request quyền có ngân sách client 5 giây, thất bại hiện “Chưa xác minh được quyền. Kiểm tra kết nối và thử lại.”, chặn phần bảo vệ tới khi xác minh; không tự logout vì lỗi mạng.

#### Scenario: Signal bị mất

- **GIVEN** poll bắt đầu tại t=0,30s; owner commit thay đổi ngay sau t=0; backend và apply dùng tổng 5s
- **WHEN** không có signal tới client foreground
- **THEN** UI hội tụ muộn nhất t=35s; chỉ poll revision theo nhịp chung, không thêm poll mỗi drawer.

#### Scenario: Tab ngủ và reconnect

- **WHEN** tab ẩn 10 phút trong lúc quyền đổi, rồi trở lại
- **THEN** không có authority polling trong thời gian ẩn; gate quyền đứng trước hiển thị cache hoặc resync dữ liệu, không auto replay K.

### Requirement: Thu hồi quyền đóng đúng phần dữ liệu và nháp

Mã: **PERM-25**.

Khi authority mới thu hồi quyền, client SHALL chặn render/query/action tương ứng, cancel request đọc và pending print timer, xóa cache dữ liệu không còn được phép, đóng drawer/preview không còn quyền truy cập và bỏ đúng phần nháp chưa gửi của thao tác đó. Nháp phần khác SHALL giữ. Khi có phần thực sự bị đóng, hiện “Quyền của bạn đã thay đổi. Phần đang thao tác không còn được phép đã đóng; dữ liệu chưa lưu của phần đó đã được bỏ.”

Q15 phân biệt quyền in và đọc: chỉ mất quyền in của preview SHALL ẩn nút In, hủy authorize/timer chưa dispatch và bỏ phản hồi in muộn; giữ preview nếu còn quyền đọc. Initial kiểm payment.take, reprint kiểm receipt.reprint. Chỉ ẩn nút không dùng thông báo nói dữ liệu đã đóng/bỏ; hiện “Quyền in hóa đơn đã thay đổi. Bạn vẫn có thể xem hóa đơn.” khi preview được giữ. Cấp lại quyền hiện nút nếu preview còn hợp lệ, không tự in. Mất quyền đọc hoặc phiên vẫn đóng/purge. Lệnh đã dispatch sang trình duyệt không được hứa có thể thu hồi.

Dirty confirmation MUST NOT trì hoãn đóng do mất quyền. Floor vẫn là fallback cho employee hợp lệ theo Q11. Response/timer cũ MUST NOT mở lại preview, in, vá cache hoặc đổi phiên mới. Mất quyền không xóa/cancel K server, không sửa R1/payment/order đã lưu, không đăng ký K/payload mới để retry. Định danh thao tác đang mất ACK SHALL còn khả năng tra cứu đúng K, nhưng payload/kết quả không được hiển thị cho người thiếu quyền.

#### Scenario: Mất quyền menu trong lúc form bẩn

- **WHEN** snapshot mới không còn menu.manage
- **THEN** form menu đóng, nháp menu bị bỏ và cache menu quản trị bị xóa; nháp order không bị reset.

#### Scenario: Response receipt muộn

- **WHEN** receipt.reprint bị thu hồi trong lúc đang chờ RPC hoặc timer print
- **THEN** response không mở/in lại hóa đơn, timer bị hủy và nút In ẩn; preview có sẵn giữ nếu còn quyền đọc, nếu mất cả quyền đọc thì đóng/purge; payment/K đã có không đổi.

#### Scenario: Refresh quyền no-op

- **WHEN** nhận signal trùng hoặc revision không đổi trong khi payment đang chờ
- **THEN** không tăng session generation, không ngắt coordinator, không xóa nháp/cache còn quyền.

### Requirement: Tín hiệu tối thiểu và làm mới catalog toàn cục

Mã: **PERM-26**.

Realtime SHALL chỉ phát signal store/topic/revision/eventId và targetId khi cần. Không publish employee rows, stores chứa bí mật, audit chi tiết, order/payment payload, tổng tiền hoặc R1 tới người không có quyền đọc. Việc UI bỏ qua payload không phải bảo vệ. Client refetch qua RPC có authority hiện hành; store filter/ACL phải kiểm server, không chỉ filter client.

Các topic đơn/thanh toán/bàn/thực đơn/sơ đồ/vật trang trí đã được adapter theo dõi SHALL giữ hành vi invalidate/refetch của baseline. Publication join table đã có ở migration008 chưa đồng nghĩa adapter đã subscribe. Giới hạn thay đổi chỉ gắn/bỏ nhóm tùy chọn phải tải lại thủ công hoặc reconnect được giữ cho change add-modifier-link-realtime-subscription; không thêm bảo đảm hội tụ join table trong change này.

Catalog default thay đổi SHALL tăng catalogRevision; mọi client đang dùng, kể cả không phải target của employee event, SHALL phát hiện qua catalog signal hoặc tuple revision khi poll/resume. Chỉ apply response khớp store/employee/session generation và revision không cũ. Catalog/employee snapshot phải nhất quán cùng revision; không ghép catalog cũ với overrides mới. Clear demo không xóa signal/revision còn cần để hội tụ; tín hiệu không chứa bí mật hoặc snapshot audit.

#### Scenario: Đổi default role toàn cục

- **WHEN** operator đổi default cashier ở catalog và không sửa employee row
- **THEN** mọi cashier phát hiện catalogRevision mới, không phải chờ event target employee; actor/session vẫn đúng.

#### Scenario: Sai thứ tự và đổi người dùng

- **WHEN** response revision 11 về sau revision 12 hoặc response employee A về sau đăng nhập B
- **THEN** bỏ response cũ, không khôi phục quyền/cache/preview của A hay revision 11.
