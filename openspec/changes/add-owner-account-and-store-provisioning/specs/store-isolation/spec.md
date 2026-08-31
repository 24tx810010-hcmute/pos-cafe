# Cô lập dữ liệu giữa các cửa hàng

## MODIFIED Requirements

### Requirement: Cô lập enforce ở tầng database

Chính sách bảo mật mức dòng SHALL enforce ranh giới cửa hàng ở tầng database, không dựa vào tầng ứng dụng.

Chính sách SHALL có **hai nhánh cấp quyền truy cập**, bổ sung chứ không thay thế:

1. **Nhánh thiết bị đã ghép**, giữ nguyên như hiện tại: phiên của service account cửa hàng truy cập được dữ liệu của chính cửa hàng đó.
2. **Nhánh chủ sở hữu**, thêm mới: phiên của tài khoản chủ truy cập được các cửa hàng có trường chủ sở hữu trỏ tới chính tài khoản đó.

Việc thêm nhánh chủ MUST NOT thay đổi định danh của bản ghi cửa hàng và MUST NOT buộc các thiết bị đã ghép phải ghép lại.

Nhánh chủ SHALL giữ ở phạm vi hẹp, chỉ mở trên các bảng cần cho những việc thuộc mặt web của chủ. Hệ thống MUST NOT mở nhánh chủ trên toàn bộ các bảng nghiệp vụ.

#### Scenario: Bỏ qua tầng ứng dụng

- **WHEN** một yêu cầu được gửi thẳng tới database bằng danh tính của cửa hàng A nhưng nhắm tới dữ liệu của cửa hàng B
- **THEN** chính sách phía database từ chối yêu cầu đó

#### Scenario: Thiết bị của cửa hàng khác

- **WHEN** một phiên service account của cửa hàng A truy vấn dữ liệu của cửa hàng B
- **THEN** chính sách phía database trả về rỗng bất kể tầng ứng dụng gửi gì

#### Scenario: Chủ truy cập cửa hàng của mình

- **WHEN** một phiên tài khoản chủ truy vấn bản ghi cửa hàng mà mình sở hữu
- **THEN** chính sách phía database cho phép

#### Scenario: Chủ truy cập cửa hàng không thuộc mình

- **WHEN** một phiên tài khoản chủ truy vấn bản ghi cửa hàng thuộc chủ khác
- **THEN** chính sách phía database trả về rỗng

#### Scenario: Thiết bị đã ghép không bị ảnh hưởng bởi thay đổi này

- **WHEN** chính sách được bổ sung nhánh chủ sở hữu
- **THEN** các thiết bị đang ghép tiếp tục hoạt động bình thường và không phải nhập lại Store Key

### Requirement: Phạm vi hiện tại của mô hình cô lập

Ranh giới cô lập SHALL ở mức cửa hàng. Mô hình này MUST NOT được hiểu là tính năng quản lý chuỗi nhiều chi nhánh, và MUST NOT được hiểu là cô lập bảo mật giữa các nhân viên trong cùng một cửa hàng.

Một tài khoản chủ SHALL sở hữu được nhiều cửa hàng, và lược đồ dữ liệu MUST NOT chứa ràng buộc nào khiến điều đó bất khả thi. Việc sở hữu nhiều cửa hàng chỉ là quan hệ dữ liệu; hệ thống vẫn MUST NOT cung cấp thực đơn dùng chung, báo cáo hợp nhất hay màn chuyển đổi cửa hàng đang làm việc.

#### Scenario: Một chủ sở hữu nhiều quán

- **WHEN** một người sở hữu hai quán
- **THEN** hai quán là hai cửa hàng tách biệt với hai Store Key khác nhau, cùng trỏ về một tài khoản chủ, và hệ thống không cung cấp màn hình tổng hợp chung cho cả hai

#### Scenario: Lược đồ không khóa cứng ở một cửa hàng

- **WHEN** kiểm tra ràng buộc trên trường chủ sở hữu của bảng cửa hàng
- **THEN** không tồn tại ràng buộc duy nhất nào trên trường đó

#### Scenario: Nhân viên trong cùng cửa hàng

- **WHEN** hai nhân viên cùng một cửa hàng cùng đăng nhập
- **THEN** cả hai truy cập được cùng tập dữ liệu của cửa hàng, và khác biệt giữa họ chỉ đến từ quyền truy cập ở tầng ứng dụng chứ không phải từ chính sách phía database

## REMOVED Requirements

### Requirement: Khóa cửa hàng ở tầng ứng dụng

**Reason**: Requirement này phát biểu rõ rằng hệ thống không được tuyên bố có enforce trạng thái cửa hàng ở tầng database. Change này chuyển việc enforce xuống tầng database nên phát biểu cũ không còn đúng. Thay bằng requirement mới bên dưới.

**Migration**: Trường `is_active` dạng boolean được thay bằng trường trạng thái dạng enum với hai giá trị `active` và `suspended`. Cửa hàng đang có `is_active = true` chuyển thành `active`, còn lại chuyển thành `suspended`. Việc chặn ở tầng ứng dụng giữ nguyên và trở thành lớp thứ hai bên cạnh lớp database.

## ADDED Requirements

### Requirement: Khóa cửa hàng enforce ở tầng database

Bản ghi cửa hàng SHALL mang một trường trạng thái với hai giá trị `active` và `suspended`. Chính sách bảo mật mức dòng SHALL kiểm tra trạng thái này, và MUST chặn truy cập dữ liệu nghiệp vụ của cửa hàng ở trạng thái `suspended` ngay tại tầng database, không dừng ở tầng ứng dụng.

Chính sách SHALL có một ngoại lệ bắt buộc: tài khoản chủ vẫn **đọc được bản ghi cửa hàng và trạng thái** của cửa hàng mình sở hữu kể cả khi cửa hàng đang bị tạm ngưng. Không có ngoại lệ này thì giao diện chỉ báo lỗi chung chung và chủ không phân biệt được cửa hàng bị tạm ngưng với hệ thống hỏng.

Việc đổi trạng thái cửa hàng MUST được ghi vào nhật ký thao tác quản trị cửa hàng. Giao diện để nhà cung cấp đổi trạng thái nằm ngoài phạm vi change này.

#### Scenario: Thiết bị của cửa hàng bị tạm ngưng

- **WHEN** một thiết bị đã ghép của cửa hàng ở trạng thái `suspended` gọi thẳng vào database để đọc đơn hàng
- **THEN** chính sách phía database trả về rỗng, không phụ thuộc tầng ứng dụng

#### Scenario: Chủ vẫn thấy vì sao cửa hàng không vào được

- **WHEN** chủ của một cửa hàng đang bị tạm ngưng mở mặt web của mình
- **THEN** chủ đọc được bản ghi cửa hàng và thấy trạng thái `suspended`, trong khi dữ liệu nghiệp vụ vẫn bị chặn

#### Scenario: Đổi trạng thái để lại dấu vết

- **WHEN** trạng thái của một cửa hàng được đổi
- **THEN** nhật ký thao tác quản trị có một bản ghi cho cửa hàng đó kèm thời điểm và trạng thái mới
