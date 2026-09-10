# 10 — Quyết định sau review, vòng đời lệnh và chính sách giá

Ngày: **08/09/2026**. Mã được đối chiếu: `main@7183b31a4ca27ed2be3ca7097f391fd2c07f806c`.

Đây là bản ghi yêu cầu và lý do quyết định để dùng khi viết spec/báo cáo. **Chưa triển khai ứng dụng, chưa hoàn tất bộ bảy artifact và chưa được duyệt triển khai.** [07](07-uu-tien-online-va-khoi-phuc-tren-server.md) và [08](08-review-doc-lap-plan-07.md) giữ nguyên làm mốc; các khuyến nghị trong [09](09-giai-thich-cac-lua-chon-con-mo.md) phải đọc theo quyết định mới ở đây.

## 1. Các quyết định chủ dự án vừa chốt

| Mã | Quyết định | Hệ quả đối với phạm vi |
| --- | --- | --- |
| D10-01 | Server là nguồn tin cậy duy nhất; đơn chính thức là đơn đã được server ghi nhận | Giỏ/draft trên máy và bản đăng ký thao tác chưa execute không được hiển thị là đơn đã tạo thành công |
| D10-02 | Người có quyền nghiệp vụ được tiếp tục xử lý, không phụ thuộc họ có tạo đơn hay không | Không giới hạn tiếp quản cho quản lý; không cần người tạo hết ca thì mới được tiếp tục |
| D10-03 | Con người chịu trách nhiệm tiền mặt; phần mềm ghi nhận và xác minh giao dịch dữ liệu | Bỏ đề xuất bắt xác nhận đã đối chiếu tiền mặt trước lần thu tiếp; không thêm trạng thái xác nhận cầm tiền/ngăn kéo tiền |
| D10-04 | Cần truy được người tạo đơn và người thực hiện thanh toán | Ghi lịch sử từ hành động được server xác minh; không dùng nhật ký làm chứng cứ ai thực sự cầm tiền |
| D10-05 | Khôi phục từ dữ liệu server | Đổi máy tải lại đơn/thao tác/kết quả đã lưu; không cam kết phục hồi nội dung chưa từng tới server |
| D10-06 | Phục hồi phiếu bếp chưa thuộc đợt này | Ghi yêu cầu delta theo lần gửi vào phần việc bếp về sau; không thêm lưu/in lại delta vào change chống trùng |
| D10-07 | **Đã chọn giá theo từng lần gọi:** ly cũ 30.000đ, ly mới 35.000đ, tổng 65.000đ | Phần món đã được server ghi nhận giữ giá cũ; phần gọi thêm nhận giá mới |
| D10-08 | Giao analyst quyết định cách hủy và thời hạn lưu lệnh, ghi rõ lý do | Các lựa chọn ở mục 3 là quyết định theo ủy quyền, không cần hỏi lại về con số TTL |

### Thành công, thất bại và chưa xác định

Kết quả cuối cùng do server quyết định. Ứng dụng vẫn cần trạng thái kỹ thuật **“Chưa xác định kết quả”** khi mất phản hồi. Server có thể đã commit dù client timeout; tự báo thất bại lúc đó trái với nguyên tắc nguồn tin cậy duy nhất là server.

Trạng thái này không phải yêu cầu thu ngân kiểm đếm hay xác nhận tiền mặt. UI cho tra cứu/tiếp tục cùng thao tác, không dựng một giao dịch mới để thử vận may. Khi server đã có kết quả, trình bày đúng kết quả đó; không cần cờ “đã đối chiếu tiền” mới cho thao tác khác.

Đơn nguồn sau split có thể nhận **một lần thanh toán mới do người dùng chủ động tạo**, với version hiện hành và quyền hợp lệ. Không chặn chỉ vì chưa ai đánh dấu đã xem kết quả cũ. Phần mềm vẫn phải tách rõ nút/luồng phục hồi lệnh cũ với xác nhận một giao dịch mới; không tự biến polling hoặc retry thành giao dịch mới.

### Người có quyền và lịch sử

Server phải kiểm danh tính và quyền của **người đang thực hiện** ở thời điểm thực hiện. Việc người tạo nghỉ/không còn phiên làm việc không làm một lệnh chưa chạy mắc kẹt nếu người tiếp tục đủ quyền. Người tạo không cần có quyền thanh toán để người khác thanh toán đơn họ đã tạo.

Dữ liệu cần giữ tối thiểu:

- Người tạo đơn, thời điểm tạo theo server; không bị ghi đè khi người khác sửa đơn.
- Người khởi tạo mỗi thao tác và người thực hiện thành công thao tác đó nếu có tiếp quản.
- Người ghi giao dịch thanh toán; người hủy lệnh; thời điểm và kết quả tương ứng.
- Liên kết thao tác với đơn nguồn, đơn tách và payment để xem được lịch sử đúng đơn.

“Người ghi giao dịch thanh toán” là người được server xác minh đã thực hiện lần ghi thành công, không phải khẳng định người đó đã cầm tiền mặt. Người B chỉ xem/replay kết quả do A thực hiện không được thay A trên payment. Gửi lặp có thể tăng bộ đếm đã chốt trước đây, không tạo thêm sự kiện “đã thu tiền” trong lịch sử.

**Khoảng trống hiện tại:** phiên Supabase mới xác thực cửa hàng; RPC đọc quyền qua `p_employee_id` do client gửi. Bằng chứng nguyên văn nằm ở [08, E5](08-review-doc-lap-plan-07.md#e5--danh-tinh-nhan-vien-va-duong-ghi). Vì vậy đọc lại role từ DB chưa đủ chứng minh ai đang gọi.

Yêu cầu mới được ghi theo nghĩa server thực sự xác minh quyền người thực hiện. Nền tảng danh tính nhân viên phía server là **phụ thuộc để đạt bảo đảm này**, liên quan change [enforce-permissions-at-database](../../../openspec/changes/enforce-permissions-at-database/proposal.md). Không tự coi toàn bộ việc viết lại quyền của mọi module đã được duyệt hoặc đã làm; phương án kỹ thuật thu hẹp cho các đường ghi trong phạm vi còn phải thiết kế. Không ghi tên nhân viên do client khai thành danh tính đã được xác thực.

## 2. Giá hiện tại trong code chưa được giữ qua mọi lần sửa đơn

Kết luận mới cụ thể hơn trường hợp register rồi execute muộn của 08: **ngay cả đơn đã tạo trên server cũng có thể bị tính lại giá khi gửi sửa đơn**.

Luồng hiện tại:

1. `snapshotToDraft` sinh UUID mới và không giữ giá/name snapshot: `src/features/pos/orderFlow.ts:66–79`.
2. SQL yêu cầu UUID mới khi replace-submit và đánh dấu các dòng cũ là removed: `012_action_permission_guardrails.sql:655–679`.
3. SQL lặp qua toàn bộ món đang gửi, đọc menu hiện hành và insert giá `v_menu_item.price`: cùng file, `798–854`.
4. Mock cũng dựng lại snapshot từ menu hiện hành: `src/adapters/mock/orderRepo.ts:66–68`.

**Ví dụ suy từ mã:** đơn có cà phê 30.000đ; menu đổi thành 35.000đ; người dùng mở đơn rồi gửi sửa một ghi chú/thêm món với version hợp lệ. Dòng cà phê được tạo lại theo giá 35.000đ. Chưa chạy ca này trên DB thực tế, nên đây là kết luận từ luồng mã, không phải sự cố production đã tái hiện.

Ngoài giá, `orders.employee_id` hiện còn bị đổi thành người submit gần nhất (`012:926–934`). Vì vậy không thể gọi cột hiện tại là “người tạo bất biến”, cũng không suy lại người tạo thật của mọi đơn cũ chỉ từ giá trị hiện tại của cột này.

Các trích đoạn mới ở phụ lục giúp kiểm được hai kết luận trên mà không truy cập repo. Định nghĩa giá từ SQL, authentication và payment có thêm trong tập bằng chứng của 08.

## 3. Hủy và lưu lệnh — quyết định theo ủy quyền

Chủ dự án giao analyst chọn phần này. Chọn một chính sách nhỏ, rõ biên và không cần worker/cron.

### 3.1. Hiệu lực lần thực hiện đầu: 24 giờ từ lần đăng ký đầu tiên

- Server đặt `expires_at = registered_at + 24 giờ` một lần. Hai mốc đều do server xác định.
- Register/retry lại cùng mã không gia hạn. Không dựa vào đồng hồ hoặc local storage của thiết bị.
- Với lệnh chưa thực hiện, server kiểm hạn **sau khi lấy quyền quyết định trên hàng lệnh, trước khi bắt đầu hiệu ứng nghiệp vụ**. Nếu thời điểm đó `>= expires_at`, lệnh hết hiệu lực và không được execute.
- Lệnh đã bắt đầu thực hiện hợp lệ trước hạn được kết thúc trong transaction ngắn của nó; không cắt ngang chỉ vì đến hạn giữa transaction.
- Lệnh đã applied luôn được tra/replay kết quả cũ, kể cả quá 24 giờ. Kiểm terminal/replay trước nhánh hết hiệu lực của lệnh chưa chạy, sau kiểm quyền truy cập cần thiết.
- Hết hiệu lực **lệnh** không tự đóng/void **đơn**, không xóa payment và không ảnh hưởng việc hợp lệ tiếp theo trên đơn đó.
- Muốn làm việc mới sau khi lệnh cũ hết hiệu lực: tải trạng thái server, xem lại nội dung và xác nhận lệnh mới. Không tự cấp mã mới rồi gửi lại nội dung cũ.

| Phương án | Ưu điểm | Nhược điểm / lý do chọn hoặc loại |
| --- | --- | --- |
| 15–30 phút | Giảm số lệnh cũ còn có thể chạy | Dễ hết hạn khi thay máy, đổi nhân viên hoặc xử lý gián đoạn; không chọn |
| Hết ngày kinh doanh | Dễ liên hệ với ngày bán hàng | Lệnh lúc 23:59 có thể chỉ còn một phút; trộn thời hạn giao thức với ngày của đơn; không chọn |
| **24 giờ từ đăng ký** | Phủ một chu kỳ ngày, cho phép tiếp quản qua ca/qua nửa đêm; một quy tắc cho bốn RPC | Vẫn cho phép lệnh tương đối cũ, nên phải giữ kiểm version/quyền và xác nhận thủ công; chọn |
| Không hết hạn | Ít nhánh xử lý | Lệnh tạo đơn bỏ lại lâu vẫn có thể chạy; không chọn |

24 giờ là **lựa chọn thiết kế cho đợt đồ án**, không phải số đo vận hành, không phải chuẩn POS hay con số sao chép từ Stripe. Hết hạn chỉ hạn chế lần áp dụng đầu tiên; nó không thay thế kiểm version/quyền hoặc quy tắc giá. Chưa chốt cách gán ngày kinh doanh cho thay đổi mới ngoài hành vi hiện hành chỉ bằng TTL này.

**Làm rõ theo câu hỏi đơn bàn để qua 1–2 ngày:** tuổi của đơn không phải tuổi của lệnh thanh toán. Đơn đã được server tạo vẫn tồn tại và chưa thanh toán cho tới khi có nghiệp vụ thanh toán/hủy hợp lệ; TTL này không tự xóa, đóng đơn hoặc trả bàn.

| Tình huống | Xử lý theo chính sách 24 giờ |
| --- | --- |
| Ngày 08/09 tạo đơn, chưa từng bấm thanh toán; ngày 10/09 mới thanh toán | Tải lại đơn server rồi tạo lệnh thanh toán mới ngày 10/09. Hạn của lệnh này tính từ khi nó đăng ký, không tính từ ngày tạo đơn |
| Ngày 08/09 đã đăng ký lệnh thanh toán nhưng server chưa thực hiện; ngày 10/09 mới tiếp tục | Server kết luận lệnh cũ expired. Đơn vẫn chưa thanh toán; người dùng tải lại và xác nhận lệnh mới sau khi biết trạng thái cuối của lệnh cũ |
| Ngày 08/09 server đã thanh toán thành công nhưng máy mất phản hồi; ngày 10/09 tra lại | Trả kết quả applied cũ; không coi giao dịch hết hạn, không tạo payment mới |

**Ngày báo cáo là điểm riêng cần quyết định, không được tự đổi bằng TTL.** Hiện tạo đơn gán `business_date` theo thời gian server (`supabase/migrations/012_action_permission_guardrails.sql:751–757`); thanh toán toàn bộ cập nhật `paid_at/status/lock_version`, không đổi `business_date` (cùng file, `1116–1122`). Báo cáo chọn đơn paid theo `business_date`, nên đơn tạo 08/09 và thanh toán 10/09 sẽ được cộng vào báo cáo 08/09 theo mã hiện hành:

[src/adapters/supabase/reportRepo.ts:24–28](D:/Workspace/pos-cafe/src/adapters/supabase/reportRepo.ts:24)

```ts
    const { data: orderRows, error } = await this.client
      .from("orders")
      .select("id,total,business_date,paid_at,created_at")
      .eq("status", "paid")
      .eq("business_date", filter.businessDate);
```

Đề xuất để cân nhắc cho báo cáo tiền mặt: giữ ngày tạo đơn phục vụ lịch sử/số đơn, đồng thời nhóm số tiền đã ghi thanh toán theo ngày thanh toán tại múi giờ cửa hàng. **Chưa chốt thay chủ dự án hoặc sửa báo cáo hiện hành.** Chưa chạy ca qua ngày trên DB; kết luận hiện trạng trên dựa vào mã.

### 3.2. Chỉ hủy lệnh đã đăng ký và chưa thực hiện

- Người có quyền thực hiện loại thao tác tương ứng trong cửa hàng được hủy lệnh chưa áp dụng. Hủy đơn đã paid vẫn theo quyền nghiệp vụ void riêng; không lẫn hai hành động.
- Cancel và execute được server phân xử trên cùng lệnh. Cancel thắng: lưu trạng thái đã hủy, late execute không chạy. Execute thắng: cancel trả kết quả đã áp dụng, không báo hủy thành công.
- Cancel lặp trả trạng thái terminal hiện có, không xóa bản ghi và không tái mở mã.
- Lệnh đã rejected/expired giữ nguyên kết quả cuối, không cần đổi tiếp sang cancelled chỉ để dọn giao diện.
- Nếu cancel không tìm thấy lệnh: **không xác nhận đã hủy**. Request register cũ có thể đang đến muộn. Đợt này không thêm tombstone hủy trước đăng ký cho một mã chưa xác minh được loại/quyền/nội dung.
- Khi còn mã/nội dung trên máy, có thể phục hồi việc đăng ký cùng mã rồi hủy lệnh đã được server nhận; khi mất local thì tìm dữ liệu server. Không dùng một kết quả tìm kiếm rỗng làm bằng chứng được phép tạo giao dịch thay thế an toàn.
- Abort HTTP, đóng drawer hoặc xóa local không được gọi là server đã hủy. Không tự execute bản đăng ký bỏ lại khi reconnect.

Lý do chọn: hủy bằng trạng thái bền vững giải quyết request đến muộn cho lệnh đã biết; không cần xây cơ chế thu hồi ý định chưa tới server. Chấp nhận giới hạn có thể còn bản đăng ký bỏ lại; nó không tạo đơn/payment, không tự chạy, và hết hiệu lực theo mốc 24 giờ từ lúc server nhận.

### 3.3. Lưu mã, nội dung và kết quả: không tự xóa trong bản đồ án

Giữ đầy đủ bản ghi lệnh và kết quả, gồm applied/rejected/cancelled/expired, **không có TTL xóa tự động trong phiên bản này**. Key đã dùng không được quay lại thành key mới chỉ vì quá 24 giờ. Không đặt một lịch tự xóa vào ngày nghiệm thu 21/12/2026.

Lý do: giữ được đường phục hồi và dấu vết phục vụ báo cáo; tránh bài toán xóa xong request cũ đến lại; không cần cron hoặc tác vụ dọn. Đánh đổi là dữ liệu tăng, và chưa có số liệu để ước lượng tăng trưởng thật. Đây là chính sách của bản đồ án, không tuyên bố dung lượng server vô hạn.

Nếu sau này cần giới hạn lưu payload/kết quả, phải có change riêng: quyết định thời hạn, giữ marker chống tái dùng mã, thử request muộn và xác định giới hạn tra cứu trước khi xóa. Không áp dụng chính sách đó ngầm vào bản hiện tại.

## 4. Tiền lệ POS và quyết định giá theo từng lần gọi

Đã tra tài liệu chính thức ngày 08/09/2026:

| Nguồn | Điều tài liệu thực sự xác nhận | Giới hạn suy luận |
| --- | --- | --- |
| [Square — Retrieve Catalog Objects](https://developer.squareup.com/docs/catalog-api/retrieve-catalog-objects) | Order lưu phiên bản catalog để đọc lại dữ liệu của thời điểm tạo; khi chỉ định `catalog_version`, CreateOrder dùng giá phiên bản đó | Không chứng minh mọi màn POS hoặc mọi thao tác thêm/sửa món đều có cùng quy tắc |
| [Toast — Add items to a check](https://doc.toasttab.com/openapi/orders/operation/ordersOrderGuidChecksCheckGuidSelectionsPost/) | Giá được mô tả tại cấp selection; endpoint cho thêm selection vào check đã có | Hợp đồng API hỗ trợ suy luận theo từng phần món được chọn, không phải cam kết toàn bộ bảng giá bị giữ từ lúc mở bàn |

Hai nguồn là tiền lệ cho việc ghi lại giá cùng dòng bán hàng. Lựa chọn dưới đây đã được chủ dự án xác nhận cho pos-cafe qua câu trả lời **“Giữ giá từng lần gọi: tổng 65.000đ”**, không phải suy “mọi POS đều làm như vậy”. Không cần sao chép cả hệ thống phiên bản catalog của Square.

### D10-PRICE — Giữ giá theo phần món đã được server ghi nhận

**Chốt bổ sung 09/09/2026:** modifier được chọn khi thêm món; không có yêu cầu thêm/sửa modifier trực tiếp lên phần đã ghi. A ×2 đã ghi giá 30.000đ, menu tăng lên 40.000đ, thêm A ×1 với modifier 0đ cho tổng **100.000đ**. Hai ví dụ sửa modifier ly cũ cho tổng 67.000đ/72.000đ đã bị rút khỏi phạm vi. Câu hỏi nghiệp vụ này đã đóng; xem bằng chứng UI và testcase tại [12, mục 7](12-chuan-bi-ra-cuoi-truoc-code.md).

**Đã được xác nhận lại sau phần giải thích:** chủ dự án đồng ý ghi nhận quy tắc hai dòng bán hàng khác giá và yêu cầu chuẩn bị rà cuối trước code. Xem [12](12-chuan-bi-ra-cuoi-truoc-code.md) để phân biệt quyết định đã chốt với phần contract/spec còn phải hoàn tất.

**Xác nhận bổ sung của chủ dự án ngày 08/09/2026:** cùng tên/cùng loại nhưng khác giá phải được phân biệt khi bán. Thuật ngữ thiết kế: **hai dòng bán hàng có giá riêng**, vẫn cùng món catalog (`menuItemId`), không tự tạo hai món menu. Mỗi phần được server ghi thành công giữ snapshot của nó; phần gọi thêm có giá mới tạo phần giá mới. Giá bằng nhau chưa đủ để gộp khi cấu hình/ghi chú khác. Ghi đơn chốt nội dung/giá, chưa tự tạo payment hoặc đánh dấu paid. Chi tiết, bằng chứng hàm thêm hiện gộp theo món/option và các biến thể test được ghi trực tiếp trong [proposal](../../../openspec/changes/add-idempotent-write-operations/proposal.md). Việc sửa size/topping phần cũ vẫn chưa được chốt chỉ bằng xác nhận về gọi thêm này.

1. Món được server tạo thành công giữ nguyên giá cơ bản, phụ thu option và tên snapshot của lần ghi đó. Đổi menu, thanh toán, retry, đổi máy hoặc chỉ sửa ghi chú không tự tính lại giá phần món đã có.
2. Món/số lượng **gọi thêm** lấy giá server hiện hành khi phần bổ sung được ghi nhận. Nếu cùng món nhưng khác giá, giữ thành các phần/dòng khác nhau để không mất nguồn gốc giá.
3. Giảm số lượng một phần món không tính lại đơn giá của phần còn lại.
4. Tách bill giữ giá snapshot phần món được tách; trả tiền dựa trên dữ liệu đơn server, không đọc lại giá menu để tính tiền cũ.
5. Đăng ký thao tác chưa execute chưa phải tạo đơn hoặc cam kết giá. Khi giá server khác giá vừa trình bày để người dùng xác nhận, cần trả về cho xem lại trước khi chấp nhận nội dung thay đổi; không tin giá client khai làm giá bán chính thức.
6. **Chốt 09/09/2026:** giữ luồng chọn modifier khi thêm món, không bổ sung sửa modifier phần đã ghi. Phần cũ giữ base/option snapshot; món mới và modifier được chọn cho món mới lấy giá khi được server ghi nhận. Những đề xuất trước về thay cấu hình ly cũ hoặc giữ base cũ rồi bổ sung modifier đều đã rút khỏi phạm vi, không còn là câu hỏi chờ chủ dự án. Xem [12, mục 7](12-chuan-bi-ra-cuoi-truoc-code.md).

| Ví dụ | Theo đề xuất giữ từng lần gọi | Theo giữ toàn bộ bảng giá lúc mở đơn |
| --- | --- | --- |
| 10:00 ghi 1 cà phê 30.000đ; 11:00 menu thành 35.000đ; không gọi thêm | Vẫn 30.000đ | Vẫn 30.000đ |
| Sau đó gọi thêm 1 cà phê | Ly cũ 30.000đ + ly mới 35.000đ = **65.000đ** | 2 ly ×30.000đ = **60.000đ** |
| Sau đó gọi một món chưa có trong đơn lúc 10:00 | Lấy giá khi bổ sung món đó | Cần biết giá lịch sử lúc 10:00, kể cả món chưa từng nằm trong đơn |

**Ưu điểm đề xuất:** giữ đúng giá phần khách đã gọi; món mới phản ánh điều kiện bán mới; không cần snapshot toàn bộ menu cho từng bàn. **Nhược điểm:** cùng món có thể có hai giá trong cùng đơn, nên UI và dữ liệu cần tách rõ từng phần; không thể tiếp tục replace-submit mất nguồn gốc dòng như hiện nay.

**Ưu điểm giữ giá toàn đơn lúc mở:** dễ giải thích “bàn này theo giá khi bắt đầu”. **Nhược điểm:** phải lưu/truy bảng giá lịch sử cho món chưa gọi và xử lý món mới tạo sau lúc mở đơn; thay đổi lớn hơn nhiều so với chỉ giữ giá dòng đã có.

**Đã chốt tổng 65.000đ.** Tăng số lượng đặt thêm phải giữ ranh giới phần cũ/phần mới, kể cả khi người dùng bấm dấu cộng trên dòng đang có. Khi viết use case, cần thể hiện rõ phần giá trong màn hình sửa món và biên đăng ký–execute; không suy rằng việc chốt nguyên tắc giá đồng nghĩa hợp đồng kỹ thuật đã hoàn chỉnh.

## 5. Cập nhật hướng testcase

Không viết lại lịch sử review 08; các ca ở đó là ứng viên trước quyết định này. Khi viết testplan chính thức, áp dụng các thay đổi sau:

| Ca | Dữ liệu / hành động | Kết quả cần đặc tả |
| --- | --- | --- |
| D10-T01 | A tạo đơn; B có quyền thanh toán, không có quyền tạo đơn | B được thanh toán; giữ A là người tạo, B là người ghi payment |
| D10-T02 | A khởi tạo lệnh chưa chạy; A nghỉ/bị khóa; B đủ quyền tiếp tục | Kiểm quyền B; không phụ thuộc A vẫn đăng nhập/đủ quyền execute |
| D10-T03 | Caller gửi ID quản lý nhưng không có danh tính server tương ứng | Không vượt quyền; test gọi thẳng server |
| D10-T04 | Payment đã do A ghi; B chỉ xem/replay | Không payment mới; người ghi payment vẫn A |
| D10-T05 | Split applied; chưa ai xác nhận tiền mặt; người đủ quyền tạo lần thanh toán mới với version mới | Không yêu cầu bước đối chiếu tiền mặt; thử lại thao tác cũ vẫn dùng K cũ |
| D10-T06 | Gây mất response sau commit | Hiện chưa xác định, tra server về applied; không báo thất bại vì timeout |
| D10-T07 | Register lúc 10:00; thực hiện lúc 09:59:59.999 ngày sau | Còn hiệu lực về TTL, vẫn kiểm quyền/version/điều kiện nghiệp vụ |
| D10-T08 | Cùng dữ liệu, kiểm hạn lúc đúng 10:00:00.000 ngày sau hoặc muộn hơn | Lệnh chưa chạy bị expired, 0 hiệu ứng nghiệp vụ |
| D10-T09 | Retry register lúc giờ thứ 23 | `expires_at` không tăng thêm 24 giờ |
| D10-T10 | Lệnh applied từ 25 giờ trước | Trả kết quả lịch sử, không báo expired và không ghi thêm |
| D10-T11 | Cancel và execute tranh chấp | Một kết quả cuối; cancel thắng thì 0 payment, execute thắng thì trả applied |
| D10-T12 | Cancel chưa tìm thấy K, sau đó register K đến muộn | Không có thông báo đã hủy giả; không tự execute; lệnh được tra cứu/hủy/hết hạn theo server |
| D10-T13 | A tạo, B sửa, C thanh toán | Lịch sử phân biệt A/B/C; cột người tạo không bị B ghi đè |
| D10-T14 | Đổi giá menu rồi sửa ghi chú của phần món đã tạo | Giữ giá cũ theo yêu cầu snapshot; không replace-submit làm tính lại tiền |
| D10-T15 | Có 1 ly 30.000đ; giá mới 35.000đ; gọi thêm 1 ly, rồi split và replay | Tổng 65.000đ; tách ly cũ 30.000đ hoặc ly mới 35.000đ theo phần được chọn; replay không ghi thêm và không gộp mất ranh giới giá |
| D10-T16 | Đơn đã tạo từ 48 giờ trước, chưa có lệnh thanh toán; người đủ quyền tải lại và thanh toán | Được đăng ký lệnh mới với hạn 24 giờ từ lúc đăng ký mới; tuổi đơn không làm lệnh hết hạn |
| D10-T17 | Đơn có lệnh thanh toán chưa áp dụng đã quá 48 giờ | Server trả expired cho lệnh cũ; đơn và số tiền còn nguyên; chỉ tạo lệnh mới qua xác nhận chủ động sau khi biết kết quả lệnh cũ |

R07-T15 chuyển thành tiếp quản theo quyền, không quản lý độc quyền. R07-T24 bỏ bước đối chiếu tiền mặt bắt buộc. R07-T21 về phục hồi delta phiếu bếp chuyển sang phần việc bếp. Kiểm soát replay không tự in và hiển thị đúng kết quả lịch sử vẫn thuộc UX chống trùng.

Chưa chạy các ca D10-Txx: giao thức/giữ giá/lịch sử mới chưa được triển khai. Ca giá cần thêm kiểm thử không gửi lại cả đơn theo giá menu hiện hành; test idempotency riêng không chứng minh được bất biến giá này.

## Phụ lục — trích nguyên văn mã mới được đối chiếu

### Draft làm mất tham chiếu giá snapshot

[src/features/pos/orderFlow.ts:66–79](D:/Workspace/pos-cafe/src/features/pos/orderFlow.ts:66)

```ts
export const snapshotToDraft = (item: OrderItemSnapshot): SubmitOrderDraftItem => ({
  id: createClientId(),
  menuItemId: item.menuItemId,
  quantity: item.quantity,
  note: item.note ?? null,
  options: item.options.map((option) => ({
    id: createClientId(),
    optionValueId: option.optionValueId,
    quantity: option.quantity,
  })),
});

export const orderDetailToDraft = (order: OrderDetail): SubmitOrderDraftItem[] =>
  order.items.map(snapshotToDraft);
```

### Replace-submit yêu cầu ID mới và loại các dòng cũ

[supabase/migrations/012_action_permission_guardrails.sql:655–679](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:655)

```sql
    if exists (
      select 1
      from jsonb_to_recordset(p_items) as item(
        id uuid,
        "menuItemId" uuid,
        quantity integer,
        note text,
        options jsonb
      )
      join public.order_items oi
        on oi.store_id = v_store_id
       and oi.order_id = p_order_id
       and oi.id = item.id
      where coalesce(item.quantity, 0) > 0
    ) then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Replace-submit must use fresh client UUIDs for active order_items.';
    end if;

    update public.order_items oi
    set status = 'removed'::public.order_item_status
    where oi.store_id = v_store_id
      and oi.order_id = p_order_id
      and oi.status <> 'removed'::public.order_item_status;
```

### Mọi dòng gửi lên được lấy lại giá menu

[supabase/migrations/012_action_permission_guardrails.sql:798–854](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:798)

```sql
  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(
      id uuid,
      "menuItemId" uuid,
      quantity integer,
      note text,
      options jsonb
    )
    where coalesce(item.quantity, 0) > 0
  loop
    if v_item.id is null or v_item."menuItemId" is null then
      raise exception 'INVALID_ORDER_ITEMS'
        using errcode = 'P0001',
              hint = 'Active items must include id and menuItemId.';
    end if;

    select *
    into v_menu_item
    from public.menu_items mi
    where mi.store_id = v_store_id
      and mi.id = v_item."menuItemId"
      and mi.deleted_at is null
      and mi.is_available = true;

    if not found then
      raise exception 'MENU_ITEM_UNAVAILABLE'
        using errcode = 'P0001',
              hint = 'Menu item is missing, deleted, unavailable, or outside the current store.';
    end if;

    v_sort_order := v_sort_order + 1;
    v_option_total := 0;

    insert into public.order_items (
      id,
      store_id,
      order_id,
      menu_item_id,
      item_name,
      quantity,
      unit_price,
      note,
      status,
      sort_order
    ) values (
      v_item.id,
      v_store_id,
      p_order_id,
      v_menu_item.id,
      v_menu_item.name,
      v_item.quantity,
      v_menu_item.price,
      nullif(v_item.note, ''),
      'waiting'::public.order_item_status,
      v_sort_order
    );
```

### Người trên order bị ghi đè khi submit

[supabase/migrations/012_action_permission_guardrails.sql:926–934](D:/Workspace/pos-cafe/supabase/migrations/012_action_permission_guardrails.sql:926)

```sql
  update public.orders o
  set subtotal = v_subtotal,
      discount_type = 'none'::public.discount_type,
      discount_value = 0,
      total = v_total,
      employee_id = p_employee_id,
      lock_version = case when v_has_existing_order then o.lock_version + 1 else o.lock_version end
  where o.store_id = v_store_id
    and o.id = p_order_id
```

### Mock cũng dựng lại giá từ menu

[src/adapters/mock/orderRepo.ts:66–68](D:/Workspace/pos-cafe/src/adapters/mock/orderRepo.ts:66)

```ts
      existingOrder.items = snapshotDraftItems(this.state.menu, activeItems);
      existingOrder.total = calculateSnapshotTotal(existingOrder.items);
      existingOrder.lockVersion += 1;
```
