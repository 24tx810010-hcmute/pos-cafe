# Đo tải và độ trễ lúc chạy thật

## Why

Không ai biết hệ này chịu được bao nhiêu quán và bao nhiêu thiết bị, vì **chưa có một con số đo nào**. `docs/testing.md` mục "Khoảng Trống Kiểm Thử" đã tự ghi nhận: chưa có kiểm thử tải, chưa đo độ trễ realtime có kiểm soát.

Rà mã ngày 2026-09-07 cho thấy **tải của hệ gần như toàn bộ là đọc do polling, không phải ghi** — và chênh lệch khoảng 50 lần:

| Nguồn tải | Ước lượng |
| --- | --- |
| Một thiết bị polling | `src/features/pos/usePosData.ts:6` đặt `refetchInterval: 5_000` cho 4 truy vấn, nên 3 truy vấn thường trực cộng 1 truy vấn khi đang mở đơn: **36–48 yêu cầu mỗi phút** |
| Một quán ba máy | ~110–145 yêu cầu mỗi phút |
| Mười quán | ~18–24 yêu cầu mỗi giây |
| Ghi, một quán bận rộn | **1–2 lần mỗi phút** |

Điểm đáng lo nhất: `refetchIntervalInBackground: true` ở cùng dòng đó nghĩa là **tab ẩn vẫn polling**. Một tablet để quên qua đêm ở quán đã đóng cửa vẫn gửi 36 yêu cầu mỗi phút. Tải này **không giảm khi quán vắng**; nó tỷ lệ với số thiết bị đang bật, không tỷ lệ với việc kinh doanh.

Ngược lại, phần ghi đã được thiết kế tách theo quán: mọi RPC ghi gọi `pg_advisory_xact_lock(hashtext(store_id || ':pos-write'))`, nên ghi trong cùng một quán xếp hàng tuần tự còn các quán khác nhau không tranh chấp. Đây là điểm mạnh, nhưng **trần ghi trong một quán vẫn chưa được đo**.

Toàn bộ các con số trên là **ước lượng suy ra từ mã, không phải đo đạc**. Change này biến chúng thành số thật.

## What Changes

- Đo độ trễ thực tế của bốn lời gọi ghi chính và của các truy vấn đọc bị polling, trên môi trường Supabase thật.
- Đếm tải polling thật trong một phiên vận hành mô phỏng, tách riêng phần tab đang hiện và tab đang ẩn.
- Đo thời gian giữ `pg_advisory_xact_lock` để suy ra trần ghi trong một quán.
- Đo chi phí của chính sách bảo mật mức dòng: so sánh cùng một truy vấn khi có và không có policy.
- Rà hạn mức của gói Supabase đang dùng: trần kết nối, trần compute, chính sách tạm ngưng project.
- Ghi toàn bộ số đo vào `docs/testing.md` kèm baseline, ngày và cấu hình máy.
- Kết luận bằng một bảng: với cấu hình hiện tại, hệ chịu được khoảng bao nhiêu quán và bao nhiêu thiết bị trước khi chạm trần nào.

## Capabilities

### New Capabilities

Không có. Đây là change đo đạc, không đổi hành vi quan sát được của hệ thống, nên `.openspec.yaml` đặt `skip_specs: true`.

### Modified Capabilities

Không có.

## Impact

- Tài liệu: `docs/testing.md`, `docs/limitations.md`, có thể cả `docs/architecture.md`.
- Không đổi mã nghiệp vụ. Có thể thêm mã đo tạm thời, phải gỡ sau khi đo xong.
- Có thể phát sinh tải thật lên project Supabase trong lúc đo; cần chốt chạy trên project nào.
- Là nền bắt buộc cho `optimize-runtime-load`: chưa đo mà đã tối ưu là đoán mò.

## Ngoài phạm vi

- Thực hiện tối ưu. Việc đó thuộc `optimize-runtime-load`.
- Xử lý tăng trưởng bộ nhớ phía trình duyệt. Việc đó thuộc `handle-long-running-session`.
- Kiểm thử xâm nhập và kiểm thử bảo mật.
- Nâng gói Supabase, vì đồ án không có ngân sách tiền.

## Phụ thuộc

- Không phụ thuộc change nào để bắt đầu.
- **Bắt buộc làm trước `optimize-runtime-load`.**
- Nên có sau `setup-test-data-environment` nếu muốn đo trên dữ liệu có quy mô thật thay vì dữ liệu demo.

## Câu hỏi phải chốt trước khi làm

1. Đo trên project Supabase nào? Dùng chính project đang phát triển thì số đo phản ánh đúng gói đang dùng, nhưng việc đo sẽ đẩy tải thật lên đó. Dựng project riêng thì sạch hơn nhưng tốn công và có thể khác cấu hình.
2. Mô phỏng bao nhiêu quán và bao nhiêu thiết bị? Cần một con số mục tiêu để biết đo tới đâu là đủ, ví dụ "chứng minh chịu được 10 quán × 3 máy".
3. Đo bằng công cụ gì? Viết script Playwright mô phỏng nhiều thiết bị là tái dùng được hạ tầng đang có, nhưng nặng; gọi thẳng RPC bằng script nhẹ hơn nhưng không phản ánh tải thật của giao diện.
4. Kết quả đo dùng để làm gì nếu nó xấu? Đây là câu quan trọng nhất: nếu số đo cho thấy hệ chỉ chịu được 3 quán thì có đổi kiến trúc không, hay chỉ ghi vào phần hạn chế và giữ nguyên phạm vi đồ án?
5. Có đo cả kịch bản mạng kém không, ví dụ độ trễ cao hoặc mất gói? Môi trường quán cà phê vốn có mạng chập chờn, nhưng đo được điều này cần thêm công cụ.
6. Số đo cần chi tiết tới đâu để đưa vào báo cáo? Trung vị và phân vị 95 là đủ, hay cần biểu đồ phân bố?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
