# Thiết kế lại mô hình phân quyền người dùng

## Why

Mô hình quyền hiện tại đủ cho phạm vi tiểu luận nhưng sẽ vỡ khi các tính năng mở rộng vào. Cụ thể: chỉ có 5 quyền hành động được enforce (`order.create`, `order.update`, `order.voidOpen`, `payment.take`, `order.voidPaid`), trong khi `docs/features.md` đã liệt kê sẵn một danh mục quyền chưa dùng gồm chuyển và gộp bàn, hoàn tiền, áp giảm giá, ghi đè giá, mở ngăn kéo tiền và các quyền ca làm việc. Vai trò là enum cứng gồm `admin`, `cashier` và `kitchen`, không tạo được vai trò tùy chỉnh. Quản trị thực đơn, sơ đồ, nhân viên, cài đặt và báo cáo vẫn chỉ chặn theo vai trò chứ chưa chỉnh được theo từng người. Ngoài ra client giữ ảnh chụp quyền tại thời điểm đăng nhập nên đổi quyền phải đăng nhập lại mới có hiệu lực đầy đủ trên máy đang mở.

Mỗi tính năng mở rộng phía sau đều sinh thêm quyền mới: tồn kho, khuyến mãi, chấm công, loyalty, nhiều cửa hàng. Nếu không thiết kế lại trước thì sẽ phải vá enum quyền nhiều lần.

Change này lật lại một phần quyết định FR-04 và mục vai trò tùy chỉnh trong phần ngoài phạm vi của `docs/requirements.md`.

## What Changes

- **Đưa catalog quyền và vai trò xuống database thành dữ liệu**, thay cho enum cứng trong mã nguồn. Thêm quyền mới về sau là thêm bản ghi, không phải sửa nhiều nơi.
- **Mở rộng bộ vai trò dựng sẵn** từ ba lên năm vai trò đang dùng được: chủ quán, quản lý, thu ngân, phục vụ và kế toán. Vai trò bếp giữ nguyên làm seam chưa bật trên giao diện. Tách chủ quán ra khỏi vai trò admin hiện tại để có một vai trò không tự khóa mình được và không ai leo thang lên được.
- **Mở rộng bộ quyền hành động từ năm lên mười bốn**, phủ cả các module quản trị là thực đơn, sơ đồ, nhân viên, báo cáo và cài đặt, và phủ cả hai module chỉ xem là sơ đồ bàn và lịch sử đơn. Chỉ khai báo quyền có tính năng thật đứng sau.
- **Đánh dấu một nhóm quyền là dành riêng cho chủ quán**, không gán được cho vai trò khác kể cả khi chủ muốn. Nhóm này gồm xóa toàn bộ dữ liệu và cấp lại Store Key.
- **Bỏ trục quyền module riêng.** Module hiện lên điều hướng khi nhân viên có ít nhất một quyền thuộc nhóm của module đó. Nhờ vậy quyền vào các module quản trị chỉnh được theo từng nhân viên, thay vì chỉ chặn cứng theo vai trò như hiện nay.
- **Giữ nguyên cơ chế ghi đè theo từng nhân viên** bằng danh sách cấp thêm và danh sách chặn, với quy tắc chặn luôn thắng. Công thức này đã có kiểm thử, không đập đi.
- **Giữ mô hình quyền nhị phân.** Kiểm tra quyền chỉ có hai kết quả là cho phép và từ chối. Không thêm kết quả trung gian kiểu cần cấp trên duyệt tại chỗ. Xem mục quyết định số 9 để biết lý do và cơ chế thay thế.
- **Lan truyền thay đổi quyền theo thời gian thực** tới thiết bị đang đăng nhập, dùng kênh realtime sẵn có, để bỏ yêu cầu khóa phiên và đăng nhập lại.
- **Thêm nhật ký thay đổi quyền**: ai đổi quyền của ai, đổi gì, lúc nào.
- Giữ nguyên nguyên tắc chốt quyền ở tầng nghiệp vụ và kiểm tra lại phía database.

## Capabilities

### New Capabilities

Không có năng lực mới. Vì không làm vai trò tùy chỉnh nên không cần tách năng lực quản trị vai trò riêng; toàn bộ thay đổi nằm trong `access-control` và `employee-management`.

### Modified Capabilities

- `access-control`: đổi cách định nghĩa vai trò và quyền sang dạng dữ liệu, mở rộng bộ vai trò và bộ quyền hành động, bỏ trục quyền module riêng, thêm nhóm quyền dành riêng cho chủ quán, đổi cách hiển thị khi thiếu quyền từ vô hiệu hóa sang ẩn, đổi hành vi lan truyền thay đổi quyền tới thiết bị đang đăng nhập, và thêm nhật ký thay đổi quyền.
- `employee-management`: đổi giao diện gán vai trò và chỉnh quyền theo bộ vai trò mới, và thêm các bất biến của bản ghi chủ quán, gồm không xóa, không tạm khóa, không đổi vai trò và không ai khác đặt lại PIN được.

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
- `add-owner-account-and-store-provisioning` chạy độc lập được, nhưng nếu làm trước thì change này gán luôn vai trò chủ quán cho tài khoản chủ đã có; nếu làm sau thì vai trò chủ quán tồn tại trước ở mức nhân viên rồi mới nối vào tài khoản chủ.

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

Ghi ngày 2026-08-28, theo trao đổi với người dùng. Đánh số theo câu hỏi ở mục trên.

**Câu 1 — Không làm vai trò tùy chỉnh.** Giữ bộ vai trò dựng sẵn và mở rộng bộ này, thay vì cho chủ quán tự định nghĩa vai trò. Vẫn đưa vai trò xuống database dạng dữ liệu để lần sau mở vai trò tùy chỉnh không phải migration lần hai, nhưng giao diện đợt này chỉ cho chọn trong các vai trò dựng sẵn.

**Câu 2 — Không áp dụng**, vì không làm vai trò tùy chỉnh.

**Câu 3 — Bộ vai trò dựng sẵn gồm sáu, trong đó năm dùng được ngay.** Chọn theo các vai trò lặp lại ở nhiều loại POS thực tế, không riêng quán cà phê:

| Vai trò | Trạng thái | Ranh giới |
| --- | --- | --- |
| Chủ quán | Mới, tách khỏi vai trò admin hiện tại | Toàn quyền, không xóa được, không tự khóa mình |
| Quản lý | Mới | Vận hành, duyệt thao tác nhạy cảm, xem báo cáo; không đổi cài đặt cửa hàng, không xóa dữ liệu |
| Thu ngân | Đã có | Bán, thu tiền, in hóa đơn; không tự hủy đơn đã thanh toán |
| Phục vụ | Mới | Ghi và sửa đơn tại bàn, gửi bếp; **không cầm tiền** |
| Kế toán | Mới | Chỉ đọc báo cáo; không thao tác nghiệp vụ |
| Bếp | Giữ nguyên làm seam | Chưa bật trên giao diện, chờ tính năng hàng đợi bếp |

Tách người ghi order khỏi người cầm tiền là kiểm soát nội bộ cơ bản và là lý do chính đưa vai trò phục vụ vào ngay đợt này, vì sơ đồ bàn và luồng đơn đã có sẵn nên chỉ cần bỏ quyền thu tiền.

Hai vai trò để dành, chưa seed vì chưa có tính năng đứng sau: thủ kho chờ `add-inventory-core`, trưởng ca chờ `add-shift-management`.

**Câu 3 tiếp — Catalog quyền mở rộng từ năm lên mười bốn.** Chỉ khai báo quyền có tính năng thật, đúng quy tắc không claim seam là tính năng:

| Quyền | Chủ quán | Quản lý | Thu ngân | Phục vụ | Kế toán |
| --- | :-: | :-: | :-: | :-: | :-: |
| `floor.view` xem sơ đồ bàn | Có | Có | Có | Có | |
| `order.create` tạo đơn | Có | Có | Có | Có | |
| `order.update` sửa đơn | Có | Có | Có | Có | |
| `order.voidOpen` hủy đơn mở | Có | Có | Có | | |
| `payment.take` thu tiền | Có | Có | Có | | |
| `orderHistory.view` xem lịch sử đơn | Có | Có | Có | | Có |
| `order.voidPaid` hủy đơn đã thanh toán | Có | Có | | | |
| `menu.manage` quản lý thực đơn | Có | Có | | | |
| `floor.manage` quản lý sơ đồ | Có | Có | | | |
| `employee.manage` quản lý nhân viên | Có | Có | | | |
| `employee.permission.edit` chỉnh quyền nhân viên | Có | | | | |
| `report.view` xem báo cáo | Có | Có | | | Có |
| `settings.manage` đổi cài đặt cửa hàng | Có | | | | |
| `data.wipe` xóa toàn bộ dữ liệu (chỉ chủ quán) | Có | | | | |

Hai quyền chỉ xem là `floor.view` và `orderHistory.view` được bổ sung ngày 2026-08-28 khi viết delta spec. Lý do: quyết định bỏ trục module ở câu 4 khiến mọi module phải suy ra từ quyền, nhưng sơ đồ bàn và lịch sử đơn là hai module chỉ xem nên trước đó không có quyền hành động nào ánh xạ tới. Không thêm thì hoặc hai module biến mất với mọi người, hoặc phải làm ngoại lệ cho chúng luôn hiện, mà ngoại lệ thì kế toán cũng thấy sơ đồ bàn.

Quyền `store.key.rotate` cấp lại Store Key không được khai báo ở change này, vì tính năng đứng sau nó thuộc `add-owner-account-and-store-provisioning`. Change đó bổ sung quyền này vào danh mục khi tính năng được làm, nâng tổng lên mười lăm.

Các mã quyền trong danh mục sản xuất hiện chưa có tính năng đứng sau vẫn **không** đưa vào đợt này: chuyển bàn, gộp bàn, hoàn tiền, áp giảm giá, ghi đè giá, mở ngăn kéo tiền và các quyền ca làm việc. Cấu trúc dữ liệu cho phép thêm chúng khi tính năng tương ứng được làm.

**Câu 4 — Có, và giải pháp là bỏ hẳn trục module riêng.** Module lên điều hướng được suy ra từ quyền hành động thay vì tra bảng cứng theo vai trò. Đây là điều kiện cần để chỉnh quyền quản trị theo từng nhân viên: hiện muốn cho một thu ngân lâu năm sửa thực đơn thì cách duy nhất là nâng người đó lên admin, kèm luôn quyền quản lý nhân viên và xóa dữ liệu.

**Câu 5 — Giữ ảnh chụp nhưng lan truyền theo thời gian thực.** Không chuyển sang đọc quyền trực tiếp mỗi lần kiểm tra, vì số lượt gọi tăng mạnh trong khi kênh realtime lọc theo cửa hàng đã chạy sẵn và tầng cache dữ liệu máy chủ cũng đã có. Đổi quyền thì thiết bị đang mở nhận tín hiệu và tải lại hồ sơ nhân viên hiện hành.

**Câu 6 — Chấp nhận thay đổi phá vỡ tương thích, chuyển đổi theo thứ tự tạo.**

Vai trò admin tách thành chủ quán và quản lý. Quy tắc chuyển đổi dữ liệu đang có:

- Mỗi cửa hàng lấy **bản ghi admin được tạo cùng lúc mở quán** làm chủ quán. Bản ghi này có định danh suy ra được từ định danh cửa hàng nên nhận diện chắc chắn, không phụ thuộc tên hiển thị.
- Mọi bản ghi admin còn lại của cửa hàng đó chuyển thành **quản lý**.
- Dự phòng khi bản ghi gốc không còn, do đã bị xóa hoặc đã đổi vai trò: lấy nhân viên vai trò admin đang hoạt động có thời điểm tạo sớm nhất.
- Dự phòng khi cửa hàng không còn nhân viên admin nào: không tự suy đoán. Ghi cửa hàng đó vào báo cáo chuyển đổi để xử lý riêng, vì cửa hàng không có chủ quán thì không ai thực hiện được các quyền dành riêng cho chủ.

Không chọn hướng chuyển toàn bộ admin thành chủ quán, vì như vậy mọi admin đều xóa được dữ liệu và cấp lại Store Key, tức là mất hẳn tác dụng của việc tách vai trò. Cũng không chọn hướng chuyển hết thành quản lý rồi chỉ định lại sau, vì sẽ có khoảng thời gian cửa hàng không ai đủ quyền.

Bản kiểm thử chuyển đổi phải phủ đủ bốn trường hợp: cửa hàng một admin, cửa hàng nhiều admin, cửa hàng đã xóa bản ghi admin gốc, và cửa hàng không còn admin nào.

**Câu 7 — Vai trò bếp giữ nguyên làm seam.** Không bỏ, không biến thành vai trò mẫu, và vẫn không xuất hiện trên giao diện cho tới khi có tính năng hàng đợi bếp.

**Câu 8 — Chưa tính quyền theo từng cửa hàng ở đợt này.** Change `add-owner-account-and-store-provisioning` đã dựng khái niệm chủ sở hữu và nhánh chính sách bảo mật tương ứng, nên khi `add-multi-store-ownership` được làm thì việc gắn quyền theo từng cửa hàng là mở rộng chứ không phải viết lại. Đợt này quyền vẫn là thuộc tính của nhân viên trong phạm vi một cửa hàng.

**Câu 9, phát sinh khi thảo luận — Quyền là nhị phân, không làm cơ chế duyệt tại chỗ bởi cấp trên.**

Đã cân nhắc và **loại bỏ** phương án cho phép người có thẩm quyền xác minh PIN ngay trên thiết bị để duyệt một thao tác mà nhân viên đang đăng nhập không có quyền. Nguyên tắc chốt lại là: có quyền thì làm được, không có quyền thì phải nhờ người khác thực hiện thay.

Lý do:

- Đã có sẵn cơ chế thay thế mà không cần thêm gì. Người quản lý cấp quyền tạm thời cho nhân viên đó qua màn quản lý nhân viên, nhân viên tự thực hiện, sau đó gỡ quyền lại. Vì quyết định ở câu 5 đã chọn lan truyền thay đổi quyền theo thời gian thực nên cách này có hiệu lực ngay, không bắt khóa phiên và đăng nhập lại.
- Cách còn lại là người có quyền tự đăng nhập và thực hiện. Nhật ký khi đó ghi đúng người đã thực hiện, không phát sinh vấn đề quy trách nhiệm.
- Cơ chế duyệt tại chỗ chỉ tiết kiệm vài thao tác cho một tình huống hiếm, nhưng kéo theo một trạng thái kiểm tra quyền mới, một hộp thoại dùng chung, tham số người duyệt ở các lời gọi phía database và một nhánh nhật ký riêng. Không tương xứng.
- Ở quy mô quán nhỏ, ca đêm thường chỉ có một người trực nên không có ai để quẹt PIN duyệt. Cơ chế duyệt vì vậy không dùng được đúng lúc cần nhất.

Hệ quả chấp nhận: khi nhân viên trực không có quyền cho một thao tác thì thao tác đó phải chờ người có quyền, và trong ca chỉ một người trực thì phải chờ hết ca. Đây là lựa chọn có chủ ý, không phải thiếu sót, và cần ghi vào phần hạn chế của tài liệu.

**Câu 10, phát sinh khi thảo luận — Thiếu quyền thì ẩn hẳn, không vô hiệu hóa.**

Áp dụng thống nhất một quy tắc cho mọi cấp: nhân viên không có quyền với một màn hình hoặc một thao tác thì **phần tử điều khiển tương ứng không được render**. Ẩn cả lối vào màn hình lẫn nút thực hiện thao tác, thay vì hiển thị ở trạng thái vô hiệu hóa.

Lý do thiết kế, ghi lại để dùng cho phần thuyết minh giao diện của báo cáo:

- **Giảm tò mò và giảm thao tác thừa.** Phần tử hiển thị nhưng bấm không được vẫn mời gọi người dùng thử. Với thu ngân đang đứng quầy trong giờ cao điểm, mỗi lần thử là một lần mất thời gian và một lần phát sinh câu hỏi cho quản lý. Không nhìn thấy thì không thử.
- **Giao diện đơn giản theo từng vai trò.** Mỗi nhân viên chỉ thấy đúng phần việc của mình, không phải lọc bằng mắt qua những mục không dùng tới. Với thiết bị POS màn hình ngang đặt cố định tại quầy, số phần tử hiển thị đồng thời là nguồn nhiễu thật, không phải vấn đề thẩm mỹ.
- **Nhất quán với cách điều hướng đang làm.** Module không có quyền vốn đã bị ẩn khỏi điều hướng. Vô hiệu hóa ở cấp nút trong khi ẩn ở cấp module là hai quy tắc khác nhau trong cùng một sản phẩm; gộp về một quy tắc dễ giải thích và dễ kiểm thử hơn.

Đánh đổi đã cân nhắc và chấp nhận: nhân viên không biết chức năng tồn tại nên khi cần sẽ hỏi quản lý thay vì tự đọc lý do trên giao diện, và hỗ trợ từ xa khó hơn vì hai máy có thể hiển thị khác nhau. Giảm nhẹ bằng cách để màn quản lý nhân viên hiển thị rõ từng quyền của mỗi người, để quản lý tra được ngay tại chỗ.

Phạm vi của quy tắc, phải nói rõ để không áp nhầm: quy tắc ẩn **chỉ áp dụng khi thiếu quyền**. Phần tử bị vô hiệu hóa vì lý do trạng thái nghiệp vụ vẫn giữ nguyên cách hiển thị hiện tại, tức vẫn hiện ở trạng thái vô hiệu hóa. Ví dụ nút in lại hóa đơn của một đơn đã hủy trong `order-history`: người dùng có quyền, chỉ là đơn không in lại được, nên ẩn nút sẽ làm họ tưởng chức năng biến mất.

Ràng buộc giữ nguyên, không được nới: việc ẩn phần tử điều khiển **không** phải biện pháp bảo vệ. Guard ở tầng nghiệp vụ và việc kiểm tra lại phía database vẫn phải chạy đủ như baseline spec `access-control` đang quy định.

Đây là một requirement bị sửa của `access-control`, vì spec hiện quy định vô hiệu hóa nút trước khi người dùng bấm.

**Câu 11, phát sinh khi thảo luận — Vai trò chủ quán là duy nhất trong mỗi cửa hàng và gắn với chủ sở hữu thật.**

Mỗi cửa hàng có **đúng một** nhân viên vai trò chủ quán. Bản ghi này bất biến với mọi thao tác quản trị của người khác: không xóa được, không tạm khóa được, không đổi sang vai trò khác được, và **không ai khác đặt lại PIN được**. Khi change `add-owner-account-and-store-provisioning` hoàn tất, bản ghi đó phải gắn với tài khoản chủ đã xác thực email của cửa hàng, tức người giữ vai trò chủ quán chính là chủ sở hữu.

Bất biến về PIN là phần bắt buộc, không phải chi tiết phụ. Quyền `employee.manage` đã giao cho vai trò quản lý bao gồm việc đặt lại PIN cho nhân viên. Nếu quyền đó tác động được lên bản ghi chủ quán thì quản lý đặt lại PIN của chủ, đăng nhập bằng PIN mới và có toàn quyền chủ quán, gồm xóa toàn bộ dữ liệu và cấp lại Store Key. Toàn bộ ràng buộc ở mục này khi đó vô hiệu. Vì vậy `employee.manage` **không tác động lên bản ghi chủ quán ở bất kỳ thao tác nào**; quản lý vẫn nhìn thấy bản ghi đó trong danh sách nhân viên nhưng không sửa được gì.

Chủ quên PIN thì đặt lại từ tài khoản chủ qua email đã xác thực, cùng kênh với việc cấp lại Store Key. Không phát sinh kênh khôi phục thứ hai.

Thứ tự thực hiện để hai change không khóa nhau: change này đưa vào **vai trò** chủ quán cùng ràng buộc duy nhất trong phạm vi cửa hàng, chưa cần tài khoản chủ tồn tại. Change onboarding sau đó bổ sung ràng buộc gắn kết giữa bản ghi nhân viên chủ quán và tài khoản chủ.

Lý do chọn ràng buộc chặt thay vì cho phép ủy quyền vai trò chủ quán cho người khác:

- Bộ quyền dành riêng cho chủ quán đã được chọn sao cho **không có thao tác nào thuộc việc quầy**: đổi cài đặt cửa hàng, chỉnh quyền nhân viên, xóa toàn bộ dữ liệu, cấp lại Store Key. Các việc phát sinh giữa ca như thêm nhân viên mới hay đặt lại PIN thuộc quyền `employee.manage` và đã giao cho vai trò quản lý. Vì vậy chủ vắng mặt không làm gián đoạn vận hành.
- Chủ vẫn thao tác được từ xa mà không cần có mặt tại quán, bằng cách ghép điện thoại của mình như một thiết bị bình thường rồi đăng nhập bằng PIN chủ quán.
- Không có đường leo thang quyền từ bên trong cửa hàng, vì không ai phong được vai trò chủ quán cho người khác.
- Chỉ có một kênh khôi phục duy nhất là email đã xác thực của chủ.

**Mỗi cửa hàng có một chủ sở hữu. Đây là quyết định thiết kế, không phải hạn chế.**

Phần mềm POS là công cụ quản lý vận hành cửa hàng, không phải nơi ghi nhận quan hệ góp vốn hay phân xử tranh chấp giữa các bên. Thực tế kinh doanh tại Việt Nam, kể cả quán hùn vốn, vẫn có một người đứng ra làm chủ và chịu trách nhiệm; quan hệ góp vốn được thỏa thuận bên ngoài phần mềm. Vì vậy mô hình một chủ sở hữu cho mỗi cửa hàng là đúng bài toán chứ không phải chỗ còn thiếu. Người góp vốn khác nếu có tham gia vận hành thì nhận vai trò quản lý, vốn đã đủ cho toàn bộ việc quầy và việc quản trị hằng ngày.

Khi viết báo cáo, trình bày điểm này ở phần quyết định thiết kế, không đưa vào chương hạn chế.
