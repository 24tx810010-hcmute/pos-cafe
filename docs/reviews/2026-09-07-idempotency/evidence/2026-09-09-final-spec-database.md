# Rà độc lập bộ spec cuối — database và hợp đồng

Ngày 09/09/2026. Mốc code đối chiếu: main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c, D:/Workspace/pos-cafe. Đầu vào là bộ artifact tại D:/Workspace/pos-cafe-docs/openspec/changes/add-idempotent-write-operations. Đã đọc design, các requirement liên quan, use case, testplan và tasks trong phạm vi DB/auth/RLS/khóa/TTL/atomicity/money. Không đọc báo cáo reviewer khác, không chạy DB/ứng dụng, không sửa đầu vào. Các finding là vấn đề thiết kế, không phải exploit đã chạy chứng minh.

Mốc hash lúc ghi báo cáo: design.md D66D436DE9125927F722F6E6437A7D32A3DBEDF424C9A467EEA1CAF6E8B37C3F; testplan.md D4593F8B280FD2681372A2B722E290B9AEF29E49B9B4F5291EB35DC8BD6E22F4; usecases.md F6CEF2BFF692DB21342D6D32D295C8110FE11B093F585DC77AE2D3A92786DECA. Root đang xử lý riêng cấu trúc OpenSpec/spacing/ma trận; báo cáo không lặp các việc đó. Số dòng dưới đây đi kèm tên section/TC để truy lại khi tài liệu được sửa.

**Kết luận:** bộ mới đã đóng phần lớn khoảng trống DB của 32 PRE-IDEM, đủ nền để rà contract cụ thể. Còn 5 điểm dưới đây cần sửa trước khi coi thiết kế DB hoàn tất. Tất cả có thể do analyst quyết định và bổ sung trong phạm vi đồ án, không cần mở lại quyết định sản phẩm.

## FIN-DB-01 — P1: cấp phiên chưa tham gia thứ tự khóa của reset PIN

**Vị trí:** design.md §2.2:40–46 và §5.1:197; testplan.md TC-IDEM-002/005:101–143. Code nền: supabase/migrations/011_void_paid_order.sql:59–65 kiểm PIN bằng SELECT; src/adapters/supabase/employeeRepo.ts:30–38 hiện chưa có employee session, nên phần cấp phiên mới phải thiết kế đầy đủ.

Design nói reset PIN/inactive thu hồi toàn bộ phiên, và yêu cầu reset khóa employee trước sessions. Nhưng start_employee_session chỉ có bước kiểm PIN rồi cấp token, chưa bắt buộc giữ khóa employee từ trước khi đọc PIN đến khi chèn session. TC-005 chỉ reset sau khi token đã cấp xong.

**Lịch còn hở:** T1 đọc PIN cũ hợp lệ, dừng trước INSERT session; T2 reset PIN, revoke mọi session hiện có và commit; T1 tiếp tục INSERT session mới rồi commit. Token do PIN cũ sinh sau reset không nằm trong tập T2 đã thu hồi và employee vẫn active, nên có thể dùng cho execute. Đây là lịch một implementation làm đúng các bước hiện được viết vẫn có thể cho qua; không khẳng định đã chạy được trên code mới chưa tồn tại.

**Sửa khả thi:** start_employee_session khóa hàng employee FOR SHARE trước kiểm active/PIN, đọc lại sau chờ, giữ tới khi INSERT session và commit. Reset/inactive giữ thứ tự employee FOR UPDATE → sessions; mọi đường cấp/reset đều dùng thứ tự này. Không dùng chỉ FK/khóa session row để xử lý một session chưa tồn tại.

**TC bổ sung:** điều khiển hai bên thắng. Start thắng: reset đợi start commit rồi thu hồi cả token vừa cấp; token không dùng được sau reset commit. Reset thắng: start đọc lại PIN mới/inactive sau chờ, PIN cũ trả INVALID_PIN và không tạo session. Positive control PIN mới cấp phiên và execute được. Observer kiểm sessions/token hash và thời điểm commit, không chỉ response của reset.

## FIN-DB-02 — P1: allowlist bảng bàn chưa cho đường INSERT hợp lệ

**Vị trí:** design.md §2.4:72 và :80; testplan.md TC-IDEM-010/011:189–208; tasks.md:27. Code: supabase/migrations/001_schema_enums.sql:140–143 định nghĩa tables.id PK và store_id NOT NULL không có default; src/adapters/supabase/floorPlanRepo.ts:46–63 INSERT cả id/store_id/area_id/layout, đúng mô hình ID client sinh.

Hàng tables viết chung “Layout INSERT/UPDATE chỉ các cột layout/name/area/asset” và không grant cột định danh/store. Nếu áp literal cho cả INSERT, tạo bàn mới không thể cung cấp id/store_id bắt buộc. Nếu người thực hiện tự mở grant cả UPDATE để chạy seed/editor thì lại mở đường đổi danh tính/chủ sở hữu mà design cấm. Test admin đổi layout hiện chưa buộc tạo một bàn mới bằng principal thật sau activation grants.

**Sửa khả thi:** tách INSERT và UPDATE. Có thể chọn INSERT cho verified admin: cho id client và store_id nhưng WITH CHECK store_id=auth.uid(), status không được truyền, DB default empty; UPDATE chỉ whitelist layout/name/area/asset/tombstone cần thiết, tuyệt đối không id/store_id/status. Phương án khác là create_table RPC lấy store từ auth và chỉ nhận client id/layout. Chọn một cách, ghi rõ các cột seed/tombstone được xử lý qua đường nào; không mở lại status để seed chạy.

**TC bổ sung:** sau migration, admin tạo bàn mới qua đường đã chọn, observer thấy đúng UUID/store và status empty; cashier/store JWT trần không tạo được; admin không UPDATE id/store/status; cross-store area bị từ chối. Seed true, seed false rồi tự thêm bàn và retry seed phải đi qua chính các grants/RPC này. Không dùng setup đặc quyền thay cho positive control tạo bàn.

## FIN-DB-03 — P1: giá mới có thể làm PRICE_CHANGED không còn output hợp lệ

**Vị trí:** design.md §3.1:94, §6:234 và thứ tự lỗi §7:271–274; usecases.md UC-IDEM-11:550–578; testplan.md TC-IDEM-034/035:453–472 và TC-IDEM-076:915–923.

Money tối đa 2.147.483.647; PRICE_CHANGED.details.proposedNewLinesTotal cũng là Money. Nhưng thứ tự kiểm quote trước money cho phép gặp thay đổi giá có tổng mới vượt Money, trong khi contract vẫn yêu cầu trả PRICE_CHANGED với một proposed total không biểu diễn được.

**Fixture cụ thể:** create có một newLine quantity=2, quotedBasePrice=1, options=[]; register hợp lệ. Trước execute, admin đổi menu price thành 2.147.483.647, vẫn nằm trong miền giá một món. Quote đổi, nhưng proposedNewLinesTotal=4.294.967.294. Không thể vừa giữ kiểu Money cho details vừa trả chính xác số đó. TC-076 hiện kiểm overflow khi quote đã khớp; chưa kết hợp overflow và price change.

**Sửa khả thi:** tính component/unit/line/order bằng bigint, kiểm range của tất cả số dự kiến trước khi dựng PRICE_CHANGED. Nếu bất kỳ số bắt buộc xuất/ghi vượt miền thì terminal rejected INVALID_WRITE_REQUEST với details lý do overflow không chứa giá trị Money sai miền; ưu tiên lỗi này trước PRICE_CHANGED. Còn khi số đều trong miền thì trả PRICE_CHANGED như hiện tại. Ghi lại thứ tự lỗi và không cắt/clamp tiền.

**TC bổ sung:** quote tăng gây line overflow như ví dụ trên, option tăng gây unit overflow, và retained+new gây order overflow dù new subtotal còn hợp lệ. Expected rejected INVALID_WRITE_REQUEST bền, toàn bộ business không đổi, không SQL UNKNOWN/âm/wrap hoặc PRICE_CHANGED payload sai schema; replay vẫn cùng rejection. Positive twin giảm quantity hoặc giá về miền hợp lệ trả PRICE_CHANGED hợp lệ trước khi K mới được xác nhận.

## FIN-DB-04 — P2: checkpoint TTL được đặt trước validation nhưng requirement nói ngay trước hiệu ứng

**Vị trí:** design.md §5.1:198–199; specs/write-idempotency/spec.md IDEM-11:117; testplan.md TC-IDEM-062/065:761–802.

Thứ tự hiện ghi: lấy clock ngay trước hiệu ứng → sau đó validate toàn bộ business/quote/version/collisions → bắt đầu hiệu ứng. Recheck chỉ bắt buộc khi validation chờ khóa mới. Validation không cần chờ khóa vẫn tốn thời gian; ở biên -1ms có thể qua hạn trước hiệu ứng đầu tiên. TC-062 dùng clock cố định và TC-065 chỉ đặt gate sau hiệu ứng đầu, nên chưa phân biệt hai cách hiểu này.

**Sửa khả thi:** dưới các khóa đã inventory, hoàn tất validation và tính toán nhưng chưa ghi; trước quyết định terminal/effect, kiểm lại session expiry và lấy clock cuối. Nếu >=expires_at thì expired thắng và không effect; nếu còn hạn mới ghi ngay. Có thể giữ kiểm sớm để tránh làm việc vô ích, nhưng kiểm sớm không thay checkpoint cuối. Không recheck TTL sau khi hiệu ứng đã bắt đầu hợp lệ. Nếu muốn checkpoint là thời điểm bắt đầu validation thay vì trước hiệu ứng thì phải sửa đồng bộ requirement; phương án dời checkpoint cuối giữ sát quyết định đang có hơn.

**TC bổ sung:** test gate sau validation hoặc giữa validation nhưng trước effect; clock đi từ expiry−1ms sang expiry, release. Expected expired/0business/event, khác TC-065 vốn có effect trước gate và phải applied. Cũng dùng phiên hết hạn trong cửa sổ này để xác minh EMPLOYEE_SESSION_REQUIRED trước effect, không lạm dụng TTL lệnh để đại diện TTL phiên.

## FIN-DB-05 — P2: OrderSnapshot chưa xác định tập items dùng cộng total sau tombstone

**Vị trí:** design.md §3.2:126, §4.2:161–174; usecases.md UC-IDEM-03:145,165–166; testplan.md TC-IDEM-028:391–395 và TC-IDEM-037:486–494. Code nền: SQL 012:675–679 hiện tombstone mà giữ lượng/giá cũ, :681–688 void open total=0; adapter orderRepo.ts:51–55 hiện loại removed khỏi getOrder.

ItemSnapshot cho phép status active/removed, OrderSnapshot có items không nói active-only, và công thức total=ΣlineTotal chưa lọc status. TC-028 lại yêu cầu removed quantity “giữ theo schema” trong khi chưa có quy tắc cụ thể giữ quantity nào. Nếu result chứa removed như một triển khai có thể hiểu, ví dụ bỏ cũ2×30k, thêm mới1×40k sẽ có lineTotal 60k+40k nhưng order.total phải 40k; void open có toàn dòng removed, total phải 0. Equality R1 không tự giải quyết được mâu thuẫn schema đầu tiên này.

**Sửa khả thi:** chọn rõ OrderSnapshot.items chỉ chứa active rows và total=Σactive lineTotal; rows removed vẫn tồn tại ở DB/audit để observer kiểm, không cần nhét vào result vận hành. Hoặc nếu result cần cả removed, nêu total chỉ sum active và phân biệt hiển thị; không để renderer cộng mọi item. Với quantity=0 yêu cầu xóa phần cũ, định nghĩa DB giữ quantity/snapshot cuối trước remove và chỉ đổi status, còn result active không có dòng đó. Đây là lựa chọn lưu/đọc, không thay việc giữ lịch sử hay thêm nghiệp vụ mới.

**TC chỉnh:** literal R1 sau remove+new có total40k và đúng tập active; raw removed row vẫn quantity2/base30k/options cũ. Void open R1 total0/activeitems[], DB còn removed quantity/giá cũ; replay không đổi bất cứ snapshot nào. Thêm assert schema/result ở đây, không chỉ rawDB vì test raw hiện đã tốt.

## Những điểm đã đủ và cần giữ

- Ma trận theo action/endpoint đã rõ, B chỉ payment.take được tiếp quản; thiếu quyền không poison K. Token opaque trong bộ nhớ, whitelist nhân viên và bảo vệ self-promotion đã có thiết kế/TC cụ thể.
- Lock order POS→K→order/table→catalog→employee/session và đọc quyền sau chờ đã giải quyết khoảng trống cũ chỉ kiểm version/role trước khóa. BEFORE STATEMENT catalog lock cùng quy tắc không lấy POS ngược và clear demo POS trước catalog là hướng phù hợp cho quy mô đồ án. Không cần tối ưu song song hoặc thêm cơ chế phân tán.
- Terminal được xử lý trước version/menu/TTL nghiệp vụ, counter ngoài R1; rejected dùng subtransaction rollback rồi RETURN outer decision, lỗi hạ tầng rollback cả applied và effect. TC-068…073 có lost ACK cho bốn terminal và kiểm cả hai chiều atomicity; đây là tiến bộ thực chất, không chỉ thêm chữ integration.
- Giá 100k/129k, nguồn retained giả mạo, split move/copy/numbering và void giữ bàn khách mới đã có oracle cụ thể. Money bigint và range check, cash-only, NULL version với positive twin đúng trạng thái là nền đúng; FIN-DB-03 chỉ xử lý góc giao nhau còn mâu thuẫn.
- Observer đọc fresh toàn bộ rows, không dùng getOrder che removed/payment thừa; barrier có PID và tiến triển, clock wiring riêng, fault sau applied trước commit, fail-closed backend/discovery đã được định nghĩa. Bản spec không gọi 93 TC là test đã chạy.

Các sửa trên là thay đổi tài liệu kỹ thuật nhỏ, có TC cụ thể; không cần hỏi lại online/server authority/takeover/cash/24h/modifier hoặc mở rộng sang owner provisioning. Chỉ sau code và testDB thực mới có thể đánh giá tính đúng của implementation.

## Recheck giới hạn đúng 5 finding — 09/09/2026

Đọc lại các đoạn đã sửa trong design và TC liên quan; không rà thêm phạm vi, không chạy code/DB. Các finding phía trên giữ nguyên làm lịch sử của bản đã review; trạng thái sau đây thay thế kết luận mở trước đó cho từng finding.

| Finding | Trạng thái recheck | Bằng chứng hiện tại |
| --- | --- | --- |
| FIN-DB-01 | Đóng ở thiết kế/testplan | design:40 yêu cầu employee FOR SHARE từ trước so PIN tới INSERT/commit; :147 và :197 nêu cùng thứ tự employee→sessions. TC-IDEM-005:144 có hai lịch start/reset thắng và oracle không token PIN cũ sống sau reset commit. |
| FIN-DB-02 | Contract đã đóng; còn thiếu positive control tạo bàn cụ thể trong TC | design:72 đã tách INSERT id/store/layout với default empty và UPDATE không identity/status. TC-IDEM-011:208–210 còn mô tả đổi menu/layout, chưa nói seedfalse rồi admin tạo bàn UUID mới qua grants vừa activation. Đã gửi root bổ sung assertion này, không yêu cầu thay thiết kế. |
| FIN-DB-03 | Đóng ở thiết kế/testplan | design:234 và :274 tính bigint/kiểm miền proposed trước PRICE_CHANGED; TC-IDEM-076:925 thêm literal 4.294.967.294 và expected rejected INVALID_WRITE_REQUEST, không response Money ngoài miền. |
| FIN-DB-04 | Contract đã đóng; còn thiếu gate trước checkpoint trong TC | design:198 hoàn tất validation/khóa rồi kiểm hạn phiên và K tại clock cuối trước effect. TC-IDEM-062:763–771 mới kiểm fixed clock và TC-IDEM-065:796–804 vẫn chỉ gate sau effect; chưa bắt hồi quy đặt clock trước validation. Đã gửi root bổ sung suffix gate validation→checkpoint cho hạn K và hạn phiên. |
| FIN-DB-05 | Đóng ở thiết kế/testplan | design:161–162,174 xác định OrderSnapshot.items active-only, raw tombstone giữ lượng/base/options. TC-IDEM-028:397 và TC-IDEM-037:496 đã kiểm literal result.items và raw removed riêng. |

Ở mốc recheck này không còn mơ hồ contract của 5 finding. Hai phần testplan nhỏ ở FIN-DB-02/04 cần được xác nhận đã bổ sung trước khi ghi cả 5 đóng hoàn toàn. Đây là tình trạng tài liệu, không phải kết quả nghiệm thu implementation.

### Recheck bổ sung hoàn tất — cùng ngày

Đã đọc trực tiếp delta TC-IDEM-011 và TC-IDEM-062 sau khi root bổ sung, không chỉ dựa vào thông báo đã sửa:

- **FIN-DB-02: đóng.** testplan:208–210 đã có seedDemo=false, A tạo bàn bằng UUID/store_id hợp lệ sau activation, status DB default empty; B/C INSERT bị từ chối và UPDATE id/store/status vẫn bị cấm. Positive control đã kiểm đúng đường INSERT mà finding yêu cầu.
- **FIN-DB-04: đóng.** testplan:769–771 có suffix validation_k_expiry với K đăng ký T, phiên T+20h, gate từ T+24h−1ms tới T+24h+1ms, expected expired/0 effect; suffix validation_session_expiry với K/phiên T, gate qua T+12h, expected EMPLOYEE_SESSION_REQUIRED/Kpending. Quy tắc clock/phiên tại testplan:64 đã miễn token còn hạn cho ca cố ý kiểm session expiry, tránh setup làm mất ý nghĩa ca này.

**Kết luận recheck cuối: cả 5 FIN-DB-01…05 đã đóng ở thiết kế và testplan; không còn finding mở trong phạm vi 5 điểm được giao kiểm lại.** Giữ nguyên giới hạn: chưa thực thi test/DB, chưa xác nhận implementation an toàn, chưa đánh giá thay đổi ngoài 5 finding.

Hash mốc đóng: design.md **7357B54BCBE40AC86D6EEC16AF9D3C003E6B2BCCDE5BDD1DBED0324F38058A42**; testplan.md **D4982CF838635799BDCDBAFB43A3EEAA25DA10AF341E63A9E79D5EC9921A0C4E**. Các kết luận mở/partial phía trên là lịch sử trước delta này.
