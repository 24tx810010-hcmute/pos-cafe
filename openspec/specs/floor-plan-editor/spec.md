# Trình soạn sơ đồ mặt bằng

## Purpose

Cho quản lý dựng sơ đồ mặt bằng trực quan của quán gồm khu, bàn và vật trang trí, đặt vị trí bằng thao tác kéo thả, và chọn ảnh nền bàn cùng ảnh trang trí từ thư viện dựng sẵn. Truy vết: FR-17, FR-18.

## Requirements

### Requirement: Quản lý khu và bàn

Trình soạn sơ đồ SHALL cho tạo, sửa và xóa mềm khu và bàn. Mỗi bàn SHALL giữ được tên, số chỗ, vị trí và cách bố trí trong khu của nó.

#### Scenario: Xóa một bàn

- **WHEN** quản lý xóa một bàn và lưu
- **THEN** bàn được đánh dấu đã xóa thay vì bị xóa cứng

#### Scenario: Nhãn bàn trên canvas

- **WHEN** quản lý xem một bàn trên canvas của trình soạn thảo
- **THEN** canvas hiển thị tên bàn trực tiếp trên nền bàn, không hiển thị số chỗ, trong khi số chỗ vẫn sửa được ở bảng thuộc tính

### Requirement: Vật trang trí chỉ để hiển thị

Trình soạn sơ đồ SHALL cho tạo, sửa và xóa mềm vật trang trí. Vật trang trí MUST NOT có trạng thái phục vụ và MUST NOT nhận đơn.

#### Scenario: Thêm vật trang trí

- **WHEN** quản lý thêm một vật trang trí vào khu
- **THEN** vật đó hiển thị trên sơ đồ ở cả trình soạn thảo và màn vận hành, và không có trạng thái bàn

### Requirement: Thư viện ảnh dựng sẵn

Hệ thống SHALL cung cấp thư viện dựng sẵn gồm mẫu tường và ảnh trang trí phân theo nhóm, cùng thư viện ảnh nền bàn. Bàn mới MUST khởi tạo với nền trắng. Database MUST chỉ lưu khóa tham chiếu tới ảnh, không lưu chính tệp ảnh.

#### Scenario: Chọn nền cho bàn

- **WHEN** quản lý chọn một ảnh nền cho bàn trong bảng thuộc tính
- **THEN** canvas hiển thị ngay nền đó và nền được lưu theo bàn khi bấm lưu

#### Scenario: Khóa ảnh không còn trong thư viện

- **WHEN** một bàn hoặc vật trang trí tham chiếu tới khóa ảnh không khớp thư viện hiện tại
- **THEN** hệ thống hiển thị ảnh thay thế thay vì ảnh hỏng, nền bàn quay về trắng và vật trang trí hiển thị nhãn thay thế

### Requirement: Thao tác trực tiếp trên canvas

Khi chọn một đối tượng trên sơ đồ, hệ thống SHALL hiển thị tay cầm để xoay và thay đổi kích thước. Tay cầm MUST luôn nằm ngang bên dưới đối tượng và MUST NOT xoay theo đối tượng. Tay cầm MUST bị ẩn với đối tượng đã xóa hoặc đang khóa.

#### Scenario: Chọn vật trang trí đang khóa

- **WHEN** quản lý chọn một vật trang trí đang ở trạng thái khóa
- **THEN** hệ thống không hiển thị tay cầm xoay và thay đổi kích thước

### Requirement: Lưu sơ đồ không ảnh hưởng trạng thái bàn

Việc lưu sơ đồ SHALL ghi tập thay đổi của khu, bàn và vật trang trí, và MUST NOT ghi đè trạng thái phục vụ hiện tại của bàn.

#### Scenario: Lưu sơ đồ trong lúc có bàn đang phục vụ

- **WHEN** quản lý lưu sơ đồ trong lúc một số bàn đang có đơn mở
- **THEN** các bàn đó vẫn giữ nguyên trạng thái đang phục vụ và đơn của chúng không bị ảnh hưởng
