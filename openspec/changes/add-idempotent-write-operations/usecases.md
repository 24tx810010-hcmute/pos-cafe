# Use case — giao thức ghi và khôi phục online

Thuật ngữ và ký hiệu K, R1, G, F0: xem [bảng thuật ngữ](proposal.md#thuat-ngu).

Ngày 2026-09-09. **Thiết kế, chưa triển khai.** Tên kiểu viết hoa được định nghĩa đầy đủ trong [design.md](design.md); ví dụ số là VND, K/O/L/P/A/B là UUID fixture trong [testplan](testplan.md). Mọi luồng ghi áp dụng ngoại lệ chung dưới đây; UC liệt kê thêm ngoại lệ riêng. Mỗi exception được kiểm bằng TC có mã trong [ma trận](traceability.md).

## Ngoại lệ chung

| Mã | Thông báo chính xác | Kết quả |
| --- | --- | --- |
| AUTH_REQUIRED | Chưa ghép cửa hàng. Vui lòng đăng nhập lại. | Không ghi nghiệp vụ; không làm hỏng K đã có. |
| EMPLOYEE_SESSION_REQUIRED | Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN. | Không ghi nghiệp vụ; không làm hỏng K đã có. |
| FORBIDDEN | Bạn không có quyền thực hiện thao tác này. | Không ghi nghiệp vụ; không làm hỏng K đã có. |
| INVALID_WRITE_REQUEST | Dữ liệu thao tác không hợp lệ. Vui lòng tải lại và kiểm tra. | Không ghi nghiệp vụ; không làm hỏng K đã có. |
| WRITE_RESULT_UNKNOWN | Chưa xác định kết quả trên server. Hãy tra cứu thao tác trước khi tiếp tục. | Không tự gửi lại; tra cứu K khi kết quả chưa rõ. |
| WRITE_TEMPORARILY_UNAVAILABLE | Chưa thể hoàn tất yêu cầu. Hãy tra cứu và chỉ thử lại cùng thao tác. | Không tự gửi lại; tra cứu K khi kết quả chưa rõ. |
| WRITE_PROTOCOL_UNSUPPORTED | Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng. | Không tự gửi lại; tra cứu K khi kết quả chưa rõ. |

## UC-IDEM-01 — Đăng nhập và khóa phiên

**Tác nhân:** Nhân viên; quản lý cấu hình quyền. **Mục tiêu:** Vào đúng phiên cá nhân và bảo vệ thao tác khi rời máy.

**Tiền điều kiện:** Thiết bị đã ghép S1, nhân viên A active; DB có giao thức v1.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| employeeId | UUID, bắt buộc | Nhân viên của S1 | A |
| pin | string, bắt buộc | Đúng 6 chữ số 0–9 | 123456 |

### Luồng chính

1. Chọn nhân viên và nhập PIN.
2. Server kiểm PIN, cấp token phiên; app mở shell.
3. Khi khóa, app gửi revoke nếu online rồi xóa token/draft phiên, quay về PIN.

### Luồng thay thế

Reload trở về PIN; đăng nhập lại không làm mất lệnh đã đăng ký trên server. Store session vẫn còn.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| INVALID_PIN | PIN không đúng hoặc nhân viên không còn hoạt động. |
| AUTH_REQUIRED | Chưa ghép cửa hàng. Vui lòng đăng nhập lại. |
| EMPLOYEE_SESSION_REQUIRED | Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN. |
| WRITE_PROTOCOL_UNSUPPORTED | Phiên bản ứng dụng và server chưa tương thích. Tạm dừng ghi và tải lại ứng dụng. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| employeeSession | {employeeId:UUID, token:string, expiresAt:UTC ISO8601} | Chỉ bộ nhớ, token không vào localStorage/log/ledger |
| UI | screen=app hoặc passcode | Không ghi nghiệp vụ đơn; thông báo phiên theo bảng lỗi |

### Tiêu chí chấp nhận

- Caller tự khai employeeId không thay danh tính token.
- Phiên hết 12 h hoặc bị thu hồi không ghi được; quyền lấy lại ở server.
- PIN hash không có trong response SELECT hay RPC.

**Truy vết:** IDEM-01, IDEM-02, IDEM-03, IDEM-21, IDEM-23, IDEM-24, IDEM-25; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-02 — Tạo đơn hoặc ghi phần gọi đầu

**Tác nhân:** Nhân viên có order.create; khách của bàn/mang đi. **Mục tiêu:** Ghi nội dung đã xác nhận thành một đơn được server công nhận.

**Tiền điều kiện:** Online, phiên hợp lệ; bàn trống nếu dine_in; menu khả dụng.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId, orderId | UUID, bắt buộc | Sinh một lần khi xác nhận, khác nhau | K1, O1 |
| orderType, tableId | dine_in hoặc takeaway; UUID hoặc null | dine_in có bàn, takeaway null | dine_in, B01 |
| newLines | NewLine[1..200], bắt buộc | Schema đầy đủ tại design, mục 3; quantity 1..999, quotedBasePrice VND nguyên | A × 2, base 30.000, options[] |

### Luồng chính

1. Nhân viên thêm món, chọn modifier trong picker cho món mới và xác nhận gửi.
2. UI đóng băng payload/create, register K1.
3. Sau ACK pending còn thuộc lượt chủ động đang hoạt động, UI execute K1 đúng payload.
4. Server khóa, kiểm quyền/giá/bàn, commit đơn và applied; UI tải lại đơn.

### Luồng thay thế

Takeaway dùng tableId=null. Tùy chọn in bếp hiện hành có thể mở sau thành công chủ động; không thuộc khả năng phục hồi.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| TABLE_NOT_FOUND | Bàn không còn khả dụng. Vui lòng chọn lại bàn. |
| TABLE_OCCUPIED | Bàn đã có đơn mở. Hãy mở đơn hiện tại của bàn. |
| MENU_ITEM_UNAVAILABLE | Món không còn khả dụng. Vui lòng chọn lại. |
| OPTION_VALUE_UNAVAILABLE | Tùy chọn không còn phù hợp với món. Vui lòng chọn lại. |
| PRICE_CHANGED | Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại. |
| ENTITY_ID_CONFLICT | Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| operation | OperationView | pending sau register; applied/rejected sau execute |
| order | OrderSnapshot | orderNo cấp bởi server, version 0, status open, total 60.000 cho ví dụ |
| payments | số hàng mới=0 | Tạo đơn không phải ghi giao dịch thanh toán |
| UI | string | Thành công: “Đã ghi đơn trên server.” |

### Tiêu chí chấp nhận

- Register riêng không có order/payment.
- R1 đúng 60.000 và chỉ 1 order; replay không cấp số mới.
- Giá/tên lấy server, không tin client.

**Truy vết:** IDEM-04, IDEM-05, IDEM-07, IDEM-13, IDEM-14, IDEM-15, IDEM-26; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-03 — Sửa đơn, gọi thêm hoặc hủy đơn mở

**Tác nhân:** Nhân viên có order.update hoặc order.voidOpen. **Mục tiêu:** Giữ phần đã ghi đúng giá và chỉ thay phần mình xác nhận.

**Tiền điều kiện:** O1 open version 5; snapshot đã tải; không có thao tác chưa rõ trong cùng lượt.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| orderId, expectedVersion | UUID và integer 0..2147483647, bắt buộc | Phải khớp O1 | O1, 5 |
| retainedLines | RetainedLine[1..200] cho update | Mỗi active ID có đúng 1 bản, quantity 0..lượng nguồn, note tùy chọn: string hoặc null ≤ 500 | L1, 2, note=ít đá |
| newLines | NewLine[0..200] | Thêm bằng menu/picker hoặc dấu cộng | A × 1, base 40.000, option 0 |
| submitAction | update hoặc void_open | Kết quả không còn món phải chọn void_open | update |

### Luồng chính

1. UI dựng draft có source ID/snapshot của dòng cũ.
2. Nhân viên đổi note, giảm lượng hoặc thêm phần mới; dấu cộng tạo lượng mới theo giá hiện hành.
3. Xác nhận đóng băng update hoặc void_open; register rồi execute.
4. Server kiểm toàn bộ nguồn retained và version; ghi thay đổi/audit atomically; UI refetch.

### Luồng thay thế

Giảm nguồn về 0 tombstone. Hủy toàn bộ dùng void_open và order.voidOpen, không ép newLines rỗng thành tạo/sửa thành công.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |
| INVALID_ORDER_ITEMS | Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn. |
| NOT_FOUND | Không tìm thấy đơn trong cửa hàng này. |
| PRICE_CHANGED | Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại. |
| MENU_ITEM_UNAVAILABLE | Món không còn khả dụng. Vui lòng chọn lại. |
| OPTION_VALUE_UNAVAILABLE | Tùy chọn không còn phù hợp với món. Vui lòng chọn lại. |
| ENTITY_ID_CONFLICT | Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| order | OrderSnapshot | Ví dụ cũ 2 × 30 k+mới 1 × 40 k=100 k, version 6; void_open total 0/statusvoid/version 6 |
| line identity | UUID + snapshot | Dòng cũ không được đổi giá/options; removed vẫn lưu |
| payment/audit | 0 payment; 1 event | Creator giữ, lastModifiedBy=executor |
| UI | string | “Đã ghi thay đổi trên server.” hoặc “Đã hủy đơn mở trên server.” |

### Tiêu chí chấp nhận

- Đổi note giữa hai ID khác giá phải bật trạng thái chưa gửi.
- +1 không bán thêm theo giá cũ.
- Replay không thêm lần gọi, không mất lượng còn lại.

**Truy vết:** IDEM-04, IDEM-07, IDEM-08, IDEM-13, IDEM-15, IDEM-16, IDEM-26, IDEM-27; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-04 — Thanh toán toàn bộ bằng tiền mặt

**Tác nhân:** Nhân viên có payment.take. **Mục tiêu:** Ghi giao dịch thanh toán toàn bộ đơn một lần.

**Tiền điều kiện:** O1 open total 150.000/version 5; không draft chưa gửi; lựa chọn toàn bộ, tổng phần thanh toán >0.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| orderId, paymentId, operationId | UUID, bắt buộc | IDs cố định theo một xác nhận | O1, P1, K1 |
| expectedVersion | integer 0..2147483647 | Bắt buộc không NULL | 5 |
| method | literal cash | Không chấp nhận qr/bank_transfer/other; tổng phần thanh toán phải >0 | cash |
| receivedAmount | integer 0..2147483647 VND | ≥ tổng server ở execute | 200000 |

### Luồng chính

1. Thu ngân chọn toàn bộ và nhập tiền nhận; phần mềm không xác minh tiền vật lý.
2. UI chọn kind=pay_order trước register và đóng băng payload.
3. Execute ghi payment, paid, version+1, giải phóng bàn nếu phù hợp và R1.
4. UI hiển thị thành công và tùy chọn hóa đơn từ R1 nếu lượt chủ động còn hiệu lực.

### Luồng thay thế

Nếu mất ACK, UC 07 tra cứu; không suy luận thất bại từ việc drawer còn mở.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| INVALID_ORDER_ITEMS | Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn. |
| PAYMENT_AMOUNT_TOO_LOW | Tiền nhận chưa đủ để thanh toán phần đã chọn. |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |
| NOT_FOUND | Không tìm thấy đơn trong cửa hàng này. |
| ENTITY_ID_CONFLICT | Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| payment | PaymentSnapshot | amount 150000, received 200000, change 50000, employee=executor |
| order/table | paid/version 6; bàn empty nếu không còn đơn mở | Tổng và businessDate giữ |
| receipt | ReceiptSnapshot | Đúng nội dung R1 |
| UI | string | “Đã ghi thanh toán trên server.” |

### Tiêu chí chấp nhận

- Đúng 1 payment kể cả nhiều execute cùng K.
- Replay không tính lại giá hoặc tiền thừa.
- Không có xác nhận ngân hàng/đối chiếu tiền mặt.

**Truy vết:** IDEM-04, IDEM-06, IDEM-07, IDEM-08, IDEM-13, IDEM-14, IDEM-18, IDEM-19, IDEM-28, IDEM-30, IDEM-32; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-05 — Tách phần chọn và thanh toán

**Tác nhân:** Nhân viên có payment.take. **Mục tiêu:** Thu tiền cho đúng số món chọn, giữ đơn còn lại.

**Tiền điều kiện:** Nguồn O1 open 5 ly × 30 k/version 5, orderNo 12, maxNo 20 cùng ngày; B01 occupied.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| orderId, newOrderId, paymentId, operationId | UUID bắt buộc | Các ID mới riêng, không trùng nguồn | O1, O2, P1, K1 |
| expectedVersion, method, receivedAmount | integer không NULL; cash; VND integer | Như UC 04 | 5, cash, 50000 |
| lines | SplitLine[1..200] | orderItemId duy nhất; quantity 1..lượng còn; splitItemId UUID; tập con thực sự | [{L1, 1, L2}] |

### Luồng chính

1. Thu ngân chọn 1 trong 5 ly, nhập 50 k.
2. UI đóng băng split/IDs/lượng/version, register và execute.
3. DB tạo child #12 paid, nguồn #21 open 4 ly, payment 30 k và R1 cùng transaction.
4. UI hiện thừa 20 k và nguồn còn 120 k; bàn vẫn occupied.

### Luồng thay thế

Tách nguyên dòng trong đơn nhiều dòng move ID; partial copy sang splitItemId. Chọn toàn bộ trước register chuyển sang UC 04.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| INVALID_ORDER_ITEMS | Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn. |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |
| INVALID_ORDER_ITEMS | Các món được chọn không hợp lệ. Vui lòng kiểm tra lại đơn. |
| PAYMENT_AMOUNT_TOO_LOW | Tiền nhận chưa đủ để thanh toán phần đã chọn. |
| NOT_FOUND | Không tìm thấy đơn trong cửa hàng này. |
| ENTITY_ID_CONFLICT | Mã dữ liệu đã được sử dụng. Hãy tải lại trước khi tạo thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| source/child | OrderSnapshot mỗi đơn | Nguồn 120 k/version 6/#21; child 30 k/version 0/#12 |
| provenance | UUID linkage | K → O1 → O2 → P1; độc lập trạng thái đơn |
| payment/receipt | PaymentSnapshot, ReceiptSnapshot | amount 30 k, received 50 k, change 20 k |
| UI | string | “Đã ghi thanh toán phần đã chọn trên server.” |

### Tiêu chí chấp nhận

- Đúng 1 child/1 payment, tổng lượng 5 bảo toàn.
- Clamp sau ACK mất không chuyển lệnh sang pay hoặc lần split thứ hai.
- Void child không đổi nguồn.

**Truy vết:** IDEM-04, IDEM-06, IDEM-07, IDEM-08, IDEM-13, IDEM-18, IDEM-19, IDEM-29, IDEM-30, IDEM-32; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-06 — Hủy đơn đã thanh toán

**Tác nhân:** Nhân viên có order.voidPaid. **Mục tiêu:** Ghi nhận hủy giao dịch trong lịch sử với lý do/người rõ ràng.

**Tiền điều kiện:** O1 paid version 6, total 150 k; B01 có thể đã có khách mới.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId, orderId | UUID bắt buộc | K mới/O1 trong S1 | K1, O1 |
| expectedVersion | integer 0..2147483647 | Không NULL, phải khớp | 6 |
| reason, reasonNote | enum 5 hiện hành; note tùy chọn: string hoặc null ≤ 500 | other bắt buộc note trim không rỗng; enum tại design | other, Nhập nhầm |

### Luồng chính

1. Nhân viên mở lịch sử, tải chi tiết hiện tại trước xác nhận hủy mới, chọn hủy và nhập lý do. Retry lệnh đã đăng ký không thay expectedVersion.
2. UI register/execute kind=void_order với version đã xác nhận.
3. DB đổi statusvoid, version 7, lưu actor/lý do/mốc; giữ payment và tiền gốc.
4. UI tải lại lịch sử và vô hiệu hóa in lại.

### Luồng thay thế

Replay lệnh đã hủy trả lịch sử cũ; không dùng trạng thái đơn hiện tại để hủy tiếp.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| VOID_REASON_REQUIRED | Vui lòng chọn lý do hủy và nhập ghi chú nếu chọn lý do khác. |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |
| NOT_FOUND | Không tìm thấy đơn trong cửa hàng này. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| order | OrderSnapshot | void/version 7, total 150 k, paidAt giữ |
| void event | actor UUID, reason enum, UTC timestamp | Ghi 1 lần; không tạo payment âm |
| current table | không thay đổi | Khách mới/bàn occupied vẫn nguyên |
| UI | string | “Đã ghi hủy đơn trên server.” |

### Tiêu chí chấp nhận

- NULL version bị chặn trên fixture paid, có positive control version 6.
- Số liệu tiền hủy chỉ tính một đơn.
- Không tác động bàn/đơn khách mới.

**Truy vết:** IDEM-04, IDEM-07, IDEM-08, IDEM-13, IDEM-31; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-07 — Tra cứu và phục hồi sau mất phản hồi/local

**Tác nhân:** Nhân viên có quyền của loại lệnh. **Mục tiêu:** Biết server đã ghi gì trước khi quyết định tiếp tục.

**Tiền điều kiện:** Có thể K đã register/applied; mất ACK hoặc xóa toàn bộ local; kết nối lại và nhập PIN.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId hoặc bộ lọc | UUID tùy chọn; orderId/kind/status/date | Không có K thì list theo S1; limit 1..100 mặc định 50 | O1, status pending |
| cursor | string opaque ≤ 512 hoặc null | Server cung cấp; không chỉnh | null |
| chosenOperation | UUID bắt buộc khi bấm tiếp tục | Chọn 1 hàng cụ thể | K2 |

### Luồng chính

1. UI báo kết quả chưa rõ, chỉ đọc get/list; hiển thị loại/đơn/số tiền/người/thời điểm/K.
2. Nhân viên phân biệt K1 applied và K2 pending, mở bản payload/result tương ứng.
3. Applied/rejected/expired/cancelled chỉ hiển thị; pending có nút Thực hiện lại với nội dung gốc.
4. Chỉ khi bấm chủ động, gửi execute cùng K/payload; tải đơn hiện tại riêng khỏi R1.

### Luồng thay thế

Register mất ACK nhưng chưa có K trên server: thử đăng ký lại cùng K/payload còn trong bộ nhớ hoặc tra cứu lại; không hứa phục hồi draft chưa gửi sau local wipe.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| OPERATION_NOT_FOUND | Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy. |
| IDEMPOTENCY_KEY_REUSED | Mã thao tác đã gắn với nội dung khác. Hãy mở lại thao tác đã lưu. |
| OPERATION_EXPIRED | Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới. |
| OPERATION_CANCELLED | Lệnh đã được hủy trước khi thực hiện. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| operation list/detail | OperationView hoặc Page | Có K, initiator, executor, times, payload, result; không PIN/token |
| historical/current | Hai vùng dữ liệu riêng | R1 có thể version 6/source 120 k, current version 7/source 90 k |
| network/print | Reads tự động được phép | 0 ghi và 0 preview/in tự phát |

### Tiêu chí chấp nhận

- Không nhầm K1/K2 có nội dung tương tự.
- Máy mới dùng server thật, không seed lại mock để giả phục hồi.
- Counter đúng; R1 giữ nguyên.

**Truy vết:** IDEM-02, IDEM-05, IDEM-06, IDEM-09, IDEM-11, IDEM-12, IDEM-14, IDEM-18, IDEM-20, IDEM-21, IDEM-22, IDEM-30; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-08 — Nhân viên khác tiếp quản

**Tác nhân:** B có quyền hành động; A hết ca; C không có quyền. **Mục tiêu:** Tiếp tục lệnh của người trước bằng quyền thật của mình.

**Tiền điều kiện:** K do A register; B phiên hợp lệ cùng S1; không yêu cầu A online.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId, payload | UUID và payload server bất biến | Đọc từ K đã chọn | K1 của A |
| employee token | Header opaque | Token củaB, không đổi employeeId trong payload | phiênB |

### Luồng chính

1. B đăng nhập, list/get lệnh mình có quyền.
2. B xem nội dung rồi chủ động execute hoặc cancel.
3. Server kiểm quyền B tại checkpoint và ghi actor thành công B.
4. A/C xem lại chỉ được phép theo quyền hiện hành.

### Luồng thay thế

B chỉ có payment.take được tiếp quản pay/split; không register/đọc/execute/cancel submit hoặc voidPaid.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| FORBIDDEN | Bạn không có quyền thực hiện thao tác này. |
| EMPLOYEE_SESSION_REQUIRED | Phiên nhân viên đã hết hiệu lực. Vui lòng nhập lại PIN. |
| AUTH_REQUIRED | Chưa ghép cửa hàng. Vui lòng đăng nhập lại. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| operation/payment | initiator=A, executor=B | ReplayC nếu có quyền không sửa actor |
| unauthorized | Không hiệu ứng, không terminal hóa pending | Cho phép người hợp lệ sau đó tiếp quản |
| UI | thông báo theo kết quả K | Không bắt A đăng nhập lại |

### Tiêu chí chấp nhận

- Đổi role/revoke trước checkpoint phải có hiệu lực.
- Giả employeeId/admin hoặc đổi cửa hàng không vượt quyền.
- Hủy lệnh dùng cùng quyền hành động, không thêm gate quản lý.

**Truy vết:** IDEM-01, IDEM-02, IDEM-03, IDEM-06, IDEM-09, IDEM-13, IDEM-24, IDEM-25; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-09 — Hủy lệnh chưa áp dụng

**Tác nhân:** Nhân viên có quyền của lệnh. **Mục tiêu:** Dừng một yêu cầu chờ mà không hủy đơn đã ghi.

**Tiền điều kiện:** Có K pending còn hạn hoặc chưa biết trạng thái; online.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId | UUID bắt buộc | Server lookup đúng store | K1 |

### Luồng chính

1. Nhân viên chọn Hủy lệnh và đọc cảnh báo đây là lệnh chờ.
2. Client gửi cancel chủ động.
3. Server tranh khóa với execute và trả trạng thái terminal thật.
4. UI chỉ nói đã hủy khi nhận cancelled; nếu applied hiển thị giao dịch đã ghi.

### Luồng thay thế

Cancel thắng: cancelled. Execute thắng: applied. Tới checkpoint đã quá 24 h: expired. Không tìm thấy: chưa xác nhận hủy; register muộn chỉ tạo pending.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| OPERATION_NOT_FOUND | Server chưa tìm thấy thao tác này. Chưa thể xác nhận đã thực hiện hay đã hủy. |
| OPERATION_EXPIRED | Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| operation | OperationView | cancelled có cancelledBy/cancelledAt; applied giữ nguyên |
| order/payment/table | Không đổi do cancel | Không hủy/hoàn tiền/giải phóng bàn |
| UI | string | “Đã hủy lệnh chờ.” chỉ với cancelled |

### Tiêu chí chấp nhận

- Hai thứ tự race đều được kiểm.
- HTTP abort/timeout không cho trạng thái cancelled giả.
- Không auto-cancel khi đóng drawer.

**Truy vết:** IDEM-02, IDEM-10, IDEM-14; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-10 — Xử lý lệnh hết hạn và đơn qua ngày

**Tác nhân:** Nhân viên có quyền của lệnh/đơn. **Mục tiêu:** Tiếp tục phục vụ đơn cũ mà không lặp thao tác quá hạn.

**Tiền điều kiện:** O1 open từ 2026-09-08; K cũ pending đăng ký quá 24 h.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| operationId, orderId | UUID | K cũ để đọc, O mở để xác nhận mới | Kold, O1 |
| new operation payload | Schema loại lệnh | Version/giá lấy hiện tại trước xác nhận mới | Knew, pay version 5 |

### Luồng chính

1. Get/list/execute ghi nhận K cũ expired theo giờ server.
2. UI nói rõ đơn vẫn mở và tải hiện trạng.
3. Nhân viên xem lại, nhập tiền nhận rồi xác nhận Knew.
4. Pay Knew thành công; giữ businessDate 2026-09-08 và paidAt 2026-09-10.

### Luồng thay thế

K cũ đã applied trước hạn thì đọc sau 48 h vẫn applied; không cần Knew.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| OPERATION_EXPIRED | Lệnh đã hết hạn thực hiện. Đơn vẫn được giữ; hãy kiểm tra và xác nhận một thao tác mới. |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| old/new operations | expired và applied riêng | Không tái sử dụngK hoặc gia hạnK cũ |
| order/report | paid; businessDate 2026-09-08 | Doanh thu 2026-09-08 tăng 150 k, 10/09 không tăng từ O1 |
| UI | thông báo hết hạn như bảng lỗi | Không nói bàn/đơn hết hạn |

### Tiêu chí chấp nhận

- -1 ms, đúng hạn, +1 ms sau khóa có expected riêng.
- Không cần cron hoặc xóa khóa.
- Đơn 48 h không bị mất.

**Truy vết:** IDEM-11, IDEM-12; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-11 — Xác nhận lại giá phần gọi thêm

**Tác nhân:** Nhân viên có order.create/update. **Mục tiêu:** Biết tổng mới trước khi ghi phần có giá thay đổi.

**Tiền điều kiện:** O1 cũ 60 k/version 5; draft mới báo 40 k; server đã 45 k.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| quote payload | NewLine có quotedBasePrice/options giá | Quote cũ là 40000, không price override | 40000 |
| confirmation | Thao tác nút xác nhận mới | Sau xem giá hiện tại | đồng ý 45 k |

### Luồng chính

1. K1 execute phát hiện quote khác, trả rejected PRICE_CHANGED và bảng chênh giá.
2. UI giữ nguyên phần cũ 60 k, trình bày phần mới 45 k/tổng 105 k.
3. Người dùng xác nhận lại tạo K2 với quote mới và version vừa tải.
4. K2 ghi đơn 105 k/version 6; K1 vẫn rejected.

### Luồng thay thế

Giá giảm hoặc chỉ option đổi cũng cần xác nhận lại. Người dùng có thể bỏ phần mới; không tự resubmit.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| PRICE_CHANGED | Giá phần gọi thêm đã thay đổi. Hãy kiểm tra giá mới trước khi xác nhận lại. |
| MENU_ITEM_UNAVAILABLE | Món không còn khả dụng. Vui lòng chọn lại. |
| OPTION_VALUE_UNAVAILABLE | Tùy chọn không còn phù hợp với món. Vui lòng chọn lại. |
| ORDER_VERSION_CONFLICT | Đơn đã thay đổi. Hãy tải lại, kiểm tra rồi xác nhận một thao tác mới. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| old operation | rejected/error PRICE_CHANGED | details chỉ phần mới bị đổi, không sửa payload |
| order | Chỉ đổi sau K2 applied | 60 k → 105 k; 0 payment |
| UI | bảng giá cũ/giá mới/tổng | Câu thông báo PRICE_CHANGED đúng bảng lỗi |

### Tiêu chí chấp nhận

- Không âm thầm nhận giá cao/thấp hơn.
- Replay K1 sau sửa menu vẫn cùng rejection.
- Modifier phần cũ không được chỉnh.

**Truy vết:** IDEM-15, IDEM-17, IDEM-26; TC cụ thể trong [traceability.md](traceability.md).

## UC-IDEM-12 — Xem/in lại hóa đơn

**Tác nhân:** Thu ngân được xem đơn theo quyền hiện hành. **Mục tiêu:** Đối chiếu và in đúng hóa đơn đã ghi.

**Tiền điều kiện:** Đơn paid, payment snapshot tồn tại; bản in là xem trước+browser.

### Đầu vào

| Trường | Kiểu/bắt buộc | Ràng buộc | Ví dụ |
| --- | --- | --- | --- |
| orderId hoặc operationId | UUID | Order paid hoặc R1 đã chọn; in lại phải kiểm current status | O1/K1 |
| print action | click chủ động | Không phát sinh từ reconnect/replay | In |

### Luồng chính

1. Mở preview lần đầu từ R1 hoặc in lại từ order snapshot.
2. UI hiện base/options/quantity/unitTotal/lineTotal/tổng/nhận/thừa.
3. Bấm In mới gọi window.print.
4. Nếu current order đã void/chưa pay thì chặn in lại, R1 chỉ để xem lịch sử.

### Luồng thay thế

Tắt tùy chọn in sau thanh toán vẫn ghi thành công; tạm tính đơn open không ghi payment.

### Luồng ngoại lệ

Áp dụng bảng ngoại lệ chung. Ngoài ra:

| Mã | Thông báo chính xác |
| --- | --- |
| RECEIPT_UNAVAILABLE | Đơn chưa thanh toán hoặc đã hủy nên không thể in hóa đơn. |

### Đầu ra

| Dữ liệu | Kiểu/trạng thái | Tác dụng/thông báo |
| --- | --- | --- |
| receipt | ReceiptSnapshot | 2 × (30 k+2 × 5 k)=80 k; nhận 100 k/thừa 20 k |
| side effects | preview/window.print | Chỉ theo thao tác quy định, không gọi máy in nhiệt |
| server | Không thêm payment hoặc sửa order | In lại không execute nghiệp vụ |

### Tiêu chí chấp nhận

- Tên/giá cũ giữ khi menu đổi.
- DOM mỗi dòng và window.print được assert, không chỉ spy printPort no-op.
- Không vượt cấm in void qua R1.

**Truy vết:** IDEM-19, IDEM-32, IDEM-33; TC cụ thể trong [traceability.md](traceability.md).
