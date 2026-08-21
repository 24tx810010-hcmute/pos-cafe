# Cô lập dữ liệu giữa các cửa hàng

## Purpose

Bảo đảm dữ liệu của mỗi cửa hàng chỉ truy cập được bởi chính cửa hàng đó, để nhiều quán dùng chung một hệ thống mà không nhìn thấy dữ liệu của nhau. Truy vết: NFR-02.

## Requirements

### Requirement: Mọi bảng nghiệp vụ gắn với một cửa hàng

Mọi bảng dữ liệu nghiệp vụ SHALL mang định danh cửa hàng, và mọi truy vấn nghiệp vụ MUST bị giới hạn trong phạm vi một cửa hàng.

#### Scenario: Truy vấn dữ liệu của cửa hàng khác

- **WHEN** một phiên đã xác thực của cửa hàng A truy vấn dữ liệu thuộc cửa hàng B
- **THEN** database không trả về bản ghi nào của cửa hàng B

### Requirement: Cô lập enforce ở tầng database

Việc cô lập cửa hàng SHALL được enforce bằng chính sách bảo mật mức dòng phía database, đối chiếu danh tính đã xác thực của cửa hàng. Hệ thống MUST NOT dựa vào việc lọc phía client làm ranh giới bảo mật.

#### Scenario: Bỏ qua tầng ứng dụng

- **WHEN** một yêu cầu được gửi thẳng tới database bằng danh tính của cửa hàng A nhưng nhắm tới dữ liệu của cửa hàng B
- **THEN** chính sách phía database từ chối yêu cầu đó

### Requirement: Phạm vi hiện tại của mô hình cô lập

Ranh giới cô lập hiện SHALL ở mức cửa hàng, phục vụ nhiều quán hoặc nhiều tài khoản độc lập. Mô hình này MUST NOT được hiểu là tính năng quản lý chuỗi nhiều chi nhánh, và MUST NOT được hiểu là cô lập bảo mật giữa các nhân viên trong cùng một cửa hàng.

#### Scenario: Một chủ sở hữu nhiều quán

- **WHEN** một người sở hữu hai quán
- **THEN** hai quán là hai cửa hàng tách biệt với hai Store Key khác nhau, và hệ thống không cung cấp màn hình tổng hợp chung cho cả hai

#### Scenario: Nhân viên trong cùng cửa hàng

- **WHEN** hai nhân viên cùng một cửa hàng cùng đăng nhập
- **THEN** cả hai truy cập được cùng tập dữ liệu của cửa hàng, và khác biệt giữa họ chỉ đến từ quyền truy cập ở tầng ứng dụng chứ không phải từ chính sách phía database

### Requirement: Khóa cửa hàng ở tầng ứng dụng

Hệ thống SHALL hỗ trợ đánh dấu một cửa hàng ở trạng thái ngừng hoạt động để khóa truy cập ở tầng ứng dụng. Hệ thống MUST NOT tuyên bố có enforce trạng thái này ở tầng database.

#### Scenario: Cửa hàng bị đánh dấu ngừng hoạt động

- **WHEN** một cửa hàng bị đánh dấu ngừng hoạt động
- **THEN** ứng dụng chặn truy cập vào cửa hàng đó, trong khi chính sách phía database chưa kiểm tra trạng thái này
