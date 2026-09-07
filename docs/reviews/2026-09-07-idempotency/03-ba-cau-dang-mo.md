# 03 — Ba câu đang mở

Ba câu này **chưa chốt**. Với mỗi câu, tài liệu trình bày cả hai phía và đề xuất hiện tại. Đây là phần cần đánh giá kỹ nhất.

---

## Câu A — Khóa chống trùng sinh và giữ ở đâu?

### Vấn đề

Khóa chỉ có tác dụng nếu lần gửi thứ hai dùng **đúng chuỗi cũ**. Mất khóa là mất bảo đảm. Nên câu này thực chất hỏi: **khóa sống được bao lâu trước khi bị mất?**

Trong React, khi ngăn kéo đơn đóng rồi mở lại, thành phần bị hủy và tạo mới; mọi biến `useState` trở về giá trị ban đầu.

| Nơi giữ | Mất khi nào |
| --- | --- |
| Adapter | **Mỗi lần gọi.** Chính là lỗi đang có |
| State của thành phần React | Khi thành phần dựng lại |
| Kho zustand | Khi tải lại trang |
| `sessionStorage` | Khi đóng tab |
| `localStorage` hoặc IndexedDB | Khi xóa dữ liệu duyệt web |

### Đề xuất ban đầu, và vì sao nó bị bác

Đề xuất ban đầu là **chỉ dùng kho zustand**, với lý lẽ: giỏ hàng đang soạn đã nằm ở đó, và tải lại trang là "hành động có chủ ý, không phải tai nạn".

**Chủ dự án bác lại, và lý lẽ bác đúng.** Ca hỏng thật:

1. Màn hình treo vì mạng.
2. Thu ngân **tải lại trang** — đây chính là phản xạ thông thường khi thấy treo.
3. Khóa trong zustand mất.
4. Thu ngân nhập lại đơn.
5. Nếu lần gửi đầu đã tới máy chủ thì bây giờ có **hai đơn**.

Tức tải lại trang không phải hành động hiếm ở ngoài lề — nó là thứ người dùng làm **đúng vào lúc nguy hiểm nhất**.

### Đề xuất hiện tại

**Kho zustand, cộng lưu riêng bản đồ khóa xuống `sessionStorage`.**

- Chỉ lưu một chuỗi ngắn cho mỗi thao tác đang chờ, không phải cả kho dữ liệu.
- Không thêm dependency, không đụng IndexedDB.
- Sống qua tải lại trang trong cùng tab.
- Xóa khóa ngay khi thao tác hoàn tất.

Phương án dùng IndexedDB đầy đủ bị loại vì nó thuộc phạm vi của change `add-offline-data-layer` ở tuần 11–13; làm sớm là lấn phạm vi và sẽ phải viết lại.

### Chỗ chưa chắc, xin đánh giá

1. **Nhiều tab cùng mở.** `sessionStorage` tách riêng theo tab. Hai tab cùng thao tác trên một đơn thì mỗi tab có khóa riêng — có sinh vấn đề gì không, hay đúng là hành vi mong muốn vì đó là hai ý định khác nhau?
2. **Khóa bị bỏ lại.** Thao tác thất bại vĩnh viễn thì khóa nằm lại trong `sessionStorage`. Có cần cơ chế dọn không, hay để nó chết cùng tab là đủ?
3. **Đóng tab rồi mở lại.** `sessionStorage` mất. Ca này khác gì ca tải lại trang về mức nguy hiểm?
4. **Có ca nào `sessionStorage` không dùng được không**, ví dụ chế độ riêng tư của trình duyệt, và khi đó nên làm gì?

---

## Câu B — Máy chủ trả về gì khi gặp khóa đã áp dụng?

### Hai phương án

**A — Phát lại nguyên văn kết quả lần đầu.** Máy chủ lưu kết quả, lần sau trả lại y hệt. Thu ngân bấm lại thì thấy màn hình như lần đầu thành công. Client không phải thêm nhánh xử lý. Giá: bảng khóa lưu thêm cột kết quả dạng `jsonb`.

**B — Chỉ báo "đã áp dụng", client tự tải lại.** Bảng khóa nhẹ hơn. Client phải thêm một nhánh: nhận tín hiệu này thì làm gì.

### Lập luận đang dùng để chọn A

Lỗi gốc mà change này sinh ra để xóa, theo đúng lời `proposal.md`:

> phụ thuộc vào việc tầng gọi có nhớ truyền định danh ổn định xuống hay không, chứ không phải một bảo đảm của hệ thống. Một chỗ quên là mất bảo đảm.

Phương án B tạo ra **cùng hình dạng đó ở tầng khác**: máy chủ trả một tín hiệu, và **mỗi chỗ gọi phải nhớ xử lý** tín hiệu ấy. Quên một chỗ thì màn hình đứng im hoặc hiện lỗi lạ. Vẫn là một luật phải nhớ ở N chỗ, N tăng theo thời gian — chỉ khác là luật nằm ở đầu ra thay vì đầu vào.

### Phản biện của chủ dự án, và cách nó được trả lời

Chủ dự án nghiêng về B với lý do: B **chủ động tải lại để lấy thông tin mới**, còn A phát lại một ảnh chụp từ lần gọi đầu, có thể đã cũ.

Đây là điểm đúng và ban đầu bị đánh giá thấp. Nhưng kiểm mã cho thấy nó **đã được cơ chế có sẵn xử lý**: `posInvalidation.ts` (trích đoạn đầy đủ ở tài liệu `01` mục 9) vô hiệu hóa bộ nhớ đệm **và chủ động tải lại** đơn đang mở, sơ đồ bàn và báo cáo sau **mỗi** lần ghi.

Nghĩa là chọn A không đồng nghĩa với dữ liệu cũ: ảnh chụp phát lại chỉ dùng cho phản hồi tức thì, và ngay sau đó cơ chế có sẵn kéo về trạng thái mới.

### So sánh kiểu hỏng

| | Hỏng như thế nào |
| --- | --- |
| A | Nếu máy khác vừa sửa đơn, `lock_version` trong ảnh chụp là cũ, nên lần gọi tiếp theo từ máy này nhận `ORDER_VERSION_CONFLICT`. **Hỏng an toàn**: báo lỗi chứ không ghi sai |
| B | Quên một nhánh xử lý thì màn hình đứng im mà không ai biết. **Hỏng im lặng** |

### Chỗ chưa chắc, xin đánh giá

1. Lập luận "B lặp lại lỗi cũ ở tầng khác" có đứng vững không, hay đó là một phép loại suy nghe hợp lý nhưng không chặt?
2. Việc phát lại ảnh chụp cũ có sinh ca hỏng nào **chưa được nêu** không? Đặc biệt với `pay_order_items`, vốn tạo đơn mới và đổi số bill của đơn gốc.
3. Lưu kết quả `jsonb` của mọi lời gọi ghi có vấn đề gì về **dữ liệu nhạy cảm** không, khi nó chứa chi tiết đơn và số tiền và nằm lại 7 ngày?
4. Có phương án thứ ba nào chưa được xét không?

---

## Câu C — Giữ khóa bao lâu, và dọn thế nào?

### Ước lượng quy mô

Quán khoảng 100 đơn mỗi ngày, mỗi đơn 1–3 lần gửi cộng 1–2 lần thanh toán, tức khoảng **400 dòng mỗi ngày**. Giữ 7 ngày là khoảng **2.800 dòng**, kèm kết quả `jsonb` chừng vài MB.

Đây là **ước lượng, không phải đo đạc**. Ở quy mô đó, nỗi lo "bảng phình" không có thật, nên nên chọn theo vế "đủ dài".

### Ràng buộc từ tương lai

Tuần 11–13 làm chế độ ngoại tuyến. Hàng đợi có thể nằm trên máy vài giờ mới gửi được. Khóa **phải sống lâu hơn cửa sổ ngoại tuyến tối đa**, hiện đang đề xuất là 4 giờ nhưng chưa chốt.

### Đề xuất hiện tại

**7 ngày**, dư an toàn kể cả khi cửa sổ ngoại tuyến nới gấp mười lần.

### Rủi ro của việc dọn, và bốn ràng buộc đề xuất

Rủi ro thật: job dọn có lỗi ở điều kiện ngày sẽ **xóa nhầm khóa còn hạn**. Thao tác gửi lại sau đó bị coi là mới, và sinh dữ liệu trùng. Tức **một lỗi ở job dọn biến thành sai dữ liệu ở luồng tiền**.

1. **Chỉ xóa theo tuổi**: `created_at < now() - interval '7 days'`. Không xóa theo trạng thái, không xóa theo số lượng.
2. **Không bao giờ dọn trong lời gọi ghi.** Job riêng, chạy định kỳ. Dọn trong lời gọi tiền là thêm việc vào đúng chỗ cần nhanh.
3. **Giới hạn số dòng mỗi lần chạy**, ví dụ 10.000. Job có lỗi thì thiệt hại bị chặn ở một lô.
4. **Ghi lại mỗi lần dọn**: số dòng đã xóa và mốc thời gian cắt. Không có dòng này thì việc mất khóa là một bí ẩn không truy được.

Cộng một kiểm thử bắt buộc: dựng khóa ở tuổi 6 ngày và 8 ngày, chạy job, khẳng định khóa 6 ngày **còn nguyên**.

### Chỗ chưa chắc, xin đánh giá

1. **Chưa biết chạy job định kỳ bằng gì.** Supabase thường có `pg_cron` nhưng chưa kiểm nó có bật ở gói đang dùng hay không. Hai đường lui là một hàm chạy theo lịch, hoặc dọn thủ công. Nếu **không có cơ chế định kỳ nào** thì thiết kế này có sụp không?
2. Bốn ràng buộc trên có đủ không? Đặc biệt: có nên **không xóa hẳn** mà chỉ đánh dấu, để một lỗi dọn không thành mất dữ liệu vĩnh viễn?
3. Con số 7 ngày có hợp lý không khi cửa sổ ngoại tuyến **vẫn chưa được chốt**? Chọn một con số phụ thuộc vào một con số chưa chốt có phải là quyết định non không?
4. Nếu khóa hết hạn **trong lúc** một thiết bị đang ngoại tuyến giữ thao tác chờ, thì chuyện gì xảy ra khi nó gửi lên? Ca này đã được nghĩ tới chưa?
