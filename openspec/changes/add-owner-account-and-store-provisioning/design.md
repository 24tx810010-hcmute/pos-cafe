# Thiết kế tài khoản chủ cửa hàng và kiểm soát việc tạo cửa hàng

## Context

Động cơ và phạm vi xem `proposal.md`, phần Why và phần Quyết định đã chốt. Phần này chỉ nêu hiện trạng kỹ thuật cần thiết để giải thích cách làm.

Bốn ràng buộc từ kho mã quyết định phần lớn thiết kế dưới đây:

1. **Bảng `stores` dùng chính `auth.users.id` làm khóa chính.** Mỗi cửa hàng *là* một tài khoản xác thực. Vì vậy không thể biến tài khoản chủ thành một hàng khác trong cùng bảng đó; chủ phải là một tài khoản xác thực riêng, và quan hệ chủ–cửa hàng là một cột mới trỏ sang.
2. **Bảng `stores` đã có cột `email`** giữ email tổng hợp dạng `store{N}@store.pos.local`, và cột `is_active` dạng boolean. Cột trạng thái mới thay chỗ `is_active`.
3. **Địa chỉ cửa hàng đã có sẵn** ở `store_settings.address`, không phải thêm trường. Email khôi phục đọc từ đó.
4. **Kho mã chưa có thành phần nào chạy phía server.** `src/adapters/supabase` là adapter gọi thẳng từ trình duyệt, và `src/architectureBoundaries.test.ts` cấm thư mục đó chạm `window`/`document`. Hàm phía server là thành phần triển khai mới, nằm ngoài cây `src`.

## Goals / Non-Goals

**Goals**

- Không ai tạo được cửa hàng nếu chưa xác thực email thật.
- Việc tạo cửa hàng là một thao tác nguyên tử, hỏng thì không để lại rác.
- Mất Store Key khôi phục được, không phải cấp mới và bắt cả quán ghép lại.
- Thiết bị đã ghép không bị ảnh hưởng bởi thay đổi này.
- Lược đồ không khóa cứng ở một cửa hàng mỗi chủ.

**Non-Goals**

- Không dựng lại các màn quản trị nghiệp vụ trên web. Quyết định 7.
- Không làm tính năng chuỗi cửa hàng. Quyết định 21.
- Không làm màn quản trị cho nhà cung cấp. Quyết định 12, tách sang `add-provider-admin-console`.
- Không chuyển đổi dữ liệu cũ. Quyết định 9.

## Decisions

### 1. Tài khoản chủ là một tài khoản xác thực riêng, không phải một hàng trong `stores`

`stores.id` đã tham chiếu `auth.users.id`, nên bảng cửa hàng và bảng tài khoản xác thực là quan hệ một–một cứng. Tài khoản chủ vì vậy là một bản ghi `auth.users` khác, và quan hệ sở hữu là cột `owner_id` trên `stores` trỏ về đó.

Cách này giữ nguyên định danh cửa hàng, nên không phải chuyển đổi dữ liệu và không thiết bị nào phải ghép lại. Đây là lý do quyết định 2 chọn tách hai loại danh tính thay vì hợp nhất.

Phân biệt hai loại tài khoản bằng cách nào: service account của cửa hàng có email thuộc miền nội bộ `@store.pos.local`, tài khoản chủ có email thật. Ngoài ra tài khoản chủ mang một dấu hiệu trong metadata để chính sách bảo mật kiểm được mà không phải khớp chuỗi email.

### 2. Toàn bộ việc ghi nhạy cảm đi qua một hàm chạy phía server

Ba việc bắt buộc phải ở phía server vì trình duyệt không được giữ khóa tương ứng:

- Giải mã phần bí mật của Store Key. Cần khóa mã hóa.
- Đổi mật khẩu service account của cửa hàng. Cần khóa quản trị của nền tảng backend.
- Tạo service account mới khi tạo cửa hàng. Cùng khóa quản trị.

Đặt tại `supabase/functions/`, chạy Deno, cùng nền tảng backend đang dùng nên không thêm hạ tầng lạ. Hai biến môi trường mới: khóa quản trị của nền tảng và khóa mã hóa Store Key. Cả hai MUST NOT bao giờ xuống client.

Vì đã có một hàm phía server, hạn mức và giới hạn tần suất cũng enforce ở đó, nơi client không lách được. Đây là lợi ích kèm theo mà quyết định 3 đã nêu.

### 3. Ranh giới với `src`: hàm phía server nằm sau một port như mọi thứ khác

Tầng `features` MUST NOT biết rằng có hàm chạy phía server. Thêm một port mới trong `src/ports` khai bằng type của `domain`, và một adapter trong `src/adapters/supabase` gọi tới hàm đó.

Nhờ vậy `src/architectureBoundaries.test.ts` tiếp tục canh được, và mock adapter dựng được toàn bộ kịch bản mà không cần hàm thật.

Tên port đặt theo việc chứ không theo hạ tầng, ví dụ `IOwnerAccountPort` và `IStoreProvisioningPort`, để sau này đổi cách triển khai không phải đổi tên.

### 4. Store Key: mã hóa đối xứng, khóa nằm ngoài database

Cột mới trên `stores` lưu phần bí mật đã mã hóa. Khóa giải mã nằm trong biến môi trường của hàm phía server.

Ngưỡng bảo mật đạt được, phát biểu chính xác để không nói quá: **người lấy được bản dump database không đọc được key**, vì thiếu khóa. Người chiếm được cả môi trường chạy của hàm thì đọc được. Đây là đánh đổi có ý thức của quyết định 6.

**Xoay khóa và mất khóa.** Thiết kế phải trả lời được hai tình huống:

- *Xoay khóa*: lưu kèm mỗi bản ghi một định danh phiên bản khóa. Khi xoay, khóa mới dùng cho bản ghi mới, và có một tác vụ giải mã bằng khóa cũ rồi mã hóa lại bằng khóa mới. Không có định danh phiên bản thì không xoay được mà không dừng hệ thống.
- *Mất khóa*: không khôi phục được Store Key của bất kỳ cửa hàng nào. Đường duy nhất còn lại là cấp lại key cho từng cửa hàng, tức mọi thiết bị phải ghép lại. Phải ghi vào `docs/limitations.md` và phải sao lưu khóa tách khỏi bản sao lưu database.

### 5. Chính sách bảo mật: thêm nhánh, không sửa nhánh cũ

Chính sách hiện tại cấp quyền theo `auth.uid() = store_id`. Thêm một nhánh thứ hai là `owner_id = auth.uid()`, nối bằng phép hoặc.

Hai hệ quả quan trọng:

- Nhánh cũ nguyên vẹn nên thiết bị đã ghép không bị ảnh hưởng. Đây là điều kiện của quyết định 2.
- Nhánh chủ chỉ mở trên các bảng cần cho mặt web: `stores`, `store_settings` ở mức đọc, bảng nhật ký, và bảng nhân viên ở mức đủ để đặt lại PIN chủ quán. **Không** mở trên đơn hàng, thanh toán, thực đơn, sơ đồ. Quyết định 7 nói rõ lý do: chủ muốn xem nghiệp vụ thì ghép thiết bị như mọi người.

Điều kiện trạng thái ghép vào cùng lượt sửa này. Chi phí thấp vì đằng nào cũng đang sửa chính sách, đúng như quyết định 11 lập luận.

Ngoại lệ bắt buộc: nhánh chủ trên bảng `stores` **không** kiểm điều kiện trạng thái, để chủ đọc được cửa hàng đang bị tạm ngưng của mình. Mọi bảng nghiệp vụ vẫn kiểm.

### 6. Trạng thái cửa hàng dùng enum, không dùng boolean

`is_active` boolean chỉ diễn đạt được hai trạng thái và không mở rộng được. Đổi sang enum `store_status` gồm `active` và `suspended`.

Chọn enum thay vì giữ boolean vì `add-provider-admin-console` sẽ cần thêm trạng thái, và đổi kiểu cột sau khi đã có dữ liệu thật đắt hơn nhiều so với đổi ngay bây giờ khi dữ liệu cũ đằng nào cũng bị xóa theo quyết định 9.

### 7. Mã một lần: dùng cơ chế của nền tảng, không tự dựng

Nền tảng backend đã có luồng gửi mã một lần qua email. Dùng nguyên cơ chế đó cho cả bốn chỗ cần mã: đăng nhập chủ, xác nhận cấp lại Store Key, đổi email chủ, và tiếp nhận chuyển quyền sở hữu.

Tự dựng bảng mã riêng sẽ phải tự lo băm mã, hạn dùng, đếm số lần sai và dọn mã cũ — bốn thứ dễ làm sai. Phần phải tự làm là giới hạn tần suất theo email và theo địa chỉ mạng, vì mức mặc định của nền tảng không đủ chặt cho một điểm cuối vừa đăng ký vừa đăng nhập.

### 8. Hai luồng khôi phục Store Key tách hẳn nhau ở mọi tầng

Không dùng chung điểm cuối, không dùng chung màn hình, không dùng chung thành phần giao diện. Lý do: bán kính ảnh hưởng khác nhau một trời một vực, và gộp lại thì một lần bấm nhầm làm cả quán ngừng bán.

| | Quên Store Key | Cấp lại Store Key |
| --- | --- | --- |
| Cần phiên chủ | Không | **Có** |
| Lối vào | Màn ghép thiết bị, màn Cài đặt | Chỉ mặt web của chủ |
| Rào chắn | Giới hạn tần suất, phản hồi chung chung | Ba lớp theo quyết định 16 |
| Store Key | Giữ nguyên | Đổi mới |
| Thiết bị đã ghép | Không ảnh hưởng | Phải ghép lại toàn bộ |

## Lược đồ dữ liệu

**Bảng `stores`, thêm cột**

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `owner_id` | `uuid not null references auth.users (id)` | **Không** đặt ràng buộc duy nhất. Quyết định 21. |
| `status` | `public.store_status not null default 'active'` | Thay `is_active` |
| `key_secret_encrypted` | `text not null` | Phần bí mật đã mã hóa |
| `key_encryption_version` | `smallint not null default 1` | Phục vụ xoay khóa |

`is_active` bị bỏ. Không có bước chuyển đổi dữ liệu vì dữ liệu cũ bị xóa theo quyết định 9.

**Bảng mới `store_admin_log`**

| Cột | Kiểu |
| --- | --- |
| `id` | `uuid primary key` |
| `store_id` | `uuid not null references public.stores (id) on delete cascade` |
| `action` | `public.store_admin_action not null` |
| `actor_owner_id` | `uuid` |
| `detail` | `jsonb not null default '{}'` |
| `created_at` | `timestamptz not null default now()` |

`action` gồm: `store_created`, `store_key_regenerated`, `store_status_changed`, `owner_pin_reset`, `owner_email_changed`, `ownership_transferred`.

`detail` MUST NOT chứa Store Key, phần bí mật, mã một lần hay PIN. Ràng buộc này kiểm bằng kiểm thử, không bằng niềm tin.

Bảng gắn với `store_id` chứ không gắn với `owner_id`, để nhật ký không mất khi cửa hàng đổi chủ. Quyết định 21.

**Bảng mới `store_ownership_transfer`**

Giữ lời chuyển quyền sở hữu đang chờ người nhận xác thực: `store_id`, `from_owner_id`, `to_email`, `status`, `expires_at`.

## Hợp đồng hàm phía server

Một hàm, nhiều hành động, phân nhánh theo tham số. Gộp thay vì tách nhiều hàm vì tất cả dùng chung phần xác thực phiên chủ, giới hạn tần suất và ghi nhật ký.

| Hành động | Cần phiên chủ | Việc chính |
| --- | --- | --- |
| `createStore` | Có | Kiểm hạn mức và tần suất, tạo service account, ghi `stores` + `store_settings` + nhân viên `owner`, trả Store Key một lần |
| `forgotStoreKey` | **Không** | Tra chủ theo email, giải mã key các cửa hàng của chủ đó, gửi email. Luôn trả phản hồi chung chung |
| `regenerateStoreKey` | Có, kèm mã một lần mới | Sinh bí mật mới, đổi mật khẩu service account, mã hóa và ghi lại, gửi email, ghi nhật ký |
| `resetOwnerPin` | Có, kèm mã một lần | Ghi lại `passcode_hash` của nhân viên vai trò `owner` |
| `startOwnershipTransfer` | Có | Ghi bản ghi chờ, gửi email tới người nhận |
| `acceptOwnershipTransfer` | Có, của người nhận | Kiểm hạn mức người nhận, đổi `owner_id` và gắn kết nhân viên `owner` trong **một giao dịch** |

`createStore` và `acceptOwnershipTransfer` bắt buộc chạy trong một giao dịch database. Nếu nền tảng không cho gói cả việc tạo tài khoản xác thực vào giao dịch đó, hàm phải tự dọn tài khoản đã tạo khi các bước sau thất bại — nếu không sẽ tái lập đúng lỗi tài khoản mồ côi mà change này sinh ra để sửa.

## Năm luồng email

| Luồng | Gửi tới | Nội dung |
| --- | --- | --- |
| Mã đăng nhập chủ | Email chủ | Mã 6 chữ số, hạn 10 phút |
| Quên Store Key | Email chủ | Danh sách cửa hàng: tên, địa chỉ, Store Key. Kèm nhắc dùng chức năng cấp lại nếu nghi hộp thư bị lộ |
| Cấp lại Store Key | Email chủ | Mã xác nhận, rồi thư thứ hai chứa key mới |
| Đổi email chủ | **Địa chỉ mới** | Mã xác nhận. Sau khi đổi, gửi thư báo về địa chỉ cũ |
| Chuyển quyền sở hữu | Email người nhận | Lời mời tiếp nhận kèm tên cửa hàng |

Email quên Store Key liệt kê dạng danh sách ngay từ đầu, kể cả khi chỉ có một dòng. Quyết định 21.

## Mặt web của chủ

Sáu màn, không hơn: nhập email; nhập mã; danh sách cửa hàng; tạo cửa hàng; chi tiết một cửa hàng gồm cấp lại Store Key và đặt lại PIN chủ quán; cài đặt tài khoản gồm đổi email và chuyển quyền sở hữu.

Màn danh sách hiển thị dạng danh sách kể cả khi có một cửa hàng, và mọi thao tác nhận định danh cửa hàng làm tham số thay vì suy ra cửa hàng duy nhất. Quyết định 21.

## Chỗ đã chừa sẵn cho nhiều cửa hàng

Ghi tách riêng để trả lời được khi bị hỏi tại buổi bảo vệ.

**Đã mở sẵn, không phải làm gì thêm**

- `stores.owner_id` là khóa ngoại thường, không có ràng buộc duy nhất.
- Mặt web đã là danh sách cửa hàng.
- Email khôi phục đã là danh sách.
- Nhật ký gắn theo cửa hàng nên không rối khi một chủ có nhiều cửa hàng.
- Chính sách bảo mật đã lọc theo `owner_id`, tự đúng với n cửa hàng.
- Trần 5 cửa hàng là cấu hình, nới không cần migration.
- Baseline spec `store-isolation` đã đặc tả sẵn kịch bản một chủ hai quán.

**Còn thiếu để thành tính năng chuỗi**

- Màn chuyển đổi cửa hàng đang làm việc trong ứng dụng POS.
- Báo cáo hợp nhất nhiều cửa hàng.
- Danh mục dùng chung giữa các cửa hàng.
- Quan hệ nhân viên làm ở nhiều cửa hàng.

Bốn việc đó nằm ở `add-multi-store-ownership` và `add-cross-store-reporting`. Không việc nào đòi sửa lược đồ đã dựng ở change này.

## Risks / Trade-offs

| Rủi ro | Giảm nhẹ |
| --- | --- |
| Store Key nằm lại trong hộp thư sau khi gửi | Giới hạn tần suất, không ghi vào nhật ký, email nhắc dùng chức năng cấp lại nếu nghi lộ. Quyết định 8 đã chấp nhận đánh đổi này |
| Mã một lần rơi vào thư rác thì không đăng nhập được, vì không có mật khẩu thay thế | Gửi qua SMTP của một tài khoản Gmail riêng của dự án, được Google ký DKIM trên `gmail.com`. Kiểm tra thực tế khả năng vào hộp thư chính trước ngày demo. Quyết định 15 mức 1 |
| Mất khóa mã hóa là mất khả năng khôi phục Store Key của mọi cửa hàng | Sao lưu khóa tách khỏi bản sao lưu database; cột phiên bản khóa cho phép xoay |
| Store Key rò rỉ thì ai cũng ghép được thiết bị | Chức năng cấp lại là biện pháp bù duy nhất. Quyết định 13 đã ghi nhận hạn chế này |
| Chủ mất hẳn quyền truy cập email thì cửa hàng kẹt | Đổi email chủ là biện pháp phòng ngừa. Lối thoát cuối thuộc `add-provider-admin-console`. Quyết định 17 |
| Thêm một thành phần triển khai mới, tăng bề mặt vận hành | Đặt trong cùng nền tảng backend đang dùng, không thêm nhà cung cấp thứ ba |

## Migration Plan

Không có bước chuyển đổi dữ liệu. Quyết định 9 chọn xóa sạch.

Trình tự bắt buộc:

1. Xác nhận rõ ràng từ chủ dự án. Không suy đoán.
2. Sao lưu toàn bộ database và kho ảnh.
3. Chạy migration lược đồ.
4. Xóa dữ liệu cũ.
5. Ghi lại thời điểm và phạm vi đã xóa.
6. Dựng lại dữ liệu demo theo `docs/demo-runbook.md`.
7. Chụp lại ảnh màn hình cho báo cáo nếu ảnh cũ không còn khớp.

Bước 1 và bước 2 là cổng chặn, không được bỏ qua.

## Open Questions

Không còn. 21 quyết định trong `proposal.md` đã phủ hết. Ba việc còn lại là việc thực hiện chứ không phải việc quyết:

- Dựng đường gửi email ở mức 1 của quyết định 15: tài khoản Gmail riêng của dự án, App Password, cấu hình SMTP tùy chỉnh.
- Nộp hồ sơ xin tên miền miễn phí để nâng lên mức 3. Không chặn tiến độ.
- Xin xác nhận của chủ dự án trước khi xóa dữ liệu cũ.
