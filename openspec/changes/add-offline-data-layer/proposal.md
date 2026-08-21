# Tầng dữ liệu cục bộ cho chế độ ngoại tuyến

## Why

Hệ thống hiện là online-only: mất mạng thì không bán được hàng. Với một quán cà phê thật, đây là lỗi nghiêm trọng, vì mạng ở quán hay rớt và quán không thể ngừng bán để chờ mạng. Baseline spec `multi-device-sync` ghi rõ mọi thao tác ghi thất bại khi mất mạng và không có hàng đợi nào lưu lại.

Đây là thay đổi lật lại một quyết định đã chốt. `pos-cafe-context.md` ghi offline-first là hoãn sang mở rộng, và mục ngoài phạm vi của `docs/requirements.md` liệt kê offline-first cùng database cục bộ là chưa làm. FR-21 và NFR-05 cũng viết trên giả định online.

Change này chỉ dựng nền: lưu dữ liệu cục bộ và xếp hàng thao tác. Việc hòa giải xung đột và phần giao diện được tách riêng vì mỗi phần đủ lớn để làm độc lập.

## What Changes

- Thêm kho dữ liệu cục bộ trên thiết bị, giữ đủ dữ liệu để bán hàng khi mất mạng: thực đơn, sơ đồ bàn, nhân viên, quyền và các đơn đang mở.
- Thêm hàng đợi thao tác: khi mất mạng, thao tác ghi được lưu lại thay vì thất bại.
- Đọc dữ liệu ưu tiên từ kho cục bộ, đồng bộ ngầm khi có mạng.
- Gửi lại hàng đợi khi mạng trở lại, đúng thứ tự và không gửi trùng.
- Xác định rõ thao tác nào được phép làm khi ngoại tuyến và thao tác nào bắt buộc phải có mạng.
- Giữ nguyên ranh giới Ports and Adapters: tầng cục bộ là một adapter, không được rò rỉ vào domain và core.

## Capabilities

### New Capabilities

- `offline-data-layer`: kho dữ liệu cục bộ trên thiết bị, hàng đợi thao tác chờ gửi, và quy tắc xác định thao tác nào khả dụng khi ngoại tuyến.

### Modified Capabilities

- `multi-device-sync`: đổi hẳn tuyên bố chỉ hoạt động khi có mạng, và đổi mô hình đồng bộ.
- `order-management`: đổi hành vi khi gửi đơn lúc không có mạng.
- `payment`: đổi hành vi khi thanh toán lúc không có mạng, nếu thanh toán được phép làm ngoại tuyến.

## Impact

- Đây là thay đổi kiến trúc lớn. Nó chạm vào mọi adapter và toàn bộ cách ứng dụng lấy dữ liệu.
- Một số bất biến hiện đang được database bảo đảm sẽ không còn giữ được khi ngoại tuyến: số bill sinh theo thứ tự thanh toán, khóa lạc quan chống ghi đè, và việc chốt giá phía database lúc gửi đơn.
- Có thể phải thêm dependency mới cho kho dữ liệu cục bộ.
- Tăng đáng kể độ phức tạp của việc kiểm thử.
- Cập nhật `pos-cafe-context.md`, `docs/requirements.md` (FR-21, NFR-05, mục ngoài phạm vi), `docs/architecture.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Hòa giải xung đột khi đồng bộ. Việc đó thuộc `add-offline-sync-conflict-resolution`.
- Hiển thị trạng thái mạng và trạng thái đồng bộ cho người dùng. Việc đó thuộc `add-offline-status-ux`.
- Đồng bộ trực tiếp giữa các thiết bị trong quán mà không qua máy chủ.
- Làm việc ngoại tuyến cho các module quản trị.

## Phụ thuộc

- `expand-e2e-coverage`: rất nên có trước, vì change này viết lại cách toàn bộ ứng dụng lấy dữ liệu.

## Câu hỏi phải chốt trước khi làm

1. Đây là tính năng cần làm thật, hay chỉ cần phân tích thiết kế cho báo cáo? Phạm vi rất lớn và rủi ro cao, cần chốt trước khi bỏ công.
2. Nếu làm thật thì mục tiêu tối thiểu là gì: chỉ cần đọc được thực đơn và sơ đồ khi mất mạng, hay phải bán và thanh toán được đầy đủ?
3. Thanh toán có được phép làm ngoại tuyến không? Đây là câu hỏi khó nhất. Cho phép thì có nguy cơ hai máy cùng thu tiền một bàn; không cho phép thì tính năng ngoại tuyến mất phần lớn giá trị.
4. Số bill xử lý thế nào khi ngoại tuyến? Hiện số bill tăng theo thứ tự thanh toán và do database sinh. Ngoại tuyến thì thiết bị không biết số kế tiếp là bao nhiêu.
5. Dữ liệu cục bộ lưu ở đâu, và chấp nhận rủi ro gì? Dữ liệu bán hàng chưa gửi mà nằm trên trình duyệt thì xóa dữ liệu trình duyệt là mất tiền thật.
6. Giữ dữ liệu cục bộ bao lâu, và giới hạn dung lượng thế nào?
7. Có chấp nhận thêm dependency mới không?
8. Ngoại tuyến áp dụng cho toàn bộ ứng dụng hay chỉ cho luồng bán hàng? Các module quản trị có thể để nguyên yêu cầu có mạng.
9. Nhiều thiết bị cùng ngoại tuyến trong cùng một quán thì có cần thấy nhau không? Nếu có thì đây là bài toán khác hẳn và lớn hơn nhiều.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
