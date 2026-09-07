# Giữ ứng dụng chạy ổn định khi mở liên tục nhiều ngày

## Why

Thiết bị POS ở quán là máy đặt cố định. Nhân viên mở ứng dụng vào buổi sáng và **không bao giờ đóng tab** — có thể chạy liên tục cả ngày, cả tuần, thậm chí không tắt máy. Đây không phải trường hợp hiếm mà là **cách dùng bình thường** của loại phần mềm này.

Nhưng ứng dụng là một trang đơn chạy trong trình duyệt, và mọi thứ tích tụ trong bộ nhớ tab đó sẽ **không bao giờ được dọn** cho tới khi có người tải lại trang. Chưa ai kiểm ứng dụng này sau 8 giờ, 24 giờ hay 7 ngày chạy liên tục.

Bốn nguồn tích tụ nhìn thấy được khi đọc mã ngày 2026-09-07:

**1. Bộ nhớ đệm truy vấn không có trần.** `src/app/AppProviders.tsx` khai `QueryClient` chỉ với `staleTime: 30_000` và `retry: false`, **không đặt `gcTime`**. Mặc định của thư viện vẫn dọn truy vấn không hoạt động, nhưng truy vấn nào **đang polling thì luôn được coi là hoạt động** nên không bao giờ bị dọn. Với `refetchIntervalInBackground: true`, điều này đúng cả khi tab bị ẩn.

**2. Khóa truy vấn sinh theo tham số.** `posQueryKeys.order(orderId)`, `orderHistory(filter)` và `report(businessDate)` tạo một mục nhớ đệm **cho mỗi giá trị tham số khác nhau**. Một ngày mở hàng trăm đơn là hàng trăm mục; xem lịch sử nhiều ngày là thêm nữa.

**3. Đăng ký realtime.** `IRealtimePort.startStoreInvalidation` trả về một hàm hủy đăng ký. Nếu có đường đi nào gọi đăng ký mà không gọi hủy, số kênh sẽ tăng dần theo thời gian chạy.

**4. Nút DOM bị bỏ lại.** Các module mở bằng ngăn kéo toàn màn hình được dựng và hủy liên tục suốt ca. Mở đóng vài nghìn lần trong một tuần là điều kiện điển hình để lộ ra rò rỉ mà mở đóng vài chục lần không thấy.

Hậu quả không phải hỏng hẳn mà là **chậm dần**: ứng dụng mượt buổi sáng, tới chiều thì thao tác trễ, và không ai biết vì sao. Nhân viên xử lý bằng cách tải lại trang, tức bản thân triệu chứng bị che đi.

Change này chưa khẳng định có rò rỉ. Nó nói rằng **chưa ai kiểm**, và với cách dùng đặc thù của POS thì đây là khoảng trống đáng đóng.

## What Changes

- Đo mức tiêu thụ bộ nhớ của tab theo thời gian chạy, ở các mốc 1 giờ, 8 giờ và 24 giờ, dưới thao tác mô phỏng liên tục.
- Đếm số mục trong bộ nhớ đệm truy vấn theo thời gian, xác định mục nào tăng không giới hạn.
- Kiểm số kênh realtime đang mở có tăng theo thời gian không.
- Kiểm số nút DOM bị bỏ lại sau khi mở và đóng ngăn kéo nhiều lần.
- Chốt và đặt `gcTime` cùng trần cho bộ nhớ đệm nếu số đo cho thấy cần.
- Bổ sung cơ chế xử lý khi phiên chạy quá lâu, nếu số đo cho thấy cần.
- Ghi kết quả vào `docs/testing.md` và giới hạn còn lại vào `docs/limitations.md`.

## Capabilities

### New Capabilities

Chưa xác định. Nếu số đo dẫn tới một hành vi người dùng nhìn thấy được — ví dụ ứng dụng tự đề nghị tải lại sau một thời gian chạy — thì sẽ phát sinh requirement mới. Nếu chỉ là chỉnh cấu hình bộ nhớ đệm thì không.

Câu hỏi số 4 quyết định điều này.

## Impact

- Có thể chạm `src/app/AppProviders.tsx`, các hook dữ liệu, và `src/features/integration/realtimeInvalidation.ts`.
- Cần một cách chạy kiểm thử dài giờ, khác hẳn bộ kiểm thử hiện có vốn chạy trong vài chục giây.
- Cập nhật `docs/limitations.md`, và `docs/testing.md` cho phần bằng chứng.

## Ngoài phạm vi

- Tải phía máy chủ. Việc đó thuộc `measure-runtime-load` và `optimize-runtime-load`.
- Chế độ ngoại tuyến và kho dữ liệu cục bộ. Việc đó thuộc `add-offline-data-layer`, dù hai bên cùng đụng tới việc dữ liệu sống lâu trên máy.
- Tối ưu kích thước gói tải về. Đó là vấn đề lúc tải trang đầu tiên, không phải vấn đề của phiên chạy dài.

## Phụ thuộc

- Không phụ thuộc change nào để bắt đầu.
- Nên làm **cùng đợt** với `measure-runtime-load`: cả hai đều là đo đạc và cùng cần một môi trường chạy dài, dựng chung thì rẻ hơn dựng hai lần.
- Nên làm **trước** `add-offline-data-layer`. Change đó thêm một kho dữ liệu sống lâu trên máy; nếu phiên chạy dài vốn đã có vấn đề thì thêm kho nữa sẽ làm khó truy nguyên.

## Câu hỏi phải chốt trước khi làm

1. Thời gian chạy liên tục cần bảo đảm là bao lâu? Một ca làm việc khoảng 8 giờ, một ngày 24 giờ, hay một tuần không tải lại? Con số này quyết định toàn bộ mức công.
2. Chấp nhận giải pháp "ứng dụng tự tải lại sau N giờ" không? Nó rẻ và chắc chắn hiệu quả, nhưng tải lại giữa ca có thể làm mất giỏ hàng đang soạn, vì `draftItems` hiện nằm trong bộ nhớ chứ không được lưu lại.
3. Ngưỡng nào thì coi là có vấn đề? Ví dụ bộ nhớ tab tăng quá bao nhiêu sau 8 giờ, hoặc thao tác chậm hơn bao nhiêu so với lúc mới mở.
4. Nếu phải thêm hành vi người dùng nhìn thấy được, ví dụ một thông báo đề nghị tải lại, thì đó có được coi là tính năng mới cần đặc tả không?
5. Đo bằng cách nào? Chạy Playwright dài giờ với thao tác lặp là tái dùng hạ tầng đang có nhưng chiếm máy rất lâu; theo dõi thủ công trên thiết bị thật gần thực tế hơn nhưng không lặp lại được.
6. Có ưu tiên giữ giỏ hàng đang soạn qua việc tải lại trang không? Việc này giao nhau với `add-offline-data-layer`, vốn cũng cần lưu dữ liệu bền phía máy; làm chung hay tách riêng cần chốt.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
