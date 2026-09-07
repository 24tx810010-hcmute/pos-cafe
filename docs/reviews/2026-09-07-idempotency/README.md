# Tập tài liệu nhờ đánh giá độc lập — Khóa chống trùng cho các lời gọi ghi

> **CẢNH BÁO — tài liệu `01` có tám lỗi đã được xác nhận.**
> Một AI độc lập đã rà ngày 07/09/2026 và tìm ra tám kết luận sai, trong đó ba lỗi
> làm sai kết luận trung tâm. **Đọc [04-dinh-chinh-sau-danh-gia.md](04-dinh-chinh-sau-danh-gia.md) trước.**
> Bản gốc được giữ nguyên có chủ ý để đối chiếu; các chỗ sai đã được đánh dấu tại chỗ.



Ngày lập: **07/09/2026**. Kho mã tại `main@7183b31`.

## Nhờ đánh giá cái gì

Dự án `pos-cafe` là phần mềm bán hàng cho quán cà phê, đang làm đồ án tốt nghiệp, hạn 21/12/2026. Change đang bàn tên là `add-idempotent-write-operations`: bảo đảm một thao tác ghi bị gửi lại không sinh dữ liệu trùng.

Tập tài liệu này gom **toàn bộ phân tích, bằng chứng mã nguồn và lập luận** dẫn tới các quyết định hiện tại. Nhờ bạn đánh giá **có phê phán**, không phải xác nhận.

**Cụ thể xin bạn tìm ba loại lỗi:**

1. **Kết luận sai về mã.** Mọi khẳng định về hành vi hệ thống đều có trích đoạn mã kèm theo trong tập này, nên bạn kiểm được mà không cần truy cập kho mã. Nếu một kết luận không suy ra được từ đoạn mã đi kèm, đó là lỗi.
2. **Lập luận có lỗ hổng.** Đặc biệt ở ba câu còn đang mở trong tài liệu `03`, nơi có hai phương án cạnh tranh nhau.
3. **Ca hỏng chưa được nghĩ tới.** Đây là thứ giá trị nhất bạn có thể đưa ra. Bối cảnh là quán cà phê: mạng chập chờn, nhiều thiết bị dùng chung một cửa hàng, nhân viên bấm lại khi màn hình có vẻ treo, máy chạy liên tục nhiều giờ.

## Đọc theo thứ tự

| File | Nội dung |
| --- | --- |
| [01-hien-trang-va-bang-chung.md](01-hien-trang-va-bang-chung.md) | Vấn đề gốc, kiến trúc liên quan, và **mọi trích đoạn mã** làm bằng chứng |
| [02-quyet-dinh-da-chot.md](02-quyet-dinh-da-chot.md) | Bốn quyết định đã chốt, kèm phương án bị loại và lý do loại |
| [03-ba-cau-dang-mo.md](03-ba-cau-dang-mo.md) | Ba câu chưa chốt, hai phía của mỗi câu, và đề xuất hiện tại |
| [04-dinh-chinh-sau-danh-gia.md](04-dinh-chinh-sau-danh-gia.md) | **Kết quả đánh giá độc lập ngày 07/09: tám lỗi đã xác nhận, hiện trạng sau đính chính** |

**Trạng thái: đã qua một vòng đánh giá độc lập.** Kết quả nằm ở tài liệu `04`. Người đánh giá đúng ở mọi khẳng định kiểm chứng được; ba lỗi làm sai kết luận trung tâm và một phát hiện mới là lỗ hổng `NULL` trong khóa lạc quan. Vòng đánh giá tiếp theo nên bắt đầu từ tài liệu `04`.

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
