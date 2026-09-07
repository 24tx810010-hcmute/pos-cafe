# Tối ưu tải lúc chạy

## Why

Rà mã ngày 2026-09-07 cho thấy tải của hệ gần như toàn bộ đến từ **polling đọc**, không phải từ ghi, và chênh lệch khoảng 50 lần. Chi tiết số liệu ước lượng ghi ở `measure-runtime-load`.

Ba chỗ nhìn thấy được ngay khi đọc mã:

**1. Tab ẩn vẫn polling.** `src/features/pos/usePosData.ts:6` đặt `refetchIntervalInBackground: true` cùng với `refetchInterval: 5_000`. Một tablet để quên qua đêm ở quán đã đóng cửa vẫn gửi khoảng 36 yêu cầu mỗi phút, mãi mãi. Đây là tải **hoàn toàn rỗng**: không ai đang nhìn màn hình đó.

**2. Polling không phân biệt quán bận và quán vắng.** Chu kỳ 5 giây cố định, chạy y hệt nhau dù có đơn hay không. Tải tỷ lệ với **số thiết bị đang bật**, không tỷ lệ với việc kinh doanh.

**3. Polling và realtime chồng nhau.** Hệ đã có `IRealtimePort` phát tín hiệu thay đổi theo cửa hàng. Polling 5 giây được thêm vào để bù trường hợp tín hiệu bị mất — tức nó là **lưới an toàn cho một cơ chế đã hoạt động**, và đang chạy với tần suất như thể cơ chế kia không tồn tại.

Change này **không được bắt đầu trước khi có số đo**. Tối ưu dựa trên suy luận từ mã là đoán mò, và rất dễ tối ưu nhầm chỗ rẻ trong khi bỏ qua chỗ đắt.

## What Changes

- Giảm hoặc dừng polling khi tab đang ẩn, sau khi chốt được việc đó không làm hỏng phần tự hồi phục sau mất kết nối.
- Xem lại quan hệ giữa polling và realtime: khi tín hiệu realtime đang khỏe thì hạ tần suất polling, mất tín hiệu mới nâng lên.
- Xem lại chu kỳ 5 giây: có thể giãn ra cho các truy vấn ít đổi như sơ đồ bàn, giữ dày cho truy vấn hay đổi như đơn đang mở.
- Rà các truy vấn đang tải nhiều dữ liệu hơn mức màn hình cần.
- Đo lại sau mỗi thay đổi và so với số nền, để chứng minh việc tối ưu có tác dụng thật.

## Capabilities

### Modified Capabilities

- `multi-device-sync`: requirement về chu kỳ tải lại đang ghi "khoảng 5 giây" sẽ phải phát biểu lại nếu chu kỳ trở thành thích ứng thay vì cố định.

## Impact

- Chạm `src/features/pos/usePosData.ts` và các hook dữ liệu khác.
- Có thể chạm `src/features/integration/realtimeInvalidation.ts` nếu gắn polling vào trạng thái realtime.
- Rủi ro thật: giảm polling quá tay làm chậm việc đồng bộ giữa các máy, mà đó là năng lực hệ đang có và đã đặc tả. Mọi thay đổi phải kèm bằng chứng đồng bộ vẫn đạt.
- Cập nhật `docs/architecture.md` mục realtime, và `openspec/specs/multi-device-sync`.

## Ngoài phạm vi

- Đo đạc. Việc đó thuộc `measure-runtime-load`.
- Tăng trưởng bộ nhớ phía trình duyệt. Việc đó thuộc `handle-long-running-session`.
- Đổi kiến trúc đồng bộ sang mô hình khác, ví dụ bỏ hẳn polling và chỉ dựa vào realtime.

## Phụ thuộc

- **Bắt buộc làm sau `measure-runtime-load`.** Không có số nền thì không chứng minh được tối ưu có tác dụng.
- Nên làm sau `expand-e2e-coverage`, vì thay đổi nhịp đồng bộ chạm vào phần khó kiểm nhất của hệ.

## Câu hỏi phải chốt trước khi làm

1. Mục tiêu của việc tối ưu là gì: giảm tải để chịu được nhiều quán hơn, hay giảm chi phí gói dịch vụ, hay chỉ để trình bày trong báo cáo? Ba mục tiêu này dẫn tới mức độ khác nhau.
2. Ngưỡng chấp nhận được cho độ trễ đồng bộ giữa hai máy là bao nhiêu? Hiện `multi-device-sync` chỉ ghi "trong khoảng vài giây" mà không có số. Không có ngưỡng thì không biết tối ưu tới đâu thì phải dừng.
3. Tab ẩn thì dừng hẳn polling hay chỉ giãn chu kỳ? Dừng hẳn tiết kiệm nhất nhưng lúc quay lại tab phải tải lại toàn bộ, và có thể có khoảng thời gian màn hình hiển thị dữ liệu cũ.
4. Có chấp nhận để chu kỳ polling thay đổi theo trạng thái realtime không? Nó tiết kiệm nhiều nhất nhưng làm hành vi hệ khó đoán hơn và khó kiểm thử hơn.
5. Việc tối ưu có được phép đổi requirement đã đặc tả trong `multi-device-sync` không, hay phải giữ nguyên hành vi đã cam kết?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
