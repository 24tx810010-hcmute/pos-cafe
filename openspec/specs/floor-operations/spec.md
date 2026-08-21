# Vận hành sơ đồ bàn

## Purpose

Cho nhân viên nhìn thấy tình trạng thực tế của quán trên sơ đồ bàn trực quan theo khu, biết bàn nào đang trống và bàn nào đang phục vụ, để mở đơn đúng bàn. Truy vết: FR-06.

## Requirements

### Requirement: Xem sơ đồ bàn theo khu

Màn sơ đồ bàn SHALL hiển thị các bàn theo từng khu hoặc tầng, và SHALL tự động thu phóng sơ đồ vừa khung nhìn.

#### Scenario: Chuyển khu

- **WHEN** nhân viên chọn một khu khác trên thanh công cụ
- **THEN** sơ đồ hiển thị các bàn và vật trang trí thuộc khu đó

### Requirement: Biểu diễn trạng thái bàn

Mỗi bàn SHALL biểu diễn rõ trạng thái trống hoặc đang phục vụ. Bàn đang phục vụ SHALL hiển thị thêm số đơn và tổng tiền của đơn đang mở.

#### Scenario: Bàn đang phục vụ

- **WHEN** một bàn có đơn đang mở
- **THEN** bàn hiển thị trạng thái đang phục vụ kèm số đơn và tổng tiền hiện tại

#### Scenario: Lọc theo trạng thái

- **WHEN** nhân viên chọn bộ lọc trạng thái bàn
- **THEN** sơ đồ chỉ làm nổi bật các bàn khớp trạng thái đã chọn

### Requirement: Nền bàn và vật trang trí chỉ để hiển thị

Bàn SHALL hiển thị ảnh nền lấy từ thư viện dựng sẵn khi đã chọn mẫu, và dùng nền trắng khi chưa chọn. Vật trang trí MUST NOT có trạng thái phục vụ và MUST NOT nhận đơn.

#### Scenario: Bàn chưa chọn nền

- **WHEN** một bàn không có mẫu nền được gán
- **THEN** bàn hiển thị nền trắng mặc định, viền vẫn biểu diễn đúng trạng thái

#### Scenario: Bấm vào vật trang trí

- **WHEN** nhân viên bấm vào một vật trang trí trên sơ đồ
- **THEN** hệ thống không mở đơn hàng nào

### Requirement: Mở đơn tại bàn và làm mới thủ công

Nhân viên SHALL mở được đơn tại một bàn từ sơ đồ, và SHALL làm mới được dữ liệu sơ đồ cùng danh sách đơn đang mở từ thanh công cụ.

#### Scenario: Mở đơn tại bàn trống

- **WHEN** nhân viên bấm vào một bàn trống
- **THEN** hệ thống mở màn tạo đơn mới cho bàn đó

#### Scenario: Mở lại đơn đang phục vụ

- **WHEN** nhân viên bấm vào một bàn đang phục vụ
- **THEN** hệ thống mở đơn đang mở của bàn đó để chỉnh sửa hoặc thanh toán
