## ADDED Requirements

### Requirement: Bộ vai trò dựng sẵn

Hệ thống SHALL cung cấp một bộ vai trò dựng sẵn, lưu ở tầng dữ liệu chứ không phải hằng số cứng trong mã nguồn: `owner`, `manager`, `cashier`, `waiter`, `accountant` và `kitchen`. Chủ quán MUST NOT tạo được vai trò mới ngoài bộ này. Mỗi cửa hàng MUST có đúng một nhân viên vai trò `owner`. Vai trò `kitchen` SHALL tiếp tục không xuất hiện trên giao diện cho tới khi có tính năng hàng đợi bếp.

#### Scenario: Chọn vai trò khi tạo nhân viên

- **WHEN** quản lý mở form tạo nhân viên
- **THEN** danh sách vai trò chọn được gồm `manager`, `cashier`, `waiter` và `accountant`, không có `owner` và không có `kitchen`

#### Scenario: Vai trò phục vụ không thu tiền được

- **WHEN** một nhân viên vai trò `waiter` mở một đơn đã sẵn sàng thanh toán
- **THEN** hệ thống không cho thực hiện thanh toán, trong khi vẫn cho tạo và sửa đơn tại bàn

#### Scenario: Vai trò kế toán chỉ đọc

- **WHEN** một nhân viên vai trò `accountant` đăng nhập
- **THEN** điều hướng chỉ hiển thị báo cáo và lịch sử đơn, không hiển thị sơ đồ bàn, và nhân viên đó không thực hiện được thao tác nghiệp vụ nào trên đơn hay thanh toán

### Requirement: Danh mục quyền hành động lưu ở tầng dữ liệu

Danh mục quyền hành động SHALL được lưu ở tầng dữ liệu, để thêm quyền mới không phải sửa kiểu dữ liệu cứng ở nhiều nơi. Hệ thống SHALL enforce mười bốn quyền: `floor.view`, `order.create`, `order.update`, `order.voidOpen`, `payment.take`, `orderHistory.view`, `order.voidPaid`, `menu.manage`, `floor.manage`, `employee.manage`, `employee.permission.edit`, `report.view`, `settings.manage` và `data.wipe`. Mỗi module trên điều hướng MUST có ít nhất một quyền trong danh mục ánh xạ tới, kể cả module chỉ xem. Danh mục MUST NOT khai báo quyền chưa có tính năng đứng sau.

Mặc định theo vai trò:

| Quyền | `owner` | `manager` | `cashier` | `waiter` | `accountant` |
| --- | :-: | :-: | :-: | :-: | :-: |
| `floor.view` | Có | Có | Có | Có | |
| `order.create` | Có | Có | Có | Có | |
| `order.update` | Có | Có | Có | Có | |
| `order.voidOpen` | Có | Có | Có | | |
| `payment.take` | Có | Có | Có | | |
| `orderHistory.view` | Có | Có | Có | | Có |
| `order.voidPaid` | Có | Có | | | |
| `menu.manage` | Có | Có | | | |
| `floor.manage` | Có | Có | | | |
| `employee.manage` | Có | Có | | | |
| `employee.permission.edit` | Có | | | | |
| `report.view` | Có | Có | | | Có |
| `settings.manage` | Có | | | | |
| `data.wipe` | Có | | | | |

Vai trò `kitchen` MUST NOT có quyền nào cho tới khi tính năng hàng đợi bếp được triển khai.

#### Scenario: Thu ngân hủy đơn đã thanh toán

- **WHEN** một nhân viên `cashier` không được cấp thêm quyền thử hủy một đơn đã thanh toán
- **THEN** hệ thống từ chối thao tác

#### Scenario: Quản lý không đổi được cài đặt cửa hàng

- **WHEN** một nhân viên `manager` thử đổi cài đặt cửa hàng
- **THEN** hệ thống từ chối thao tác, vì `settings.manage` không thuộc mặc định của vai trò đó

#### Scenario: Thêm quyền mới không phải đổi kiểu dữ liệu

- **WHEN** một quyền mới được thêm vào danh mục ở tầng dữ liệu
- **THEN** hệ thống kiểm tra được quyền đó mà không cần đổi kiểu dữ liệu quyền trong mã nguồn

### Requirement: Quyền dành riêng cho chủ quán

Một số quyền SHALL được đánh dấu là dành riêng cho vai trò `owner` và MUST NOT gán được cho vai trò khác hoặc cấp thêm cho từng nhân viên, kể cả khi chính chủ quán yêu cầu. Nhóm này gồm `data.wipe`. Việc đánh dấu SHALL là thuộc tính của bản ghi quyền, không phải kiểm tra rải rác ở tầng giao diện.

#### Scenario: Cấp quyền dành riêng cho một quản lý

- **WHEN** chủ quán thử cấp thêm `data.wipe` cho một nhân viên vai trò `manager`
- **THEN** hệ thống từ chối và nêu rõ đây là quyền chỉ chủ quán mới giữ

#### Scenario: Gọi thẳng database với quyền dành riêng

- **WHEN** một lời gọi xóa toàn bộ dữ liệu được gửi thẳng tới database bởi nhân viên không phải chủ quán
- **THEN** database từ chối thao tác

### Requirement: Điều hướng suy ra từ quyền hành động

Việc một module có xuất hiện trên điều hướng hay không SHALL được suy ra từ quyền hành động của nhân viên: module hiển thị khi và chỉ khi nhân viên có ít nhất một quyền thuộc nhóm quyền của module đó. Hệ thống MUST NOT giữ một bảng ánh xạ vai trò sang module tách rời khỏi bộ quyền.

#### Scenario: Cấp quyền quản trị thực đơn cho một thu ngân

- **WHEN** chủ quán cấp thêm `menu.manage` cho một nhân viên vai trò `cashier`
- **THEN** module quản trị thực đơn xuất hiện trên điều hướng của nhân viên đó, trong khi các thu ngân khác không thấy module này

#### Scenario: Gỡ quyền cuối cùng của một module

- **WHEN** chủ quán gỡ quyền cuối cùng mà một nhân viên có trong nhóm quyền của một module
- **THEN** module đó biến mất khỏi điều hướng của nhân viên đó

#### Scenario: Module chỉ xem cũng có quyền ánh xạ

- **WHEN** một nhân viên không có `floor.view` đăng nhập
- **THEN** module sơ đồ bàn không xuất hiện trên điều hướng, vì module chỉ xem cũng được suy ra từ quyền chứ không phải ngoại lệ luôn hiển thị

### Requirement: Ẩn phần tử điều khiển khi thiếu quyền

Khi nhân viên hiện hành không có quyền cho một thao tác hoặc một màn hình, giao diện SHALL không render phần tử điều khiển tương ứng, thay vì hiển thị nó ở trạng thái vô hiệu hóa. Quy tắc này SHALL chỉ áp dụng cho trường hợp thiếu quyền; phần tử bị vô hiệu hóa vì lý do trạng thái nghiệp vụ MUST vẫn hiển thị ở trạng thái vô hiệu hóa. Việc ẩn phần tử MUST NOT được coi là biện pháp bảo vệ.

#### Scenario: Thu ngân không có quyền hủy đơn đã thanh toán

- **WHEN** một nhân viên `cashier` không được cấp thêm quyền mở chi tiết một đơn đã thanh toán
- **THEN** nút hủy đơn không xuất hiện trên màn hình

#### Scenario: Vô hiệu hóa vì trạng thái nghiệp vụ vẫn hiển thị

- **WHEN** một nhân viên có quyền in lại hóa đơn mở một đơn đã hủy
- **THEN** nút in lại hóa đơn vẫn hiển thị ở trạng thái vô hiệu hóa, vì lý do là trạng thái của đơn chứ không phải thiếu quyền

### Requirement: Lan truyền thay đổi quyền theo thời gian thực

Khi vai trò hoặc quyền của một nhân viên thay đổi, mọi thiết bị đang đăng nhập bằng nhân viên đó SHALL nhận tín hiệu và tải lại quyền hiệu lực mà không cần khóa phiên và đăng nhập lại. Hệ thống MUST NOT yêu cầu đăng nhập lại như điều kiện để thay đổi quyền có hiệu lực trên giao diện.

#### Scenario: Gỡ quyền khi nhân viên đang đăng nhập ở máy khác

- **WHEN** chủ quán gỡ một quyền của nhân viên đang đăng nhập trên thiết bị khác
- **THEN** thiết bị đó cập nhật quyền hiệu lực và ẩn các phần tử điều khiển tương ứng mà không cần thao tác nào từ người dùng

#### Scenario: Mất kết nối khi quyền thay đổi

- **WHEN** một thiết bị mất kết nối tại thời điểm quyền thay đổi rồi kết nối lại
- **THEN** thiết bị đó tải lại quyền hiệu lực ngay khi kết nối lại

### Requirement: Nhật ký thay đổi quyền

Mọi thay đổi về vai trò và về quyền ghi đè của nhân viên SHALL được ghi vào nhật ký, tối thiểu gồm người thực hiện, nhân viên bị tác động, nội dung thay đổi và thời điểm. Nhật ký SHALL chỉ ghi thêm, MUST NOT sửa hoặc xóa được từ ứng dụng.

#### Scenario: Đổi vai trò của một nhân viên

- **WHEN** chủ quán đổi vai trò của một nhân viên từ `cashier` sang `manager`
- **THEN** nhật ký ghi lại người thực hiện, nhân viên bị tác động, vai trò cũ, vai trò mới và thời điểm

#### Scenario: Thử sửa nhật ký từ ứng dụng

- **WHEN** một lời gọi sửa hoặc xóa bản ghi nhật ký quyền được gửi từ ứng dụng
- **THEN** database từ chối thao tác

## MODIFIED Requirements

### Requirement: Ghi đè quyền theo từng nhân viên

Quyền hành động SHALL có thể ghi đè cho từng nhân viên bằng danh sách cấp thêm và danh sách chặn, nên hai nhân viên cùng vai trò vẫn có thể có quyền khác nhau. Quyền hiệu lực SHALL bằng mặc định theo vai trò hợp với danh sách cấp thêm, trừ đi danh sách chặn, trong đó danh sách chặn luôn thắng. Khi đổi vai trò của một nhân viên, các ghi đè MUST được đặt lại về mặc định của vai trò mới. Quyền dành riêng cho chủ quán MUST NOT xuất hiện trong danh sách cấp thêm của bất kỳ nhân viên nào không phải chủ quán.

#### Scenario: Cấp thêm quyền cho một thu ngân

- **WHEN** quản lý cấp quyền `order.voidPaid` cho một nhân viên `cashier` cụ thể
- **THEN** chỉ nhân viên đó hủy được đơn đã thanh toán, các thu ngân khác vẫn bị từ chối

#### Scenario: Lưu đúng mặc định vai trò

- **WHEN** quản lý chỉnh quyền của một nhân viên về đúng bộ mặc định của vai trò rồi lưu
- **THEN** hệ thống xóa các ghi đè của nhân viên đó thay vì lưu lại bộ trùng mặc định

#### Scenario: Chặn thắng cấp thêm

- **WHEN** một quyền vừa nằm trong danh sách cấp thêm vừa nằm trong danh sách chặn của cùng một nhân viên
- **THEN** quyền hiệu lực không bao gồm quyền đó

### Requirement: Chốt quyền ở luồng nghiệp vụ và guardrail phía database

Mọi luồng có quyền tương ứng trong danh mục SHALL kiểm tra quyền ở tầng nghiệp vụ, gồm tạo đơn, sửa đơn, hủy đơn mở, thanh toán, hủy đơn đã thanh toán, quản trị thực đơn, quản trị sơ đồ, quản lý nhân viên, chỉnh quyền nhân viên, xem báo cáo, đổi cài đặt cửa hàng và xóa toàn bộ dữ liệu. Các lời gọi database tương ứng MUST kiểm tra lại quyền hiệu lực đọc trực tiếp từ database. Hệ thống MUST NOT coi việc ẩn hoặc vô hiệu hóa phần tử điều khiển là biện pháp bảo vệ.

#### Scenario: Gọi thẳng vào database khi thiếu quyền

- **WHEN** một lời gọi thanh toán được gửi thẳng tới database bởi nhân viên không có quyền `payment.take`
- **THEN** database từ chối thao tác

#### Scenario: Gọi thẳng vào database cho thao tác quản trị

- **WHEN** một lời gọi sửa thực đơn được gửi thẳng tới database bởi nhân viên không có quyền `menu.manage`
- **THEN** database từ chối thao tác

## REMOVED Requirements

### Requirement: Hai trục kiểm soát truy cập độc lập

**Reason**: Trục quyền module theo vai trò bị bỏ. Giữ hai trục tách rời khiến quyền vào các module quản trị không chỉnh được theo từng nhân viên, và tạo ra hai nguồn sự thật phải giữ đồng bộ bằng tay.

**Migration**: Điều hướng nay suy ra từ quyền hành động, theo requirement "Điều hướng suy ra từ quyền hành động". Bảng ánh xạ vai trò sang module bị xóa; mỗi module được gắn với một nhóm quyền, và module hiển thị khi nhân viên có ít nhất một quyền trong nhóm đó.

### Requirement: Bộ quyền hành động được enforce

**Reason**: Bộ năm quyền cố định khai báo bằng kiểu dữ liệu cứng không mở rộng được, và mặc định theo vai trò dựa trên bộ ba vai trò cũ đã bị thay. Quy tắc vô hiệu hóa nút sớm cũng không còn đúng sau khi giao diện chuyển sang ẩn hẳn phần tử khi thiếu quyền.

**Migration**: Thay bằng requirement "Danh mục quyền hành động lưu ở tầng dữ liệu", mở rộng từ năm lên mười hai quyền và đặt mặc định theo bộ vai trò mới. Phần hành vi giao diện chuyển sang requirement "Ẩn phần tử điều khiển khi thiếu quyền". Dữ liệu ghi đè hiện có phải được chuyển đổi sang danh mục quyền mới.

### Requirement: Giới hạn đã biết của mô hình quyền hiện tại

**Reason**: Ảnh chụp quyền tại thời điểm đăng nhập không còn là hành vi của hệ thống, nên phát biểu về giới hạn này không còn đúng.

**Migration**: Thay bằng requirement "Lan truyền thay đổi quyền theo thời gian thực". Thiết bị đang đăng nhập nhận tín hiệu và tải lại quyền hiệu lực, không còn phải khóa phiên và đăng nhập lại.
