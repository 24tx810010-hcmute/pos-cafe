# Thiết kế mô hình phân quyền mới

## Context

Động cơ và phạm vi xem `proposal.md`, phần Why và phần Quyết định đã chốt. Phần này chỉ nêu hiện trạng kỹ thuật cần thiết để giải thích cách làm.

Hiện trạng liên quan trực tiếp:

- `employees.role` là kiểu enum `employee_role` với ba giá trị `admin`, `cashier`, `kitchen`, khai báo từ migration đầu tiên.
- `employees.permission_overrides` là cột `jsonb` nullable, thêm ở migration 011, chứa hai danh sách `grants` và `denies`.
- Hàm `has_employee_permission(role, overrides, permission)` ở migration 012 hard-code bảng ánh xạ vai trò sang quyền, và chính comment trong migration đó ghi rõ phải giữ đồng bộ thủ công với `src/core/guards.ts`. Đây là nguồn lệch pha đã biết, không phải giả định.
- `src/core/guards.ts` giữ hai bảng hằng số: `rolePermissions` cho module và `defaultRolePermissions` cho quyền hành động.
- Publication realtime ở migration 004 gồm chín bảng nghiệp vụ và **không** có `employees`.
- `verify_employee_pin` trả về định danh, tên, vai trò và `permission_overrides` của nhân viên.

## Goals / Non-Goals

**Goals**

- Một nguồn sự thật duy nhất cho danh mục quyền và mặc định theo vai trò, dùng chung cho cả tầng nghiệp vụ lẫn tầng database.
- Giữ `domain`, `core` và `ports` không phụ thuộc Supabase, để kiểm thử ranh giới kiến trúc tiếp tục pass.
- Thay đổi quyền có hiệu lực trên thiết bị đang mở mà không tăng đáng kể số lượt gọi.

**Non-Goals** ở mức thiết kế

- Không dựng cơ chế cấu hình vai trò cho người dùng cuối, vì không làm vai trò tùy chỉnh.
- Không đưa danh mục quyền vào bộ nhớ đệm dài hạn phía client; danh mục là dữ liệu tham chiếu đọc một lần mỗi phiên.
- Không đụng tới cách xác minh PIN và cách thiết lập phiên nhân viên.

## Decisions

### 1. Vai trò và quyền là bảng tham chiếu toàn cục, không gắn theo cửa hàng

Ba bảng mới: danh mục vai trò, danh mục quyền, và bảng nối vai trò với quyền. Không có cột định danh cửa hàng.

Lý do: đã chốt không làm vai trò tùy chỉnh, nên mọi cửa hàng dùng chung đúng một bộ vai trò và một bộ mặc định. Gắn theo cửa hàng sẽ nhân bản cùng một tập dữ liệu cho mọi cửa hàng, kéo theo chính sách bảo mật mức dòng và việc seed cho từng cửa hàng mới, đổi lấy một khả năng chưa dùng.

Phương án đã cân nhắc: bảng theo từng cửa hàng ngay từ đầu để sau này mở vai trò tùy chỉnh không phải migration lần hai. Bỏ vì việc thêm cột định danh cửa hàng vào sau là thay đổi cộng thêm, không phải viết lại, nên chi phí hoãn thấp hơn chi phí làm sớm.

Bảng quyền mang cờ đánh dấu quyền dành riêng cho chủ quán và nhóm module mà quyền đó thuộc về. Nhờ cờ nằm trên bản ghi quyền, việc chặn gán quyền dành riêng và việc suy ra điều hướng đều đọc từ cùng một chỗ.

### 2. Cột vai trò của nhân viên đổi từ enum sang khóa ngoại dạng chuỗi

`employees.role` chuyển thành cột chuỗi tham chiếu danh mục vai trò.

Lý do: enum không tham chiếu được bảng, và không xóa được giá trị `admin` khỏi enum sau khi tách thành `owner` và `manager`. Giữ enum nghĩa là vĩnh viễn tồn tại một giá trị không hợp lệ mà mọi chỗ đọc phải phòng thủ.

Phương án đã cân nhắc: thêm giá trị mới vào enum bằng lệnh mở rộng kiểu và bỏ qua giá trị cũ. Bỏ vì để lại giá trị chết trong kiểu dữ liệu, và vẫn không giải quyết được việc vai trò phải là dữ liệu tra cứu được.

### 3. Quyền hiệu lực tính ở một chỗ, và tầng database đọc lại từ chính bảng đó

Hàm `has_employee_permission` được viết lại để tra bảng nối vai trò với quyền thay vì hard-code, nên nó chuyển từ `immutable` sang `stable`. Bổ sung một lời gọi trả về danh sách quyền hiệu lực của một nhân viên, dùng cho client sau khi đăng nhập và mỗi lần nhận tín hiệu làm mới.

Lý do: xóa hẳn nguồn lệch pha giữa bảng hằng số trong mã nguồn và bảng hard-code trong migration. Sau thay đổi này, sửa mặc định vai trò là sửa dữ liệu, cả hai tầng thấy ngay cùng một kết quả.

Cần kiểm tra khi làm: hàm ở mức `stable` không dùng được trong chỉ mục hay cột sinh. Hiện nó chỉ được gọi trong thân các lời gọi nghiệp vụ nên không vướng, nhưng phải xác nhận lại trước khi đổi.

### 4. Suy ra điều hướng bằng hàm thuần trong `core`

`core` nhận danh mục quyền kèm nhóm module như tham số và trả về tập module hiển thị. Không giữ bảng hằng số nào trong `core`.

Lý do: giữ `core` thuần và không phụ thuộc nguồn dữ liệu, nên kiểm thử ranh giới kiến trúc tiếp tục pass và các hàm này kiểm thử được bằng dữ liệu dựng sẵn. Bảng `rolePermissions` hiện tại bị xóa; `defaultRolePermissions` cũng bị xóa vì mặc định nay đến từ dữ liệu.

### 5. Tín hiệu thời gian thực phát trên bảng nhật ký, không phát trên bảng nhân viên

Thêm bảng nhật ký thay đổi quyền vào publication realtime. **Không** thêm bảng nhân viên.

Lý do: bảng nhân viên chứa giá trị băm PIN. Đưa bảng đó vào publication sẽ đẩy nguyên bản ghi tới client theo mỗi lần cập nhật, phá requirement của `employee-session` là client không đọc được giá trị băm PIN. Bảng nhật ký không chứa dữ liệu nhạy cảm, và nó được ghi đúng vào lúc quyền thay đổi, nên một bảng phục vụ cả hai mục đích là kiểm toán và tín hiệu.

Phương án đã cân nhắc: thêm một cột phiên bản quyền trên bảng cửa hàng rồi phát trên bảng cửa hàng. Bỏ vì `add-owner-account-and-store-provisioning` sẽ thêm cột bí mật đã mã hóa vào chính bảng đó, nên phát bảng cửa hàng sẽ thành rủi ro rò rỉ ngay sau đó.

Client lọc theo định danh cửa hàng như các kênh hiện có, và chỉ tải lại khi bản ghi nhật ký nhắc tới chính nhân viên đang đăng nhập.

### 6. Ẩn phần tử điều khiển làm ở một chỗ dùng chung

Một thành phần bao dùng chung quyết định có render hay không dựa trên quyền hiệu lực. Việc vô hiệu hóa vì trạng thái nghiệp vụ giữ nguyên cách làm hiện tại và không đi qua thành phần này.

Lý do: hai lý do ẩn và vô hiệu hóa dễ bị trộn lẫn khi rải rác ở từng màn. Tách thành một điểm duy nhất làm quy tắc kiểm thử được và tránh áp nhầm.

## Ranh giới Ports and Adapters

| Tầng | Nội dung |
| --- | --- |
| `src/domain` | Kiểu dữ liệu cho mã vai trò, mã quyền, bản ghi danh mục quyền và quyền hiệu lực. Không còn kiểu liệt kê cứng cho quyền. |
| `src/core` | Hàm thuần tính quyền hiệu lực từ mặc định vai trò cộng ghi đè, hàm suy ra tập module hiển thị, hàm kiểm tra quyền dành riêng chủ quán. Nhận danh mục qua tham số, không giữ hằng số. |
| `src/ports` | Hợp đồng đọc danh mục quyền và vai trò, đọc quyền hiệu lực của một nhân viên, đăng ký nhận tín hiệu thay đổi quyền, và ghi ghi đè quyền kèm nhật ký. |
| `src/adapters/supabase` | Hiện thực các hợp đồng trên bằng truy vấn bảng tham chiếu, lời gọi nghiệp vụ và kênh realtime. |
| `src/features` | Ghép các mảnh trên vào luồng màn hình; không tự tính quyền. |

Kiểm thử ranh giới kiến trúc hiện có phải tiếp tục pass, tức `domain`, `core` và `ports` không được import bất kỳ thứ gì thuộc adapter.

## Ảnh hưởng tới database

**Migration**

- Thêm ba bảng tham chiếu và seed dữ liệu vai trò, quyền, mặc định theo vai trò.
- Thêm bảng nhật ký thay đổi quyền.
- Đổi cột vai trò của nhân viên từ enum sang chuỗi có khóa ngoại, kèm chuyển đổi dữ liệu theo quyết định số 6 trong proposal: bản ghi admin đầu tiên của mỗi cửa hàng thành `owner`, các admin còn lại thành `manager`.
- Viết lại hàm kiểm tra quyền và bổ sung lời gọi trả về quyền hiệu lực.
- Rà các lời gọi nghiệp vụ đang kiểm tra quyền để dùng danh mục mới.

**Chính sách bảo mật mức dòng**

- Ba bảng tham chiếu cho phép đọc với phiên đã xác thực, không cho ghi từ ứng dụng.
- Bảng nhật ký chỉ cho ghi thêm qua lời gọi nghiệp vụ, không có chính sách sửa hoặc xóa, và chỉ đọc được trong phạm vi cửa hàng của mình.

**Realtime**

- Thêm bảng nhật ký thay đổi quyền vào publication. Không thêm bảng nhân viên.

## Risks / Trade-offs

- **Đổi kiểu cột vai trò làm vỡ mọi chỗ đang đọc vai trò** → Làm trong một migration có thứ tự rõ, và dựa vào biên dịch kiểm tra kiểu nghiêm ngặt cộng bộ kiểm thử hiện có để quét hết chỗ gọi trước khi triển khai.
- **Ánh xạ module sai làm nhân viên mất màn hình** → Thêm kiểm thử khẳng định mọi module có ít nhất một quyền ánh xạ tới, và kiểm thử ảnh chụp tập module hiển thị cho từng vai trò dựng sẵn.
- **Hàm kiểm tra quyền chuyển từ `immutable` sang `stable`** → Xác nhận trước rằng nó không được dùng trong chỉ mục hay cột sinh; nếu có thì phải tách phần bất biến ra trước.
- **Tín hiệu realtime trên bảng nhật ký làm tăng lưu lượng** → Lọc theo định danh cửa hàng như các kênh hiện có, và chỉ tải lại khi bản ghi nhắc tới nhân viên đang đăng nhập.
- **Chuyển đổi vai trò admin chọn nhầm người thành chủ quán** → Bốn trường hợp kiểm thử chuyển đổi đã nêu trong proposal, và xuất báo cáo chuyển đổi để rà tay trước khi chạy trên môi trường thật.
- **Ẩn hẳn phần tử làm khó hỗ trợ từ xa** → Bù bằng requirement hiển thị quyền hiệu lực của từng nhân viên trong màn quản lý nhân viên.

## Migration Plan

1. Thêm bảng tham chiếu và bảng nhật ký, seed dữ liệu. Chưa ai đọc, không ảnh hưởng hành vi.
2. Thêm lời gọi trả về quyền hiệu lực và viết lại hàm kiểm tra quyền để tra bảng. Kết quả trả về phải trùng khớp với hành vi cũ cho ba vai trò cũ, kiểm chứng bằng kiểm thử đối chiếu trước khi đi tiếp.
3. Đổi cột vai trò và chuyển đổi dữ liệu. Đây là bước phá vỡ tương thích.
4. Chuyển tầng nghiệp vụ và giao diện sang danh mục mới, xóa hai bảng hằng số trong `core`.
5. Bật lan truyền theo thời gian thực.
6. Cập nhật tài liệu nhánh `docs`.

**Rollback**: các bước 1 và 2 hoàn tác được bằng cách bỏ bảng và khôi phục hàm cũ. Từ bước 3 trở đi phải khôi phục từ bản sao lưu, nên bước 3 chỉ chạy sau khi bước 2 đã được kiểm chứng đối chiếu.

## Open Questions

- Nhật ký thay đổi quyền giữ bao lâu và có cần dọn định kỳ không. Câu này trả lời sau được vì nó không đổi spec, không đổi cách làm và không đổi danh sách công việc; mặc định trước mắt là giữ vô thời hạn vì lượng bản ghi rất nhỏ.
