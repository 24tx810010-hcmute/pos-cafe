## ADDED Requirements

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](../../proposal.md#thuat-ngu).

### Requirement: Danh tính nhân viên được server xác minh

Mã: **IDEM-01**. Truy vết: FR-03, FR-04.

Mỗi lời gọi giao thức SHALL có phiên cửa hàng và phiên nhân viên do server cấp sau PIN; employeeId do client khai MUST NOT là bằng chứng danh tính. Phiên nhân viên ở bộ nhớ, hết hạn sau 12 giờ, khóa/đổi PIN/tạm khóa nhân viên thu hồi phiên theo design.

#### Scenario: Caller gửi employeeId của quản lý nhưng không có token tương ứng

- **WHEN** Caller gửi employeeId của quản lý nhưng không có token tương ứng
- **THEN** server từ chối, không ghi lệnh hoặc nghiệp vụ

### Requirement: Quyền hiện hành và tiếp quản

Mã: **IDEM-02**. Truy vết: FR-04, FR-11, FR-15.

Register, execute, get, list và cancel SHALL kiểm quyền hành động của chính loại lệnh theo bảng design. Execute SHALL kiểm lại sau mọi khóa có thể chờ, trước hiệu ứng đầu tiên; mất quyền không làm lệnh bị rejected. Người có quyền SHALL tiếp quản dù khác người khởi tạo.

#### Scenario: A hết ca; B có payment.take đọc và thực hiện lệnh pay của A

- **WHEN** A hết ca; B có payment.take đọc và thực hiện lệnh pay của A
- **THEN** payment mang actor B, initiator vẫn A; C thiếu quyền không đọc/thực hiện/hủy được lệnh đó

### Requirement: Đóng đường ghi vượt giao thức

Mã: **IDEM-03**. Truy vết: NFR-01, NFR-02, FR-04.

Client SHALL không ghi trực tiếp orders, order_items, order_item_options, payments, ledger, audit hoặc trạng thái bàn; mọi overload RPC cũ SHALL bị thu hồi quyền gọi. Nguồn quyền/PIN và đường bootstrap/admin/seed SHALL được bảo vệ như design; tenant khác không đọc/ghi được lệnh.

#### Scenario: Store JWT không có phiên nhân viên thử gọi RPC cũ hoặc tự nâng role

- **WHEN** Store JWT không có phiên nhân viên thử gọi RPC cũ hoặc tự nâng role
- **THEN** database từ chối; không đổi actor, quyền, tổng, bàn hoặc ledger

### Requirement: Payload có hợp đồng bất biến

Mã: **IDEM-04**. Truy vết: NFR-01, NFR-05.

Server SHALL kiểm schema v1, UUID, kiểu, required/null, số nguyên và giới hạn trước đăng ký. Cùng K SHALL so sánh JSONB theo cấu trúc: thứ tự khóa object không quan trọng, thứ tự array có ý nghĩa, absent khác null; credentials không nằm trong payload.

#### Scenario: K đã đăng ký với hai dòng khác nhau, client đổi thứ tự mảng

- **WHEN** K đã đăng ký với hai dòng khác nhau, client đổi thứ tự mảng
- **THEN** IDEMPOTENCY_KEY_REUSED; payload gốc và thời hạn không đổi

### Requirement: Đăng ký trước thực hiện

Mã: **IDEM-05**. Truy vết: NFR-01, NFR-05.

Xác nhận mới SHALL sinh UUID K và các UUID thực thể rồi register payload bất biến. Register SHALL chỉ lưu lệnh pending, không tạo đơn/payment. Duplicate register cùng K/payload SHALL trả bản đầu, không gia hạn; K khác cùng nội dung là thao tác độc lập.

#### Scenario: Hai máy đăng ký đồng thời cùng K và payload

- **WHEN** Hai máy đăng ký đồng thời cùng K và payload
- **THEN** chỉ một hàng pending; lần execute hợp lệ sau đó tạo đúng một nghiệp vụ

### Requirement: Trả kết quả lịch sử khi thử lại

Mã: **IDEM-06**. Truy vết: NFR-01, NFR-05.

Execute cùng K và payload gốc SHALL trả terminal/result/error đã ghi, trước việc kiểm version/trạng thái/giá/TTL nghiệp vụ hiện tại. Caller vẫn phải có quyền hiện hành. Không tạo payment, số bill hoặc audit nghiệp vụ mới; kết quả lịch sử không được ghi đè trạng thái đơn hiện tại trên UI.

#### Scenario: K1 split đã applied, K2 tiếp tục sửa đơn rồi client replay K1

- **WHEN** K1 split đã applied, K2 tiếp tục sửa đơn rồi client replay K1
- **THEN** R1 giữ phiên bản/số tiền của lần K1; bảng đơn hiện tại vẫn phản ánh K2

### Requirement: Atomicity của hiệu ứng và kết quả

Mã: **IDEM-07**. Truy vết: NFR-01.

Hiệu ứng nghiệp vụ và applied/result SHALL commit cùng transaction. Lỗi hạ tầng SHALL rollback cả hai và giữ đăng ký pending. Lỗi nghiệp vụ xác định SHALL rollback mọi hiệu ứng trong subtransaction rồi commit rejected/error bên ngoài; rejected không được mở lại khi dữ liệu thay đổi.

#### Scenario: Fault sau lưu applied nhưng trước commit

- **WHEN** Fault sau lưu applied nhưng trước commit
- **THEN** đơn/items/options/payments/audit/số bill không đổi và K vẫn pending; retry chủ động không fault thành công một lần

### Requirement: Khóa lạc quan phối hợp chống trùng

Mã: **IDEM-08**. Truy vết: NFR-01, FR-07, FR-11, FR-12, FR-15.

Lệnh mới trên đơn tồn tại SHALL yêu cầu expectedVersion nguyên không NULL. Khác K cùng version SHALL chỉ một applied; bên thua rejected ORDER_VERSION_CONFLICT. Hai create khác K cùng bàn SHALL chỉ một đơn mở; hai takeaway độc lập SHALL được phép cùng thành công.

#### Scenario: Update và pay khác K cùng version cạnh tranh hợp lệ

- **WHEN** Update và pay khác K cùng version cạnh tranh hợp lệ
- **THEN** đúng một applied, bên kia rejected; không coi cả hai lỗi/treo là đạt

### Requirement: Khôi phục dựa trên server

Mã: **IDEM-09**. Truy vết: NFR-05, FR-14.

Get/list SHALL trả payload, trạng thái, người, thời điểm và liên kết kết quả để tìm đúng lệnh sau mất toàn bộ local. UI SHALL phân biệt nhiều lệnh tương tự bằng K/thời điểm/người/loại/đơn và cho chọn rõ; không suy luận kết quả từ tổng đơn hoặc trạng thái bàn.

#### Scenario: Máy mới không giữ K, tìm thấy K1 applied và K2 pending

- **WHEN** Máy mới không giữ K, tìm thấy K1 applied và K2 pending
- **THEN** xem riêng R1 và thực hiện K2 chỉ sau chọn/xác nhận; không tạo K3 do khôi phục

### Requirement: Hủy lệnh chờ trên server

Mã: **IDEM-10**. Truy vết: NFR-01, NFR-05.

Cancel SHALL chỉ chuyển pending còn hạn sang cancelled trong transaction tranh cùng khóa execute. Nếu execute đã applied, cancel SHALL trả applied; nếu đã hết hạn trả expired. HTTP abort hoặc not found MUST NOT được trình bày là đã hủy; cancel không hủy đơn.

#### Scenario: Cancel thắng trước execute

- **WHEN** Cancel thắng trước execute
- **THEN** K cancelled và 0 hiệu ứng; execute sau chỉ trả cancelled

### Requirement: Thời hạn lệnh khác tuổi đơn

Mã: **IDEM-11**. Truy vết: NFR-05, FR-11.

Lần execute đầu SHALL bắt đầu hiệu ứng trước registeredAt+24 h theo đồng hồ DB sau tất cả khóa; tại hoặc sau hạn chuyển expired. Qua checkpoint hợp lệ trước hạn SHALL được commit sau hạn. Đơn SHALL không tự đóng do lệnh hết hạn; đơn mở 48 giờ được thanh toán bằng K mới.

#### Scenario: Đơn mở ngày 08/09 được thanh toán ngày 10/09 với K vừa đăng ký

- **WHEN** Đơn mở ngày 08/09 được thanh toán ngày 10/09 với K vừa đăng ký
- **THEN** thanh toán thành công; businessDate vẫn 08/09, paidAt là 10/09

### Requirement: Giữ dữ liệu lệnh trong bản đồ án

Mã: **IDEM-12**. Truy vết: NFR-05, FR-14.

Bản phát hành này SHALL không tự xóa K/payload/result/terminal kể cả quá 24/48 giờ; không tái sử dụng K. Get/list SHALL chuyển pending quá hạn sang expired một cách lười khi truy cập; không cần cron. Khôi phục chỉ bảo đảm dữ liệu server đã nhận, không bảo đảm draft chưa đăng ký.

#### Scenario: Mất ACK của một lệnh applied rồi xem lại sau 48 giờ

- **WHEN** Mất ACK của một lệnh applied rồi xem lại sau 48 giờ
- **THEN** trả applied và kết quả cũ, không expired hoặc chạy lại

### Requirement: Dấu vết người thực hiện

Mã: **IDEM-13**. Truy vết: FR-07, FR-11, FR-12, FR-15.

Server SHALL ghi creator đơn, người khởi tạo lệnh, executor thành công, nhân viên payment, canceller và mốc thời gian bất biến. Replay không đổi các trường này. Lịch sử cũ không đủ bằng chứng creator SHALL hiển thị không xác định; không suy diễn từ last editor.

#### Scenario: A tạo, E sửa, A register pay, B execute, C replay

- **WHEN** A tạo, E sửa, A register pay, B execute, C replay
- **THEN** creator A, last editor E, initiator A, executor/payment B; không trường actor nào thành C

### Requirement: Online và kết quả chưa rõ

Mã: **IDEM-14**. Truy vết: NFR-05.

Mất mạng hoặc quá 15 giây chờ SHALL hiển thị kết quả chưa rõ; không gọi đó là thất bại nghiệp vụ hay đã hủy. Không có outbox hoặc ghi offline; polling mỗi 5 giây chỉ get/list/refetch. Late response, focus, reconnect và reload MUST NOT tự phát register/execute/cancel hoặc mở/in phiếu.

#### Scenario: Register ACK về sau timeout hoặc sau khóa màn hình

- **WHEN** Register ACK về sau timeout hoặc sau khóa màn hình
- **THEN** không tự execute; người có quyền tra cứu rồi chủ động tiếp tục

### Requirement: Giá giữ theo từng phần đã ghi

Mã: **IDEM-15**. Truy vết: FR-07, FR-09.

Phần đã ghi SHALL giữ base, tên món và snapshot option/name/price/quantity. Phần gọi thêm kể cả nút cộng SHALL lấy giá hiện hành tại execute và là phần riêng; hai phần khác giá không gộp. Chỉ chọn modifier khi thêm món, không thêm luồng sửa modifier phần cũ.

#### Scenario: A cũ 2 × 30.000, thêm A mới giá 40.000 với modifier 0

- **WHEN** A cũ 2 × 30.000, thêm A mới giá 40.000 với modifier 0
- **THEN** tổng 100.000; dòng cũ 60.000 và dòng mới 40.000, không payment

### Requirement: Nguồn gốc dòng cũ và ghi chú

Mã: **IDEM-16**. Truy vết: FR-07, NFR-01.

Retained line SHALL được xác minh cùng store/order, active, chưa move, không trùng ID; quantity không vượt lượng nguồn. Chỉ giảm/xóa lượng và sửa note trên nguồn cũ; giá/options do server giữ. Dirty detection SHALL xét source ID, note và phần mới, không chỉ đa tập nội dung.

#### Scenario: Đổi chỗ note giữa hai dòng cùng món giá 30.000 và 35.000

- **WHEN** Đổi chỗ note giữa hai dòng cùng món giá 30.000 và 35.000
- **THEN** UI nhận ra có sửa, submit giữ đúng giá của từng ID; tổng 65.000

### Requirement: Xác nhận lại khi giá phần mới đổi

Mã: **IDEM-17**. Truy vết: FR-07, FR-09.

Giá xác nhận của mọi phần mới SHALL được so với giá hiện hành của base và từng option, cả tăng lẫn giảm. Chênh lệch SHALL terminal rejected PRICE_CHANGED, không ghi đơn hoặc đổi payload K. UI trình bày giá mới; chỉ xác nhận mới tạo K mới.

#### Scenario: Đơn cũ 60.000, phần mới báo 40.000 nhưng server thành 45.000

- **WHEN** Đơn cũ 60.000, phần mới báo 40.000 nhưng server thành 45.000
- **THEN** K1 rejected, đơn vẫn 60.000/version cũ; xác nhận K2 cho tổng 105.000

### Requirement: Lựa chọn thanh toán cố định theo lệnh

Mã: **IDEM-18**. Truy vết: FR-11, FR-12.

Loại pay/split và item IDs/quantity/expectedVersion SHALL cố định khi xác nhận, trước register. Full selection SHALL dùng pay; RPC split nhận toàn bộ SHALL rejected INVALID_ORDER_ITEMS. Polling/clamp/fallback full selection không được thay payload hoặc chuyển loại lệnh đang chờ.

#### Scenario: Sau split mất ACK, clamp giữ 1 ly hoặc rỗng rồi UI fallback tất cả

- **WHEN** Sau split mất ACK, clamp giữ 1 ly hoặc rỗng rồi UI fallback tất cả
- **THEN** retry vẫn K/payload split ban đầu, không tạo thêm một payment hoặc gọi pay cho phần còn lại

### Requirement: Hóa đơn theo snapshot chuẩn

Mã: **IDEM-19**. Truy vết: FR-13.

Receipt SHALL giữ baseUnitPrice, option priceDelta/quantity, unitTotal và lineTotal, tổng/tiền nhận/tiền thừa theo lần thanh toán. Lần đầu, replay, lịch sử và bản in SHALL dùng cùng nghĩa dữ liệu; quantity option phải hiển thị. Replay không tự mở/in; in lại là thao tác riêng, đơn void không được in lại.

#### Scenario: Hai ly mỗi ly base 30.000+topping 2 × 5.000

- **WHEN** Hai ly mỗi ly base 30.000+topping 2 × 5.000
- **THEN** unitTotal 40.000, lineTotal 80.000, nhận 100.000/thừa 20.000; đổi menu không đổi hóa đơn

### Requirement: Bộ đếm replay

Mã: **IDEM-20**. Truy vết: NFR-05.

Mỗi execute đã xác thực tới K đã terminal SHALL tăng replayCount đúng 1 một cách atomic; lần quyết định terminal đầu tiên bằng 0. Register/get/list/cancel, request bị từ chối quyền/mismatch hoặc rollback không tăng. Counter ngoài immutable result; không tạo audit row cho mỗi retry.

#### Scenario: Hai execute hợp lệ cùng replay một K applied

- **WHEN** Hai execute hợp lệ cùng replay một K applied
- **THEN** replayCount tăng đúng 2, R1/actor/timestamp nghiệp vụ không đổi

### Requirement: Tương thích giao thức và migration

Mã: **IDEM-21**. Truy vết: NFR-01, NFR-03.

Client SHALL dùng capability writeProtocolVersion=1; DB/app thiếu phiên bản hoặc schema phù hợp SHALL chặn ghi rõ lỗi, không fallback RPC cũ/mock. Migration SHALL bảo toàn đơn/giá/payment cũ và thu hồi mọi overload cũ; backfill thông tin chưa biết bằng null có ý nghĩa.

#### Scenario: Client mới gặp DB chưa migration hoặc E2E thiếu Supabase config

- **WHEN** Client mới gặp DB chưa migration hoặc E2E thiếu Supabase config
- **THEN** ghi bị chặn WRITE_PROTOCOL_UNSUPPORTED hoặc preflight thất bại, không chạy backend giả

### Requirement: Kiểm chứng có thể tái lập

Mã: **IDEM-22**. Truy vết: NFR-07.

Nghiệm thu SHALL có manifest TC, expected tính độc lập, observer DB riêng, kiểm backend thật, race có barrier và fault sau commit/rollback. Không có testcase bắt buộc bị skip hoặc không được khám phá; kết quả test mới chưa chạy MUST NOT được ghi là đã đạt.

#### Scenario: Runner chỉ tìm src nhưng test nằm ngoài include

- **WHEN** Runner chỉ tìm src nhưng test nằm ngoài include
- **THEN** cổng discovery thất bại dù số test khác vẫn xanh
