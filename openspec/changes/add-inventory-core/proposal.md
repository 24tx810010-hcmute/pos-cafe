# Xây dựng mô hình tồn kho cơ bản

## Why

Hệ thống hiện không biết gì về nguyên vật liệu. Trạng thái hết hàng của một món là một cờ do quản lý bật tay trong trình soạn thực đơn, không liên quan tới lượng nguyên liệu còn lại. Hệ quả là quán không biết còn bao nhiêu sữa, bao nhiêu cà phê, không biết khi nào phải nhập thêm, và không phát hiện được thất thoát. Quản lý kho nằm trong phần ngoài phạm vi của `docs/requirements.md` và giờ được đưa vào làm hướng mở rộng.

Change này chỉ dựng nền: khái niệm nguyên liệu, đơn vị tính, tồn hiện tại và lịch sử biến động. Việc trừ tồn theo đơn bán và màn hình quản lý được tách riêng.

## What Changes

- Thêm khái niệm nguyên vật liệu với tên, đơn vị tính và phân nhóm.
- Thêm khái niệm tồn hiện tại của mỗi nguyên liệu trong một cửa hàng.
- Thêm sổ ghi biến động tồn, để mọi thay đổi số lượng đều truy được nguồn gốc thay vì chỉ ghi đè con số.
- Thêm các loại biến động cơ bản: nhập kho, xuất hủy, điều chỉnh sau kiểm kê.
- Thêm ngưỡng tồn tối thiểu cho mỗi nguyên liệu, làm cơ sở cảnh báo sắp hết.
- Thêm quyền thao tác kho vào mô hình phân quyền.

## Capabilities

### New Capabilities

- `inventory-core`: khái niệm nguyên vật liệu, tồn hiện tại, sổ biến động tồn và ngưỡng cảnh báo. Đây là nguồn sự thật về số lượng nguyên liệu trong một cửa hàng.

### Modified Capabilities

- `access-control`: bổ sung quyền thao tác kho.

## Impact

- Bảng mới cho nguyên liệu, tồn và sổ biến động; kéo theo migration và chính sách bảo mật mức dòng theo cửa hàng.
- Thêm cổng và adapter mới theo kiến trúc Ports and Adapters ở worktree `D:\Workspace\pos-cafe`.
- Tăng phạm vi seed demo và dữ liệu kiểm thử.
- Cập nhật `docs/data-model.md`, `docs/features.md`, `docs/requirements.md`, `docs/limitations.md`.

## Ngoài phạm vi

- Trừ tồn tự động khi bán hàng. Việc đó thuộc `add-recipe-based-stock-deduction`.
- Màn hình quản lý kho. Việc đó thuộc `add-inventory-management-screen`.
- Quản lý nhà cung cấp, đơn đặt hàng nhập, công nợ và giá vốn.
- Quản lý kho nhiều địa điểm.

## Phụ thuộc

- `redesign-permission-model`: nên chốt mô hình quyền trước để quyền kho khai báo đúng cách ngay từ đầu.

## Câu hỏi phải chốt trước khi làm

1. Mục tiêu thật của tính năng kho là gì: biết còn bao nhiêu để nhập hàng đúng lúc, hay tính giá vốn và lợi nhuận? Hai mục tiêu này dẫn tới mô hình dữ liệu khác nhau, mục tiêu thứ hai cần theo dõi giá nhập theo lô.
2. Đơn vị tính xử lý thế nào? Có cần quy đổi giữa đơn vị mua và đơn vị dùng không, ví dụ mua theo thùng nhưng dùng theo lon, mua theo kilôgam nhưng dùng theo gam? Nếu có thì phải thiết kế hệ đơn vị ngay từ đầu.
3. Tồn có được phép âm không? Cho phép âm thì tránh chặn bán hàng khi dữ liệu chưa khớp, nhưng làm số liệu kho mất tin cậy.
4. Có cần theo dõi hạn sử dụng và lô hàng không? Quán cà phê có sữa và đồ tươi nên đây là câu hỏi thật, nhưng nó làm mô hình phức tạp hơn nhiều.
5. Có cần giá vốn không? Nếu có thì tính theo phương pháp nào, và số liệu này có vào báo cáo không?
6. Nguyên liệu và món trong thực đơn là hai thứ tách biệt hoàn toàn, hay có món bán thẳng như hàng hóa đóng gói vừa là món vừa là nguyên liệu? Ví dụ một chai nước suối bán nguyên chai.
7. Ai được thao tác kho: chỉ quản lý, hay thu ngân cũng được ghi nhận xuất hủy?
8. Quy mô dự kiến bao nhiêu nguyên liệu và bao nhiêu biến động mỗi ngày? Con số này quyết định có cần bảng tổng hợp tồn riêng hay tính từ sổ biến động là đủ.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
