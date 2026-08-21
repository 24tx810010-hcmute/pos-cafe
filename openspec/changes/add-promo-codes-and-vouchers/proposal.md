# Mã giảm giá và voucher

## Why

Quán cần công cụ khuyến mãi có thể phát ra ngoài và thu lại được: mã giảm giá in trên tờ rơi, mã gửi cho khách quen, voucher tặng kèm. Khác với giảm giá thủ công vốn phụ thuộc quyết định tại quầy, mã và voucher là chương trình có điều kiện và có giới hạn số lần dùng, nên cần được quản lý và kiểm soát chặt.

## What Changes

- Thêm khái niệm mã giảm giá: một chuỗi ký tự mà thu ngân hoặc khách nhập, gắn với một quy tắc giảm giá.
- Thêm điều kiện áp dụng cho mã: khoảng thời gian hiệu lực, giá trị đơn tối thiểu, giới hạn tổng số lần dùng, giới hạn số lần dùng cho mỗi khách.
- Thêm khái niệm voucher: mã dùng một lần, phát hành theo lô, theo dõi được trạng thái đã dùng hay chưa.
- Thêm luồng nhập mã tại màn đơn hàng hoặc màn thanh toán, kèm phản hồi rõ khi mã không hợp lệ hoặc không đủ điều kiện.
- Ghi nhận lần sử dụng của từng mã và voucher, truy được về đơn nào.

## Capabilities

### New Capabilities

- `promo-codes`: định nghĩa mã giảm giá và voucher, điều kiện áp dụng, giới hạn số lần dùng và ghi nhận lần sử dụng.

### Modified Capabilities

- `discount-engine`: bổ sung mã giảm giá và voucher làm nguồn sinh khoản giảm.
- `order-management`: bổ sung luồng nhập và gỡ mã trên đơn.
- `payment`: bổ sung luồng nhập mã tại màn thanh toán nếu được chốt là áp ở bước này.

## Impact

- Thêm bảng mã, bảng voucher và bảng ghi nhận lần dùng; kéo theo migration.
- Cần ràng buộc chống dùng vượt giới hạn khi nhiều thiết bị cùng áp một mã, tức là phải xử lý ở tầng database chứ không chỉ kiểm tra ở giao diện.
- Ảnh hưởng tới mẫu hóa đơn: hóa đơn phải in mã đã dùng.
- Cập nhật `docs/data-model.md`, `docs/features.md`.

## Ngoài phạm vi

- Cơ chế tính giảm giá. Việc đó thuộc `add-discount-engine`.
- Màn quản lý và tạo chương trình khuyến mãi. Việc đó thuộc `add-promotion-management-screen`.
- Gửi mã cho khách qua tin nhắn hoặc thư điện tử.
- Mã gắn với chương trình khách hàng thân thiết. Việc đó liên quan `add-loyalty-points`.

## Phụ thuộc

- `add-discount-engine`: bắt buộc.
- `add-customer-registry`: cần nếu muốn giới hạn số lần dùng theo từng khách, vì hiện hệ thống không có khái niệm khách hàng.

## Câu hỏi phải chốt trước khi làm

1. Mã được nhập ở bước nào: lúc tạo đơn, hay lúc thanh toán? Nhập lúc thanh toán hợp với thực tế hơn nhưng phải tính lại tổng ngay tại màn thanh toán.
2. Ai nhập mã: thu ngân gõ tay, hay khách tự đưa mã cho thu ngân? Có cần quét mã vạch hoặc mã QR không?
3. Voucher dùng một lần khác mã giảm giá dùng nhiều lần thế nào trong mô hình dữ liệu: hai khái niệm tách biệt, hay một khái niệm với tham số giới hạn số lần dùng?
4. Có cần giới hạn số lần dùng theo từng khách không? Nếu có thì bắt buộc phải có `add-customer-registry` trước, vì hiện đơn hàng không gắn khách.
5. Một đơn được áp tối đa bao nhiêu mã? Nếu nhiều hơn một thì quay lại câu hỏi cộng dồn khuyến mãi ở `add-discount-engine`.
6. Mã có phân biệt chữ hoa chữ thường không, và định dạng mã do người tạo tự đặt hay hệ thống sinh?
7. Khi đơn có mã bị hủy sau khi đã thanh toán thì lần dùng của mã có được hoàn lại không?
8. Có cần mã áp cho một nhóm món cụ thể không, ví dụ giảm 20 phần trăm cho nhóm cà phê, hay chỉ áp cho cả đơn?
9. Voucher phát hành theo lô thì in ra bằng cách nào, và có cần theo dõi lô nào phát cho ai không?

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
