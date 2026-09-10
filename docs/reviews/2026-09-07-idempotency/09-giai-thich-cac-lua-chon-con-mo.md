# 09 — Giải thích các lựa chọn còn mở sau review 07

> **Cập nhật 08/09/2026:** chủ dự án đã trả lời tại [10 — Quyết định sau review](10-quyet-dinh-sau-review-va-chinh-sach-gia.md). Không áp dụng đề xuất bắt đối chiếu tiền mặt hoặc chỉ quản lý được tiếp quản ở bản dưới. Giá theo từng lần gọi đã được chọn; phần hủy/thời hạn do analyst quyết định theo ủy quyền. Giữ nguyên nội dung so sánh dưới đây làm lịch sử lập luận.

Ngày: **08/09/2026**. Đây là tài liệu hỗ trợ chủ dự án quyết định, **không ghi nhận các khuyến nghị dưới đây là đã được chấp thuận**. Không thay thế bộ bảy artifact của OpenSpec.

Đọc bằng chứng mã và giới hạn kiểm chứng tại [08 — Review độc lập](08-review-doc-lap-plan-07.md). Bản [07](07-uu-tien-online-va-khoi-phuc-tren-server.md) được giữ nguyên làm mốc review.

## Điều đã rõ và điều vẫn cần chọn

Chủ dự án đã chọn ưu tiên online, hoãn bán hàng offline. Hướng đang thảo luận là đăng ký lệnh trên server trước khi thực hiện, để máy khác tìm lại được lệnh đã đăng ký. Cách lưu và khôi phục này không tự trả lời các quy tắc vận hành dưới đây.

Phân biệt ba câu nói rất dễ lẫn:

| Câu nói | Thực sự biết được điều gì? |
| --- | --- |
| “Máy tôi chưa thấy kết quả” | Chỉ biết trạng thái phía máy đó; server có thể đã ghi thanh toán |
| “Server đã ghi thanh toán” | Biết thay đổi dữ liệu đã commit; chưa chứng minh nhân viên đã xem, đã nhận tiền mặt hay bếp đã nhận phiếu |
| “Tôi đã đối chiếu thao tác này” | Một người xác nhận đã kiểm tra kết quả; đây là dữ liệu về quy trình, không phải một lần ghi tiền nữa |

“Cùng một thao tác” trong giao thức được nhận diện bằng **một mã lệnh và nội dung đã xác nhận gắn với mã đó**. Đổi máy để tiếp tục phải chọn lại lệnh cũ. Hai máy tự tạo hai mã khác nhau cho hai đơn giống nhau vẫn là hai lệnh. Hệ thống không đọc được ý định của hai người từ món và tổng tiền.

Hai bước server không nhất thiết tạo thành hai lần bấm. **Đề xuất UX ban đầu:** thu ngân xác nhận một lần; khi vẫn online và đăng ký trả thành công, ứng dụng nối tiếp execute trong chính lần xác nhận đó. Nếu luồng bị gián đoạn thì hiện trạng thái để tra cứu/tiếp tục thủ công. Không tự execute một bản đăng ký bỏ lại chỉ vì thiết bị vừa reconnect. Đây là đề xuất cần đưa vào luồng để duyệt, không coi là quyết định đã chốt.

## 1. Có bắt đối chiếu lần thanh toán trước rồi mới cho thu tiếp?

**Ví dụ:** bàn có năm ly. A đã thu một ly, server ghi xong nhưng A không nhận được phản hồi. B thấy bàn còn bốn ly. B có thể đang phục vụ một khách khác thật, hoặc đang định làm lại việc của A vì tưởng lần trước chưa thành công.

Khóa chống trùng chặn B thực hiện lại **mã lệnh của A**. Nếu B tạo mã mới dựa trên version mới, đây lại là một lệnh hợp lệ về mặt dữ liệu. Vì thế vấn đề còn lại là quy trình nhận diện lần thu tiền, không thể chỉ thêm một UUID là hết.

| Lựa chọn | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Hiển thị kết quả trước đó nhưng vẫn cho thu tiếp | Ít cản trở lúc đông khách; máy A mất không làm đơn bị mắc kẹt | Nhân viên có thể bỏ qua cảnh báo và thu thêm do hiểu nhầm |
| Bắt xem và xác nhận kết quả chưa đối chiếu trước khi tạo **lệnh thanh toán mới trên cùng đơn nguồn** | Giảm khả năng bấm lại thành một lần thu tiền khác; phạm vi ảnh hưởng hẹp | Thêm bước xác nhận; cần quy tắc ai được xác nhận thay và xử lý hai máy cùng thao tác |
| Khóa mọi chỉnh sửa trên đơn, hoặc khóa cả bàn/cửa hàng | Trình tự rất chặt | Một xác nhận bị bỏ quên có thể cản việc thêm món hoặc phục vụ khách mới; phạm vi lớn hơn vấn đề cần giải quyết |

**Khuyến nghị tổng hợp:** không khóa toàn đơn/bàn/cửa hàng chỉ vì kết quả chưa được xem. Với ưu tiên tránh thu thêm do hiểu nhầm, tôi nghiêng về **bước xác nhận hẹp trước lần thu tiếp trên cùng đơn nguồn**. Hai reviewer A/B ưu tiên phương án nhẹ hơn: cảnh báo, cho tiếp tục với version hiện hành; họ chỉ thêm bước bắt buộc nếu chủ dự án coi đối chiếu tiền mặt là yêu cầu. Reviewer C nghiêng về chặn/buộc đối chiếu hẹp ở đơn chịu ảnh hưởng. Đây là đánh đổi vận hành, không có kết quả kiểm thử nào quyết định thay chủ dự án.

Nếu chọn bước xác nhận hẹp, đó phải là quy tắc dùng chung trên server cho việc thu tiếp, không chỉ một popup trên máy A. Việc đánh dấu “đã đối chiếu” không được tự xảy ra vì polling đã tải dữ liệu. Thao tác còn chưa rõ kết quả phải được tra cứu/xử lý trước; không được dùng nút xác nhận để biến “chưa biết” thành “đã thất bại”. Những đơn khác vẫn tiếp tục được phục vụ.

Ngay cả cách chặt hơn cũng không chứng minh tiền mặt đã thật sự được trao. Nó giảm nhầm lẫn bằng một bước kiểm tra có người chịu trách nhiệm.

## 2. Ai được tiếp tục hoặc hủy lệnh do người khác tạo?

**Ví dụ:** A đăng ký thanh toán nhưng máy hỏng, sau đó A hết ca. Lệnh nằm trên server. B đang đứng quầy có được tiếp tục hay phải gọi quản lý?

| Lựa chọn | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Chỉ người tạo | Dễ quy trách nhiệm; ít quy tắc xử lý chéo | A vắng mặt thì việc bị treo dù máy B vẫn dùng được |
| Người tạo xử lý việc của mình; quản lý xử lý chéo | Có đường giải quyết khi A vắng; trách nhiệm rõ; phạm vi quyền mới nhỏ | Cần quản lý có mặt hoặc đăng nhập được khi phát sinh |
| Mọi nhân viên có quyền nghiệp vụ tương ứng | Quầy hoạt động linh hoạt nhất | Dễ xử lý nhầm việc của đồng nghiệp; cần thông tin nhận diện và nhật ký rõ hơn |

**Khuyến nghị:** người tạo xử lý việc của mình, quản lý xử lý chéo; vẫn phải có quyền nghiệp vụ hiện hành. Nếu quán thường chỉ có một thu ngân và quản lý không sẵn sàng hỗ trợ, phương án cho nhân viên cùng quyền xử lý chéo thực tế hơn.

Tách quyền **xem kết quả đã có**, **thực hiện lệnh chưa chạy**, **hủy lệnh chưa chạy** và **đánh dấu đã đối chiếu**. Đổi người xử lý không được viết lại người khởi tạo bên trong lệnh bất biến. Nhật ký lưu riêng người khởi tạo và người thực hiện/đối chiếu thực tế theo hợp đồng đã chọn.

Còn một ý nghĩa cần chốt trong nhóm này: **payment được ghi nhận cho người nào khi tiếp quản?** Hiện SQL điền `payments.employee_id` từ `p_employee_id` (`012_action_permission_guardrails.sql:359–379,1094–1114`; trích tại E5 của tài liệu 08). Giữ người tạo A giúp giữ nguồn gốc nhưng có thể sai nếu B mới là người nhận tiền; luôn đổi thành B cũng có thể sai nếu A đã nhận tiền mặt rồi B chỉ ghi tiếp vào hệ thống. Đề xuất lưu riêng người tạo/người thực hiện và yêu cầu đối chiếu ai đã nhận tiền khi tiếp quản; không suy việc cầm tiền từ người bấm execute. Payment đã commit không bị sửa người ghi nhận chỉ vì người khác xem lại.

**Giới hạn hiện tại cần chấp nhận hoặc mở change riêng:** phiên Supabase xác thực cửa hàng; `employeeId` vẫn do client gửi. Đọc mã ở [08, E5](08-review-doc-lap-plan-07.md#e5--danh-tinh-nhan-vien-va-duong-ghi) cho thấy quy tắc “chỉ quản lý” hiện có thể là rào kiểm tra của ứng dụng, chưa chống được nhân viên có phiên cửa hàng chủ động giả mạo ID khi gọi API. Thêm cột “người tiếp tục” không giải quyết được việc xác thực đó.

Với đồ án này, có thể công bố đúng giới hạn hiện có và kiểm thử đúng phạm vi. Nếu yêu cầu là DB phải chống giả mạo nhân viên, cần bổ sung cơ chế xác thực nhân viên từ server; không nên âm thầm gộp toàn bộ việc đó vào change chống trùng.

## 3. Giá đổi hoặc sang ngày mới trước lần thực hiện đầu tiên thì sao?

Đây là **điểm mới cần bổ sung sau review**, không chỉ là đổi cách trình bày câu hỏi cũ.

**Ví dụ:** 10:00 A đăng ký một cà phê giá hiển thị 30.000đ nhưng chưa thực hiện. 10:15 quản lý đổi giá thành 35.000đ. 10:30 B tìm lại lệnh. Payload vẫn là cùng mã món và số lượng, nhưng SQL hiện lấy giá tại lúc chạy. Đơn mới cũng được xác định ngày kinh doanh lúc chạy. Bằng chứng ở [08, E2](08-review-doc-lap-plan-07.md#e2--gia-va-ngay-kinh-doanh-duoc-doc-luc-execute).

| Lựa chọn | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Dùng giá lúc thực hiện | Gần hành vi SQL hiện tại nhất; ít dữ liệu phải lưu thêm | Có thể khác số tiền người dùng đã thấy khi đăng ký; cần hiển thị và xác nhận lại |
| Giữ giá do server chốt lúc đăng ký | Giữ đúng báo giá đó khi đổi máy; dễ giải thích với người dùng | Cần lưu báo giá và sửa cách thực hiện; phải quyết định có tiếp tục bán món đã ngừng bán hay không |
| Giá/điều kiện bán thay đổi thì từ chối lệnh cũ, cho xem lại để xác nhận lệnh mới | Không âm thầm đổi tiền; không phải giữ giá hoặc giữ hàng lâu | Thêm kiểm tra và thao tác xác nhận lại; lệnh cũ phải được kết thúc an toàn trước khi thay thế |

**Khuyến nghị:** phương án thứ ba. Đăng ký chỉ giữ nội dung định làm, không giữ giá, bàn hay món cho người đó. Trước lần execute đầu tiên, server kiểm tra các điều kiện đã xác nhận; có thay đổi ảnh hưởng việc bán thì cho xem lại. Bước xác nhận phải bám vào giá được server kiểm chứng; chỉ so `order.lockVersion` không phát hiện được menu đổi giá.

Điểm này áp dụng đặc biệt cho gửi đơn. Thanh toán đang dựa vào snapshot của đơn, nên không cần xây cơ chế giữ tiền thẻ hay một hệ thống báo giá mới cho mọi RPC.

**Ngày kinh doanh là lựa chọn riêng:** cho tiếp tục lệnh chưa chạy qua ngày thì thuận tiện, nhưng có thể ghi một đơn hôm qua vào hôm nay. Đề xuất cho đợt đồ án là lệnh chưa thực hiện thuộc ngày cũ phải xem lại và xác nhận lệnh mới. Kết quả **đã thực hiện** hôm qua vẫn được xem lại nguyên trạng; không hết hiệu lực chỉ vì qua ngày.

## 4. Hủy, hết hiệu lực và xóa lịch sử là ba việc khác nhau

**Ví dụ:** A bấm thực hiện rồi mất phản hồi. B bấm hủy. Request của A có thể đang đến server muộn hoặc đang chạy.

Phần kỹ thuật bắt buộc của một nút hủy an toàn: server phân xử hủy và thực hiện trên cùng lệnh. Nếu hủy thắng, lần thực hiện đến sau không chạy. Nếu thực hiện đã thắng, trả kết quả đã áp dụng; không thông báo hủy thành công. Bấm hủy phía trình duyệt chưa phải bằng chứng server đã hủy.

`void_order` hiện ghi trạng thái và dấu vết hủy đơn đã trả, giữ lại payment; nó không phải thao tác xóa lệnh chưa chạy hoặc tự trả lại tiền mặt. Bằng chứng ở [08, E7](08-review-doc-lap-plan-07.md#e7--void-va-phieu-in-khong-chung-minh-tien-mat-da-duoc-hoan).

| Việc cần chọn | Phương án và ưu điểm | Nhược điểm |
| --- | --- | --- |
| Có cho hủy lệnh chưa thực hiện? | Cho hủy qua server: nhân viên kết thúc được việc bỏ dở | Cần quyền, lý do/thông tin kiểm toán và xử lý request đến muộn |
| Lệnh chưa chạy còn hiệu lực bao lâu? | Giới hạn ngắn giảm việc tiếp tục một ý định đã cũ; giới hạn dài dễ khôi phục hơn | Ngắn gây nhiều xác nhận lại; dài dễ giữ lệnh lỗi thời |
| Giữ kết quả/mã đã dùng bao lâu? | Giữ qua giai đoạn đồ án giúp tra cứu và chặn mã cũ, chưa cần job dọn | Dung lượng tăng; sau đó vẫn phải có chính sách bảo trì |

**Khuyến nghị:** cho hủy lệnh chưa thực hiện theo quyền ở mục 2; giữ bản ghi đã hủy/hết hiệu lực để nhận diện request cũ. Tách **thời hạn được thực hiện lần đầu** khỏi **thời hạn lưu kết quả và mã đã dùng**.

Đề xuất nhẹ về vận hành là chưa làm job xóa tự động trong giai đoạn đến 21/12/2026. Đây là đề xuất chưa được chốt, không phải lịch hẹn tự xóa vào ngày 21/12. Mốc 24 giờ trước đây cũng chưa được chấp thuận. Không cần `pg_cron` chỉ để kiểm tra hết hiệu lực khi người dùng yêu cầu thực hiện.

Các mốc thời gian cuối cùng phải được ghi thành số và kiểm thử tại biên khi viết spec. Không nên chọn một TTL theo hệ thống thanh toán thẻ rồi coi đó là nhu cầu của quán này.

## 5. Đổi máy hoặc mất toàn bộ dữ liệu local: tìm lại đến mức nào?

**Ví dụ 1:** đăng ký đã vào server nhưng phản hồi bị mất. Máy A còn mã lệnh: tra hoặc đăng ký lại đúng mã và nội dung. Đăng ký lại không tự thực hiện nghiệp vụ.

**Ví dụ 2:** A mất cả mã lệnh. B cần danh sách trên server để tìm theo người tạo, thời gian, bàn/đơn và nội dung. Đơn tách cần liên kết cả đơn nguồn lẫn bill đã trả; số đơn hiển thị không đủ làm định danh. Bằng chứng ở [08, E6](08-review-doc-lap-plan-07.md#e6--tim-lai-don-tach-can-ca-hai-uuid).

**Ví dụ 3:** hai khách mang đi đều mua một cà phê 30.000đ; hai lệnh giống nhau nằm trong danh sách. Không đủ dữ liệu để máy tự chọn một lệnh là việc của A.

| Lựa chọn | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Chỉ khôi phục khi còn mã local | Phạm vi nhỏ nhất | Không đáp ứng nhu cầu đổi máy/mất dữ liệu mà chủ dự án đã nêu |
| Danh sách thao tác trên server, người dùng chọn và đối chiếu | Dùng được sau mất local; không cần tự suy ý định | Cần màn hình nhỏ và thông tin nhận diện; vẫn có ca con người không phân biệt được |
| Bắt buộc tạo hồ sơ bán hàng dùng chung trước, mọi máy chọn cùng hồ sơ | Có định danh nghiệp vụ sớm hơn để phối hợp | Thay quy trình bắt đầu bán hàng; thêm quản lý bản nháp và bỏ dở |

**Khuyến nghị:** danh sách thao tác trên server, lọc và chọn thủ công; chưa xây hệ thống bản nháp bán hàng dùng chung trong change này. Khi thiếu thông tin để phân biệt, yêu cầu đối chiếu thực tế, không tự ghép theo món hoặc chọn bản gần nhất.

Giới hạn phải nói rõ: nếu nội dung chưa từng tới server và máy cũ cũng mất nội dung, không thể phục hồi nội dung đó. Ngoài ra, một lần tìm chưa thấy không chứng minh request cũ sẽ không đến muộn. Không cho thông báo “không có dữ liệu” tự trở thành lý do tạo mã mới an toàn.

Local vẫn có ích làm bộ nhớ phụ trước/khi đăng ký. Mục tiêu là sau khi server nhận, việc khôi phục không phụ thuộc duy nhất vào local; không phải cấm mọi dữ liệu trong trình duyệt.

## 6. Khôi phục dữ liệu có bao gồm phiếu bếp của đúng lần gửi?

**Ví dụ:** đơn đã có hai cà phê. A thêm một bánh, server ghi xong, A mất kết nối trước khi mở phiếu bếp. Máy B tìm lại lệnh. Phiếu bếp cần chỉ có **một bánh**; toàn bộ đơn lại có hai cà phê và một bánh.

UI hiện tính phần tăng thêm ở client; kết quả RPC submit chứa toàn bộ món còn hiệu lực. Vì vậy “lưu nguyên kết quả RPC” chưa đủ khôi phục đúng phiếu bếp. Bằng chứng ở [08, E4](08-review-doc-lap-plan-07.md#e4--phieu-bep-la-phan-tang-them-ket-qua-rpc-la-toan-don).

| Lựa chọn | Ưu điểm | Nhược điểm |
| --- | --- | --- |
| Khôi phục kết quả nghiệp vụ và hóa đơn thanh toán; chưa phục hồi phiếu bếp của lần sửa | Ít thay đổi hơn, hoàn thành luồng tiền trước | Khi mất local, có thể phải báo bếp/đối chiếu món bằng tay; phải công bố giới hạn |
| Lưu bền phần món gửi bếp của từng thao tác | Máy khác mở lại được đúng phiếu; phù hợp luồng bán hàng có bếp | Cần thêm dữ liệu kết quả và kiểm thử tăng/giảm/đổi option; không chỉ là thêm một nút in |

**Khuyến nghị:** nếu phiếu bếp là kênh giao việc chính của bản demo, chọn lưu phần tăng thêm ngay trong transaction của thao tác. Nếu ưu tiên hoàn thành chống thu trùng trước, có thể hoãn phục hồi phiếu bếp với giới hạn được ghi rõ. Không dùng phiếu toàn đơn để giả làm phiếu của lần gửi.

Khi phục hồi, dùng nút **“Xem kết quả”** và **“In lại”** rõ ràng, không tự in do reconnect/replay. Hiển thị đó là kết quả tại thời điểm cũ; tải trạng thái đơn hiện tại riêng. Không tái sử dụng thông báo “Bàn đã trống” của kết quả cũ làm thông báo về trạng thái bàn bây giờ.

Không cam kết giấy chỉ in đúng một lần: dữ liệu server không chứng minh giấy đã ra hoặc bếp đã nhận. Yêu cầu có thể kiểm chứng là replay không tự phát sinh lệnh in và người dùng thấy rõ bản in lại.

## Phần analyst có thể xử lý, không đẩy thành câu hỏi nghiệp vụ

- Chống trùng cả đăng ký lẫn execute; cùng mã khác nội dung bị từ chối.
- Nội dung retry không đổi theo polling, không sinh lại UUID hay chuyển từ split sang full.
- Không để mutation tạm dừng offline rồi tự thực hiện khi reconnect.
- Kết quả và hiệu ứng nghiệp vụ trong cùng transaction; không giữ transaction chờ người dùng đối chiếu.
- Hủy/request muộn phải được server phân xử; không xóa mã để “hủy”.
- Lỗi mạng chưa rõ kết quả khác từ chối nghiệp vụ cuối cùng. Không lưu từ chối rồi ném lỗi làm chính bản ghi đó rollback.
- Sửa kiểm tra version `NULL` cho đơn có sẵn, xử lý chữ ký RPC cũ và kiểm tra đúng phạm vi quyền đã công bố.
- Test tích hợp Postgres cho transaction, tranh chấp, quyền và `NULL`; test mock không thay được phần này.

Các ràng buộc này giúp hiện thực phạm vi online một cách nhất quán. Tên bảng, tên mã lỗi, cách khóa row và vị trí cấu hình thư viện thuộc phần thiết kế kỹ thuật, không cần chủ dự án tự chọn.

## Thứ tự quyết định để không phải trả lời tất cả cùng lúc

Ba lựa chọn ảnh hưởng quy trình nhất là **đối chiếu trước khi thu tiếp**, **quyền xử lý chéo**, và **giá/điều kiện bán thay đổi trước lần execute đầu**. Sau đó chốt thời hạn, mức phục hồi khi mất mã và phạm vi phiếu bếp.

Gói đề xuất của người tổng hợp để cân nhắc: xác nhận hẹp trước lần thu tiếp; quản lý xử lý chéo; điều kiện bán đổi thì xem lại; hủy lệnh chưa chạy bằng trạng thái bền vững; danh sách phục hồi thủ công; chưa làm worker, hàng đợi offline, job dọn hoặc hệ thống bản nháp chung. Phạm vi phục hồi phiếu bếp phụ thuộc nó có phải kênh giao việc chính của bản demo hay không.

Chưa có lựa chọn nào trong gói đề xuất này được ghi thành quyết định của chủ dự án. Danh sách testcase ứng viên nằm trong tài liệu 08; kết quả mong đợi phụ thuộc lựa chọn vẫn được đánh dấu còn mở.
