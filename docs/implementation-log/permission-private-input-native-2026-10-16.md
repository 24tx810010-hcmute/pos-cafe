# Private inputs — kiểm ACL native và bản sửa v3, 16/10/2026

## Kết quả thực tế của lượt đã duyệt

Owner cho phép setup v2 và một probe READ ONLY có điều kiện qua câu trả lời `call_c5e5fed39d324541bc9680abb3fdf3d6`. Điều kiện là chỉ probe sau khi ba bản sao được xác minh; gặp lỗi thì dừng. Sau gián đoạn, root xác nhận chưa có thư mục đích, run03 hoặc process tương ứng trước khi gọi setup.

Setup v2 được gọi **một lần**, từ 11:17:38.7139829Z đến 11:17:39.3989965Z ngày 16/10/2026 (18:17 UTC+7), 685 ms, exit 1: **PRIVATE_COPY_FAILED / PRIVATE_COPY_REFUSED**. Source SHA256 `d328951b5e1762980ddb686dfd743640c5345ac79f9730eaa21f121d1ccfdd88` thuộc candidate v2 đã duyệt `274a5fe18e4c4fd1ef54f4bd8b1343f3dbb96f8302023fadf46dc5ab6aec1073`.

Receipt ghi createdDirectory=true, createdFiles=0, copiedFiles=0, credentialDecrypted=false, databaseConnected=false; **DB probe mới có 0 invocation**. Parent tool exit 0 chỉ có nghĩa lưu receipt thành công. Root dừng phần private theo điều kiện đã duyệt; không dùng lại lượt này để tự retry.

[run03](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03) giữ intent, marker trước invocation, setup-result và chẩn đoán metadata. Thư mục `D:/Workspace/pos-cafe-db-readonly-private` hiện **rỗng**, owner là current user, không reparse, ACL còn kế thừa (8 rules, 4 allow ngoài allowlist), chưa đủ điều kiện chứa private inputs. CreationTimeUtc `2026-10-16T11:17:39.2729671Z` được lưu để định danh cho đề xuất tiếp tục. Không có file private mới hoặc payload được lưu trong đó.

Setup v2 khóa, đọc và hash ba đầu vào trước bước tạo thư mục, theo thứ tự source; credential vẫn là bytes DPAPI mã hóa, chưa giải mã. Không nhận createdFiles=0 thành bằng chứng chưa đọc bytes nguồn. Chẩn đoán sau lỗi chỉ đọc metadata; không đổi ACL/owner bản gốc trên C, không copy, xóa, kết nối hoặc sửa database.

## Thực nghiệm native và giới hạn kết luận

Hai control dùng thư mục công khai mới dưới run03 và dữ liệu giả:

| Control | Kết quả | Giới hạn |
| --- | --- | --- |
| Trích đúng `New-ProtectedSecurity` của v2, descriptor có `SetOwner`, gọi native SetAccessControl trên thư mục rỗng | Bị từ chối: MethodInvocationException, inner UnauthorizedAccessException; ACL chưa protected | Đây là exception của control, không phải stage/exception được ghi trong lượt setup private |
| Descriptor chỉ đặt DACL, không SetOwner; native SetAccessControl rồi CreateNew file chứa `SYNTHETIC ACL TEST ONLY` | PASS; owner giữ current user; thư mục và file có protected ACL với 3 rules | Đây là dữ liệu giả; chưa chứng minh copy private hoặc probe DB |

Windows phân biệt quyền sửa DACL (`WRITE_DAC`) và đổi owner (`WRITE_OWNER`): [Microsoft Standard Access Rights](https://learn.microsoft.com/en-us/windows/win32/secauthz/standard-access-rights). Từ hai control, root suy luận yêu cầu ghi owner không cần thiết là nguyên nhân phù hợp với lỗi. Không khẳng định token thiếu privilege cụ thể hoặc stage/exception thật của setup v2: receipt v2 không thu các chi tiết đó.

Helper do agent chuẩn bị đã yêu cầu ghi owner dù thư mục mới đã thuộc current user. Bản sửa bỏ yêu cầu ghi owner, vẫn xác minh owner trước/sau; không elevation, takeown, đổi owner Windows hoặc nới private ACL.

`historical-command-provenance.json` lưu hồi cứu đúng ba public tool inputs gốc (setup v2 và hai control), timestamp/call ID, argv và cơ sở cwd. Không chạy lại các lệnh khi trích hồ sơ. Original control receipts chưa có descriptor/script hash tại thời điểm chạy; hồ sơ hồi cứu không giả thành hash được ghi đồng thời.

## Bản sửa local v3 và thẩm quyền

Gói [actor-probe-retry-v3](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3) đã hoàn thiện local, chờ review độc lập. Module DB, launcher và probe tests giữ nguyên bytes của v2. V3 chỉ tiếp tục đúng thư mục rỗng vừa tạo, không tạo/thay thế thư mục khác, không overwrite hoặc delete. [Assert-ResumeFacts/Assert-ResumeDirectory](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:79) kiểm exact path, creation timestamp, current owner, non-reparse và empty trước DACL; [ACL/CreateNew helpers](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:117) kiểm owner/protected ACL trước mọi payload.

Giữ [chính sách tổ tiên v2](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:48): current user/SYSTEM/Administrators, cùng ngoại lệ TrustedInstaller chỉ tại non-leaf directory đúng `C:\`. Private leaf và đích vẫn yêu cầu owner current user; ACL protected chỉ current user/SYSTEM/Administrators. Giữ ba input, size/hash pins, source locks, CreateNew và verify từng bản sao. [Coordinator](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-retry-v3/setup-private-inputs.ps1:11) thêm enum stage cố định để chẩn đoán lỗi mà không xuất exception/private values. Không đổi SQL, target, CA, DPAPI, scope hoặc output whitelist.

Phần chuẩn bị/test dùng public synthetic fixtures riêng dưới `run03/native-fixtures/<GUID>`; không thay đổi private target hoặc đọc nội dung private. Chỉ thử native ACL/CreateNew/hash với dữ liệu giả mới được ghi vào kết quả local. Native fixture phải dùng đúng helper functions được trích từ source v3, và ghi source/lệnh/kết quả để replay từ snapshot.

**Cần owner duyệt mới trước khi áp dụng v3**: quyền cũ dừng khi setup lỗi, probe chưa gọi. Đề xuất là tiếp tục thư mục rỗng đã định danh, xác minh ba bản sao, rồi đúng một probe READ ONLY nếu setup đạt. Chưa có quyền mới ở checkpoint này; không tự retry hoặc xóa partial outputs. Review local không cấp quyền thực thi private hay cập nhật Supabase.

## Kiểm chứng và tài nguyên

[v3-local-verification-01.json](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/v3-local-verification-01.json) gắn sáu source files, tổng 70.442 bytes, argv, TAP SHA, thời điểm 11:33:34Z–11:33:49Z, Node 24.16.0. **22/22 tests PASS, 0 fail/skip/cancel**: 21 fake/default/static và 1 native public fixture dùng đúng sáu ACL/hash helper functions trích từ setup v3. Hai PowerShell syntax checks PASS. Các ca giữ từ bộ v2 được điều chỉnh expected của coordinator v3; không gọi cả 19 ca đó là byte-identical hoặc cộng các lượt chạy thành ca mới.

Native fixture tạo hai file giả 48 logical bytes, kiểm owner/protected 3-rule ACL, copy/hash và CreateNew collision bị từ chối. Lần chạy trước đó được giữ ở GUID khác (tổng hai fixture, bốn file giả, 96 bytes tại thời điểm kiểm của tác giả); không xóa. Không lấy 6 metadata checks v2 thành native v3 PASS. Lịch sử giữ trong [hồ sơ v2](permission-private-input-setup-2026-10-16.md). Các control/fixtures không là DB integration tests.

Setup SHA256 `ff6d3904021f9560904680d6e8aba43735f93ba018e74c6fed87f318446618d8`; plan SHA256 `a3d2c95706624ed8e067f3e0ada690514e98c364f6a542071674aca66ba1ac67`; retry tests SHA256 `1426b28a9ec53983e9479c977511389c4e08fb533ce9341b04979c3c504c63e0`. Chưa chạy actual v3 `-Prepare` hoặc DB probe. Recipe: Node hiện có `D:/tools/nodejs/node.exe --max-old-space-size=512 --test --test-reporter=tap --test-concurrency=2`, truyền hai test files dưới v3; cwd `D:/Workspace/pos-cafe`. Snapshot phải có thêm original `actor-probe/actor-probe.mjs` để phép so sánh bytes chạy lại được; public native output luôn ghi ra fresh GUID bên ngoài snapshot.

Ba input giữ tổng 25.782 bytes; credential là DPAPI mã hóa, scope/CA được bảo vệ bằng ACL. Đề xuất private resume có phần tăng dưới 1 MiB trên D. Không cài công cụ/gói, WSL/Docker hoặc dùng dịch vụ trả phí. Node tests/probe giới hạn heap 512 MiB; test concurrency 2; probe tương lai một connection, process timeout 90 giây. Đây không phải quota RAM/CPU của hệ điều hành. Checkpoint local trước freeze: C trống 203.757.072.384 bytes, D trống 103.461.535.744 bytes; hai artifact roots online/inventory lần lượt 2.840.823 và 5.151.948 logical bytes, chưa bao gồm snapshot v3 và metadata review sẽ tạo. Allocation thực chưa đo; không nhận logical sum thành disk allocation. C/D vượt dự trữ 30 GiB; phải đo lại trước thao tác private tiếp theo.

## Ý nghĩa với push và báo cáo

Có thể báo cáo việc đã xác minh lỗi setup local, kiểm ACL native và chuẩn bị bản sửa có kiểm chứng khi review hoàn tất. **Chưa có actor/scope online PASS mới, chưa làm database tương thích contract 2**. Full backup/recovery, hosted profile/control, cutover và backend gates vẫn chưa hoàn tất; chưa đủ điều kiện phát hành chỉ từ các test này.

Không push main/docs, chạy CI, sửa Supabase, deploy Vercel hoặc xóa file. [Online gaps](permission-online-compatibility-2026-10-16.md) và [file inventory](permission-file-inventory-2026-10-16.md) vẫn là đầu vào cho các bước tiếp theo. Walkthrough local: lỗi v2 → empty target → hai native controls → DACL-only/owner verify → exact resume guards → review → chờ owner; chưa nhận owner đã đọc hoặc nghiệm thu.

## Metadata bàn giao sau review

**SEC và EVC cùng APPROVE candidate-01**, SHA256 `67281193ff5a77202b94354fda84e403ed816b253957935ac25e074008b3f70b`, 23 snapshot files/174.878 bytes, không finding chặn. [SEC review](permission-private-input-native-sec-review-2026-10-16.md), SHA `4a1aee4d309a574ba730c8f3bf21ac116b9a60c4fabd1050498d9720c85cdc16`; [EVC review](permission-private-input-native-evc-review-2026-10-16.md), SHA `c248bbd5abee1d630090c566c27934d690a20ef3d9c138a831094175d5b75104`. Phạm vi là hồ sơ v2 thất bại, native diagnosis và proposal local v3. Các câu chờ review trong nội dung freeze phía trên là trạng thái tại thời điểm khóa candidate; metadata này không đổi frozen source/expected hoặc mở quyền thực thi.

Root replay snapshot 22/22; EVC replay độc lập 22/22; SEC replay 4 ca quyết định. Hai reviewer đều kiểm syntax/default plans; không cộng các lần thành 48 ca hoặc nhận native fixture thành private/DB PASS. [Snapshot replay](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/snapshot-replay-01.json) và [closeout](D:/Workspace/pos-cafe/artifacts/permission-online-compatibility-20261016/actor-probe-run-03/closeout.json) giữ kiểm cuối. SHA index trong receipts là SHA của staged entries (`git ls-files --stage -z`), không SHA physical `.git/index`; staged entries/HEAD khớp baseline, cached diff rỗng. Private target vẫn rỗng, inherited 8 rules, owner/timestamp không đổi tại metadata checkpoint; chưa áp dụng v3.

Hoàn tất **bản sửa local và review**, chờ owner quyết định cho phép tiếp tục exact empty directory và một probe READ ONLY có điều kiện. Actual v3/copy/probe mới chưa chạy; database compatibility và push/release vẫn BLOCKED. Không tự retry hoặc xóa khi chờ câu trả lời.
