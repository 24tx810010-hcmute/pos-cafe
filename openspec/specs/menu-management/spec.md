# Quản lý thực đơn

## Purpose

Cho quản lý dựng và duy trì thực đơn của quán gồm danh mục, món, ảnh món và thư viện nhóm tùy chọn dùng chung, với mô hình lưu quan hệ và cơ chế lưu theo tập thay đổi. Truy vết: FR-16.

## Requirements

### Requirement: Quản lý danh mục và món

Trình soạn thực đơn SHALL cho tạo, sửa và xóa danh mục và món. Mỗi món SHALL có tên, giá, danh mục và trạng thái còn bán hay hết hàng.

#### Scenario: Đánh dấu món hết hàng

- **WHEN** quản lý đặt một món sang trạng thái hết hàng
- **THEN** thẻ món ở màn bán hàng hiển thị lớp phủ đã bán hết

#### Scenario: Đổi thứ tự món trong danh mục

- **WHEN** quản lý bật chế độ đổi vị trí, chọn một món gốc rồi bấm một món khác cùng danh mục
- **THEN** hai món hoán đổi vị trí và chế độ đổi vị trí tự tắt

### Requirement: Ảnh món

Hệ thống SHALL cho tải lên ảnh món ở định dạng JPG, PNG hoặc WebP. Hệ thống MUST chặn tệp lớn hơn 5MB trước khi lưu. Món chưa có ảnh MUST hiển thị biểu tượng thay thế ở màn bán hàng.

#### Scenario: Tải ảnh vượt dung lượng

- **WHEN** quản lý chọn một tệp ảnh lớn hơn 5MB
- **THEN** hệ thống cảnh báo và không lưu tệp đó

#### Scenario: Món chưa có ảnh

- **WHEN** một món chưa được gán ảnh
- **THEN** màn bán hàng hiển thị biểu tượng thay thế thay vì ảnh trống

### Requirement: Thư viện nhóm tùy chọn dùng chung

Nhóm tùy chọn SHALL được quản lý tập trung một nơi gồm tên, kiểu chọn-một hay chọn-nhiều, cờ bắt buộc và danh sách giá trị kèm giá. Một nhóm SHALL gắn được vào nhiều món, và một món SHALL gắn được nhiều nhóm.

#### Scenario: Gắn nhóm vào món

- **WHEN** quản lý tick một nhóm tùy chọn trong bảng chi tiết món
- **THEN** hệ thống tạo liên kết giữa món và nhóm đó

#### Scenario: Sửa nhóm đang dùng ở nhiều món

- **WHEN** quản lý sửa giá một giá trị trong nhóm đang gắn với nhiều món
- **THEN** thay đổi có hiệu lực với mọi món đang gắn nhóm đó

### Requirement: Lưu theo tập thay đổi và xóa mềm

Trình soạn thực đơn SHALL sửa trên trạng thái cục bộ và chỉ ghi xuống database khi người dùng bấm lưu, dưới dạng tập thay đổi gồm mục tạo mới, cập nhật và xóa. Hệ thống MUST NOT xóa cứng dữ liệu do trình soạn thảo quản lý.

#### Scenario: Sửa rồi rời màn không lưu

- **WHEN** quản lý sửa thực đơn rồi rời màn mà chưa bấm lưu
- **THEN** hệ thống yêu cầu xác nhận và dữ liệu trên database không đổi

#### Scenario: Xóa một món

- **WHEN** quản lý xóa một món và lưu
- **THEN** món được đánh dấu đã xóa thay vì bị xóa cứng, và các đơn cũ chứa món đó vẫn hiển thị đúng bản chụp
