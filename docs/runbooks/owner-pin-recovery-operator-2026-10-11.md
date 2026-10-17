# Công cụ operator khôi phục PIN owner — local candidate

Trạng thái 11/10/2026: source cục bộ theo PIN-D07, **chưa phát hành hoặc cho phép dùng trên đích hosted**. POS không có quyền gọi recovery. Chỉ operator hạ tầng có hồ sơ/kênh bàn giao đã xác minh được thực hiện UC-PIN-02.

## Chuẩn bị

1. Đối chiếu Store ID, Owner ID đang hoạt động, hồ sơ hỗ trợ và kênh nhận PIN ngoài ứng dụng. Ghi `operatorRef`, `caseRef`, `proofRef` 1–200 Unicode code points; các ref là mã bằng chứng, không chứa secret.
2. Hạ tầng cấp một login PostgreSQL riêng có quyền `SET ROLE pos_owner_recovery`; công cụ **không cấp role/grant**. Trên target chưa có membership phù hợp, startup hoặc thao tác phải thất bại an toàn. Không dùng `service_role`, token owner hay browser để gọi RPC.
3. Credential PostgreSQL nằm trong file riêng ngoài `D:/Workspace/pos-cafe` với quyền đọc chỉ cho operator. Cấu hình `OWNER_RECOVERY_DSN_FILE` trỏ tới file; `OWNER_RECOVERY_EXPECTED_HOST` phải khớp hostname DSN; `OWNER_RECOVERY_LAUNCH_CODE` là mã mở phiên bí mật dài tối thiểu 20 ký tự do kênh secret đã duyệt cung cấp; `OWNER_RECOVERY_PORT` tùy chọn, mặc định 5191. Không ghi giá trị bí mật vào repo, command history, screenshot, tài liệu hoặc báo cáo.
4. Chạy `node scripts/owner-recovery-operator.mjs` trong worktree `main`. Công cụ chỉ bind `127.0.0.1`, in URL loopback không secret. Nếu preflight role/target/config không đạt thì dừng bằng mã lỗi cố định. Mở URL đó trên cùng máy bằng profile operator đã tắt lưu mật khẩu/tự động điền; thuộc tính `autocomplete="off"` trên form không bảo đảm mọi browser/password manager đều tuân theo. Không proxy/public tunnel.

## Thao tác

1. Nhập mã mở phiên. Cookie HttpOnly/SameSite và CSRF của phiên có hạn 10 phút; code không nằm trong URL/storage.
2. Điền Store ID, Owner ID, ba refs và PIN tạm mới đúng 6 chữ số ASCII. Trang tự tạo requestId; giữ mã này trong hồ sơ ngoài app để đối chiếu. Tích xác nhận chỉ sau khi thật sự kiểm hồ sơ/đối tượng/kênh bàn giao.
3. Bấm **Phát hành PIN tạm** một lần. `applied` là transition mới: bàn giao bằng kênh đã xác minh, sau đó bấm **Đã bàn giao PIN · xóa khỏi trang**. `replayed` là receipt lịch sử, **không** xác nhận trạng thái owner hiện tại: kiểm tra trạng thái hiện tại trước mọi bàn giao, rồi bấm **Xóa PIN khỏi trang**. Khóa phiên khi xong. Công cụ không gửi PIN.
4. Nếu mất ACK hoặc backend trả `PERMISSION_UPDATE_UNAVAILABLE` khi trang còn mở, dùng **Thử lại cùng yêu cầu** với nguyên requestId/payload; không tự sinh PIN/ID mới. Nếu trang đã reload hoặc phiên mất, dừng và đối chiếu audit/hồ sơ trước một yêu cầu mới. `ADMIN_REQUEST_REUSED` nghĩa là ID đã dùng với payload khác; kiểm hồ sơ rồi mới tạo yêu cầu mới.

Backend chỉ trả outcome/dữ liệu whitelist hoặc mã và câu tiếng Việt trong design; không trả PIN, DB credential, hash hay raw SQL. Log process không in request body. Trang không dùng localStorage, sessionStorage, IndexedDB hoặc clipboard tự động. Bản local-only qua HTTP loopback vẫn dựa vào bảo vệ của máy operator và kênh secret; không phải dịch vụ công khai hoặc xác thực người dùng từ xa.

## Kiểm chứng và giới hạn

[TC18](../implementation-log/permission-pin-tc18-closeout-2026-10-11.md) ghi unit/core, Chromium desktop/mobile, PostgreSQL role/transition thật trên target cách ly, canary các sink và postflight. Trước khi dùng trên đích thật cần gate CLOSE-2/3, cấp login role theo chính sách hạ tầng, xác minh binding/backup/hồ sơ vận hành và review candidate cuối. Không chạy công cụ với DSN hosted chỉ vì source local đã PASS.
