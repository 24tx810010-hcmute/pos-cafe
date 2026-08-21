# Màn hình quản lý kho

## Why

Mô hình tồn kho và cơ chế trừ tồn tự động không dùng được nếu quản lý không có chỗ để nhập hàng, kiểm kê và xem tồn. Đây là màn hình vận hành hàng ngày của người quản lý quán, và cũng là nơi số liệu kho được sửa cho khớp thực tế.

## What Changes

- Thêm một module quản lý kho vào ứng dụng, hiển thị trong điều hướng theo quyền.
- Màn danh sách tồn: xem tồn hiện tại của mọi nguyên liệu, lọc và tìm kiếm, làm nổi bật nguyên liệu dưới ngưỡng tối thiểu.
- Chức năng nhập kho: ghi nhận lượng nhập cho một hoặc nhiều nguyên liệu trong một lần.
- Chức năng xuất hủy: ghi nhận lượng hỏng, đổ bỏ, kèm lý do.
- Chức năng kiểm kê: nhập số đếm thực tế, hệ thống tính chênh lệch và sinh biến động điều chỉnh.
- Màn lịch sử biến động: xem mọi thay đổi tồn theo thời gian, lọc theo nguyên liệu và loại biến động, truy ngược về đơn hàng khi biến động do bán.
- Quản lý danh mục nguyên liệu: tạo, sửa, ngừng sử dụng, đặt ngưỡng tối thiểu.

## Capabilities

### New Capabilities

- `inventory-management-ui`: các luồng thao tác kho của người dùng gồm xem tồn, nhập kho, xuất hủy, kiểm kê và tra cứu lịch sử biến động.

### Modified Capabilities

- `access-control`: bổ sung quyền truy cập module kho, tách biệt với quyền thao tác kho.

## Impact

- Thêm module vào vỏ ứng dụng và điều hướng ở worktree `D:\Workspace\pos-cafe`.
- Dùng lại các thành phần giao diện dùng chung hiện có gồm ngăn kéo toàn màn hình và hộp thoại chặn toàn ứng dụng.
- Ảnh hưởng tới bố cục điều hướng vốn đang có sáu mục.
- Cập nhật `docs/screens.md`, `docs/features.md`.

## Ngoài phạm vi

- Mô hình dữ liệu kho. Việc đó thuộc `add-inventory-core`.
- Trừ tồn tự động. Việc đó thuộc `add-recipe-based-stock-deduction`.
- Báo cáo kho chuyên sâu và phân tích xu hướng tiêu hao.
- Đặt hàng nhà cung cấp.

## Phụ thuộc

- `add-inventory-core`: bắt buộc.
- `add-recipe-based-stock-deduction`: không bắt buộc, nhưng màn lịch sử biến động chỉ đầy đủ khi đã có biến động do bán hàng.

## Câu hỏi phải chốt trước khi làm

1. Người dùng chính của màn này là ai: chỉ quản lý, hay cả nhân viên pha chế ghi nhận xuất hủy trong ca?
2. Thao tác nào cần làm nhanh trên máy tính bảng trong lúc quán đang đông, và thao tác nào chấp nhận làm chậm trên máy tính lúc cuối ngày? Câu trả lời quyết định bố cục màn hình.
3. Kiểm kê làm theo toàn bộ kho một lần, hay theo từng nhóm nguyên liệu? Kiểm kê toàn bộ chính xác hơn nhưng mất thời gian nên ít khi được làm.
4. Nhập kho có cần ghi giá nhập và nhà cung cấp không? Nếu có thì phạm vi tăng lên đáng kể và chạm vào câu hỏi giá vốn ở `add-inventory-core`.
5. Chênh lệch khi kiểm kê có cần bước duyệt của người khác không, hay người kiểm kê tự xác nhận là xong?
6. Điều hướng hiện có sáu mục. Thêm module kho thì đặt ở đâu, và có cần gom nhóm lại các mục quản trị không?
7. Cảnh báo sắp hết hàng hiển thị ở đâu ngoài màn kho? Có cần hiện trên màn bán hàng để thu ngân biết không?
8. Có cần xuất dữ liệu kho ra tệp không? Lưu ý nút xuất báo cáo hiện tại đang bị vô hiệu hóa vì chưa hỗ trợ.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
