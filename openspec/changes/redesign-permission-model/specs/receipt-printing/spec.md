# Delta receipt-printing — áp sau IDEM-32/33

## MODIFIED Requirements

### Requirement: In lại hóa đơn

Mã: **PERM-27**.

In lại hóa đơn paid chưa void SHALL cần receipt.reprint và quyền đọc hóa đơn tại điểm vào: orderHistory.view cho lịch sử, payment.take cùng quyền đọc K hiện hành cho Tra cứu/payment context. receipt.reprint riêng không cho xem lịch sử hoặc đọc/execute/cancel K; orderHistory.view riêng cho xem, không in lại qua chức năng POS.

Owner/manager/cashier có quyền in lại mặc định; waiter không có mặc định. Nhân viên chỉ xem có thể được cấp riêng receipt.reprint theo trần quyền. Cả nút Lịch sử, Tra cứu và nút In trong preview nguồn reprint SHALL kiểm quyền hiện hành; server endpoint prepare-reprint MUST kiểm lại, không chỉ UI. Đơn void hoặc thiếu payment trả RECEIPT_UNAVAILABLE; người có quyền thấy nút void disabled, người thiếu quyền không thấy nút. R1 terminal của payment void vẫn là lịch sử theo phase 27, không được dùng qua chức năng reprint để vượt trạng thái hiện tại.

Receipt lấy snapshot đã lưu, giữ nguyên metadata/giá/số lượng; legacy marker giữ nghĩa cũ. In lại không sinh payment, order hay K mới. Quyền kiểm soát chức năng app/server, không bảo đảm người đã nhận dữ liệu không thể lưu/chụp/in ngoài app. Test chỉ xác minh lệnh print của app, không xác nhận số tờ giấy.

Theo Q15, chỉ mất receipt.reprint SHALL ẩn nút In và hủy yêu cầu/timer in chưa dispatch; preview đang mở SHALL giữ nếu còn quyền đọc hóa đơn. Mất quyền đọc hoặc phiên mới đóng/purge dữ liệu. Cấp lại quyền làm nút hiện khi preview vẫn hợp lệ, MUST NOT tự in. Mỗi lần bấm vẫn kiểm server và trạng thái paid hiện hành.

#### Scenario: Nhân viên chỉ xem chưa được cấp quyền in

- **GIVEN** waiter được grant orderHistory.view/report.view và deny order.create/order.update; chưa có receipt.reprint hoặc payment.take
- **WHEN** mở đơn paid rồi gọi prepare-reprint trực tiếp
- **THEN** xem được lịch sử; chức năng in lại bị ẩn và RPC FORBIDDEN, không cấp quyền payment.take.

#### Scenario: Cấp riêng quyền in lại

- **GIVEN** nhân viên chỉ xem có cấu hình overrides như scenario trên
- **WHEN** owner grant receipt.reprint cho nhân viên này
- **THEN** sau hội tụ, nhân viên này in lại được đơn paid từ lịch sử mà vẫn không thu tiền/tiếp quản K.

#### Scenario: Hủy đơn sau khi đã mở preview

- **WHEN** đơn thành void trước lần kiểm server của nút In
- **THEN** không gọi print; receipt/R1 cũ không bị viết lại và không tạo giao dịch mới.

#### Scenario: Menu đổi cả tên và giá sau payment

- **GIVEN** actor có quyền đọc nguồn và receipt.reprint
- **WHEN** menu đổi tên/giá sau payment
- **THEN** in lại dùng tên/giá/quantity option lúc thanh toán; không dựng lại từ catalog mới.

#### Scenario: In lại đơn đã hủy

- **WHEN** người có quyền lịch sử và receipt.reprint mở đơn void
- **THEN** nút in lại disabled; nếu thiếu receipt.reprint thì ẩn; gọi server trả RECEIPT_UNAVAILABLE, không dùng R1 cũ để vượt chặn.

### Requirement: Phiếu tạm tính và hóa đơn

Mã: **PERM-28**.

Giữ phiếu tạm tính và receipt schema phase 27. Thanh toán chủ động lần đầu thành công với tùy chọn in bật SHALL mở preview từ R1; payment.take vẫn điều khiển luồng này, không bắt receipt.reprint. Tắt tùy chọn, replay, late ACK hoặc recovery SHALL không tự mở preview/gọi in. Người dùng phải bấm In.

Tùy chọn in hóa đơn mặc định bật. Phiếu tạm tính dựng từ snapshot đơn hiện tại; receipt biểu diễn base, option quantity/delta, unitTotal gồm option, lineTotal và tổng/nhận/thừa nhất quán theo phase 27.

Nút In nguồn initial SHALL kiểm session/payment.take và trạng thái paid hiện hành; quyền đọc receipt không được cấp chỉ bởi flag client initialSuccess/purpose. R1 đã cấp hợp lệ không bị sửa để đếm in. Initial là nguồn luồng payment thành công, không phải chứng nhận lần in giấy đầu tiên. Không thêm quyền hoặc hành vi mới cho phiếu gửi bếp/tạm tính ở change này.

Theo Q15, initial SHALL cho in tiếp khi preview còn mở và còn payment.take; browser Cancel không tiêu hao quyền dùng luồng initial. Mỗi click chủ động mới có printRequestId riêng; double-click trong lúc đang xử lý được gộp, retry authorize mất ACK trước dispatch giữ cùng ID. Callback/ACK lặp của ID đã dispatch MUST NOT gọi print lần hai. Không tự in do reconnect hoặc được cấp lại quyền.

Chỉ mất payment.take SHALL ẩn nút In initial và hủy authorize/timer chưa dispatch; nếu còn orderHistory.view thì giữ preview được phép đọc, nếu không còn quyền đọc hoặc mất phiên thì đóng/purge. receipt.reprint không tự đổi nguồn initial thành reprint. Đóng preview bỏ grant ở client; mở lại qua Lịch sử/Tra cứu phải theo PERM-27, không lấy K cũ để tạo grant initial mới. Server không dùng việc trình duyệt đóng/mở làm bằng chứng đã in bao nhiêu bản.

#### Scenario: Thu ngân bị deny reprint vẫn thanh toán và in ban đầu

- **WHEN** cashier có payment.take, bị deny receipt.reprint hoàn tất thanh toán chủ động với tùy chọn in bật
- **THEN** mở preview và in qua luồng initial; mở lại từ lịch sử/Tra cứu vẫn bị chặn quyền reprint.

#### Scenario: Retry payment không tự in

- **WHEN** mất ACK payment rồi tra cứu/replay cùng K
- **THEN** giữ R1, không tự mở receipt hoặc gọi print; in lại chủ động cần PERM-27.

#### Scenario: Hai ly base 30.000, option 2 × 5.000, trả 100.000

- **WHEN** thanh toán hai ly, mỗi ly base 30.000 và option quantity2 × delta5.000, nhận100.000
- **THEN** receipt đơn giá40.000, thành tiền80.000, option ×2, tiền thừa20.000.

#### Scenario: Tắt tùy chọn in hóa đơn

- **WHEN** cashier tắt tùy chọn in rồi thanh toán thành công
- **THEN** payment vẫn thành công và không mở hóa đơn.

#### Scenario: Hủy hộp thoại in ban đầu

- **WHEN** cashier bị deny reprint đã gửi lệnh initial rồi hủy hộp thoại browser
- **THEN** preview còn mở; cashier còn payment.take được chủ động bấm In lần nữa với PR2; server kiểm lại, không tạo payment/K mới và không tự in từ callback PR1 lặp.

#### Scenario: Mất và được cấp lại quyền in khi vẫn được xem

- **GIVEN** preview initial còn mở, actor có orderHistory.view và payment.take
- **WHEN** payment.take bị thu hồi rồi được cấp lại trong cùng phiên
- **THEN** lúc thiếu quyền nút In ẩn, timer cũ bị hủy và preview chỉ để xem; lúc có lại quyền nút hiện, phải bấm mới kiểm quyền/in, không replay timer hoặc PR đã dispatch.

#### Scenario: In phiếu tạm tính

- **WHEN** cashier chọn in tạm tính đơn open được phép đọc
- **THEN** mở phiếu tạm tính từ snapshot đơn hiện tại; không yêu cầu receipt.reprint hoặc tạo payment.
