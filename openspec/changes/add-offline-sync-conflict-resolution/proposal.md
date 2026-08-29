# Đồng bộ và hòa giải xung đột sau khi ngoại tuyến

## Why

Có kho dữ liệu cục bộ và hàng đợi thao tác thì bài toán khó nhất vẫn chưa được giải: khi mạng trở lại, thao tác đã xếp hàng có thể mâu thuẫn với những gì đã xảy ra trên máy chủ. Hai thiết bị cùng ngoại tuyến, cùng sửa một bàn, cùng thanh toán một đơn, hoặc một thiết bị ngoại tuyến trong khi thiết bị khác vẫn online và đã đóng đơn đó rồi.

Hiện hệ thống chống ghi đè bằng khóa lạc quan: thao tác dựa trên dữ liệu cũ bị từ chối và người dùng phải tải lại. Cách này hợp lý khi online vì người dùng đang ngồi trước máy và sửa lại được ngay. Nhưng với thao tác đã xếp hàng từ hai giờ trước thì không còn ai để hỏi, nên cần chính sách hòa giải rõ ràng.

## What Changes

- Định nghĩa chính sách hòa giải cho từng loại thao tác trong hàng đợi.
- Phát hiện xung đột khi gửi lại: dữ liệu trên máy chủ đã đổi so với lúc thao tác được tạo cục bộ.
- Xử lý xung đột không tự giải được: đưa vào hàng chờ người xử lý thay vì âm thầm bỏ hoặc âm thầm ghi đè.
- Bảo đảm gửi lại không sinh trùng, kể cả khi mạng chập chờn và một thao tác được gửi hai lần.
- Xử lý các bất biến bị phá khi ngoại tuyến, đặc biệt là số bill sinh theo thứ tự thanh toán.
- Ghi dấu vết đầy đủ cho mọi xung đột và mọi quyết định hòa giải, vì đây là chỗ tiền có thể sai.

## Capabilities

### New Capabilities

- `offline-conflict-resolution`: phát hiện xung đột khi đồng bộ lại, chính sách hòa giải theo loại thao tác, bảo đảm không sinh trùng, và hàng chờ xung đột cần người xử lý.

### Modified Capabilities

- `offline-data-layer`: bổ sung quy tắc gửi lại và xử lý kết quả từ chối.
- `multi-device-sync`: đổi mô hình chống ghi đè, vì khóa lạc quan hiện tại giả định người dùng đang ngồi trước máy để tải lại.
- `payment`: đổi quy tắc sinh số bill nếu thanh toán được phép làm ngoại tuyến.
- `order-history`: bổ sung hiển thị đơn có xung đột đang chờ xử lý, nếu được chốt là cần.

## Impact

- Đây là phần rủi ro cao nhất trong toàn bộ danh sách mở rộng, vì sai sót ở đây làm mất tiền hoặc ghi nhận sai doanh thu.
- Chạm vào các lời gọi phía database quan trọng nhất và vào quy tắc đánh số bill.
- Cần bộ kiểm thử riêng cho các tình huống xung đột, và các tình huống này khó dựng lại.
- Cập nhật `docs/architecture.md`, `docs/limitations.md`, `pos-cafe-context.md`.

## Danh mục tình huống phải xử lý

Hai mươi tình huống rút ra từ chính cấu trúc dữ liệu và các lời gọi ghi hiện có, ngày 2026-08-28. Danh sách này là đầu vào bắt buộc cho việc thiết kế chính sách hòa giải và cho bộ kiểm thử: mỗi dòng phải có một quyết định và ít nhất một kịch bản kiểm thử.

**Số và định danh**

| # | Tình huống |
| --- | --- |
| 1 | Hai thiết bị cùng tạo đơn khi ngoại tuyến rồi đồng bộ cùng lúc |
| 2 | Thiết bị ngoại tuyến mở đơn cho một bàn, thiết bị đang online cũng mở đơn cho đúng bàn đó |
| 3 | Đơn tạo lúc gần nửa đêm, đồng bộ sau khi đã sang ngày kinh doanh mới |
| 4 | Đơn ngoại tuyến đồng bộ sau khi số của các đơn cùng ngày đã nhảy do người khác tách đơn thanh toán |

**Thực đơn**

| # | Tình huống |
| --- | --- |
| 5 | Món bị xóa mềm trong lúc thiết bị ngoại tuyến, đơn ngoại tuyến có món đó |
| 6 | Giá món đổi trong lúc thiết bị ngoại tuyến — dùng giá lúc ghi hay giá lúc đồng bộ |
| 7 | Nhóm tùy chọn bị sửa trong lúc thiết bị ngoại tuyến |
| 8 | Món bị ẩn khỏi thực đơn nhưng đơn ngoại tuyến đã chọn |

**Bàn và sơ đồ**

| # | Tình huống |
| --- | --- |
| 9 | Bàn bị xóa trong trình sửa sơ đồ, đơn ngoại tuyến trỏ tới bàn đó |
| 10 | Bàn đã được trả về trống ở thiết bị khác, đơn ngoại tuyến vẫn coi là đang phục vụ |

**Nhân viên và quyền**

| # | Tình huống |
| --- | --- |
| 11 | Nhân viên bị tạm khóa trong lúc thiết bị ngoại tuyến nhưng vẫn đang thao tác |
| 12 | Quyền bị gỡ trong lúc ngoại tuyến — ý định tạo lúc còn quyền có được áp dụng không |
| 13 | Đổi người trực khi ngoại tuyến, trong khi PIN hiện được so khớp phía database |
| 14 | PIN bị đặt lại trong lúc thiết bị ngoại tuyến |

**Tiền, nếu thanh toán được phép làm ngoại tuyến**

| # | Tình huống |
| --- | --- |
| 15 | Thanh toán ngoại tuyến rồi đơn đó bị thiết bị khác hủy online trước khi đồng bộ |
| 16 | Thanh toán ngoại tuyến bị gửi hai lần do ứng dụng khởi động lại giữa chừng |
| 17 | Tiền thối tính lúc ngoại tuyến nhưng tổng đơn đổi sau khi đồng bộ |
| 18 | Báo cáo doanh thu chạy trong lúc còn ý định chưa gửi, số liệu thiếu mà không ai biết |

**Vận hành**

| # | Tình huống |
| --- | --- |
| 19 | Thiết bị ngoại tuyến qua đêm rồi mới đồng bộ |
| 20 | Người dùng xóa dữ liệu trình duyệt khi còn ý định chưa gửi |

Tình huống 20 là rủi ro nghiêm trọng nhất và **không giải quyết trọn vẹn được bằng phần mềm**. Tối thiểu phải cảnh báo rõ khi còn hàng đợi và chặn các thao tác dọn dữ liệu trong ứng dụng, nhưng người dùng vẫn xóa được từ phía trình duyệt.

## Chiến lược kiểm thử

Đây là phần dễ làm ẩu nhất trong toàn bộ dự án, vì các tình huống ở trên khó dựng lại bằng tay và dễ bị bỏ sót.

**Kiểm thử hợp đồng dùng chung.** Dự án đã có nguyên tắc adapter mock và adapter thật cùng thỏa một hợp đồng, theo NFR-03. Adapter cục bộ là adapter thứ ba và phải chạy **cùng một bộ kiểm thử hợp đồng**, không viết bộ riêng.

**Kiểm thử đơn vị cho hàng đợi.** Thứ tự phát lại, chống gửi trùng, lùi dần khi gửi lại thất bại, và khôi phục đúng khi ứng dụng bị đóng giữa lúc đang gửi.

**Kiểm thử tích hợp phát lại.** Dựng sẵn một hàng đợi, phát vào database thật, và khẳng định phát hai lần cho kết quả giống hệt phát một lần.

**Kiểm thử đầu cuối với mạng bị ngắt thật.** Công cụ kiểm thử đầu cuối hiện dùng ngắt được mạng ở mức ngữ cảnh trình duyệt, nên dựng lại được đúng kịch bản đang ghi đơn thì rớt mạng, ghi tiếp, nối lại, rồi kiểm tra dữ liệu trên máy chủ.

**Kiểm thử theo tính chất, phần đáng giá nhất.** Sinh ngẫu nhiên chuỗi thao tác của hai tới ba thiết bị, ngắt mạng ở những thời điểm ngẫu nhiên, rồi phát lại theo nhiều thứ tự khác nhau. Sau mỗi lần chạy, khẳng định bốn bất biến:

- Không có hai đơn cùng số trong cùng một ngày kinh doanh
- Tổng tiền các bản ghi thanh toán bằng tổng tiền các đơn ở trạng thái đã thanh toán
- Không ý định nào bị áp dụng hai lần
- Không ý định nào biến mất mà không để lại dấu vết

Cách này bắt được lớp lỗi mà kiểm thử viết tay bỏ sót, và bản thân nó là một mục có sức nặng cho chương kiểm thử của báo cáo.

## Ngoài phạm vi

- Kho dữ liệu cục bộ và hàng đợi. Việc đó thuộc `add-offline-data-layer`.
- Hiển thị trạng thái đồng bộ cho người dùng. Việc đó thuộc `add-offline-status-ux`.
- Hòa giải tự động bằng cách hợp nhất nội dung ở mức từng trường.

## Phụ thuộc

- `add-offline-data-layer`: bắt buộc.
- `add-idempotent-write-operations`: bắt buộc, gián tiếp qua change trên. Bảo đảm không sinh trùng là điều kiện cần để phát lại hàng đợi an toàn.

## Câu hỏi phải chốt trước khi làm

1. Nguyên tắc chung khi xung đột là gì: máy chủ luôn thắng, thiết bị luôn thắng, hay tùy loại thao tác? Nguyên tắc máy chủ luôn thắng an toàn nhất nhưng sẽ vứt bỏ đơn đã bán ngoại tuyến.
2. Đơn đã thanh toán ngoại tuyến mà máy chủ báo đơn đó đã bị thiết bị khác thanh toán hoặc hủy thì xử lý thế nào? Đây là tình huống mất tiền thật, cần chính sách rõ ràng.
3. Số bill xử lý ra sao? Nếu ngoại tuyến sinh số tạm thì lúc đồng bộ có đánh số lại không? Đánh số lại sẽ làm hóa đơn đã đưa cho khách không khớp với hệ thống.
4. Xung đột không tự giải được thì ai xử lý và xử lý ở đâu? Cần một màn hình riêng, hay đưa vào màn lịch sử đơn?
5. Thao tác trong hàng đợi có hạn dùng không? Ví dụ thao tác quá 24 giờ thì không gửi nữa mà chuyển thẳng sang chờ người xử lý.
6. Có chấp nhận việc một số thao tác ngoại tuyến bị mất hẳn không, và nếu có thì người dùng được thông báo thế nào?
7. Mức độ chi tiết của dấu vết xung đột cần tới đâu, và giữ bao lâu?
8. Kiểm thử các tình huống xung đột bằng cách nào? Cần dựng được kịch bản hai thiết bị cùng ngoại tuyến rồi cùng online lại.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
