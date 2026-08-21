# Màn hình quản lý khuyến mãi

## Why

Mã giảm giá, voucher và chương trình giờ vàng đều cần chỗ để tạo, sửa, bật tắt và theo dõi hiệu quả. Không có màn quản lý thì mọi chương trình phải tạo bằng thao tác trực tiếp vào database, điều này không chấp nhận được với người dùng thật.

Màn này cũng là nơi trả lời câu hỏi kinh doanh quan trọng: chương trình nào đang chạy, đã giảm bao nhiêu tiền, và có kéo thêm doanh thu hay không.

## What Changes

- Thêm một module quản lý khuyến mãi vào ứng dụng, hiển thị trong điều hướng theo quyền.
- Danh sách chương trình khuyến mãi với trạng thái đang chạy, đã hết hạn, đang tắt.
- Tạo và sửa mã giảm giá cùng điều kiện áp dụng.
- Phát hành và theo dõi voucher.
- Tạo và sửa chương trình giờ vàng cùng lịch áp dụng và phạm vi món.
- Bật tắt nhanh một chương trình mà không cần xóa.
- Thống kê sử dụng cho mỗi chương trình: số lần dùng, tổng tiền đã giảm, và doanh thu của các đơn có áp chương trình đó.

## Capabilities

### New Capabilities

- `promotion-management-ui`: các luồng thao tác của người quản lý để tạo, sửa, bật tắt và theo dõi chương trình khuyến mãi.

### Modified Capabilities

- `access-control`: bổ sung quyền truy cập module khuyến mãi và quyền tạo sửa chương trình.
- `reporting`: bổ sung số liệu hiệu quả khuyến mãi nếu thống kê được đặt trong báo cáo thay vì trong màn khuyến mãi.

## Impact

- Thêm module vào vỏ ứng dụng và điều hướng ở worktree `D:\Workspace\pos-cafe`.
- Bố cục điều hướng tiếp tục phình ra nếu cả module kho và module khuyến mãi cùng được thêm.
- Cập nhật `docs/screens.md`, `docs/features.md`.

## Ngoài phạm vi

- Cơ chế tính giảm giá và các nguồn khuyến mãi. Việc đó thuộc ba change còn lại của nhóm.
- Phân tích hiệu quả khuyến mãi chuyên sâu, ví dụ so sánh nhóm khách có và không dùng mã.
- Lập lịch tự động bật tắt chương trình theo chiến dịch.

## Phụ thuộc

- `add-discount-engine`: bắt buộc.
- `add-promo-codes-and-vouchers` và `add-happy-hour-pricing`: cần ít nhất một trong hai, vì màn quản lý phải có thứ để quản lý.

## Câu hỏi phải chốt trước khi làm

1. Gom tất cả loại khuyến mãi vào một màn duy nhất, hay tách màn theo loại? Gom vào một chỗ dễ tìm nhưng biểu mẫu sẽ phức tạp vì mỗi loại có tham số khác nhau.
2. Thống kê hiệu quả khuyến mãi đặt ở đâu: trong màn khuyến mãi, hay thêm một mục vào màn báo cáo vốn đã có bốn mục?
3. Ai được tạo và sửa chương trình khuyến mãi: chỉ quản lý, hay có vai trò riêng?
4. Sửa một chương trình đang chạy thì các đơn đã áp chương trình đó có bị ảnh hưởng không? Câu trả lời phải là không, vì đơn lưu bản chụp, nhưng cần xác nhận và cần cảnh báo rõ trên giao diện.
5. Xóa một chương trình đã có đơn sử dụng thì xử lý thế nào: chặn xóa, hay xóa mềm như cách trình soạn thực đơn đang làm?
6. Có cần xem trước tác dụng của chương trình trước khi bật không, ví dụ áp thử lên một đơn mẫu?
7. Điều hướng sắp xếp lại thế nào khi có thêm module kho và module khuyến mãi?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
