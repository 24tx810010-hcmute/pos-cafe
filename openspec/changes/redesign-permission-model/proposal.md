# Thiết kế lại mô hình phân quyền người dùng

## Why

Mô hình quyền hiện tại đủ cho phạm vi tiểu luận nhưng sẽ vỡ khi các tính năng mở rộng vào. Cụ thể: chỉ có 5 quyền hành động được enforce (`order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`), trong khi `docs/features.md` đã liệt kê sẵn một danh mục quyền chưa dùng gồm chuyển và gộp bàn, hoàn tiền, áp giảm giá, ghi đè giá, mở ngăn kéo tiền và các quyền ca làm việc. Vai trò là enum cứng gồm `admin`, `cashier` và `kitchen`, không tạo được vai trò tùy chỉnh. Quản trị thực đơn, sơ đồ, nhân viên, cài đặt và báo cáo vẫn chỉ chặn theo vai trò chứ chưa chỉnh được theo từng người. Ngoài ra client giữ ảnh chụp quyền tại thời điểm đăng nhập nên đổi quyền phải đăng nhập lại mới có hiệu lực đầy đủ trên máy đang mở.

Mỗi tính năng mở rộng phía sau đều sinh thêm quyền mới: tồn kho, khuyến mãi, chấm công, loyalty, nhiều cửa hàng. Nếu không thiết kế lại trước thì sẽ phải vá enum quyền nhiều lần.

Change này lật lại một phần quyết định FR-04 và mục vai trò tùy chỉnh trong phần ngoài phạm vi của `docs/requirements.md`.

## What Changes

- Thiết kế lại mô hình quyền để thêm quyền mới không phải sửa enum cứng ở nhiều nơi.
- Mở rộng phạm vi quyền hành động sang các module quản trị, thay vì chỉ chặn theo vai trò.
- Xem xét vai trò tùy chỉnh do chủ quán tự định nghĩa, thay cho enum ba vai trò cố định.
- Xử lý vấn đề ảnh chụp quyền tại thời điểm đăng nhập, để thay đổi quyền có hiệu lực mà không bắt đăng nhập lại.
- Thiết kế cách quyền mới của các tính năng mở rộng được khai báo và mặc định theo vai trò.
- Giữ nguyên nguyên tắc chốt quyền ở tầng nghiệp vụ và kiểm tra lại phía database.

## Capabilities

### New Capabilities

Chưa xác định. Phụ thuộc kết quả thảo luận: nếu có vai trò tùy chỉnh thì có thể tách thành một năng lực riêng cho việc quản trị vai trò.

### Modified Capabilities

- `access-control`: đổi cách định nghĩa vai trò và quyền, mở rộng bộ quyền hành động, đổi hành vi lan truyền thay đổi quyền tới thiết bị đang đăng nhập.
- `employee-management`: đổi giao diện gán vai trò và quyền cho nhân viên nếu có vai trò tùy chỉnh.

## Impact

- `src/core/guards.ts`, `src/domain`, `src/ports` và các adapter tương ứng ở worktree `D:\Workspace\pos-cafe`.
- Bảng `employees` và cấu trúc lưu ghi đè quyền; có thể cần bảng vai trò mới, kéo theo migration.
- Các lời gọi phía database đang kiểm tra quyền cần cập nhật theo mô hình mới.
- Ảnh hưởng tới mọi tính năng mở rộng phía sau, nên nên làm sớm.
- Cập nhật `docs/features.md`, `docs/requirements.md` (FR-04), `docs/data-model.md`, `pos-cafe-context.md`.

## Ngoài phạm vi

- Siết ranh giới bảo mật xuống tầng database cho từng nhân viên. Việc đó thuộc `enforce-permissions-at-database`.
- Nhật ký kiểm toán đầy đủ cho mọi thao tác.
- Đăng nhập bằng tài khoản riêng cho từng nhân viên thay cho mô hình Store Key kèm PIN.

## Phụ thuộc

- Không phụ thuộc change nào, nhưng nên làm trước nhóm tồn kho, khuyến mãi, chấm công và loyalty vì các nhóm đó đều sinh quyền mới.

## Câu hỏi phải chốt trước khi làm

1. Có thật sự cần vai trò tùy chỉnh không, hay chỉ cần giữ ba vai trò cố định và mở rộng bộ quyền ghi đè theo từng người? Vai trò tùy chỉnh mạnh hơn nhiều nhưng kéo theo màn quản trị vai trò và tăng đáng kể phạm vi.
2. Nếu có vai trò tùy chỉnh thì ai được tạo vai trò, và có giữ lại các vai trò dựng sẵn không xóa được không?
3. Danh mục quyền chưa dùng trong `docs/features.md` gồm chuyển và gộp bàn, hoàn tiền, áp giảm giá, ghi đè giá, mở ngăn kéo tiền, mở và chốt ca. Trong đó cái nào thực sự sẽ làm, cái nào bỏ hẳn? Không nên thiết kế cho quyền không bao giờ dùng.
4. Các module quản trị là thực đơn, sơ đồ, nhân viên, cài đặt và báo cáo có cần chỉnh quyền theo từng người không, hay giữ nguyên chặn theo vai trò là đủ?
5. Vấn đề ảnh chụp quyền xử lý theo hướng nào: đọc quyền trực tiếp mỗi lần kiểm tra, hay giữ ảnh chụp nhưng thêm cơ chế đẩy thông báo làm mới quyền tới thiết bị đang mở? Hướng thứ nhất đơn giản hơn nhưng tăng số lượt gọi.
6. Có chấp nhận đây là thay đổi phá vỡ tương thích không? Dữ liệu quyền ghi đè hiện có sẽ phải chuyển đổi sang cấu trúc mới.
7. Vai trò `kitchen` xử lý thế nào trong mô hình mới: giữ làm seam tương lai như hiện nay, bỏ hẳn, hay biến thành một vai trò tùy chỉnh mẫu?
8. Mức phân quyền có cần tính tới nhiều cửa hàng không? Nếu `add-multi-store-ownership` sẽ làm thì một người có thể có quyền khác nhau ở từng cửa hàng, và điều đó phải được tính vào thiết kế ngay từ đầu.

## Quyết định đã chốt

Chưa có. Ghi câu trả lời của người dùng vào mục này trước khi bắt đầu implement.
