# Danh sách việc

Chia hai giai đoạn theo quyết định 18. Kết thúc giai đoạn 1 là một điểm dừng an toàn: hệ thống chạy đầy đủ và đã trả lời trọn vấn đề ai cũng tạo được cửa hàng. Phần thiếu duy nhất là khôi phục, mà hiện tại cũng chưa có, nên dừng ở đó không làm hệ thống tệ hơn trước.

Ánh xạ sang `docs/roadmap.md`: giai đoạn 1 là mục 5 (tuần 7–9), giai đoạn 2 là mục 6 (tuần 10).

---

# Giai đoạn 1 — Danh tính và gate tạo cửa hàng

## 1. Việc có thời gian chờ, khởi động sớm nhất có thể

- [ ] 1.1 Mua tên miền cho việc gửi email
- [ ] 1.2 Chọn nhà cung cấp gửi email theo bốn yêu cầu ở quyết định 15
- [ ] 1.3 Xác minh tên miền và cấu hình bản ghi xác thực người gửi
- [ ] 1.4 Gửi thử tới ít nhất một nhà cung cấp hộp thư phổ biến, xác nhận vào hộp thư chính chứ không vào thư rác
- [ ] 1.5 Ghi lại hạn mức gửi của gói đang dùng, đối chiếu với nhu cầu của giai đoạn phát triển và buổi demo

## 2. Lược đồ và migration

- [ ] 2.1 Thêm enum `store_status` gồm `active` và `suspended`
- [ ] 2.2 Thêm enum `store_admin_action` gồm sáu giá trị ở `design.md`
- [ ] 2.3 Thêm cột `owner_id` vào `stores`, kiểu `uuid not null references auth.users (id)`, **không** đặt ràng buộc duy nhất
- [ ] 2.4 Thêm cột `status` vào `stores`, bỏ cột `is_active`
- [ ] 2.5 Thêm cột `key_secret_encrypted` và `key_encryption_version` vào `stores`
- [ ] 2.6 Tạo bảng `store_admin_log` theo lược đồ ở `design.md`
- [ ] 2.7 Viết kiểm thử khẳng định không tồn tại ràng buộc duy nhất nào trên `stores.owner_id`

## 3. Chính sách bảo mật mức dòng

- [ ] 3.1 Bổ sung nhánh `owner_id = auth.uid()` trên `stores`, **không** kèm điều kiện trạng thái, để chủ đọc được cửa hàng đang bị tạm ngưng của mình
- [ ] 3.2 Bổ sung nhánh chủ ở mức đọc trên `store_settings`
- [ ] 3.3 Bổ sung nhánh chủ trên `store_admin_log`
- [ ] 3.4 Bổ sung nhánh chủ trên `employees` ở phạm vi đủ để đặt lại PIN vai trò `owner`
- [ ] 3.5 Thêm điều kiện `status = 'active'` vào chính sách của mọi bảng nghiệp vụ
- [ ] 3.6 Xác nhận nhánh thiết bị đã ghép giữ nguyên, không sửa một chữ nào
- [ ] 3.7 Kiểm thử: thiết bị của cửa hàng `suspended` gọi thẳng database bị trả về rỗng
- [ ] 3.8 Kiểm thử: chủ vẫn đọc được bản ghi và trạng thái của cửa hàng `suspended` của mình
- [ ] 3.9 Kiểm thử: chủ không đọc được cửa hàng của chủ khác

## 4. Hàm phía server

- [ ] 4.1 Dựng khung hàm tại `supabase/functions/`, gồm phần xác thực phiên chủ dùng chung
- [ ] 4.2 Khai báo hai biến môi trường: khóa quản trị nền tảng và khóa mã hóa Store Key
- [ ] 4.3 Viết tiện ích mã hóa và giải mã phần bí mật, có mang định danh phiên bản khóa
- [ ] 4.4 Cài giới hạn tần suất theo email và theo địa chỉ mạng, dùng các con số ở quyết định 20
- [ ] 4.5 Cài hạn mức 5 cửa hàng và 3 lần tạo mỗi ngày, đọc từ cấu hình chứ không phải hằng số trong mã
- [ ] 4.6 Hành động `createStore`: kiểm hạn mức, tạo service account, ghi `stores`, `store_settings`, nhân viên vai trò `owner`, trả Store Key một lần
- [ ] 4.7 Bảo đảm `createStore` chạy trọn vẹn hoặc không để lại gì; nếu nền tảng không gói được việc tạo tài khoản xác thực vào giao dịch thì tự dọn tài khoản đã tạo khi bước sau thất bại
- [ ] 4.8 Ghi `store_created` vào `store_admin_log`
- [ ] 4.9 Kiểm thử: hàm không bao giờ trả khóa quản trị hay khóa mã hóa ra ngoài
- [ ] 4.10 Kiểm thử: lỗi giữa chừng không để lại service account mồ côi

## 5. Ports và adapters

- [ ] 5.1 Thêm `IOwnerAccountPort` và `IStoreProvisioningPort` vào `src/ports`, khai bằng type của `domain`
- [ ] 5.2 Thêm type tương ứng vào `src/domain`
- [ ] 5.3 Hiện thực adapter Supabase gọi hàm phía server
- [ ] 5.4 Hiện thực adapter mock đủ để dựng mọi kịch bản mà không cần hàm thật
- [ ] 5.5 Nối hai port mới vào `AppPorts` và `src/app/runtimePorts.ts`
- [ ] 5.6 Chạy `src/architectureBoundaries.test.ts`, xác nhận không vi phạm ranh giới

## 6. Mặt web của chủ, phần giai đoạn 1

- [ ] 6.1 Màn nhập email
- [ ] 6.2 Màn nhập mã một lần, kèm xử lý hết hạn và quá số lần sai
- [ ] 6.3 Màn danh sách cửa hàng, hiển thị dạng danh sách kể cả khi chỉ có một dòng
- [ ] 6.4 Màn tạo cửa hàng: tên hiển thị bắt buộc, địa chỉ tùy chọn, PIN chủ quán
- [ ] 6.5 Thông báo khi chạm trần cửa hàng, kèm hướng dẫn liên hệ nhà cung cấp
- [ ] 6.6 Đăng xuất, và hết hạn phiên sau 7 ngày không dùng
- [ ] 6.7 Xác nhận mọi thao tác nhận định danh cửa hàng làm tham số, không suy ra cửa hàng duy nhất của chủ

## 7. Gỡ luồng tạo cửa hàng cũ

- [ ] 7.1 Gỡ luồng tạo cửa hàng phía client ở `src/app/screens/CreateStoreScreen.tsx`
- [ ] 7.2 Cập nhật `src/adapters/supabase/authRepo.ts` cho khớp hợp đồng mới
- [ ] 7.3 Xác nhận màn ghép thiết bị bằng Store Key giữ nguyên hành vi, theo quyết định 13
- [ ] 7.4 Cập nhật các kiểm thử đang dựa vào luồng tạo cửa hàng cũ

## 8. Cổng chặn — xóa dữ liệu cũ

> Không được vượt qua mục này nếu chưa đủ điều kiện. Đây là thao tác không hoàn tác được.

- [ ] 8.1 **Xin xác nhận rõ ràng của chủ dự án.** Không suy đoán, không mặc định là đã đồng ý
- [ ] 8.2 Sao lưu toàn bộ database
- [ ] 8.3 Sao lưu toàn bộ kho ảnh
- [ ] 8.4 Sao lưu khóa mã hóa Store Key, cất tách khỏi bản sao lưu database
- [ ] 8.5 Xóa dữ liệu cũ
- [ ] 8.6 Ghi lại thời điểm thực hiện và phạm vi đã xóa
- [ ] 8.7 Dựng lại dữ liệu demo theo `docs/demo-runbook.md`
- [ ] 8.8 Thông báo mọi Store Key hiện có đã mất hiệu lực và mọi thiết bị phải ghép lại

## 9. Kiểm thử giai đoạn 1

- [ ] 9.1 Đăng ký lần đầu và đăng nhập lần sau đi chung một luồng
- [ ] 9.2 Mã hết hạn sau 10 phút, hủy sau 5 lần nhập sai
- [ ] 9.3 Phản hồi giống hệt nhau cho email đã tồn tại và chưa tồn tại
- [ ] 9.4 Vượt giới hạn tần suất theo email và theo địa chỉ mạng đều bị chặn
- [ ] 9.5 Không có phiên chủ thì không tạo được cửa hàng
- [ ] 9.6 Chạm trần 5 cửa hàng và chạm giới hạn 3 lần mỗi ngày
- [ ] 9.7 Một chủ tạo được nhiều cửa hàng, và cả hai đều hiện trong danh sách
- [ ] 9.8 Kiểm thử smoke trên môi trường thật: tạo cửa hàng từ đầu tới lúc ghép được thiết bị

## 10. Tài liệu giai đoạn 1

- [ ] 10.1 Cập nhật `docs/requirements.md`: FR-01, FR-02, mở rộng phạm vi NFR-02
- [ ] 10.2 Cập nhật `docs/architecture.md`: thêm thành phần chạy phía server
- [ ] 10.3 Cập nhật `docs/data-model.md`: cột mới và bảng mới
- [ ] 10.4 Cập nhật `docs/screens.md`: mặt web của chủ
- [ ] 10.5 Cập nhật `docs/limitations.md`: rủi ro mất khóa mã hóa, và Store Key nằm lại trong hộp thư
- [ ] 10.6 Cập nhật `pos-cafe-context.md` và `docs/features.md`
- [ ] 10.7 Đánh dấu mục 5 trong `docs/roadmap.md` là đã xong, ghi ngày

---

# Giai đoạn 2 — Khôi phục và vòng đời quyền sở hữu

## 11. Quên Store Key

- [ ] 11.1 Hành động `forgotStoreKey` ở hàm phía server, **không** đòi phiên chủ
- [ ] 11.2 Luôn trả phản hồi chung chung, không tiết lộ email có tồn tại hay không
- [ ] 11.3 Giới hạn 3 lần mỗi giờ tính theo email
- [ ] 11.4 Dựng email liệt kê dạng danh sách: tên cửa hàng, địa chỉ lấy từ `store_settings`, Store Key
- [ ] 11.5 Thêm câu nhắc dùng chức năng cấp lại nếu nghi hộp thư đã bị lộ
- [ ] 11.6 Một thành phần giao diện dùng chung, gắn ở hai lối vào: màn ghép thiết bị và màn Cài đặt
- [ ] 11.7 Kiểm thử: Store Key và phần bí mật không xuất hiện trong bất kỳ nhật ký nào

## 12. Cấp lại Store Key

- [ ] 12.1 Hành động `regenerateStoreKey`, đòi phiên chủ
- [ ] 12.2 Lớp 1: cảnh báo nêu rõ hậu quả, nút xác nhận tách khỏi nút mở hộp thoại
- [ ] 12.3 Lớp 2: gõ lại đúng tên cửa hàng
- [ ] 12.4 Lớp 3: nhập mã một lần mới gửi tới email chủ
- [ ] 12.5 Sinh bí mật mới, đổi mật khẩu service account, mã hóa và ghi lại
- [ ] 12.6 Gửi email chứa key mới
- [ ] 12.7 Ghi `store_key_regenerated` vào nhật ký, không kèm giá trị key
- [ ] 12.8 Cảnh báo trên giao diện rằng thiết bị của chính chủ cũng sẽ bị đăng xuất
- [ ] 12.9 Xác nhận ứng dụng POS **không có** lối vào nào cho chức năng này
- [ ] 12.10 Kiểm thử: người ngồi vào phiên chủ bỏ ngỏ bị chặn ở lớp 3

## 13. Đặt lại PIN của vai trò chủ quán

- [ ] 13.1 Hành động `resetOwnerPin`, đòi phiên chủ kèm mã một lần
- [ ] 13.2 Giao diện đặt PIN mới trên mặt web
- [ ] 13.3 Chặn mọi vai trò khác tác động lên bản ghi nhân viên vai trò `owner`, kể cả vai trò có `employee.manage`
- [ ] 13.4 Ghi `owner_pin_reset` vào nhật ký
- [ ] 13.5 Kiểm thử: PIN mới có hiệu lực ngay trên thiết bị đã ghép

## 14. Đổi email chủ

- [ ] 14.1 Gửi mã xác nhận tới **địa chỉ mới**, không phải địa chỉ cũ
- [ ] 14.2 Từ chối nếu địa chỉ mới đã gắn với tài khoản chủ khác
- [ ] 14.3 Sau khi đổi, gửi thư thông báo về địa chỉ cũ
- [ ] 14.4 Ghi `owner_email_changed` vào nhật ký

## 15. Chuyển quyền sở hữu cửa hàng

- [ ] 15.1 Tạo bảng `store_ownership_transfer`
- [ ] 15.2 Hành động `startOwnershipTransfer`: ghi bản ghi chờ, gửi email mời tiếp nhận
- [ ] 15.3 Hành động `acceptOwnershipTransfer`: kiểm hạn mức người nhận trước
- [ ] 15.4 Đổi `owner_id` và gắn kết nhân viên vai trò `owner` **trong cùng một giao dịch**
- [ ] 15.5 Ghi `ownership_transferred` vào nhật ký
- [ ] 15.6 Kiểm thử: chưa xác thực tiếp nhận thì cửa hàng vẫn thuộc chủ cũ
- [ ] 15.7 Kiểm thử: người nhận đã đầy hạn mức thì bị từ chối
- [ ] 15.8 Kiểm thử: nhật ký cũ của cửa hàng không mất sau khi đổi chủ

## 16. Kiểm thử giai đoạn 2

- [ ] 16.1 Quên Store Key không làm thiết bị nào mất phiên
- [ ] 16.2 Cấp lại Store Key làm mọi thiết bị mất phiên, gồm cả thiết bị của chủ
- [ ] 16.3 Xoay khóa mã hóa: bản ghi mã hóa bằng khóa cũ vẫn giải mã được nhờ cột phiên bản
- [ ] 16.4 Kiểm thử smoke trên môi trường thật: quên key, cấp lại key, ghép lại thiết bị

## 17. Tài liệu giai đoạn 2

- [ ] 17.1 Cập nhật `docs/features.md` và `docs/screens.md` cho năm luồng khôi phục
- [ ] 17.2 Ghi quy trình xoay khóa mã hóa vào tài liệu vận hành
- [ ] 17.3 Cập nhật `docs/demo-runbook.md` với kịch bản demo phần khôi phục
- [ ] 17.4 Đánh dấu mục 6 trong `docs/roadmap.md` là đã xong, ghi ngày
- [ ] 17.5 Chạy `openspec archive add-owner-account-and-store-provisioning` sau khi cả hai giai đoạn xong
