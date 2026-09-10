# Rà độc lập thiết kế kiểm thử — database, quyền, race, ACK và TTL

Ngày: 09/09/2026. Kết luận: **chưa automation-ready**. Bộ 32 PRE-IDEM đã đặt đúng nhiều bất biến khó, nhưng chưa đủ để một người khác viết test DB mà không tự chọn oracle, thứ tự khóa, trạng thái lỗi và quyền đọc/tiếp quản. Các finding dưới đây là khoảng trống thiết kế test hoặc contract, không phải kết quả tái hiện exploit.

## Phạm vi và mốc bằng chứng

- Đã xác minh HEAD của D:/Workspace/pos-cafe là 7183b31a4ca27ed2be3ca7097f391fd2c07f806c.
- Đã đọc toàn bộ proposal, đủ PRE-IDEM-01…32 và các biến thể bổ sung; đọc tài liệu 12, lấy mục 7 ngày 09/09 làm quyết định hiện hành. Không đọc/trao đổi báo cáo của reviewer khác.
- Đã đọc AGENTS.md, CLAUDE.md và openspec/SPEC-STANDARD.md trên worktree docs. Đối chiếu RPC hiệu lực ở migration 011/012, schema/RLS, adapter auth/order/payment/employee/report, domain và test Supabase hiện có.
- Không sửa ứng dụng/test/input, không chạy baseline, không truy DB/cloud, không đọc credential. Chỉ tạo báo cáo này. Không có ca PRE-IDEM nào được báo là đã chạy.

Ký hiệu tài liệu trong báo cáo:

| Ký hiệu | Đường dẫn đầy đủ | SHA-256 của đầu vào đọc ngày 09/09 |
| --- | --- | --- |
| P | D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations/proposal.md | 1C6AD6EE2651540540DBBF74AE01E2F52DF49CA075BCB699851C2084EF3D75C5 |
| R12 | D:/Workspace/pos-cafe-docs/docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md | 1E899453B55553457D45A751B7E1EB07571132EFF7C67D333A57779D860BF6F9 |

Các đường dẫn code bên dưới tính từ D:/Workspace/pos-cafe. Số dòng là mốc đã đọc, không phải số dòng của bản code tương lai. P1 là khoảng trống cần đóng trước khi coi contract/test DB sẵn sàng; P2 là phần oracle/coverage cần hoàn chỉnh trước nghiệm thu. Không suy grants đang chạy chỉ từ policy SQL.

## Phần thiết kế hợp lý

- P:99–105 tách tuổi đơn, hạn lần execute đầu và thời gian giữ kết quả. Applied được replay sau 24 giờ; hết hạn/hủy lệnh không tự trả bàn, void đơn hay hoàn tiền. TTL-04/05 kiểm ngay ngưỡng và sau chờ khóa là hướng đúng.
- P:222–226 kiểm mất ACK sau commit, cả hai nhánh selection clamp và mất local/đổi máy. P:262–266 đã yêu cầu observer xác nhận commit, barrier, caller tách credential fixture; đây không phải bộ test chỉ có mock.
- P:227–228,242–244 đã đưa SQL NULL, atomicity, quyền RPC/DML, migration/grants vào kế hoạch; P:202 phân biệt kiểm chuỗi migration với chứng minh DB. Không được trình bày các mục này thành hoàn toàn chưa có.
- P:237–240 và R12:279–299 chốt đúng giá: A cũ 2×30.000 + A mới 40.000 có modifier 0đ = 100.000; modifier có phí 7.000 cho tổng 107.000; split đúng ID được 30.000 hoặc 40.000. Không mở lại thao tác sửa modifier phần đã ghi.
- P:243–244 và R12:102 chặn bypass RPC cũ, chọn loại full/split trước register. Đối chiếu SQL 012:213–227 xác nhận gọi split toàn bộ hiện trả INVALID_ORDER_ITEMS; không nên dùng quantity=5 của O1 làm ca split thành công.
- Không bắt đối chiếu tiền mặt, không tự resume, không đổi chính sách ngày báo cáo là đúng phạm vi đã chốt. Tài liệu công khai trạng thái chưa triển khai, thiếu sáu artifact; không dùng baseline xanh làm kết quả 32 ca.

## Findings

### DB-01 — P1: danh sách bypass chưa bao gồm dữ liệu có thể tự cấp quyền hoặc phá bất biến từ bảng khác

**Tài liệu:** P:242–243 (PRE-29/30); R12:109,113. PRE-30 liệt kê orders/items/options/payments/lệnh nhưng chưa có testcase cụ thể bảo vệ nguồn danh tính/quyền và trạng thái bàn.

**Code:** supabase/migrations/002_indexes_rls_triggers.sql:89–96,113–129 dùng policy FOR ALL theo cửa hàng. src/adapters/supabase/employeeRepo.ts:41–54,59–70 ghi trực tiếp employees, gồm role/is_active/permission_overrides. supabase/migrations/011_void_paid_order.sql:59–65 xác minh PIN bằng passcode_hash trong chính bảng đó. Schema 001:19,31,191,215,233,247 có quan hệ xóa dây chuyền từ store; việc một DELETE cụ thể có hoàn tất còn tùy FK khác và grants thực. Không khẳng định đã khai thác được trên DB.

**Kịch bản bị bỏ lọt:** bộ test chặn D gọi execute hoặc giả ID B có thể vẫn pass nếu D được UPDATE chính permission_overrides/role, đặt lại PIN của B hoặc tạo nhân viên mới có quyền rồi lấy phiên được server xác minh. Chặn direct UPDATE orders cũng không chứng minh caller không thể tự UPDATE tables.status hoặc xóa dữ liệu qua đường cha. Đây là tác động trực tiếp đến bảo đảm quyền/trạng thái của change, không phải yêu cầu idempotency cho toàn bộ admin.

**Expected cần bổ sung:** dùng phiên ứng dụng của D thử riêng UPDATE role/overrides/is_active/passcode_hash, INSERT nhân viên có quyền, giả ID vào endpoint quản trị liên quan; sau đó thử lấy phiên/execute K. Không thao tác nào được cấp quyền hoặc đổi danh tính thành công nếu chưa có quyền quản trị đã được server xác minh. Kiểm UPDATE tables.status khi đang có O1 và các đường xóa cha có thể chạm ledger/business rows. Observer xác nhận rows, quyền và K không đổi. Nếu giữ ghi layout trực tiếp thì chứng minh chỉ các cột layout được phép, không cho sửa status. Kiểm catalog/grants và gọi thật dưới credential ứng dụng; chạy positive control qua đường quản trị hợp lệ để tránh một hệ thống cấm toàn bộ cũng pass.

**Ai đóng:** analyst phối hợp phần tối thiểu của enforce-permissions-at-database. Chỉ cần hỏi chủ dự án nếu giải pháp buộc đổi luồng đăng nhập/phạm vi quản trị; không hỏi lại nguyên tắc server xác minh đã chốt.

### DB-02 — P1: fixture quyền và điểm kiểm quyền chưa đủ để chứng minh tiếp quản đúng người

**Tài liệu:** P:206,240,242; R12:109. A/B/C/D chỉ có mô tả vài quyền. PRE-27 cho C replay nhưng chưa nói C có quyền đọc/payment hay chỉ void; PRE-29 nói không được đọc mà chưa có mapping read/list/cancel và không phân biệt các nhánh submit.

**Code:** src/adapters/supabase/authRepo.ts:19–24,120–145 dùng phiên cửa hàng. employeeRepo.ts:30–38 hiện chỉ trả Employee sau verifyPin. SQL 012:76–97,1024–1047 lấy quyền theo p_employee_id trước khi chờ khóa store; SQL 012:602–630 tách order.create/order.update/order.voidOpen; 011:105–149 cũng đọc quyền trước khóa order. src/core/guards.ts:60–77 quy định denies thắng grants/default.

**Kịch bản bị bỏ lọt:** dùng admin cho tất cả fixture sẽ pass takeover mà không chứng minh B chỉ có payment.take, không có quyền tạo/sửa đơn. Negative test với payload sai hoặc JWT không đến đúng store có thể bị từ chối sớm vì lý do khác. Thu hồi quyền giữa register–execute không phủ trường hợp quyền được đọc rồi request chờ khóa, quyền bị thu hồi trước lúc ghi.

**Expected cần bổ sung:** lập ma trận endpoint × loại nghiệp vụ × quyền cụ thể. B là cashier với denies order.create/order.update/order.voidOpen nhưng có payment.take; B phải execute lệnh payment của A bị khóa, vẫn không execute submit. Test order.create/order.update/order.voidOpen riêng, voidPaid bằng grant cho người không phải admin, denies thắng grant/default, inactive, thiếu/giả/phiên nhân viên hết hiệu lực. Định nghĩa C và quyền đọc/list/replay trước khi viết assertion. Mọi negative dùng payload hợp lệ và phiên cửa hàng hợp lệ; positive control cùng fixture phải đến được nghiệp vụ. D bị từ chối không được biến K thành rejected/cancelled làm B mất khả năng tiếp quản.

Thêm lịch khóa có barrier: caller vượt bước đọc quyền → chờ khóa nghiệp vụ → admin thu hồi quyền và commit → nhả khóa. Contract phải nêu điểm quyết định quyền. Đề xuất analyst: kiểm quyền hiện hành tại điểm quyết định áp dụng sau khóa cần thiết; nếu thu hồi đã commit trước điểm đó thì từ chối, chưa ghi nghiệp vụ, K còn có thể do B hợp lệ thực hiện. Không thay trường actor/payment khi caller khác chỉ đọc/replay.

**Ai đóng:** analyst; không cần quyết định sản phẩm mới trừ khi đề xuất quyền đọc mới làm đổi trải nghiệm đã chốt. Không mặc định chỉ quản lý được tiếp quản.

### DB-03 — P1: PRE-17 chỉ chờ khóa lệnh, chưa khóa nghĩa của TTL khi còn chờ khóa nghiệp vụ

**Tài liệu:** P:103,229–231,264; R12:111. Có cả câu kiểm sau khóa quyết định lệnh và câu transaction bắt đầu hiệu ứng hợp lệ trước hạn được kết thúc. Chưa xác định nếu giữ khóa lệnh rồi tiếp tục đợi store/order/table thì thuộc câu nào.

**Code:** SQL 012:99,138–159,240 (split); :523,575–598,759 (submit); :1047,1061–1088 (pay) có nhiều tầng khóa. 011:144–149 khóa order cho void. Vì vậy harness chỉ khóa hàng K có thể bỏ qua cửa sổ thực tế sau khi lấy K.

**Kịch bản:** K pending sắp hết hạn. Execute lấy khóa K trước hạn nhưng bị giữ tại advisory store hoặc hàng order/table; nhả khóa đó sau expires_at. Implementation kiểm hạn ngay khi lấy K sẽ pass PRE-17 hiện mô tả, dù sau đó mới bắt đầu hiệu ứng.

**Expected cần cụ thể hóa:** ghi rõ checkpoint hợp lệ nằm ở đâu so với toàn bộ khóa. Đề xuất theo câu “bắt đầu hiệu ứng”: sau các khóa có thể chặn và trước hiệu ứng nghiệp vụ đầu tiên, kiểm đồng hồ DB thực; đến checkpoint ở thời điểm >= expires_at thì expired, O/items/options/payments/bàn không đổi. Nếu đã qua checkpoint hợp lệ và bắt đầu hiệu ứng trước hạn thì transaction được hoàn tất, cancel chờ nó phải thấy applied. Test riêng chờ khóa K, khóa store và khóa order/table; ghi thời điểm quan sát/checkpoint thực, không chỉ thời gian harness định gửi request.

Exact -1ms/0/+1ms không nên trông vào sleep hoặc thời điểm HTTP dự kiến. Analyst cần đặc tả clock seam chỉ trên DB test, fixture times do harness đặc quyền điều khiển, và một kiểm wiring độc lập với đồng hồ DB thật. Kiểm wiring phải phát hiện dùng timestamp đầu transaction cho bước sau chờ; không được đưa tham số currentTime cho caller ứng dụng. Retry register, read và failed unauthorized attempt không gia hạn hai mốc server.

**Ai đóng:** analyst chọn thứ tự khóa/checkpoint và harness; không hỏi lại thời hạn 24 giờ. Đây là mơ hồ thiết kế, chưa phải bug TTL đã tái hiện vì code idempotency chưa có.

### DB-04 — P1: expected race “tối đa một” cho fixture hợp lệ chưa chứng minh tiến triển, thiếu một số lịch cạnh tranh khác bản chất

**Tài liệu:** P:219–220,227,235,263 (PRE-06/07/14/22). Barrier và hai bên thắng đã được yêu cầu, nhưng PRE-06 chỉ nói tối đa một áp dụng; PRE-14 không liệt kê cặp loại lệnh hoặc trạng thái terminal của bên thua.

**Code:** SQL 012:99,523,1047 dùng cùng store advisory lock; :637–642,1068–1074 dùng OCC; :238–251,759–765 cùng cấp số theo max+1; 002:70 chặn hai đơn mở cùng bàn. Các lớp này có thể làm test vô tình tuần tự hóa, hoặc che đường khóa sai khi thêm hàng K.

**Expected sửa rõ:** với same K/payload, input hợp lệ, không inject lỗi và request đều được giao đến server, sau hai caller kết thúc phải có chính xác một registration/applied result và chính xác một nghiệp vụ, không chấp nhận cả hai bị lỗi rồi gọi đó là “tối đa một”. Nếu chủ động inject timeout thì observer phải xác định terminal eventual result; timeout không phải nhánh pass thay cho final-state assertion.

| Biến thể cần tách | Lịch và expected |
| --- | --- |
| Same K, payload khác, register cạnh tranh | Hai connection thật; buộc mỗi bên thắng ở fixture riêng. Payload bên thắng bất biến; bên thua mismatch, không thay hạn/actor/result; chỉ lệnh thắng có thể chạy. PRE-07 hiện chỉ đổi sau register tuần tự. |
| Khác K, cùng O/version | Cụ thể update–pay, update–split, pay–split, update–voidOpen; voidPaid–voidPaid dùng O đã paid. Điều khiển mỗi bên thắng. Một applied, bên thua lỗi OCC terminal đúng contract; tổng/payment/bàn tương ứng bên thắng; không deadlock bị nuốt thành timeout. |
| Khác K tạo mới cùng bàn | Hai orderId khác nhau, expectedVersion=null. Một đơn mở, bên kia conflict; bàn occupied, không còn order/items rác từ bên thua. |
| Khác K tạo takeaway độc lập | Cùng nội dung nhưng orderId/payment IDs mới, hai xác nhận mới hợp lệ phải tạo hai nghiệp vụ; không được chống trùng bằng hash nội dung. |
| Cấp số order khi create cạnh tranh split | Cố định business_date và số lớn nhất trước ca; số đã trả giữ đúng, số nguồn mới không trùng số vừa tạo; replay không cấp thêm số. |

Harness phải ghi backend PID/transaction độc lập, xác nhận bên chờ thật bằng quan sát khóa/gate, giới hạn thời gian chờ và fail nếu lịch không đạt; Promise.all hay hai object client dùng chung transaction không đủ. Nếu test chủ ý chấp nhận lỗi serialization/deadlock để caller retry thì contract phải phân loại nó là lỗi hạ tầng và test retry cùng K sau rollback, không coi lỗi đó là business rejected.

**Ai đóng:** analyst. Không cần product decision; đây là các phân hoạch để chứng minh chống trùng và OCC hiện đã yêu cầu.

### DB-05 — P1: fault/ACK chưa có ma trận terminal-state và oracle rollback đầy đủ

**Tài liệu:** P:101–105,222–224,228,234–236,262–265. PRE-15 đã yêu cầu atomicity và phân biệt lỗi hạ tầng/lỗi nghiệp vụ; khoảng trống là điểm inject, trạng thái K cụ thể và cách kiểm cả hai chiều.

**Code:** SQL 012:247–379 đổi số nguồn, tạo đơn, move/copy items/options rồi mới ghi payment; :675–679 remove phần cũ trước vòng validate/insert :798–918; :1116–1128 đổi order/bàn sau insert payment. RPC hiện dùng raise exception cho lỗi nghiệp vụ (:639,824,893,1071); adapter errors.ts:30–55 chỉ map response, không có cơ chế lưu rejection mới.

**Kịch bản có thể pass sai:** observer chỉ kiểm “không có hiệu ứng thiếu applied” sẽ không bắt applied/R1 đã lưu nhưng hiệu ứng bị rollback. Chỉ inject sau toàn bộ nghiệp vụ sẽ không kiểm lỗi giữa renumber–copy option–payment hoặc sau tombstone dòng cũ. Bọc catch sai có thể giữ một phần nghiệp vụ khi ghi rejected; ngược lại raise lỗi ra ngoài transaction có thể làm bản rejected cũng rollback.

**Expected cần bổ sung:** snapshot DB trước ca gồm cả dòng removed/options và số đơn. Dùng hook test-only tại (a) sau renumber/tombstone, (b) sau thay items/options hoặc payment, (c) sau lưu applied result nhưng trước commit. Lỗi hạ tầng tại mọi điểm phải rollback toàn bộ hiệu ứng lẫn applied/result, K vẫn là bản đăng ký pending với payload/hạn đầu; một retry chủ động sau khi bỏ fault tạo đúng một applied. Không chấp nhận chỉ nhìn “số payment chưa tăng”.

Với lỗi nghiệp vụ xác định xảy ra muộn, ví dụ option mới không hợp lệ sau phần xử lý đầu: hiệu ứng nghiệp vụ rollback hoàn toàn nhưng một rejected terminal/error code được lưu bền vững. Sửa dữ liệu để lệnh sẽ hợp lệ nếu chạy mới, rồi execute lại K: vẫn cùng rejection, 0 hiệu ứng mới. K2 chỉ được xét sau xác nhận mới. Ngoài applied, chạy lost ACK sau commit rejected, cancelled và expired; read/replay trả terminal cũ kể cả sau 48 giờ, không mở lại hoặc sửa sang loại terminal khác. Payload mismatch/unauthorized không được ghi đè terminal gốc.

Để tránh false positive ở MVCC, observer đọc trạng thái cuối sau transaction/injected fault đã kết thúc bằng snapshot mới; một SELECT cũ hoặc nhìn rows trong chính transaction chưa commit không chứng minh rollback/commit. Mất ACK phải chặn outbound response sau commit được observer xác nhận, rồi thả late response trong fixture riêng. Kết quả nghiệp vụ R1 phải được đối chiếu số liệu độc lập trước khi dùng equality làm oracle replay.

**Ai đóng:** analyst thiết kế taxonomy lỗi và transaction. Không cần product decision cho các tính chất đã ghi ở PRE-15.

### DB-06 — P1: giữ snapshot cũ có ca đúng giá nhưng thiếu payload giả mạo nguồn gốc

**Tài liệu:** P:33–36,237–239,244,270; R12:281–283. PRE-31 có dòng ngoài đơn/cửa hàng cho split, chưa có ca cụ thể cho contract giữ phần cũ/thêm phần mới của submit.

**Code:** SQL 012:655–672 hiện bắt active items dùng ID mới; :815–850 và :875–915 lấy snapshot từ menu. Contract mới phải thay hạn chế ID này. Split có hai hình thức nguồn gốc khác nhau: 012:300–304 chuyển nguyên dòng sang đơn khác; :306–355 giữ ID nguồn và tạo splitItemId/options mới khi tách một phần số lượng. Một ID từng thuộc O1 có thể không còn thuộc O1 sau split.

**Kịch bản bị bỏ lọt:** caller khai dòng mới là retained để lấy giá cũ, tăng retained quantity=2 thành 3, gửi retained ID đã move sang đơn paid, ID removed, ID từ order khác/S2, lặp cùng retained ID, đổi menu/option/name/price trên phần cũ. UI không có nút sửa modifier không ngăn các payload này. Tổng cuối bằng 100.000 cũng chưa đủ nếu server lấy giá/cấu hình do caller khai.

**Expected cần bổ sung:** dưới phiên có đúng order.update, gửi từng payload giả riêng; server xác minh store/order/trạng thái/quantity/source ID tại execute. Phần giữ lại chỉ dùng snapshot server và lượng còn hợp lệ; tăng số lượng là phần mới theo giá đã được xác nhận, không làm tăng lượng ở giá cũ. Field immutable bị đổi phải bị từ chối theo schema/contract, không silently biến thành thay modifier món cũ. Invalid source không ghi/tombstone bất kỳ dòng nào. Giữ ca hợp lệ đối chứng: menu/option cũ đã đổi tên/giá, retained note/giảm quantity vẫn giữ snapshot cũ; phần mới vẫn phải thỏa quan hệ món–group–option hiện hành. Kiểm cùng signature modifier 0đ bằng ID/options rows, không chỉ sum(total).

**Ai đóng:** analyst. Không cần hỏi thêm về modifier hoặc cho phép sửa modifier phần cũ; hành vi đó đã ngoài phạm vi.

### DB-07 — P2: expected theo tổng tiền hoặc R1 còn bỏ sót cấu trúc dòng, audit và tác động bàn hiện tại

**Tài liệu:** P:214–218,237–241,245 (PRE-01…05/24/25/27/32), P:162 yêu cầu ghi riêng ngày kinh doanh nhưng PRE-19 chưa có con số báo cáo.

**Code:** SQL 012:300–355 move/copy snapshot khác nhau; :359–401 tạo payment, cập nhật source version và không trả bàn. 011:164–173 chỉ void/metadata/version, không sửa total/payment/bàn. 012:926–932 hiện ghi đè employee_id khi submit. Schema 001:201 chỉ có employee_id cho order; adapter orderRepo.ts:23–27 chưa trả creator/modifier audit. orderRepo.ts:51–55 bỏ items removed, :74–83 chỉ lấy payment gần nhất, nên dùng getOrder làm observer duy nhất có thể che row thừa. reportRepo.ts:13–28 lọc paid/void theo business_date.

**Expected cần làm thành oracle chung, áp trước/sau retry:**

| Ca | Snapshot phải kiểm thêm |
| --- | --- |
| PRE-02 hủy mở | O1 version 5→6, status void, subtotal/total=0, paid_at null; active items=0 nhưng snapshot removed không bị hard-delete; 0 payment; B01 empty; orderNo/businessDate/creator giữ nguyên. Replay không đổi version/updated_at nghiệp vụ. |
| PRE-04 split một phần L1 | Cố định source orderNo=12 và max của store/date=20. Paid order mới mang #12/version 0; source thành #21/version 6/open/120.000, B01 occupied. L1 ở nguồn quantity=4; splitItemId ở paid order quantity=1, option snapshot copy đủ; một payment thuộc đúng paid order, không payment ở source. Replay giữ toàn bộ các ID/số. |
| Split cả dòng trong đơn nhiều dòng | Dùng O2: cà phê giữ orderItemId khi chuyển sang đơn paid, trà còn ở nguồn; không copy thêm cà phê hoặc orphan option. Nếu contract mới đổi chiến lược lưu thì vẫn cần bảng ánh xạ ID rõ và tổng lượng bảo toàn. |
| PRE-05 void paid | Cố định version paid=6; void thành version=7, total/subtotal/orderNo/businessDate/paid_at/payment giữ nguyên, metadata actor/reason/time chỉ ghi lần đầu. Cho khách mới O3 ngồi B01 trước void và trước replay: B01 vẫn occupied, O3/version/items không bị tác động. |
| PRE-27 audit | Gán rõ A tạo, E sửa, A khởi tạo lệnh, B execute. Assert creator=A, last modifier=E ở nơi contract quy định, operation initiator=A/executor=B, payment employee=B. Replay C không đổi các giá trị hoặc thời điểm. Hiện chưa có đủ cột/output; đây là contract cần bổ sung, không kiểm bằng tên UI. |
| PRE-19 qua ngày | O1 business_date=08/09, paid_at=10/09 theo timezone fixture; doanh thu hiện hành 08/09 tăng 150.000, 10/09 không tăng từ O1, payment count=1. Không tự áp đề xuất ngày thu tiền chưa duyệt. |

Liên kết K→sourceOrderId→paidOrderId→paymentId phải đọc lại từ connection/context mới sau khi bỏ R1/local, không chỉ assert các field của response đầu. Khi split/paid order đã bị void, R1 vẫn là lịch sử của thao tác applied; trạng thái hiện tại tải riêng. Mọi assert đếm phải đọc toàn bộ rows trong store/nhóm ID fixture, không chỉ lọc ID trả về, để bắt đơn/payment thừa.

**Ai đóng:** analyst. Các giá trị version/số/ID chính xác là dữ liệu fixture; không cần product decision, trừ khi muốn thay chính sách đánh số/ngày báo cáo hiện hành.

### DB-08 — P2: PRE-31 chưa phân hoạch các đầu vào mà SQL hiện tự ép kiểu hoặc fail ngoài AppError

**Tài liệu:** R12:56–59 và P:220,244,258. PRE-31 nêu vài giá trị nhỏ, chưa chốt null/type/range ở các field ngoài expectedVersion.

**Code:** SQL 012:113,229 và :1055,1076 so tiền nhưng không test NULL trực tiếp; payments ở 001:250–253 bắt NOT NULL/integer. SQL 012:529–550,807 bỏ/coalesce quantity null; :858–862 coi options không phải array như rỗng; :898 ép quantity option thiếu/âm/0 lên 1. 012:59–65,210,921 dùng integer cho tính tiền; errors.ts:49–55 map lỗi SQL chưa biết về fallback UNKNOWN.

**Kịch bản:** NULL receivedAmount/method, quantity chuỗi số, options object/null, quantity option=0/−1/null, note quá giới hạn, UUID đúng cú pháp nhưng trùng một entity đã có, hoặc multiplication vượt miền integer. Test chỉ dùng quantity 0/1/5/6 không chứng minh schema strict hoặc rejection bền vững cho các trường hợp này. Ví dụ 71.583×30.000=2.147.490.000 vượt integer 32-bit trong biểu thức hiện tại; không nên để tác giả test tùy chọn coi UNKNOWN là lỗi nghiệp vụ cuối hay lỗi hạ tầng retryable.

**Expected cần bổ sung:** bảng trường bắt buộc/nullable/kiểu JSON/ngưỡng max, không ép string thành number hay option âm thành 1 khi nội dung đã đăng ký phải bất biến. Invalid schema phải có code/message và quy tắc K tồn tại hay chưa; invalid attempt cùng K không được làm hỏng bản hợp lệ đã đăng ký. Các phép tính tiền dùng miền đã chốt, vượt ngưỡng bị từ chối rõ và rollback toàn bộ. Test collision paymentId/newOrderId/splitItemId cùng store/khác store phải xác nhận không trả nhầm kết quả entity cũ và không còn hiệu ứng dở dang. Giới hạn phải là số cụ thể trong design, rồi kiểm min/max/max+1; không dùng lỗi constraint bất kỳ làm oracle “đã bị chặn”.

**Ai đóng:** analyst chọn giới hạn kỹ thuật tương thích đồ án và taxonomy lỗi. Nếu muốn đổi giới hạn nghiệp vụ người dùng hiện thấy mới cần nêu tác động với chủ dự án.

### DB-09 — P2: quyết định đếm replay chưa có ca hoặc định nghĩa số lần phải đếm

**Tài liệu:** P:459–461 giữ quyết định có một cột đếm lần lặp; không PRE-IDEM nào assert bộ đếm này. P:297 yêu cầu kết quả nghiệp vụ giống nhau nhưng không tách metadata transport/replay khỏi R1.

**Code:** adapter paymentRepo.ts:11–35, orderRepo.ts:89–100,163–171 chưa có operation/replay metadata; SQL 012:443–455,1171–1179 chỉ trả result nghiệp vụ. Đây là khoảng trống của thiết kế sẽ viết, không khẳng định code hiện có bộ đếm bị sai.

**Expected cần bổ sung:** analyst định nghĩa đếm register trùng hay execute trùng, có đếm read không, mismatch/unauthorized/timeout có đếm không, điểm commit đếm. Ví dụ nếu chọn đếm mỗi execute hợp lệ gặp terminal, hai replay đồng thời sau applied phải tăng đúng 2 bằng cập nhật nguyên tử; unauthorized/mismatch không thay bộ đếm; R1 business result giữ nguyên. Tách metadata mutable khỏi nội dung so sánh R1. Nếu quyết định lịch sử này đã bị thay thế thì ghi rõ thay thế, không để một requirement còn hiệu lực mà zero TC.

**Ai đóng:** analyst cụ thể hóa quyết định ghi nhật ký đã chốt; chỉ hỏi chủ dự án khi muốn bỏ hẳn yêu cầu đếm.

## Cách chuyển sang testplan có thể tự động hóa

Mỗi PRE-IDEM chứa nhiều biến thể phải tách thành TC riêng theo dữ liệu và kết quả terminal cụ thể. Trước khi viết test cần có một manifest fixture: store/actor/permissions/UUID/orderNo/businessDate/version, trạng thái tất cả rows, thời gian server, và expected sau từng bước. Hợp đồng lệnh cần tên trường/schema/error rõ; báo cáo này không tự đặt API/cột mới thành quyết định đã duyệt.

Một lần chạy DB tối thiểu cần caller A/B và observer/fixture controller tách quyền. Controller không được thực thi nghiệp vụ hộ caller. RLS negative có thể là zero rows chứ không luôn throw; dùng affected-row count và observer để chứng minh không mutation, đồng thời assert code của RPC theo contract. Snapshot so sánh sau race/fault phải là snapshot mới sau khi transaction đã settle. Có positive control cho từng lớp từ chối để phát hiện fixture không hợp lệ hoặc service chặn toàn bộ.

Migration test phải có cả DB mới và nâng cấp từ bộ migration hiện hành lên bản mới với đơn open/paid, snapshot, payment có sẵn. Kiểm overload/grants/function body/catalog thực sau migration, route ứng dụng gọi API mới thành công, route cũ bị từ chối. Không dùng readdir/regex như migrations.test.ts:10–18 làm chứng minh runtime. Tài liệu đã yêu cầu môi trường DB riêng; phần thiếu cần điền là reset/upgrade fixture, barrier, clock/fault hook và oracle ở trên, không chỉ thêm chữ “integration”.

Không đủ điều kiện tuyên bố test đúng/đầy đủ bằng số lượng 32 hoặc coverage. Cần đóng DB-01…06 và cụ thể hóa DB-07…09 cùng các artifact còn thiếu; sau triển khai mới chạy DB/race/ACK và lưu kết quả thực pass/fail/skip. **Các kết luận code trong báo cáo là đối chiếu tĩnh; không có exploit hay bug DB mới nào được báo là đã chạy chứng minh.**
