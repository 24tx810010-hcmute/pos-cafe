# Tập tài liệu nhờ đánh giá độc lập — Khóa chống trùng cho các lời gọi ghi

**Bản để đọc hiện tại (2026-09-10):** [15 — Đối chiếu review ngoài và biên tập](15-doi-chieu-review-ngoai-va-bien-tap.md), cùng [proposal hiện hành](../../../openspec/changes/add-idempotent-write-operations/proposal.md). Bộ spec có 93 testcase gốc đã thiết kế, chưa chạy; lịch triển khai chưa chốt lại. Các tài liệu 01–14 giữ lịch sử phân tích và review trước đó.

> **CẢNH BÁO — tài liệu `01` có tám lỗi đã được xác nhận.**
> Một AI độc lập đã rà ngày 2026-09-07 và tìm ra tám kết luận sai, trong đó ba lỗi
> làm sai kết luận trung tâm. **Đọc [04-dinh-chinh-sau-danh-gia.md](04-dinh-chinh-sau-danh-gia.md) trước.**
> Bản gốc được giữ nguyên có chủ ý để đối chiếu; các chỗ sai đã được đánh dấu tại chỗ.



Ngày lập: **2026-09-07**. Kho mã tại `main@7183b31`.

## Nhờ đánh giá cái gì

Dự án `pos-cafe` là phần mềm bán hàng cho quán cà phê, đang làm đồ án tốt nghiệp, hạn 2026-12-21. Change đang bàn tên là `add-idempotent-write-operations`: bảo đảm một thao tác ghi bị gửi lại không sinh dữ liệu trùng.

Tập tài liệu này gom **toàn bộ phân tích, bằng chứng mã nguồn và lập luận** dẫn tới các quyết định hiện tại. Nhờ bạn đánh giá **có phê phán**, không phải xác nhận.

**Cụ thể xin bạn tìm ba loại lỗi:**

1. **Kết luận sai về mã.** Mọi khẳng định về hành vi hệ thống đều có trích đoạn mã kèm theo trong tập này, nên bạn kiểm được mà không cần truy cập kho mã. Nếu một kết luận không suy ra được từ đoạn mã đi kèm, đó là lỗi.
2. **Lập luận có lỗ hổng.** Đặc biệt ở ba câu còn đang mở trong tài liệu `03`, nơi có hai phương án cạnh tranh nhau.
3. **Ca hỏng chưa được nghĩ tới.** Đây là thứ giá trị nhất bạn có thể đưa ra. Bối cảnh là quán cà phê: mạng chập chờn, nhiều thiết bị dùng chung một cửa hàng, nhân viên bấm lại khi màn hình có vẻ treo, máy chạy liên tục nhiều giờ.

## Mốc chuẩn bị trước bộ spec hoàn chỉnh

Proposal ở mốc 2026-09-08 đến 2026-09-09 có 32 PRE-IDEM chuẩn bị, được giữ nguyên ở [bản lưu](evidence/2026-09-09-proposal-truoc-bo-spec.md). [Proposal hiện hành](../../../openspec/changes/add-idempotent-write-operations/proposal.md) trỏ bộ bảy artifact và 93 TC gốc sau hoàn thiện. Modifier chỉ chọn khi thêm món: A × 2 giá 30.000 đ + A mới 40.000 đ với modifier 0 đ = 100.000 đ; không mở rộng sửa modifier phần cũ.

## Đọc theo thứ tự

| File | Nội dung |
| --- | --- |
| [15-doi-chieu-review-ngoai-va-bien-tap.md](15-doi-chieu-review-ngoai-va-bien-tap.md) | Kiểm lại review ngoài; bổ sung 2026-09-10 về điều hướng, nguyên tắc giữ tài liệu 14 và kịch bản ảnh hưởng lịch tới mục 10 |
| [14-bo-spec-hoan-chinh-va-ra-cuoi.md](14-bo-spec-hoan-chinh-va-ra-cuoi.md) | Bộ bảy artifact, 93 TC gốc; kết quả validate/traceability và review độc lập vòng cuối |
| [13-review-doc-lap-kich-ban-test.md](13-review-doc-lap-kich-ban-test.md) | Mốc review 32 PRE-IDEM trước khi viết bộ hoàn chỉnh; giữ các lỗi và báo cáo gốc để đối chiếu |
| [12-chuan-bi-ra-cuoi-truoc-code.md](12-chuan-bi-ra-cuoi-truoc-code.md) | **Đọc mục 7 trước:** chốt modifier chỉ khi thêm món, ví dụ 100.000 đ, bằng chứng UI và testcase; các mục trước giữ lịch sử chuẩn bị, kiểm kê artifact và điều kiện trước code |
| [11-thuong-mai-dien-tu-va-kiem-chung-test.md](11-thuong-mai-dien-tu-va-kiem-chung-test.md) | Nghiên cứu giá cart/checkout/order, giới hạn áp dụng cho POS và quy trình kiểm chứng test độc lập |
| [10-quyet-dinh-sau-review-va-chinh-sach-gia.md](10-quyet-dinh-sau-review-va-chinh-sach-gia.md) | **Đọc trước: quyết định mới về server, quyền tiếp quản, tiền mặt, giá từng lần gọi và vòng đời lệnh** |
| [09-giai-thich-cac-lua-chon-con-mo.md](09-giai-thich-cac-lua-chon-con-mo.md) | Lịch sử các lựa chọn/ưu nhược trước khi chủ dự án trả lời; đọc theo cập nhật 10 |
| [08-review-doc-lap-plan-07.md](08-review-doc-lap-plan-07.md) | **Ba review toàn phần độc lập đối chiếu main; bằng chứng mã, khác biệt khuyến nghị và 24 testcase ứng viên** |
| [07-uu-tien-online-va-khoi-phuc-tren-server.md](07-uu-tien-online-va-khoi-phuc-tren-server.md) | Mốc review giữ nguyên: quyết định 2026-09-08 ưu tiên online, hoãn offline và hướng phục hồi trên server |
| [01-hien-trang-va-bang-chung.md](01-hien-trang-va-bang-chung.md) | Vấn đề gốc, kiến trúc liên quan, và **mọi trích đoạn mã** làm bằng chứng |
| [02-quyet-dinh-da-chot.md](02-quyet-dinh-da-chot.md) | Bốn quyết định đã chốt, kèm phương án bị loại và lý do loại |
| [03-ba-cau-dang-mo.md](03-ba-cau-dang-mo.md) | Ba câu chưa chốt, hai phía của mỗi câu, và đề xuất hiện tại |
| [04-dinh-chinh-sau-danh-gia.md](04-dinh-chinh-sau-danh-gia.md) | **Kết quả đánh giá độc lập ngày 2026-09-07: tám lỗi đã xác nhận, hiện trạng sau đính chính** |
| [05-nho-danh-gia-vong-hai.md](05-nho-danh-gia-vong-hai.md) | Nhờ đánh giá vòng hai: kiểm bản sửa, và một mâu thuẫn mới lộ ra |
| [06-ket-qua-vong-hai.md](06-ket-qua-vong-hai.md) | **Kết quả vòng hai: định nghĩa "một thao tác", hợp đồng máy chủ, và câu trả lời cho A/B/C** |

**Trạng thái hiện tại:** nguyên tắc vận hành, giá và vòng đời lệnh đã được ghi trong spec. Xem tài liệu 15 để biết phần đính chính và lịch còn chờ chốt; ứng dụng và test mới vẫn chưa triển khai.

Vòng một tìm ra tám lỗi, ba trong số đó làm sai kết luận trung tâm, cộng một phát hiện mới là lỗ hổng `NULL` trong khóa lạc quan. Vòng hai xác nhận cả ba khẳng định của bản sửa, tìm thêm **hai chỗ bản sửa vẫn sai**, và trả lời câu quan trọng nhất — *"cùng một thao tác" là gì*. Cả hai chỗ sai đã được đính chính, và `proposal.md` đã được viết lại cho nhất quán.

**Đọc [10](10-quyet-dinh-sau-review-va-chinh-sach-gia.md) để nắm quyết định hiện tại, [08](08-review-doc-lap-plan-07.md) để kiểm bằng chứng review.** [07](07-uu-tien-online-va-khoi-phuc-tren-server.md) được giữ nguyên để đối chiếu. Các tài liệu `01` `02` `03` là bản gốc trước đánh giá, giữ lại làm dấu vết quá trình; `04` và `06` là hai lần đính chính. Số liệu test cục bộ của đợt mới nằm trong 08; chưa chạy DB/cloud, đo tải hoặc tái hiện mất mạng toàn hệ thống.

## Những chỗ tôi tự biết là chưa chắc

Ghi ra trước để bạn khỏi mất công tìm, và để bạn biết chỗ nào đáng soi kỹ:

1. **Chưa đo độ trễ thật của bất kỳ lời gọi nào.** Mọi ước lượng về hiệu năng trong tập này là suy ra từ đọc mã, không phải đo đạc.
2. **Chưa chạy thử ca hỏng nào trên môi trường thật.** Kết luận "gọi lại bị chặn" suy ra từ đọc mã SQL, chưa có kiểm thử chứng minh.
3. **Chưa biết `pg_cron` có bật ở gói Supabase đang dùng hay không**, mà phương án dọn bảng khóa đang giả định có một cơ chế chạy định kỳ.
4. **Hệ chưa từng chạy thật và chưa có kiểm thử tải**, nên chưa có dữ liệu vận hành để đối chiếu.

## Bốn câu hỏi cụ thể xin bạn trả lời

**Câu 1.** Tài liệu `01` kết luận rằng trong bốn lời gọi ghi, chỉ **tạo đơn mới** là thực sự sinh dữ liệu trùng khi gửi lại; ba lời gọi còn lại đã bị khóa lạc quan chặn. Kết luận này có đúng với các trích đoạn mã đi kèm không? Có ca nào lách được không?

**Câu 2.** Tài liệu `01` phân biệt hai cơ chế: **khóa lạc quan** chặn nhiều máy cùng sửa một đơn, **khóa chống trùng** chặn một máy gửi lại. Cách phân biệt này có đúng và có đủ không? Có tình huống nào cả hai cùng không chặn được không?

**Câu 3.** Ở tài liệu `03` câu A, đề xuất lưu khóa vào `sessionStorage` để sống qua việc tải lại trang. Cách này có lỗ hổng gì? Đặc biệt xin xét: nhiều tab cùng mở, tab bị đóng rồi mở lại, và khóa bị bỏ lại khi thao tác thất bại vĩnh viễn.

**Câu 4.** Ở tài liệu `03` câu B, lập luận cho rằng phương án "server phát lại kết quả lần đầu" tốt hơn phương án "server chỉ báo đã áp dụng". Lập luận đó có đứng vững không? Việc phát lại một ảnh chụp cũ có sinh ra ca hỏng nào chưa được nêu không?

## Định dạng trả lời mong muốn

Với mỗi lỗi tìm được, xin ghi: **chỗ nào** (tên file và mục), **sai gì**, và **vì sao**. Không cần đề xuất cách sửa nếu bạn không chắc — chỉ ra được vấn đề đã là đủ giá trị.

Nếu bạn thấy một kết luận **đúng** nhưng lập luận dẫn tới nó **yếu**, xin nói rõ, vì tập tài liệu này sẽ dùng làm nguyên liệu cho báo cáo khóa luận và phần lập luận sẽ bị hỏi.
