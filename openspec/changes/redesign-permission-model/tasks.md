# Công việc

Thứ tự bám theo Migration Plan trong `design.md`. Các nhóm 1 tới 3 không đổi hành vi quan sát được, nhóm 4 là bước phá vỡ tương thích.

## 1. Bảng tham chiếu và dữ liệu seed

- [ ] 1.1 Viết migration thêm bảng danh mục vai trò, danh mục quyền và bảng nối vai trò với quyền; xác minh bằng cách chạy migration trên database cục bộ và kiểm tra ba bảng tồn tại với khóa chính và khóa ngoại đúng
- [ ] 1.2 Seed sáu vai trò dựng sẵn và mười bốn quyền kèm cờ dành riêng chủ quán và nhóm module; xác minh số bản ghi khớp bảng trong delta spec `access-control`
- [ ] 1.3 Seed mặc định vai trò theo đúng bảng trong delta spec; xác minh bằng truy vấn đối chiếu từng ô của bảng đó
- [ ] 1.4 Viết migration thêm bảng nhật ký thay đổi quyền, chỉ ghi thêm; xác minh không tồn tại chính sách sửa hoặc xóa trên bảng đó
- [ ] 1.5 Thêm chính sách bảo mật mức dòng cho bốn bảng mới; xác minh phiên của một cửa hàng đọc được danh mục nhưng không ghi được, và không đọc được nhật ký của cửa hàng khác

## 2. Hàm và lời gọi phía database

- [ ] 2.1 Viết lại hàm kiểm tra quyền để tra bảng nối thay vì hard-code, đổi mức từ `immutable` sang `stable`; xác minh trước đó rằng hàm không được dùng trong chỉ mục hay cột sinh
- [ ] 2.2 Thêm lời gọi trả về danh sách quyền hiệu lực của một nhân viên; xác minh kết quả bằng truy vấn thủ công cho ít nhất một nhân viên có ghi đè cấp thêm và một nhân viên có ghi đè chặn
- [ ] 2.3 Viết kiểm thử đối chiếu khẳng định hàm mới trả về đúng kết quả như bảng hard-code cũ cho ba vai trò cũ; đây là cổng chặn trước khi sang nhóm 4
- [ ] 2.4 Chặn việc gán quyền dành riêng chủ quán ở tầng database; xác minh lời gọi cấp thêm quyền dành riêng cho vai trò khác bị từ chối
- [ ] 2.5 Ghi nhật ký trong lời gọi sửa vai trò và sửa ghi đè quyền; xác minh mỗi lần sửa sinh đúng một bản ghi nhật ký có đủ người thực hiện, nhân viên bị tác động, nội dung và thời điểm

## 3. Tầng domain, core và ports

- [ ] 3.1 Đổi kiểu mã vai trò và mã quyền trong `src/domain` sang dạng mở, thêm kiểu cho bản ghi danh mục và quyền hiệu lực; xác minh `tsc -b` pass
- [ ] 3.2 Viết hàm thuần tính quyền hiệu lực trong `src/core` nhận danh mục qua tham số; xác minh bằng unit test phủ ba trường hợp mặc định, cấp thêm và chặn thắng
- [ ] 3.3 Viết hàm thuần suy ra tập module hiển thị từ quyền hiệu lực; xác minh bằng unit test ảnh chụp tập module cho từng vai trò dựng sẵn
- [ ] 3.4 Viết unit test khẳng định mọi module trong ứng dụng có ít nhất một quyền ánh xạ tới; test này phải fail nếu thêm module mà quên khai báo nhóm quyền
- [ ] 3.5 Xóa hai bảng hằng số `rolePermissions` và `defaultRolePermissions` khỏi `src/core/guards.ts`; xác minh không còn chỗ nào import chúng
- [ ] 3.6 Bổ sung hợp đồng trong `src/ports` cho việc đọc danh mục, đọc quyền hiệu lực, nhận tín hiệu thay đổi quyền và ghi ghi đè; xác minh kiểm thử ranh giới kiến trúc vẫn pass

## 4. Chuyển đổi dữ liệu vai trò

- [ ] 4.1 Viết migration đổi cột vai trò của nhân viên từ enum sang chuỗi có khóa ngoại, kèm chuyển đổi dữ liệu theo quyết định số 6; xác minh bằng truy vấn trước và sau trên bản sao dữ liệu
- [ ] 4.2 Viết kiểm thử chuyển đổi phủ bốn trường hợp: cửa hàng một admin, cửa hàng nhiều admin, cửa hàng đã xóa bản ghi admin gốc, cửa hàng không còn admin nào
- [ ] 4.3 Xuất báo cáo chuyển đổi liệt kê cửa hàng và vai trò được gán, gồm các cửa hàng phải xử lý tay; xác minh báo cáo chạy được trên bản sao dữ liệu trước khi chạy thật

## 5. Adapter và luồng ứng dụng

- [ ] 5.1 Hiện thực đọc danh mục quyền và vai trò trong adapter Supabase; xác minh bằng kiểm thử adapter đối chiếu với dữ liệu seed
- [ ] 5.2 Hiện thực đọc quyền hiệu lực và nối vào luồng đăng nhập nhân viên; xác minh nhân viên đăng nhập nhận đúng danh sách quyền
- [ ] 5.3 Cập nhật màn quản lý nhân viên: chọn vai trò trong bộ mới, tách quyền chỉnh ghi đè khỏi quyền quản lý nhân viên; xác minh bằng kiểm thử thành phần cho vai trò quản lý không thấy phần chỉnh quyền
- [ ] 5.4 Hiện thực các bất biến của bản ghi chủ quán ở tầng nghiệp vụ và giao diện; xác minh bốn thao tác xóa, tạm khóa, đổi vai trò và đặt lại PIN đều bị chặn
- [ ] 5.5 Thêm hiển thị quyền hiệu lực của từng nhân viên, phân biệt mặc định và ghi đè; xác minh bằng kiểm thử thành phần
- [ ] 5.6 Cập nhật kiểm tra quyền ở các luồng quản trị thực đơn, sơ đồ, báo cáo, cài đặt và xóa dữ liệu; xác minh mỗi luồng từ chối khi thiếu quyền tương ứng

## 6. Điều hướng và hiển thị

- [ ] 6.1 Chuyển điều hướng sang suy ra từ quyền hiệu lực, bỏ bảng ánh xạ vai trò sang module; xác minh bằng kiểm thử ảnh chụp điều hướng cho từng vai trò
- [ ] 6.2 Viết thành phần bao dùng chung quyết định render theo quyền; xác minh bằng unit test cho hai nhánh có quyền và thiếu quyền
- [ ] 6.3 Thay các chỗ đang vô hiệu hóa nút vì thiếu quyền sang ẩn hẳn; xác minh không còn chỗ nào vô hiệu hóa vì lý do thiếu quyền
- [ ] 6.4 Rà soát và giữ nguyên các chỗ vô hiệu hóa vì lý do trạng thái nghiệp vụ; xác minh nút in lại hóa đơn của đơn đã hủy vẫn hiển thị ở trạng thái vô hiệu hóa

## 7. Lan truyền quyền theo thời gian thực

- [ ] 7.1 Thêm bảng nhật ký thay đổi quyền vào publication realtime; xác minh bảng nhân viên vẫn không nằm trong publication
- [ ] 7.2 Đăng ký kênh nhận tín hiệu lọc theo cửa hàng và tải lại quyền hiệu lực khi bản ghi nhắc tới nhân viên đang đăng nhập; xác minh bằng kiểm thử đa thiết bị rằng gỡ quyền ở máy này làm ẩn phần tử ở máy kia
- [ ] 7.3 Bảo đảm tải lại quyền khi kết nối trở lại sau khi mất mạng; xác minh bằng kịch bản ngắt và nối lại kết nối
- [ ] 7.4 Cập nhật cảnh báo khi tự thu hẹp quyền của chính mình; xác minh cảnh báo xuất hiện khi thu hẹp và không xuất hiện khi mở rộng

## 8. Kiểm thử

- [ ] 8.1 Viết kiểm thử đầu cuối cho vai trò phục vụ: tạo và sửa được đơn, không thu tiền được, không thấy lịch sử đơn
- [ ] 8.2 Viết kiểm thử đầu cuối cho vai trò kế toán: chỉ thấy báo cáo và lịch sử đơn, không thấy sơ đồ bàn
- [ ] 8.3 Viết kiểm thử đầu cuối cho việc cấp quyền quản trị thực đơn cho một thu ngân và thấy module xuất hiện
- [ ] 8.4 Viết kiểm thử gọi thẳng database khi thiếu quyền cho ít nhất một luồng vận hành và một luồng quản trị
- [ ] 8.5 Chạy toàn bộ bộ kiểm thử và production build; xác minh không có hồi quy so với baseline

## 9. Tài liệu nhánh docs

- [ ] 9.1 Cập nhật `docs/requirements.md` phần FR-04 theo mô hình quyền mới; xác minh bảng truy vết không còn nhắc tới hai trục quyền
- [ ] 9.2 Cập nhật `docs/features.md` phần vai trò và quyền, gồm bảng mười bốn quyền và sáu vai trò, và bỏ mục danh mục quyền chưa dùng đã được đưa vào hoặc loại hẳn
- [ ] 9.3 Cập nhật `docs/data-model.md` với bốn bảng mới và cột vai trò đã đổi kiểu
- [ ] 9.4 Cập nhật `docs/limitations.md`: bỏ mục ảnh chụp quyền cần đăng nhập lại, bổ sung quyết định thiết kế ẩn phần tử khi thiếu quyền
- [ ] 9.5 Cập nhật `pos-cafe-context.md` phần nghiệp vụ hiện hành về vai trò và quyền
- [ ] 9.6 Cập nhật `docs/testing.md` với các nhóm kiểm thử mới và ngày chạy baseline
