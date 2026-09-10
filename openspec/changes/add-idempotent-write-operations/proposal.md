# Bảo đảm không sinh trùng cho các lời gọi ghi

> **Duyệt triển khai 2026-09-10:** chủ dự án xác nhận không còn vấn đề, cho phép push docs trước rồi triển khai code. Code chỉ được push sau khi các kiểm tra bắt buộc đạt. Giữ phạm vi hiện tại; quỹ giờ chưa cố định, lịch ở dưới tiếp tục là kịch bản dự báo và được cập nhật theo tiến độ thực tế, không chặn bắt đầu code. Các đoạn về chờ duyệt bên dưới giữ bối cảnh phân tích trước mốc này.

Ngày lập bộ spec 2026-09-09; cập nhật phân tích lịch 2026-09-10. **Đã duyệt và triển khai; đã nghiệm thu code, chưa deploy môi trường thật.** Kết quả/SHA hiện hành ở [phase 27](../../../docs/implementation-log/phase-27-idempotent-write-operations.md). Mốc code: main@7183b31. [Proposal trước bộ spec](../../../docs/reviews/2026-09-07-idempotency/evidence/2026-09-09-proposal-truoc-bo-spec.md) được giữ nguyên, gồm 32 mã PRE-IDEM và lịch sử sửa quyết định.

<a id="thuat-ngu"></a>
## Thuật ngữ

| Ký hiệu/thuật ngữ | Định nghĩa trong bộ tài liệu |
| --- | --- |
| K | Khóa chống trùng của một thao tác đã xác nhận, tức operationId kiểu UUID, trong phạm vi một cửa hàng. K gắn với payload bất biến đã đăng ký trên server; không phải mã đơn, bàn hay nhân viên. |
| K1, K2, Knew | Các K khác nhau trong ví dụ: thao tác riêng, không phải các lần thử lại cùng K. |
| Payload | Nội dung xác nhận theo WritePayloadV1 tại design, mục 3. Thử lại phải dùng nguyên nội dung đã đăng ký, kể cả version, loại thao tác, ID và số lượng. |
| R1 | BusinessResult bất biến được server lưu khi K chuyển sang applied lần đầu. R1 có thể khác trạng thái đơn hiện tại và không gồm metadata replayCount. Lệnh rejected giữ lỗi đã quyết định, không có R1 thành công. |
| G | Bộ tiêu chí kiểm chứng chung tại testplan, mục A3: dữ liệu DB trước/sau, tiền, số lượng, quan hệ, actor, tiến triển khi tranh chấp và số request UI. Đây là ký hiệu tài liệu, không phải trường API. |
| F0–F7 | Mã các bộ dữ liệu thử cố định (fixture) tại testplan, mục A5. F0 là cửa hàng S1 chưa có đơn/thanh toán, cùng nhân viên, bàn và catalog mẫu. |
| Oracle / SUT | Oracle là kết quả hoặc tiêu chí mong đợi để đối chiếu kết quả chạy test; phải độc lập với helper của hệ thống đang được kiểm thử (SUT). |
| OCC | Kiểm soát cạnh tranh lạc quan bằng version: từ chối thao tác dựa trên phiên bản đơn đã cũ. OCC và K giải quyết hai vấn đề khác nhau. |
| pending / applied / rejected / cancelled / expired | Đã đăng ký, chưa quyết định cuối / đã áp dụng / nghiệp vụ bị từ chối / đã hủy trước áp dụng / hết hạn bắt đầu áp dụng. Bốn trạng thái cuối là terminal, không mở lại. |
| TTL | Thời hạn của lệnh pending: 24 giờ từ lần đăng ký đầu. Đây không phải thời hạn tồn tại của đơn. |
| IDEM / UC-IDEM / TC-IDEM / PRE-IDEM | Mã requirement / use case / testcase / câu hỏi kiểm tra trước triển khai ở proposal cũ. |
| k trong ví dụ tiền | Nghìn đồng Việt Nam: 30 k = 30.000 VND. Payload và DB dùng số tiền nguyên theo VND. |

Chi tiết hợp đồng nằm trong [design](design.md); định danh và số liệu fixture nằm trong [testplan](testplan.md).

## Why

Khi request đã commit nhưng client mất phản hồi, polling có thể thay version và lựa chọn. Thử lại từ UI hiện tại có thể thành giao dịch mới: tách thêm món hoặc chuyển lựa chọn rỗng sang thanh toán toàn bộ phần còn lại. Khóa lạc quan không xác định được đây là lần gửi lại của cùng một xác nhận.

Draft và submit hiện dựng lại giá từ catalog, trong khi chủ dự án chọn giữ giá từng phần đã ghi. Bằng chứng code tại [design, mục 1](design.md), đoạn nguyên văn trong [review 12](../../../docs/reviews/2026-09-07-idempotency/12-chuan-bi-ra-cuoi-truoc-code.md). Không tuyên bố đã xảy ra sự cố thật; theo chủ dự án, hệ chưa vận hành thật.

## What Changes

- Thêm register, execute, get, list và cancel. K gắn payload bất biến cùng kết quả trên server, tìm lại được từ máy khác.
- Server xác minh phiên nhân viên và quyền, bảo vệ nguồn quyền/PIN, thu hồi RPC cũ và đường DML vượt giao thức.
- Giữ ID và snapshot phần cũ; phần mới, kể cả phần thêm bằng dấu cộng, nhận giá mới đã xác nhận. Không sửa modifier trên phần cũ.
- Pending có 24 giờ để bắt đầu thực hiện; đơn không hết hạn. Bản đồ án không tự xóa K, payload hoặc kết quả.
- Ghi người tạo đơn, người khởi tạo/thực hiện/hủy lệnh và người thanh toán. Hóa đơn tính đúng số lượng option; phục hồi không tự in.
- Thiết kế 33 requirement, 12 use case, 93 testcase gốc và các biến thể về quyền, tranh chấp, lỗi và thời gian. Mỗi ca có kết quả mong đợi và cách quan sát. Test đã hiện thực; kết quả chỉ được công nhận khi đủ gate cùng fingerprint tại phase 27.

## Capabilities

### New Capabilities

- write-idempotency: giao thức ghi, phục hồi, tính nguyên tử, thời hạn/hủy lệnh, quyền, giá nguồn và nghiệm thu.

### Modified Capabilities

- employee-session: phiên server, giữ quy trình Store Key/PIN.
- access-control: quyền hiện hành cho giao thức ghi, bảo vệ nguồn quyền; ghi rõ giới hạn SELECT.
- order-management: phần giữ lại/phần mới, xác nhận giá, định danh nguồn, phát hiện draft thay đổi và OCC.
- payment: thanh toán toàn bộ/tách phần một lần, đóng băng lựa chọn, liên kết kiểm toán hai đơn.
- order-void: chặn version NULL, giữ tiền, lịch sử, bàn và kết quả gửi lại.
- receipt-printing: schema thống nhất, số lượng option, in lại theo trạng thái hiện tại.

## Impact

FR-03/04/07/09/11/12/13/14/15; NFR-01/02/03/05/07. Ảnh hưởng domain/ports, mock/Supabase adapters, draft/payment/recovery, SQL/RLS, phần admin/bootstrap tối thiểu, hóa đơn và tests. Mã ứng dụng ở worktree main; tài liệu ở worktree docs. Chưa cập nhật baseline specs thành đã triển khai.

Baseline payment quy định: “Hai đơn sau khi tách MUST độc lập với nhau, chỉ cùng nhãn bàn.” Delta cho phép liên kết kiểm toán bất biến nguồn → đơn con → thanh toán → K, vẫn giữ trạng thái độc lập và không hủy dây chuyền. Access-control nâng các đường ghi từ kiểm tra employeeId do client gửi sang xác minh phiên server; chưa thay toàn bộ mô hình tài khoản/chủ quán.

## Câu hỏi phải chốt trước khi làm

Các câu hỏi nghiệp vụ ban đầu đã có câu trả lời. Dưới đây giữ lại nguyên văn bảy câu hỏi của proposal trước bộ spec, cùng câu trả lời hiện hành và mã quyết định. Ngày, nguồn quyết định nằm ở [bảng D01–D12](#quyet-dinh); lịch sử trước đính chính vẫn được giữ ở evidence.

1. ~~Khóa chống trùng sinh ở tầng nào? Sinh ở tầng nghiệp vụ khi người dùng xác nhận là đúng nhất về mặt ngữ nghĩa, nhưng phải bảo đảm nó sống sót qua việc thành phần giao diện bị dựng lại.~~ **Đã chốt:** tầng điều phối nghiệp vụ sinh K tại xác nhận; server lưu payload để phục hồi độc lập với UI và local. Xem D01, D02, D06.
2. ~~Khi gặp khóa đã áp dụng, máy chủ trả về nguyên văn kết quả lần đầu, hay chỉ báo đã áp dụng và để client tự tải lại? Trả nguyên văn thì client không phải xử lý thêm nhánh nào, nhưng phải lưu kết quả.~~ **Đã chốt:** trả R1 bất biến; tải và hiển thị trạng thái đơn hiện tại riêng. Xem D02.
3. ~~Giữ khóa đã áp dụng bao lâu? Đủ dài để phủ mọi lần thử lại hợp lý, đủ ngắn để bảng không phình. Nếu sau này làm ngoại tuyến thì thời hạn này phải dài hơn thời gian một thiết bị có thể ngoại tuyến.~~ **Đã chốt:** pending có hạn 24 giờ; bản đồ án không tự xóa K/payload/result ở trạng thái cuối. Ngoại tuyến đã hoãn. Xem D01, D07, D08.
4. ~~Áp cho những lời gọi nào? Tối thiểu là ba lời gọi đụng tiền là gửi đơn, thanh toán và hủy đơn. Có mở rộng sang các thao tác quản trị không?~~ **Đã chốt:** bốn RPC nghiệp vụ, gồm cả pay_order_items; không mở giao thức chống trùng cho mọi thao tác quản trị. Phần phiên/quyền/admin tối thiểu là điều kiện bảo vệ giao thức. Xem D09.
5. ~~Đã từng phát sinh bản ghi trùng trên dữ liệu thật chưa? Cần một truy vấn kiểm tra trước khi làm, vì kết quả đổi mức ưu tiên của change này.~~ **Đã rõ giới hạn bằng chứng:** chưa có sự cố thật được xác nhận; theo chủ dự án, hệ chưa vận hành thật. Rủi ro suy ra từ mã cần được kiểm bằng testcase đã thiết kế. Preflight migration vẫn kiểm dữ liệu trước thay đổi. Xem D10.
6. ~~Sau khi có bảo đảm này, có bật tự động thử lại cho các lời gọi ghi không, hay vẫn để người dùng chủ động bấm lại?~~ **Đã chốt:** người dùng chủ động tra cứu và thử lại cùng K; reconnect/focus chỉ đọc. Xem D01, D02.
7. ~~Lần gửi lặp có ghi vào nhật ký không? Ghi thì phát hiện được vấn đề mạng, nhưng thêm ghi cho một việc vốn không có tác dụng gì.~~ **Đã chốt:** replayCount nằm ngoài R1; không tạo event nghiệp vụ cho từng retry. Chỉ execute hợp lệ vào trạng thái cuối đã có mới tăng bộ đếm. Xem D12.

32 mã PRE-IDEM là checklist phân tích bổ sung, khác với bảy câu hỏi trên. Bản nguyên văn và lịch sử câu trả lời nằm ở [proposal trước bộ spec](../../../docs/reviews/2026-09-07-idempotency/evidence/2026-09-09-proposal-truoc-bo-spec.md); requirement, use case và testcase hiện hành được nối bằng [traceability](traceability.md).

**Còn phải chốt về kế hoạch:** giữ phạm vi hiện tại và dời lịch, hay yêu cầu một bản thu hẹp phạm vi để duyệt lại? Phân tích khối lượng ở mục tiếp theo. Đây là quyết định lịch/phạm vi của chủ dự án, không phải yêu cầu trả lời lại nghiệp vụ.

## Khối lượng và xung đột lịch

[Roadmap](../../../docs/roadmap.md) đặt mục 2 ở tuần 2026-09-04 đến 2026-09-10 và đã ghi “lịch thực hiện cần được rà lại khi chốt spec”. Bộ task hiện tại cho thấy cần kiểm tra quỹ giờ trước khi tiếp tục coi đây là cam kết một tuần.

- Có 43 đầu mục. Tổng cố định của 42 mục ngoài task 40 là **76,5 giờ công**, đã gồm **6 giờ** cho ba reviewer tại task 37–39.
- Task 40 dự trù **2 giờ cho mỗi task sửa lỗi phát sinh**. Với n task sửa lỗi, mô hình ước lượng là **76,5 + 2n giờ**. **78,5 giờ** tương ứng n = 1; không phải tổng có trần và không cộng thêm ba lượt review lần nữa.
- Với 40 giờ tập trung mỗi tuần, phần cố định tương đương khoảng 1,9 tuần; với 20 giờ mỗi tuần là khoảng 3,8 tuần. Chờ DB, công việc khác và sửa lỗi có thể kéo dài lịch. “2–3 tuần” chỉ là một kịch bản, chưa phải cam kết. Reviewer chạy song song có thể giảm thời gian chờ, không tự giảm tổng giờ công.
- Task 09–14 chiếm 12 giờ trong tổng trên, đưa phần phiên/quyền/đóng đường vượt giao thức vào mục 2. Phần siết quyền tầng dữ liệu vốn nằm ở mục 4, tuần 2026-10-02 đến 2026-10-08. Đây là thay đổi phụ thuộc có thật; không có nghĩa toàn bộ enforce-permissions-at-database đã chuyển lên hoặc hoàn thành.

Chưa đổi ngày roadmap và chưa cắt phạm vi. Analyst khuyến nghị giữ các bảo đảm đã chọn, rà lại quỹ giờ và lịch trước triển khai. Nếu cần thu hẹp thì phải nêu rõ bảo đảm và testcase bị ảnh hưởng để chủ dự án duyệt; không bỏ quyền hoặc test DB rồi vẫn nhận đủ bảo đảm.

### Ảnh hưởng dây chuyền tới mục 3–10 — cập nhật 2026-09-10

**Thông tin từ chủ dự án (2026-09-10):** không có quỹ giờ cố định, nhưng làm dự án hằng ngày. Chưa có căn cứ quy đổi thành 20 hoặc 40 giờ/tuần. Hai cột dưới là phân tích kịch bản, chưa phải lịch được duyệt hay thời gian chạy thực tế của agent.

Các giả định được giữ rõ để có thể kiểm lại phép tính:

1. Giả sử bắt đầu mục 2 vào **2026-09-11**, ngày đầu của khối tuần tiếp theo; chưa ghi nhận task triển khai nào hoàn thành trước mốc này. Đây là mốc tính thử, không ấn định ngày bắt đầu thay chủ dự án.
2. Dự trù **n = 1**, tức 78,5 giờ cho mục 2; lấy ceil(78,5 / giờ mỗi tuần) thành số khối tuần, mỗi khối bảy ngày lịch. Cách làm tròn dùng để so với roadmap theo tuần, không dự đoán ngày hoàn thành tới từng ngày.
3. Tạm giữ thời lượng mục 3/4/5/6 là **3/1/3/1 tuần**, tổng tám tuần; mục 9 một tuần và mục 10 hai tuần. Đây là thời lượng lịch cũ, chưa được chứng minh khả thi ở cả hai mức giờ. Chưa tự trừ thời gian mục 4 cho phần quyền đã đưa vào mục 2, vì chưa bóc lại phạm vi còn lại.
4. Mục 7–8 đã hoãn: **2026-11-06 đến 2026-11-26 là ba tuần chưa phân bổ lại**. Mô hình dưới thử dùng khoảng này để hấp thụ dịch chuyển của mục 3–6; việc phân bổ thật vẫn cần chốt. Không dùng bốn ngày **2026-12-18 đến 2026-12-21** đang dành cho đệm và tập demo.
5. Làm tuần tự, không tính công việc song song để rút lịch, không thêm thời gian chờ DB hoặc phát sinh ngoài n = 1. Các yếu tố này phải được cập nhật khi có dữ liệu thực tế.

| Mục | Lịch gốc | Kịch bản 40 giờ/tuần cho mục 2 | Kịch bản 20 giờ/tuần cho mục 2 |
| --- | --- | --- | --- |
| 2 — Chống trùng | 2026-09-04 đến 2026-09-10 | 2026-09-11 đến 2026-09-24 (2 tuần) | 2026-09-11 đến 2026-10-08 (4 tuần) |
| 3 — Mô hình quyền | 2026-09-11 đến 2026-10-01 | 2026-09-25 đến 2026-10-15 | 2026-10-09 đến 2026-10-29 |
| 4 — Quyền tầng dữ liệu | 2026-10-02 đến 2026-10-08 | 2026-10-16 đến 2026-10-22 | 2026-10-30 đến 2026-11-05 |
| 5 — Tài khoản chủ | 2026-10-09 đến 2026-10-29 | 2026-10-23 đến 2026-11-12 | 2026-11-06 đến 2026-11-26 |
| 6 — Vòng đời sở hữu | 2026-10-30 đến 2026-11-05 | 2026-11-13 đến 2026-11-19 | 2026-11-27 đến 2026-12-03 |
| 7–8 — Offline | Đã hoãn, không triển khai trong phạm vi này | Còn 2026-11-20 đến 2026-11-26 chưa cần dùng sau mục 6 | Ba tuần cũ đã bị dịch chuyển mục 3–6 chiếm hết; mục 6 kéo thêm một tuần |
| 9 — Triển khai và đo tải | 2026-11-27 đến 2026-12-03 | Giữ 2026-11-27 đến 2026-12-03 | Sẽ thành 2026-12-04 đến 2026-12-10 nếu không điều chỉnh |
| 10 — Viết báo cáo | 2026-12-04 đến 2026-12-17 | Giữ 2026-12-04 đến 2026-12-17 | Sẽ thành 2026-12-11 đến 2026-12-24 nếu vẫn giữ đủ hai tuần sau mục 9 |

Theo giả định trên, **40 giờ** làm mục 3–6 dịch hai tuần so với lịch gốc, được ba tuần hoãn offline hấp thụ; không cần dùng bốn ngày đệm cuối. **20 giờ** làm mục 3–6 dịch bốn tuần; sau khi dùng ba tuần còn thiếu một tuần trước cửa sổ báo cáo. Nếu tiếp tục tuần tự, báo cáo xong ngày 2026-12-24, muộn ba ngày so với hạn 2026-12-21. Để giữ nguyên cửa sổ báo cáo và đệm, cần thu hồi một tuần trước mục 10. Không diễn đạt thành “ăn hết cửa sổ viết báo cáo”.

Riêng phép tính mục 2, để nằm trong ba tuần còn có thể hấp thụ, ngưỡng là **(76,5 + 2n) / 3 giờ/tuần**: khoảng **26,2 giờ/tuần khi n = 1**, không phải ranh giới cứng 20/40 giờ. Tương đương mục 2 xong chậm nhất **2026-10-01** trong mô hình này để còn tám tuần mục 3–6 và một tuần mục 9 trước báo cáo. Đây là chỉ báo có điều kiện, **không phải ngưỡng bảo đảm toàn dự án**, vì giờ công của mục 3–6/9/10 chưa được ước lượng lại.

**Cách ra quyết định khi quỹ giờ không cố định:** hiện giữ nguyên các bảo đảm để review, chưa chọn cột lịch nào. Analyst đề xuất ghi giờ tập trung thực tế, thời gian chờ và đầu ra đã kiểm chứng trong tuần triển khai đầu, rồi cập nhật dự báo phần còn lại. Nếu dự báo không giữ được hai tuần báo cáo và khoảng đệm, cần đưa ra phương án cho toàn dự án: tăng quỹ giờ nếu khả thi, điều chỉnh cách tổ chức việc hoặc thu hẹp phần được chủ dự án chấp nhận. Chưa đủ dữ liệu để kết luận phải cắt riêng change chống trùng; không bỏ quyền hoặc testcase rồi vẫn nhận đủ bảo đảm. Lịch chính thức chỉ đổi sau khi chủ dự án chọn phương án.

<a id="quyet-dinh"></a>
## Quyết định đã chốt

Các mã D là chỉ mục biên tập cho bản hiện hành, không thay số quyết định lịch sử trong proposal cũ.

| Mã | Ngày | Nguồn | Quyết định |
| --- | --- | --- | --- |
| D01 | 2026-09-08 | Chủ dự án; analyst cụ thể hóa thử lại | Online, server là nguồn tin cậy; không hàng đợi bán offline, không tự thử lại thao tác ghi. |
| D02 | 2026-09-08 đến 2026-09-09 | Analyst cụ thể hóa yêu cầu phục hồi | K sinh khi xác nhận, gắn payload bất biến; trả R1 khi gửi lại, không dựng payload từ UI/polling. |
| D03 | 2026-09-08 | Chủ dự án | Người có quyền thực tế được tiếp quản; không cần người tạo online hoặc giới hạn riêng cho quản lý. |
| D04 | 2026-09-08 | Chủ dự án | Người nhận chịu trách nhiệm tiền mặt vật lý; phần mềm bảo đảm ghi giao dịch, không thêm bước đối soát tiền. |
| D05 | 2026-09-08 đến 2026-09-09 | Chủ dự án | Giữ giá từng phần: 30.000 + 35.000 = 65.000 VND. Khác giá là dòng bán khác ID, không tạo catalog khác. Modifier chỉ chọn khi thêm món: cũ A × 2 × 30.000 + mới A × 1 × 40.000 + option 0 = 100.000 VND; không sửa modifier cũ. |
| D06 | 2026-09-08 | Chủ dự án | Mất local/đổi máy phục hồi dữ liệu server; bếp chưa làm, hoãn phục hồi đúng phiếu. |
| D07 | 2026-09-08 đến 2026-09-09 | Analyst được giao chọn | Pending 24 giờ từ register đầu; kiểm giờ DB sau khóa và validation, trước hiệu ứng; không gia hạn. Đơn 48 giờ vẫn có thể thanh toán bằng K mới. |
| D08 | 2026-09-08 đến 2026-09-09 | Analyst được giao chọn | Cancel tranh khóa với execute, không hủy applied. Không tự xóa K/result để tránh tái dùng thành giao dịch mới. |
| D09 | 2026-09-09 | Analyst thiết kế theo phạm vi đã thống nhất | Bốn RPC: submit_order_changes, pay_order, pay_order_items, void_order. Phiên nhân viên opaque token 12 giờ và bảo vệ nguồn quyền đi kèm; schema, giới hạn, lỗi, khóa, harness tại design. |
| D10 | 2026-09-09 | Chủ dự án cung cấp bối cảnh; analyst ghi giới hạn | Hệ chưa vận hành thật; không khẳng định có ca trùng thật. Kiểm dữ liệu và tái hiện trên môi trường thử riêng trước khi kết luận về implementation. |
| D11 | 2026-09-09 | Analyst giữ phạm vi | businessDate giữ ngày tạo; paidAt riêng; hóa đơn gồm giá base và số lượng option. |
| D12 | 2026-09-09 | Analyst cụ thể hóa | Replay counter tăng nguyên tử khi execute vào trạng thái cuối đã có; ngoài R1, không event mỗi retry. |

Lý do và đánh đổi tại design, mục 2, 5 và 8: register/execute tăng độ trễ nhưng tìm được lệnh trước áp dụng; giữ payload/result tốn dung lượng; khóa theo store giảm mức song song; snapshot theo phần làm UI nhiều dòng. Xác thực và bảo vệ nguồn quyền cần thiết để các bảo đảm đã chọn có ý nghĩa thực tế.

## Ngoài phạm vi

Bán offline, outbox và tự thử lại mutation; gateway/QR/ngân hàng/ngăn kéo/kiểm tiền vật lý; sửa modifier cũ; engine giá linh động/giảm giá/tồn kho; native printer; bếp và khôi phục đúng phiếu; tự đóng đơn cũ; tự dọn ledger; đổi ngày báo cáo; quyền nhân viên cho mọi endpoint đọc; tài khoản chủ mới.

## Phụ thuộc

- Phần tối thiểu của enforce-permissions-at-database là cổng cùng change: phiên server, nguồn quyền, chống đường gọi vượt giao thức. Phần rộng hơn vẫn thuộc change ấy; không đợi toàn bộ hệ thống tài khoản chủ. Ảnh hưởng lịch nêu ở mục khối lượng.
- Test DB riêng cho observer/fault và Supabase/PostgREST thật. Thiếu môi trường là BLOCKED DB test; không thay bằng mock rồi nhận đạt.
- [define-test-strategy (đã archive)](../archive/2026-09-07-define-test-strategy/proposal.md) cung cấp baseline; setup-test-data-environment cung cấp môi trường an toàn. Không chèn lỗi vào dữ liệu cửa hàng thật.
- Giữ Ports & Adapters và các ranh giới kiến trúc.

## Đọc và duyệt

1. [Requirement](specs/write-idempotency/spec.md) và các delta trong specs/.
2. [Use case](usecases.md): thao tác, đầu vào, đầu ra, thông báo.
3. [Design](design.md): schema, quyền, khóa, lỗi, migration và đánh đổi.
4. [Testplan](testplan.md): fixture, expected và cổng chạy.
5. [Traceability](traceability.md): không sót requirement hoặc use case.
6. [Tasks](tasks.md): từng việc ước lượng không quá 2 giờ, tổng và phần phát sinh ghi riêng.

Bộ này có **bảy loại artifact, 13 file Markdown**, gồm 7 file capability và 6 file gốc. Kết quả rà contract trước đó ở [tài liệu 14](../../../docs/reviews/2026-09-07-idempotency/14-bo-spec-hoan-chinh-va-ra-cuoi.md); đối chiếu review ngoài và đính chính trình bày/lịch ở [tài liệu 15](../../../docs/reviews/2026-09-07-idempotency/15-doi-chieu-review-ngoai-va-bien-tap.md). Chỉ kết luận đạt cho kiểm tra đã thực sự chạy; duyệt triển khai và lịch vẫn cần dựa trên bản cụ thể này.
