# Tài khoản chủ cửa hàng

## ADDED Requirements

### Requirement: Tài khoản chủ dùng email thật, xác thực bằng mã một lần, không có mật khẩu

Hệ thống SHALL cung cấp một loại danh tính riêng gọi là tài khoản chủ, định danh bằng một địa chỉ email thật đã xác thực. Tài khoản chủ MUST NOT có mật khẩu. Việc đăng ký lần đầu và đăng nhập các lần sau SHALL dùng chung một luồng: nhập email, nhận mã một lần sáu chữ số qua email, nhập mã. Tài khoản SHALL được tạo ở lần nhập đúng mã đầu tiên của một email chưa từng có tài khoản.

Mã một lần SHALL hết hạn sau 10 phút. Hệ thống SHALL hủy mã sau 5 lần nhập sai và bắt người dùng yêu cầu mã mới.

Danh tính này SHALL tách biệt với service account của cửa hàng và với nhân viên trong cửa hàng. Service account MUST tiếp tục xác thực bằng phần bí mật trong Store Key, và nhân viên MUST tiếp tục xác thực bằng PIN.

#### Scenario: Đăng ký lần đầu

- **WHEN** một người nhập email chưa từng có tài khoản chủ và nhập đúng mã một lần vừa nhận
- **THEN** hệ thống tạo tài khoản chủ cho email đó, đánh dấu email đã xác thực, và mở phiên đăng nhập

#### Scenario: Đăng nhập các lần sau

- **WHEN** một người nhập email đã có tài khoản chủ và nhập đúng mã một lần vừa nhận
- **THEN** hệ thống mở phiên đăng nhập cho tài khoản đó và không tạo tài khoản mới

#### Scenario: Mã hết hạn

- **WHEN** người dùng nhập một mã đã được gửi quá 10 phút trước
- **THEN** hệ thống từ chối, nêu rõ mã đã hết hạn, và cho phép yêu cầu mã mới

#### Scenario: Nhập sai quá số lần cho phép

- **WHEN** người dùng nhập sai mã 5 lần cho cùng một mã
- **THEN** hệ thống hủy mã đó, và mọi lần nhập tiếp theo với mã đó bị từ chối kể cả khi gõ đúng

#### Scenario: Không có đường đăng nhập thay thế

- **WHEN** người dùng tìm cách đăng nhập tài khoản chủ mà không qua mã một lần
- **THEN** hệ thống không cung cấp đường nào khác, và không tồn tại luồng đặt hoặc khôi phục mật khẩu cho tài khoản chủ

### Requirement: Chống dò email và chống gửi mã dồn dập

Hệ thống SHALL giới hạn tần suất gửi mã một lần ở mức 3 lần mỗi 15 phút và 10 lần mỗi ngày tính theo địa chỉ email, đồng thời 10 lần mỗi giờ tính theo địa chỉ mạng của người gọi. Các giới hạn này MUST được enforce ở phía server.

Phản hồi của điểm cuối gửi mã SHALL giống hệt nhau bất kể email có tồn tại tài khoản chủ hay không. Hệ thống MUST NOT tiết lộ qua nội dung phản hồi, mã trạng thái hay thời gian phản hồi rằng một email đã có tài khoản.

#### Scenario: Phản hồi không phân biệt email đã tồn tại

- **WHEN** một người gửi yêu cầu mã cho một email chưa từng đăng ký và cho một email đã đăng ký
- **THEN** hai phản hồi giống nhau về nội dung và mã trạng thái

#### Scenario: Vượt giới hạn theo email

- **WHEN** một email đã được gửi mã 3 lần trong 15 phút và có yêu cầu thứ tư
- **THEN** hệ thống không gửi thêm email nào và trả về cùng dạng phản hồi chung chung

#### Scenario: Vượt giới hạn theo địa chỉ mạng

- **WHEN** một địa chỉ mạng gửi yêu cầu mã cho nhiều email khác nhau vượt 10 lần trong một giờ
- **THEN** hệ thống từ chối các yêu cầu tiếp theo từ địa chỉ đó cho tới khi hết cửa sổ

### Requirement: Phiên đăng nhập của chủ có hạn

Phiên đăng nhập của tài khoản chủ SHALL hết hạn sau 7 ngày kể từ lần sử dụng gần nhất, và SHALL được gia hạn mỗi lần chủ thao tác. Hệ thống SHALL cung cấp thao tác đăng xuất chủ động.

#### Scenario: Phiên bỏ ngỏ quá lâu

- **WHEN** một phiên chủ không được dùng trong hơn 7 ngày
- **THEN** phiên hết hiệu lực và lần truy cập tiếp theo phải đăng nhập lại bằng mã một lần

### Requirement: Quan hệ giữa chủ và cửa hàng, kèm hạn mức

Mỗi cửa hàng SHALL thuộc về đúng một tài khoản chủ, và trường chủ sở hữu trên bản ghi cửa hàng MUST là bắt buộc. Một tài khoản chủ SHALL sở hữu được nhiều cửa hàng; hệ thống MUST NOT đặt ràng buộc duy nhất khiến một chủ chỉ giữ được một cửa hàng.

Hệ thống SHALL giới hạn mỗi tài khoản chủ tối đa 5 cửa hàng và tối đa 3 lần tạo cửa hàng mỗi ngày. Hai giới hạn này MUST được enforce ở phía server và SHALL là giá trị cấu hình, không phải hằng số nằm trong mã.

Việc sở hữu nhiều cửa hàng MUST NOT được hiểu là tính năng quản lý chuỗi. Hệ thống không cung cấp thực đơn dùng chung, báo cáo hợp nhất hay màn chuyển đổi cửa hàng đang làm việc.

#### Scenario: Chạm trần số cửa hàng

- **WHEN** một tài khoản chủ đã sở hữu 5 cửa hàng và yêu cầu tạo cửa hàng thứ sáu
- **THEN** hệ thống từ chối, nêu rõ đã đạt số cửa hàng tối đa, và hướng dẫn liên hệ nhà cung cấp để nới hạn mức

#### Scenario: Tạo cửa hàng dồn dập trong ngày

- **WHEN** một tài khoản chủ đã tạo 3 cửa hàng trong cùng một ngày và yêu cầu tạo tiếp
- **THEN** hệ thống từ chối và nêu rõ giới hạn theo ngày

#### Scenario: Danh sách cửa hàng vẫn là danh sách khi chỉ có một

- **WHEN** một chủ chỉ sở hữu một cửa hàng và mở mặt web của mình
- **THEN** hệ thống hiển thị danh sách cửa hàng gồm một dòng, không phải màn chi tiết của một cửa hàng cố định

### Requirement: Quên Store Key gửi lại đúng key hiện tại

Hệ thống SHALL cung cấp luồng quên Store Key: chủ nhập email, hệ thống gửi về email đã xác thực danh sách các cửa hàng thuộc chủ đó, mỗi dòng gồm tên cửa hàng, địa chỉ cửa hàng và Store Key hiện tại. Store Key MUST NOT đổi và các thiết bị đã ghép MUST NOT bị ảnh hưởng.

Luồng này SHALL có hai lối vào dùng chung một thành phần giao diện: một ở màn tạo cửa hàng và ghép thiết bị, một ở màn Cài đặt trong ứng dụng.

Hệ thống SHALL giới hạn 3 lần gửi mỗi giờ tính theo email. Lối vào công khai SHALL trả phản hồi chung chung không tiết lộ email có tồn tại hay không. Hệ thống MUST NOT ghi Store Key hoặc phần bí mật vào bất kỳ nhật ký nào.

#### Scenario: Chủ quên key và cần ghép thêm thiết bị

- **WHEN** chủ nhập đúng email đã xác thực vào hộp thoại quên Store Key
- **THEN** hệ thống gửi email chứa Store Key hiện tại của các cửa hàng thuộc chủ đó, và thiết bị đang ghép vẫn hoạt động bình thường

#### Scenario: Email không thuộc tài khoản chủ nào

- **WHEN** một người nhập email không gắn với tài khoản chủ nào
- **THEN** hệ thống không gửi email nào và trả về cùng phản hồi như trường hợp thành công

#### Scenario: Chỉ gửi cửa hàng của chính chủ đó

- **WHEN** hệ thống dựng nội dung email quên Store Key
- **THEN** nội dung chỉ gồm các cửa hàng có trường chủ sở hữu trỏ tới đúng tài khoản chủ của email đó

### Requirement: Cấp lại Store Key chỉ thực hiện được trong phiên chủ và qua ba lớp rào chắn

Hệ thống SHALL cung cấp luồng cấp lại Store Key, sinh phần bí mật mới, đổi mật khẩu service account của cửa hàng rồi gửi Store Key mới về email chủ. Key cũ MUST hết hiệu lực ngay, và mọi thiết bị đã ghép MUST phải ghép lại.

Luồng này SHALL chỉ khả dụng khi có phiên tài khoản chủ đang đăng nhập. Ứng dụng POS MUST NOT cung cấp lối vào nào cho luồng này, kể cả cho nhân viên vai trò `owner`. Hệ thống MUST NOT thêm quyền hành động nào vào danh mục quyền để phục vụ luồng này.

Trước khi thực hiện, hệ thống SHALL yêu cầu đủ ba lớp theo thứ tự: cảnh báo nêu rõ hậu quả với nút xác nhận tách khỏi nút mở hộp thoại; gõ lại đúng tên cửa hàng; và nhập một mã một lần mới gửi tới email chủ.

#### Scenario: Cấp lại thành công

- **WHEN** chủ đang đăng nhập vượt qua đủ ba lớp rào chắn
- **THEN** hệ thống sinh Store Key mới, vô hiệu key cũ, gửi key mới về email chủ, và mọi thiết bị đang ghép mất phiên cửa hàng

#### Scenario: Phiên bỏ ngỏ trên máy dùng chung

- **WHEN** một người ngồi vào máy có sẵn phiên chủ đang đăng nhập và thử cấp lại Store Key
- **THEN** hệ thống chặn ở lớp thứ ba vì người đó không đọc được mã một lần gửi tới email chủ

#### Scenario: Không có lối vào từ ứng dụng POS

- **WHEN** một nhân viên vai trò `owner` đăng nhập trên thiết bị tại quán và tìm chức năng cấp lại Store Key
- **THEN** ứng dụng không hiển thị chức năng đó ở bất kỳ màn nào

#### Scenario: Thiết bị của chính chủ cũng bị đăng xuất

- **WHEN** chủ cấp lại Store Key từ một thiết bị đã ghép bằng key cũ
- **THEN** thiết bị đó cũng mất phiên cửa hàng, và giao diện đã cảnh báo trước điều này ở lớp thứ nhất

### Requirement: Đặt lại PIN của vai trò chủ quán qua email chủ

Hệ thống SHALL cho phép chủ đang đăng nhập đặt lại PIN của nhân viên vai trò `owner` trong cửa hàng của mình. Đây MUST là đường duy nhất đặt lại PIN đó; quyền quản lý nhân viên của các vai trò khác MUST NOT tác động lên bản ghi nhân viên vai trò `owner`.

#### Scenario: Chủ quên PIN chủ quán

- **WHEN** chủ đăng nhập mặt web và yêu cầu đặt lại PIN của vai trò chủ quán
- **THEN** hệ thống cho đặt PIN mới sau khi xác nhận qua mã một lần, và PIN mới có hiệu lực ngay trên mọi thiết bị đã ghép

#### Scenario: Quản lý không đặt lại được PIN chủ quán

- **WHEN** một nhân viên vai trò `manager` có quyền `employee.manage` thử đặt lại PIN của nhân viên vai trò `owner`
- **THEN** hệ thống từ chối và nêu rõ PIN của chủ quán chỉ đặt lại được từ tài khoản chủ

### Requirement: Đổi email của tài khoản chủ

Hệ thống SHALL cho phép chủ đang đăng nhập đổi sang một địa chỉ email khác. Mã xác nhận MUST được gửi tới **địa chỉ mới**. Sau khi đổi thành công, hệ thống SHALL gửi thư thông báo về địa chỉ cũ.

#### Scenario: Đổi email thành công

- **WHEN** chủ nhập địa chỉ mới và nhập đúng mã gửi tới địa chỉ mới đó
- **THEN** tài khoản chủ chuyển sang địa chỉ mới, và một thư thông báo được gửi tới địa chỉ cũ

#### Scenario: Địa chỉ mới đã thuộc tài khoản chủ khác

- **WHEN** chủ nhập một địa chỉ đã gắn với tài khoản chủ khác
- **THEN** hệ thống từ chối và không gửi mã tới địa chỉ đó

### Requirement: Chuyển quyền sở hữu cửa hàng

Hệ thống SHALL cho phép chủ hiện tại chuyển quyền sở hữu một cửa hàng cho một tài khoản chủ khác, xác định bằng địa chỉ email. Việc chuyển SHALL chỉ hoàn tất khi người nhận xác thực để tiếp nhận. Khi hoàn tất, trường chủ sở hữu của cửa hàng và ràng buộc gắn nhân viên vai trò `owner` MUST chuyển sang chủ mới trong cùng một giao dịch.

Việc chuyển MUST bị từ chối nếu chủ nhận đã chạm trần số cửa hàng.

#### Scenario: Chuyển quyền sở hữu thành công

- **WHEN** chủ hiện tại chỉ định email chủ mới và chủ mới xác thực tiếp nhận
- **THEN** cửa hàng đổi chủ sở hữu, nhân viên vai trò `owner` gắn với tài khoản chủ mới, và chủ cũ không còn thấy cửa hàng đó trong danh sách của mình

#### Scenario: Chủ nhận đã đầy hạn mức

- **WHEN** chủ nhận đã sở hữu 5 cửa hàng
- **THEN** hệ thống từ chối việc chuyển và nêu rõ lý do

#### Scenario: Người nhận chưa xác thực

- **WHEN** chủ hiện tại đã gửi lời chuyển nhưng người nhận chưa xác thực tiếp nhận
- **THEN** cửa hàng vẫn thuộc chủ hiện tại và mọi truy cập giữ nguyên

### Requirement: Nhật ký thao tác quản trị cửa hàng

Hệ thống SHALL ghi nhật ký các thao tác quản trị cửa hàng gồm tạo cửa hàng, cấp lại Store Key, đổi trạng thái cửa hàng, đặt lại PIN chủ quán, đổi email chủ và chuyển quyền sở hữu. Mỗi bản ghi SHALL gắn với một cửa hàng cụ thể và ghi thời điểm, loại thao tác và tài khoản chủ thực hiện.

Nhật ký MUST NOT chứa Store Key, phần bí mật, mã một lần hay PIN ở bất kỳ dạng nào.

#### Scenario: Cấp lại Store Key để lại dấu vết

- **WHEN** một cửa hàng được cấp lại Store Key
- **THEN** nhật ký có một bản ghi cho cửa hàng đó với loại thao tác và thời điểm, và không chứa giá trị key nào

#### Scenario: Nhật ký gắn với cửa hàng, không gắn với chủ

- **WHEN** một cửa hàng được chuyển sang chủ mới
- **THEN** các bản ghi nhật ký trước đó vẫn thuộc về cửa hàng đó và không bị mất khi đổi chủ

### Requirement: Phạm vi của mặt web dành cho chủ

Mặt web của tài khoản chủ SHALL chỉ gồm các việc mà thiết bị POS không làm được: đăng nhập và đăng xuất, xem danh sách cửa hàng của mình, tạo cửa hàng mới, quên Store Key, cấp lại Store Key, đặt lại PIN của vai trò chủ quán, đổi email chủ và chuyển quyền sở hữu.

Mặt web MUST NOT dựng lại các màn quản trị nghiệp vụ đã có trong ứng dụng POS, gồm báo cáo, cài đặt cửa hàng, quản lý thực đơn, quản lý sơ đồ và quản lý nhân viên.

#### Scenario: Chủ muốn xem báo cáo từ xa

- **WHEN** chủ muốn xem báo cáo doanh thu mà không có mặt tại quán
- **THEN** chủ ghép thiết bị của mình bằng Store Key rồi đăng nhập bằng PIN chủ quán, và mặt web không cung cấp màn báo cáo riêng
